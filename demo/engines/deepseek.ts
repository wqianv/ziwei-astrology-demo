export type DeepSeekInterpretationResponse = {
  model?: string;
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
};

export async function requestDeepSeekInterpretation(
  prompt: string,
): Promise<DeepSeekInterpretationResponse> {
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

  return data;
}
