const DEFAULT_ALLOWED_ORIGIN = "https://wqianv.github.io";
const DEFAULT_DEEPSEEK_BASE_URL = "https://api.deepseek.com";
const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-pro";

const systemPrompt =
  "你负责把传统命理排盘解释成普通人能理解、可执行、不过度断言的中文报告。";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    if (url.pathname !== "/api/deepseek/interpret") {
      return json({ error: "Not found" }, 404, request, env);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, request, env);
    }

    if (!isAllowedOrigin(request, env)) {
      return json({ error: "Origin not allowed" }, 403, request, env);
    }

    if (!env.DEEPSEEK_API_KEY) {
      return json({ error: "Missing DEEPSEEK_API_KEY" }, 500, request, env);
    }

    let body;

    try {
      body = await request.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400, request, env);
    }

    const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

    if (!prompt) {
      return json({ error: "Missing prompt" }, 400, request, env);
    }

    if (prompt.length > 30000) {
      return json({ error: "Prompt is too long" }, 413, request, env);
    }

    const deepSeekResponse = await fetch(
      `${trimTrailingSlash(env.DEEPSEEK_BASE_URL || DEFAULT_DEEPSEEK_BASE_URL)}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: env.DEEPSEEK_MODEL || body.model || DEFAULT_DEEPSEEK_MODEL,
          messages: [
            {
              role: "system",
              content: systemPrompt,
            },
            {
              role: "user",
              content: prompt,
            },
          ],
          temperature: 0.5,
          stream: false,
        }),
      },
    );
    const data = await deepSeekResponse.json();

    if (!deepSeekResponse.ok) {
      return json(
        {
          error: data?.error?.message || "DeepSeek API request failed",
          details: data,
        },
        deepSeekResponse.status,
        request,
        env,
      );
    }

    return json(
      {
        model: data.model,
        content: data.choices?.[0]?.message?.content ?? "",
        usage: data.usage,
      },
      200,
      request,
      env,
    );
  },
};

function handleOptions(request, env) {
  if (!isAllowedOrigin(request, env)) {
    return json({ error: "Origin not allowed" }, 403, request, env);
  }

  return new Response(null, {
    status: 204,
    headers: corsHeaders(request, env),
  });
}

function json(body, status, request, env) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...corsHeaders(request, env),
    },
  });
}

function corsHeaders(request, env) {
  const origin = request.headers.get("Origin");
  const fallbackOrigin = allowedOrigins(env)[0] || DEFAULT_ALLOWED_ORIGIN;
  const allowOrigin =
    origin && allowedOrigins(env).includes(origin) ? origin : fallbackOrigin;

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    Vary: "Origin",
  };
}

function isAllowedOrigin(request, env) {
  const origin = request.headers.get("Origin");

  if (!origin) {
    return true;
  }

  return allowedOrigins(env).includes(origin);
}

function allowedOrigins(env) {
  return (env.ALLOWED_ORIGIN || DEFAULT_ALLOWED_ORIGIN)
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
