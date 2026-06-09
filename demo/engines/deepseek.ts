export type DeepSeekInterpretationResponse = {
  model?: string;
  content: string;
  source?: "browser" | "proxy";
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export type DeepSeekInterpretationRequest =
  | {
      mode: "browser";
      prompt: string;
      apiKey: string;
      model: string;
      baseUrl?: string;
    }
  | {
      mode: "proxy";
      prompt: string;
    };

const deepSeekSystemPrompt =
  "你负责把传统命理排盘解释成普通人能理解、可执行、不过度断言的中文报告。";

export async function requestDeepSeekInterpretation(
  request: DeepSeekInterpretationRequest,
): Promise<DeepSeekInterpretationResponse> {
  if (request.mode === "browser") {
    return requestDeepSeekFromBrowser(request);
  }

  const endpoint =
    import.meta.env.VITE_DEEPSEEK_PROXY_URL || "/api/deepseek/interpret";

  if (
    endpoint === "/api/deepseek/interpret" &&
    window.location.hostname.endsWith("github.io")
  ) {
    throw new Error(
      "GitHub Pages 是静态部署，无法运行本地 DeepSeek 代理。请配置 VITE_DEEPSEEK_PROXY_URL 指向外部代理。",
    );
  }

  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(data.error || "DeepSeek request failed");
  }

  return { ...data, source: "proxy" };
}

async function requestDeepSeekFromBrowser({
  apiKey,
  baseUrl,
  model,
  prompt,
}: Extract<DeepSeekInterpretationRequest, { mode: "browser" }>) {
  const key = apiKey.trim();

  if (!key) {
    throw new Error("请输入 DeepSeek API Key，或配置后端代理。");
  }

  const endpoint = `${trimTrailingSlash(
    baseUrl || "https://api.deepseek.com",
  )}/chat/completions`;

  let response: Response;

  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: model.trim() || "deepseek-v4-pro",
        messages: [
          {
            role: "system",
            content: deepSeekSystemPrompt,
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.5,
        stream: false,
      }),
    });
  } catch (error) {
    throw new Error(
      error instanceof TypeError
        ? "浏览器直连 DeepSeek 失败，可能是网络或 CORS 限制。可以稍后重试，或改用我们搭的后端代理。"
        : "DeepSeek request failed",
    );
  }

  const data = await response.json();

  if (!response.ok) {
    throw new Error(data?.error?.message || "DeepSeek request failed");
  }

  return {
    model: data.model,
    content: data.choices?.[0]?.message?.content ?? "",
    usage: data.usage,
    source: "browser" as const,
  };
}

function trimTrailingSlash(value: string) {
  return value.replace(/\/+$/, "");
}
