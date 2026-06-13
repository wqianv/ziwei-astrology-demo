# OpenAI-compatible LLM proxy on Cloudflare Workers

This worker provides a small serverless proxy for the H5 app and Mini Program.
It keeps the legacy synchronous interpretation endpoint and also supports
background jobs for slower model calls.

## Why Cloudflare Workers

- Free tier is enough for an early demo.
- No server to maintain.
- Provider API keys can be stored as encrypted Worker secrets.
- A separate proxy access key blocks casual public use of our backend.
- The Mini Program public entry can use a rate-limited job endpoint without
  asking ordinary users to paste the backend key.
- Admin stats expose public usage, failures, invalid keys, and rate-limit
  counts for the management page.
- The frontend can call a same-purpose HTTPS endpoint from GitHub Pages.
- Mini Program LLM generation can be submitted as a background job and polled
  later instead of holding one long local request open.

## Deploy

Install Wrangler and log in:

```bash
npm create cloudflare@latest
npx wrangler login
```

From this folder, set the provider API key and proxy access key:

```bash
npx wrangler secret put LLM_API_KEY
npx wrangler secret put PROXY_ACCESS_KEY
```

Create the job storage and queue once, then paste the returned KV namespace ID
into `wrangler.jsonc`:

```bash
npx wrangler kv namespace create LLM_JOBS
npx wrangler queues create ziwei-llm-jobs
```

Optional variables:

```bash
npx wrangler secret put ALLOWED_ORIGIN
npx wrangler secret put LLM_BASE_URL
npx wrangler secret put LLM_MODEL
```

Public Mini Program limits can be tuned in `wrangler.jsonc`:

```text
PUBLIC_HOURLY_LIMIT=3
PUBLIC_DAILY_LIMIT=8
PUBLIC_IP_DAILY_LIMIT=60
```

`LLM_BASE_URL` must be an OpenAI-compatible API base URL. The worker calls:

```text
{LLM_BASE_URL}/chat/completions
```

DeepSeek example:

```text
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-pro
```

Deploy:

```bash
npx wrangler deploy
```

After deployment, the protected endpoints are:

```text
POST /api/llm/interpret
POST /api/llm/jobs
GET  /api/llm/jobs/{jobId}
GET  /api/admin/stats
```

The public Mini Program endpoints are:

```text
POST /api/llm/public/jobs
GET  /api/llm/public/jobs/{jobId}
```

## Notes

- Do not put `LLM_API_KEY` in any `VITE_*` frontend variable.
- Do not put `PROXY_ACCESS_KEY` in any `VITE_*` frontend variable. Protected
  management and legacy endpoints send it as `X-Ziwei-Proxy-Key`; the public
  Mini Program endpoint uses `X-Ziwei-Client-Id` plus rate limits instead.
- Keep `ALLOWED_ORIGIN` set to the public origins, for example
  `https://wqianv.github.io,https://tanxj.xyz,https://www.tanxj.xyz`.
- The browser-key mode does not need this worker. This worker is for the
  "use our backend proxy" mode.
- Job metadata/results are kept in KV for `LLM_JOB_TTL_SECONDS` seconds
  (default: 24 hours). The prompt is sent to the queue but is not stored in KV.
- Usage counters are stored in the same KV namespace by hour, day, and total.
  The public endpoint uses KV counters for lightweight abuse protection.
- Legacy `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, and
  `DEEPSEEK_PROXY_URL` names are still supported for migration.
