import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    base: env.VITE_BASE_PATH || "/",
    server: {
      host: "0.0.0.0",
      port: 5174,
    },
    plugins: [deepSeekInterpretationPlugin(env)],
  };
});

function deepSeekInterpretationPlugin(env: Record<string, string>) {
  return {
    name: "deepseek-interpretation-api",
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
      server.middlewares.use("/api/deepseek/interpret", async (req, res) => {
        if (req.method !== "POST") {
          sendJson(res, 405, { error: "Method not allowed" });
          return;
        }

        const apiKey = env.DEEPSEEK_API_KEY;

        if (!apiKey) {
          sendJson(res, 500, {
            error:
              "Missing DEEPSEEK_API_KEY. Create .env.local in the project root.",
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
            `${env.DEEPSEEK_BASE_URL || "https://api.deepseek.com"}/chat/completions`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
              },
              body: JSON.stringify({
                model: env.DEEPSEEK_MODEL || "deepseek-v4-flash",
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
          const data = await response.json();

          if (!response.ok) {
            sendJson(res, response.status, {
              error: data?.error?.message || "DeepSeek API request failed",
              details: data,
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
      });
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

function sendJson(
  res: import("node:http").ServerResponse,
  status: number,
  body: unknown,
) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}
