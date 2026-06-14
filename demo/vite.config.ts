import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE_PATH || "/",
    server: {
      host: "0.0.0.0",
      port: 5174,
    },
    plugins: [llmInterpretationPlugin(env)],
  };
});

function llmInterpretationPlugin(env: Record<string, string>) {
  return {
    name: "llm-interpretation-api",
    configureServer(server: {
      middlewares: {
        use: (
          path: string,
          handler: (
            req: import("node:http").IncomingMessage,
            res: import("node:http").ServerResponse,
          ) => void,
        ) => void;
      };
    }) {
      const handler = async (
        req: import("node:http").IncomingMessage,
        res: import("node:http").ServerResponse,
      ) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        const proxyAccessKey = env.PROXY_ACCESS_KEY?.trim();

        if (
          proxyAccessKey &&
          req.headers["x-ziwei-proxy-key"] !== proxyAccessKey
        ) {
          sendJson(res, 401, { error: "Invalid backend access key" });
          return;
        }

        const apiKey =
          env.LLM_API_KEY || env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY;

        if (!apiKey) {
          sendJson(res, 500, {
            error:
              "Missing LLM_API_KEY. Create .env.local in the project root.",
          });
          return;
        }

        try {
          const body = await readJsonBody<{ prompt?: string }>(req);
          const prompt = body.prompt?.trim();

          if (!prompt) {
            sendJson(res, 400, { error: "Missing prompt" });
            return;
          }

          const response = await fetch(
            `${trimTrailingSlash(env.LLM_BASE_URL || env.DEEPSEEK_BASE_URL || "https://api.deepseek.com")}/chat/completions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model:
                  env.LLM_MODEL || env.DEEPSEEK_MODEL || "deepseek-v4-pro",
                messages: [
                  {
                    role: "system",
                    content:
                      "你负责把传统命理排盘解释成普通人能理解、可执行、不过度断言的中文报告。",
                  },
                  { role: "user", content: prompt },
                ],
                temperature: 0.5,
                stream: false,
              }),
            },
          );
          const responseText = await response.text();
          const data = parseJson(responseText);

          if (!response.ok) {
            sendJson(res, response.status, {
              error:
                data?.error?.message ||
                responseText ||
                "LLM API request failed",
              details: data || responseText.slice(0, 500),
            });
            return;
          }

          if (!data) {
            sendJson(res, 502, {
              error: "LLM API returned empty or invalid JSON",
              details: responseText.slice(0, 500),
            });
            return;
          }

          sendJson(res, 200, {
            model: data.model,
            content: data.choices?.[0]?.message?.content ?? "",
            usage: data.usage,
          });
        } catch (error) {
          sendJson(res, 500, {
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      };

      server.middlewares.use("/api/llm/interpret", handler);
      server.middlewares.use("/api/deepseek/interpret", handler);
    },
  };
}

function readJsonBody<T>(
  req: import("node:http").IncomingMessage,
): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = "";

    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
