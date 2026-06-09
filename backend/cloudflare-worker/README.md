# DeepSeek proxy on Cloudflare Workers

This worker provides a small serverless proxy for GitHub Pages.

## Why Cloudflare Workers

- Free tier is enough for an early demo.
- No server to maintain.
- API keys can be stored as encrypted Worker secrets.
- The frontend can call a same-purpose HTTPS endpoint from GitHub Pages.

## Deploy

Install Wrangler and log in:

```bash
npm create cloudflare@latest
npx wrangler login
```

From this folder, set the secret:

```bash
npx wrangler secret put DEEPSEEK_API_KEY
```

Optional variables:

```bash
npx wrangler secret put ALLOWED_ORIGIN
npx wrangler secret put DEEPSEEK_BASE_URL
npx wrangler secret put DEEPSEEK_MODEL
```

Deploy:

```bash
npx wrangler deploy
```

After deployment, copy the worker URL and add it as a GitHub repository
variable:

```text
DEEPSEEK_PROXY_URL=https://your-worker.your-subdomain.workers.dev/api/deepseek/interpret
```

Then run the GitHub Pages workflow again.

## Notes

- Do not put `DEEPSEEK_API_KEY` in any `VITE_*` frontend variable.
- Keep `ALLOWED_ORIGIN` set to the GitHub Pages origin, for example
  `https://wqianv.github.io`.
- The browser-key mode does not need this worker. This worker is for the
  "use our backend proxy" mode.
