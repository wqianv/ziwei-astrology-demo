# OpenAI-compatible LLM proxy on Cloudflare Workers

This worker provides a small serverless proxy for GitHub Pages.

## Why Cloudflare Workers

- Free tier is enough for an early demo.
- No server to maintain.
- Provider API keys can be stored as encrypted Worker secrets.
- A separate proxy access key blocks casual public use of our backend.
- The frontend can call a same-purpose HTTPS endpoint from GitHub Pages.

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

Optional variables:

```bash
npx wrangler secret put ALLOWED_ORIGIN
npx wrangler secret put LLM_BASE_URL
npx wrangler secret put LLM_MODEL
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

After deployment, copy the worker URL and add it as a GitHub repository
variable:

```text
LLM_PROXY_URL=https://your-worker.your-subdomain.workers.dev/api/llm/interpret
```

Then run the GitHub Pages workflow again.

## Notes

- Do not put `LLM_API_KEY` in any `VITE_*` frontend variable.
- Do not put `PROXY_ACCESS_KEY` in any `VITE_*` frontend variable. The user
  enters it in the browser and it is sent as `X-Ziwei-Proxy-Key`.
- Keep `ALLOWED_ORIGIN` set to the GitHub Pages origin, for example
  `https://wqianv.github.io`.
- The browser-key mode does not need this worker. This worker is for the
  "use our backend proxy" mode.
- Legacy `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, `DEEPSEEK_MODEL`, and
  `DEEPSEEK_PROXY_URL` names are still supported for migration.
