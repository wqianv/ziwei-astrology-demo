const DEFAULT_ALLOWED_ORIGIN = "https://wqianv.github.io";
const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com";
const DEFAULT_LLM_MODEL = "deepseek-v4-pro";
const DEFAULT_JOB_TTL_SECONDS = 24 * 60 * 60;
const MAX_PROMPT_LENGTH = 30000;
const JOBS_PATH = "/api/llm/jobs";
const LEGACY_INTERPRET_PATHS = ["/api/llm/interpret", "/api/deepseek/interpret"];

const systemPrompt =
  "你负责把传统命理排盘解释成普通人能理解、可执行、不过度断言的中文报告。";

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const route = resolveRoute(url.pathname);

    if (request.method === "OPTIONS") {
      return handleOptions(request, env);
    }

    if (!route) {
      return json({ error: "Not found" }, 404, request, env);
    }

    if (!route.methods.includes(request.method)) {
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

    if (route.type === "interpret") {
      return handleInterpret(request, env);
    }

    if (route.type === "createJob") {
      return handleCreateJob(request, env, ctx);
    }

    return handleGetJob(route.jobId, request, env);
  },

  async queue(batch, env) {
    for (const message of batch.messages) {
      const body = message.body || {};
      const jobId = typeof body.jobId === "string" ? body.jobId : "";
      const prompt = typeof body.prompt === "string" ? body.prompt : "";

      if (!jobId || !prompt) {
        message.ack();
        continue;
      }

      await runInterpretJob(env, jobId, prompt);
      message.ack();
    }
  },
};

async function handleInterpret(request, env) {
  const promptResult = await readPrompt(request);

  if (!promptResult.ok) {
    return json(
      { error: promptResult.error },
      promptResult.status,
      request,
      env,
    );
  }

  try {
    const result = await requestLLM(env, promptResult.prompt);
    return json(result, 200, request, env);
  } catch (error) {
    return json(
      llmErrorBody(error),
      error.status || 500,
      request,
      env,
    );
  }
}

async function handleCreateJob(request, env, ctx) {
  if (!jobStore(env)) {
    return json({ error: "Missing LLM_JOBS KV binding" }, 500, request, env);
  }

  const promptResult = await readPrompt(request);

  if (!promptResult.ok) {
    return json(
      { error: promptResult.error },
      promptResult.status,
      request,
      env,
    );
  }

  const jobId = crypto.randomUUID();
  const createdAt = new Date().toISOString();
  const status = env.LLM_JOB_QUEUE ? "queued" : "running";
  const job = {
    id: jobId,
    status,
    createdAt,
    updatedAt: createdAt,
    model: providerModel(env),
  };

  await putJob(env, jobId, job);

  if (env.LLM_JOB_QUEUE) {
    try {
      await env.LLM_JOB_QUEUE.send({
        jobId,
        prompt: promptResult.prompt,
      });
    } catch (error) {
      await putJob(env, jobId, {
        ...job,
        status: "error",
        error: error.message || "Failed to enqueue job",
        updatedAt: new Date().toISOString(),
      });
      return json({ error: "Failed to enqueue job" }, 500, request, env);
    }
  } else {
    ctx.waitUntil(runInterpretJob(env, jobId, promptResult.prompt));
  }

  return json(
    {
      jobId,
      status,
      pollUrl: `${JOBS_PATH}/${jobId}`,
      expiresInSeconds: jobTtlSeconds(env),
    },
    202,
    request,
    env,
  );
}

async function handleGetJob(jobId, request, env) {
  if (!jobStore(env)) {
    return json({ error: "Missing LLM_JOBS KV binding" }, 500, request, env);
  }

  const job = await getJob(env, jobId);

  if (!job) {
    return json({ error: "Job not found" }, 404, request, env);
  }

  return json(
    {
      ...job,
      retryAfterSeconds: retryAfterSeconds(job.status),
    },
    200,
    request,
    env,
  );
}

async function runInterpretJob(env, jobId, prompt) {
  const existing = await getJob(env, jobId);
  const baseJob = existing || {
    id: jobId,
    createdAt: new Date().toISOString(),
    model: providerModel(env),
  };

  await putJob(env, jobId, {
    ...baseJob,
    status: "running",
    updatedAt: new Date().toISOString(),
  });

  try {
    const result = await requestLLM(env, prompt);

    await putJob(env, jobId, {
      ...baseJob,
      status: "done",
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      model: result.model,
      content: result.content,
      usage: result.usage,
    });
  } catch (error) {
    await putJob(env, jobId, {
      ...baseJob,
      status: "error",
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: error.message || "LLM API request failed",
      errorStatus: error.status || 500,
    });
  }
}

async function requestLLM(env, prompt) {
  const apiKey = providerApiKey(env);

  if (!apiKey) {
    const error = new Error("Missing LLM_API_KEY");
    error.status = 500;
    throw error;
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
  const responseText = await llmResponse.text();
  const data = parseJson(responseText);

  if (!llmResponse.ok) {
    const error = new Error(
      data?.error?.message || responseText || "LLM API request failed",
    );
    error.status = llmResponse.status;
    error.details = data || responseText.slice(0, 500);
    throw error;
  }

  return {
    model: data?.model,
    content: data?.choices?.[0]?.message?.content ?? "",
    usage: data?.usage,
  };
}

async function readPrompt(request) {
  let body;

  try {
    body = await request.json();
  } catch {
    return {
      ok: false,
      status: 400,
      error: "Invalid JSON body",
    };
  }

  const prompt = typeof body.prompt === "string" ? body.prompt.trim() : "";

  if (!prompt) {
    return {
      ok: false,
      status: 400,
      error: "Missing prompt",
    };
  }

  if (prompt.length > MAX_PROMPT_LENGTH) {
    return {
      ok: false,
      status: 413,
      error: "Prompt is too long",
    };
  }

  return {
    ok: true,
    prompt,
  };
}

function resolveRoute(pathname) {
  if (LEGACY_INTERPRET_PATHS.includes(pathname)) {
    return {
      type: "interpret",
      methods: ["POST"],
    };
  }

  if (pathname === JOBS_PATH) {
    return {
      type: "createJob",
      methods: ["POST"],
    };
  }

  const jobPrefix = `${JOBS_PATH}/`;

  if (pathname.startsWith(jobPrefix)) {
    const jobId = decodeURIComponent(pathname.slice(jobPrefix.length));

    if (/^[a-f0-9-]{16,80}$/i.test(jobId)) {
      return {
        type: "getJob",
        methods: ["GET"],
        jobId,
      };
    }
  }

  return null;
}

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
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
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

function jobStore(env) {
  return env.LLM_JOBS || env.ZIWEI_LLM_JOBS;
}

function jobKey(jobId) {
  return `llm-job:${jobId}`;
}

async function putJob(env, jobId, job) {
  await jobStore(env).put(jobKey(jobId), JSON.stringify(job), {
    expirationTtl: jobTtlSeconds(env),
  });
}

async function getJob(env, jobId) {
  const rawJob = await jobStore(env).get(jobKey(jobId));

  if (!rawJob) {
    return null;
  }

  return parseJson(rawJob);
}

function jobTtlSeconds(env) {
  const value = Number(env.LLM_JOB_TTL_SECONDS);

  if (!Number.isFinite(value)) {
    return DEFAULT_JOB_TTL_SECONDS;
  }

  return Math.min(7 * 24 * 60 * 60, Math.max(10 * 60, Math.floor(value)));
}

function retryAfterSeconds(status) {
  if (status === "queued") {
    return 3;
  }

  if (status === "running") {
    return 5;
  }

  return 0;
}

function llmErrorBody(error) {
  return {
    error: error.message || "LLM API request failed",
    details: error.details,
  };
}

function parseJson(value) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function trimTrailingSlash(value) {
  return value.replace(/\/+$/, "");
}
