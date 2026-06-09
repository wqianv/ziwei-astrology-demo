const DEFAULT_ALLOWED_ORIGIN = "https://wqianv.github.io";
const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com";
const DEFAULT_LLM_MODEL = "deepseek-v4-pro";

const systemPrompt =
  "你负责把传统命理排盘解释成普通人能理解、可执行、不过度断言的中文报告。";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    if (
      !["/api/llm/interpret", "/api/deepseek/interpret"].includes(
        url.pathname,
      )
    ) {
      return json({ error: "Not found" }, 404, request, env);
    }

    if (request.method !== "POST") {
      return json({ error: "Method not allowed" }, 405, request, env);
    }

    if (!isAllowedOrigin(request, env)) {
      return json({ error: "Origin not allowed" }, 403, request, env);
    }

    const accessCheck = validateProxyAccessKey(request, env);

    if (!accessCheck.ok) {
      return json(
        { error: accessCheck.error },
        accessCheck.status,
        request,
        env,
      );
    }

    const apiKey = providerApiKey(env);

    if (!apiKey) {
      return json({ error: "Missing LLM_API_KEY" }, 500, request, env);
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

    const llmResponse = await fetch(
      `${trimTrailingSlash(providerBaseUrl(env))}/chat/completions`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: providerModel(env),
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
    const data = await llmResponse.json();

    if (!llmResponse.ok) {
      return json(
        {
          error: data?.error?.message || "LLM API request failed",
          details: data,
        },
        llmResponse.status,
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
    "Access-Control-Allow-Headers": "Content-Type, X-Ziwei-Proxy-Key",
    Vary: "Origin",
  };
}

function validateProxyAccessKey(request, env) {
  const configuredAccessKey = env.PROXY_ACCESS_KEY?.trim();

  if (!configuredAccessKey) {
    return {
      ok: false,
      status: 500,
      error: "Missing PROXY_ACCESS_KEY",
    };
  }

  if (request.headers.get("X-Ziwei-Proxy-Key")?.trim() !== configuredAccessKey) {
    return {
      ok: false,
      status: 401,
      error: "Invalid backend access key",
    };
  }

  return { ok: true };
}

function providerApiKey(env) {
  return env.LLM_API_KEY || env.DEEPSEEK_API_KEY || env.OPENAI_API_KEY;
}

function providerBaseUrl(env) {
  return env.LLM_BASE_URL || env.DEEPSEEK_BASE_URL || DEFAULT_LLM_BASE_URL;
}

function providerModel(env) {
  return env.LLM_MODEL || env.DEEPSEEK_MODEL || DEFAULT_LLM_MODEL;
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
