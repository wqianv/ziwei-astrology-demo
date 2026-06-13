const DEFAULT_ALLOWED_ORIGIN = "https://wqianv.github.io";
const DEFAULT_LLM_BASE_URL = "https://api.deepseek.com";
const DEFAULT_LLM_MODEL = "deepseek-v4-pro";
const DEFAULT_JOB_TTL_SECONDS = 24 * 60 * 60;
const MAX_PROMPT_LENGTH = 30000;
const JOBS_PATH = "/api/llm/jobs";
const PUBLIC_JOBS_PATH = "/api/llm/public/jobs";
const ADMIN_STATS_PATH = "/api/admin/stats";
const LEGACY_INTERPRET_PATHS = ["/api/llm/interpret", "/api/deepseek/interpret"];
const DEFAULT_PUBLIC_HOURLY_LIMIT = 3;
const DEFAULT_PUBLIC_DAILY_LIMIT = 8;
const DEFAULT_PUBLIC_IP_DAILY_LIMIT = 60;
const METRIC_FIELDS = [
  "adminStats",
  "completedJobs",
  "createJob",
  "failedJobs",
  "invalidKey",
  "llmError",
  "publicCreateJob",
  "publicGetJob",
  "promptTokens",
  "rateLimited",
  "syncInterpret",
  "completionTokens",
  "totalTokens",
];

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

    if (!route.public) {
      const accessCheck = validateProxyAccessKey(request, env);

      if (!accessCheck.ok) {
        ctx.waitUntil(trackMetric(env, "invalidKey"));
        return json(
          { error: accessCheck.error },
          accessCheck.status,
          request,
          env,
        );
      }
    }

    if (route.type === "interpret") {
      return handleInterpret(request, env, ctx);
    }

    if (route.type === "createJob") {
      return handleCreateJob(request, env, ctx, route);
    }

    if (route.type === "getJob") {
      return handleGetJob(route.jobId, request, env, route);
    }

    return handleAdminStats(request, env, ctx);
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

async function handleInterpret(request, env, ctx) {
  ctx.waitUntil(trackMetric(env, "syncInterpret"));
  const promptResult = await readPrompt(request);

  if (!promptResult.ok) {
    ctx.waitUntil(trackMetric(env, "failedJobs"));
    return json(
      { error: promptResult.error },
      promptResult.status,
      request,
      env,
    );
  }

  try {
    const result = await requestLLM(env, promptResult.prompt);
    ctx.waitUntil(trackUsage(env, result.usage));
    return json(result, 200, request, env);
  } catch (error) {
    ctx.waitUntil(trackMetric(env, "llmError"));
    return json(
      llmErrorBody(error),
      error.status || 500,
      request,
      env,
    );
  }
}

async function handleCreateJob(request, env, ctx, route) {
  if (!jobStore(env)) {
    return json({ error: "Missing LLM_JOBS KV binding" }, 500, request, env);
  }

  const isPublic = route.public === true;
  const client = isPublic ? await publicClient(request) : null;

  if (isPublic && !client.clientId) {
    ctx.waitUntil(trackMetric(env, "failedJobs"));
    return json({ error: "Missing client id" }, 400, request, env);
  }

  if (isPublic) {
    const rateLimit = await checkPublicRateLimit(env, client);

    if (!rateLimit.ok) {
      ctx.waitUntil(Promise.all([
        trackMetric(env, "rateLimited"),
        setLastEvent(env, "rateLimited", {
          at: new Date().toISOString(),
          clientHash: client.clientHash,
          reason: rateLimit.reason,
        }),
      ]));
      return json(
        {
          error: "Rate limit exceeded",
          reason: rateLimit.reason,
          limit: rateLimit.limit,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        },
        429,
        request,
        env,
      );
    }
  }

  const promptResult = await readPrompt(request);

  if (!promptResult.ok) {
    ctx.waitUntil(trackMetric(env, "failedJobs"));
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
  const channel = isPublic ? "public" : "admin";
  const job = {
    id: jobId,
    status,
    createdAt,
    updatedAt: createdAt,
    model: providerModel(env),
    channel,
    clientHash: client?.clientHash,
  };

  await putJob(env, jobId, job);
  ctx.waitUntil(trackMetric(env, isPublic ? "publicCreateJob" : "createJob"));

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
      ctx.waitUntil(trackMetric(env, "failedJobs"));
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

async function handleGetJob(jobId, request, env, route) {
  if (!jobStore(env)) {
    return json({ error: "Missing LLM_JOBS KV binding" }, 500, request, env);
  }

  const job = await getJob(env, jobId);

  if (!job) {
    return json({ error: "Job not found" }, 404, request, env);
  }

  if (route.public === true) {
    const client = await publicClient(request);

    if (!client.clientId || job.clientHash !== client.clientHash) {
      return json({ error: "Job not found" }, 404, request, env);
    }

    await trackMetric(env, "publicGetJob");
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
    channel: "admin",
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
    await Promise.all([
      trackMetric(env, "completedJobs"),
      trackUsage(env, result.usage),
      setLastEvent(env, "completedJob", {
        at: new Date().toISOString(),
        channel: baseJob.channel || "admin",
        jobId,
        model: result.model,
      }),
    ]);
  } catch (error) {
    await putJob(env, jobId, {
      ...baseJob,
      status: "error",
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      error: error.message || "LLM API request failed",
      errorStatus: error.status || 500,
    });
    await Promise.all([
      trackMetric(env, "failedJobs"),
      trackMetric(env, "llmError"),
      setLastEvent(env, "failedJob", {
        at: new Date().toISOString(),
        channel: baseJob.channel || "admin",
        jobId,
        status: error.status || 500,
        message: error.message || "LLM API request failed",
      }),
    ]);
  }
}

async function handleAdminStats(request, env, ctx) {
  if (!jobStore(env)) {
    return json({ error: "Missing LLM_JOBS KV binding" }, 500, request, env);
  }

  ctx.waitUntil(trackMetric(env, "adminStats"));
  const now = new Date();
  const [today, currentHour, total, lastCompleted, lastFailed, lastRateLimited] =
    await Promise.all([
      readMetricBucket(env, "day", dayKey(now)),
      readMetricBucket(env, "hour", hourKey(now)),
      readMetricBucket(env, "total", "all"),
      getLastEvent(env, "completedJob"),
      getLastEvent(env, "failedJob"),
      getLastEvent(env, "rateLimited"),
    ]);

  return json(
    {
      generatedAt: now.toISOString(),
      limits: {
        publicHourly: publicHourlyLimit(env),
        publicDaily: publicDailyLimit(env),
        publicIpDaily: publicIpDailyLimit(env),
      },
      today,
      currentHour,
      total,
      last: {
        completedJob: lastCompleted,
        failedJob: lastFailed,
        rateLimited: lastRateLimited,
      },
      jobTtlSeconds: jobTtlSeconds(env),
    },
    200,
    request,
    env,
  );
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
  if (pathname === ADMIN_STATS_PATH) {
    return {
      type: "adminStats",
      methods: ["GET"],
      public: false,
    };
  }

  if (LEGACY_INTERPRET_PATHS.includes(pathname)) {
    return {
      type: "interpret",
      methods: ["POST"],
      public: false,
    };
  }

  if (pathname === JOBS_PATH) {
    return {
      type: "createJob",
      methods: ["POST"],
      public: false,
    };
  }

  if (pathname === PUBLIC_JOBS_PATH) {
    return {
      type: "createJob",
      methods: ["POST"],
      public: true,
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
        public: false,
      };
    }
  }

  const publicJobPrefix = `${PUBLIC_JOBS_PATH}/`;

  if (pathname.startsWith(publicJobPrefix)) {
    const jobId = decodeURIComponent(pathname.slice(publicJobPrefix.length));

    if (/^[a-f0-9-]{16,80}$/i.test(jobId)) {
      return {
        type: "getJob",
        methods: ["GET"],
        jobId,
        public: true,
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
    "Access-Control-Allow-Headers": "Content-Type, X-Ziwei-Client-Id, X-Ziwei-Proxy-Key",
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

async function publicClient(request) {
  const rawClientId = String(request.headers.get("X-Ziwei-Client-Id") || "").trim();
  const clientId = /^mini-[a-z0-9-]{8,100}$/i.test(rawClientId) ? rawClientId : "";
  const ip =
    request.headers.get("CF-Connecting-IP") ||
    request.headers.get("X-Forwarded-For") ||
    "";

  return {
    clientId,
    clientHash: clientId ? await sha256Hex(`client:${clientId}`) : "",
    ipHash: ip ? await sha256Hex(`ip:${String(ip).split(",")[0].trim()}`) : "",
  };
}

async function checkPublicRateLimit(env, client) {
  const now = new Date();
  const checks = [
    {
      key: `rate:client:hour:${hourKey(now)}:${client.clientHash}`,
      limit: publicHourlyLimit(env),
      reason: "client-hour",
      retryAfterSeconds: secondsUntilNextHour(now),
      ttl: 3 * 60 * 60,
    },
    {
      key: `rate:client:day:${dayKey(now)}:${client.clientHash}`,
      limit: publicDailyLimit(env),
      reason: "client-day",
      retryAfterSeconds: secondsUntilNextDay(now),
      ttl: 3 * 24 * 60 * 60,
    },
  ];

  if (client.ipHash) {
    checks.push({
      key: `rate:ip:day:${dayKey(now)}:${client.ipHash}`,
      limit: publicIpDailyLimit(env),
      reason: "ip-day",
      retryAfterSeconds: secondsUntilNextDay(now),
      ttl: 3 * 24 * 60 * 60,
    });
  }

  for (const check of checks) {
    const count = await incrementKvNumber(env, check.key, check.ttl);

    if (count > check.limit) {
      return {
        ok: false,
        ...check,
        count,
      };
    }
  }

  return { ok: true };
}

async function trackMetric(env, metric, amount = 1) {
  if (!jobStore(env) || !Number.isFinite(Number(amount))) {
    return;
  }

  const now = new Date();
  await Promise.all([
    addMetricValue(env, "total", "all", metric, amount),
    addMetricValue(env, "day", dayKey(now), metric, amount),
    addMetricValue(env, "hour", hourKey(now), metric, amount),
  ]);
}

async function trackUsage(env, usage = {}) {
  const tasks = [];

  if (Number.isFinite(Number(usage.prompt_tokens))) {
    tasks.push(trackMetric(env, "promptTokens", Number(usage.prompt_tokens)));
  }

  if (Number.isFinite(Number(usage.completion_tokens))) {
    tasks.push(trackMetric(env, "completionTokens", Number(usage.completion_tokens)));
  }

  if (Number.isFinite(Number(usage.total_tokens))) {
    tasks.push(trackMetric(env, "totalTokens", Number(usage.total_tokens)));
  }

  await Promise.all(tasks);
}

async function readMetricBucket(env, scope, bucket) {
  const entries = await Promise.all(
    METRIC_FIELDS.map(async (metric) => [
      metric,
      await readKvNumber(env, metricKey(scope, bucket, metric)),
    ]),
  );

  return Object.fromEntries(entries);
}

async function addMetricValue(env, scope, bucket, metric, amount) {
  await incrementKvNumber(
    env,
    metricKey(scope, bucket, metric),
    metricTtlSeconds(scope),
    Number(amount),
  );
}

async function incrementKvNumber(env, key, ttlSeconds, amount = 1) {
  const nextValue = (await readKvNumber(env, key)) + amount;
  const options = ttlSeconds ? { expirationTtl: ttlSeconds } : undefined;

  await jobStore(env).put(key, String(nextValue), options);
  return nextValue;
}

async function readKvNumber(env, key) {
  const raw = await jobStore(env).get(key);
  const value = Number(raw);

  return Number.isFinite(value) ? value : 0;
}

async function setLastEvent(env, name, value) {
  if (!jobStore(env)) {
    return;
  }

  await jobStore(env).put(`stats:last:${name}`, JSON.stringify(value), {
    expirationTtl: 30 * 24 * 60 * 60,
  });
}

async function getLastEvent(env, name) {
  if (!jobStore(env)) {
    return null;
  }

  return parseJson(await jobStore(env).get(`stats:last:${name}`));
}

function metricKey(scope, bucket, metric) {
  return `stats:${scope}:${bucket}:${metric}`;
}

function metricTtlSeconds(scope) {
  if (scope === "hour") {
    return 14 * 24 * 60 * 60;
  }

  if (scope === "day") {
    return 90 * 24 * 60 * 60;
  }

  return undefined;
}

function dayKey(date) {
  return date.toISOString().slice(0, 10);
}

function hourKey(date) {
  return date.toISOString().slice(0, 13);
}

function secondsUntilNextHour(date) {
  const next = new Date(date);
  next.setUTCMinutes(60, 0, 0);
  return Math.max(60, Math.ceil((next.getTime() - date.getTime()) / 1000));
}

function secondsUntilNextDay(date) {
  const next = new Date(Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate() + 1,
    0,
    0,
    0,
  ));
  return Math.max(60, Math.ceil((next.getTime() - date.getTime()) / 1000));
}

function publicHourlyLimit(env) {
  return positiveInt(env.PUBLIC_HOURLY_LIMIT, DEFAULT_PUBLIC_HOURLY_LIMIT);
}

function publicDailyLimit(env) {
  return positiveInt(env.PUBLIC_DAILY_LIMIT, DEFAULT_PUBLIC_DAILY_LIMIT);
}

function publicIpDailyLimit(env) {
  return positiveInt(env.PUBLIC_IP_DAILY_LIMIT, DEFAULT_PUBLIC_IP_DAILY_LIMIT);
}

function positiveInt(value, fallback) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
}

async function sha256Hex(value) {
  const buffer = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(value),
  );

  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, 24);
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
