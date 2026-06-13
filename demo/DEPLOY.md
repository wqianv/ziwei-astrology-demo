# Cloudflare Pages deployment

The production demo is served from Cloudflare Pages instead of GitHub Pages.
GitHub remains the source repository, but Cloudflare handles the public site,
custom domain, and HTTPS certificate.

## Runtime shape

- Cloudflare Pages serves `demo/dist` for `tanxj.xyz` and `www.tanxj.xyz`.
- Cloudflare Worker serves `api.tanxj.xyz`.
- The Worker calls an OpenAI-compatible LLM provider and requires
  `X-Ziwei-Proxy-Key`.
- `https://www.tanxj.xyz/dashboard` renders the login-gated admin dashboard.

Cloudflare Pages must build with:

```text
VITE_LLM_PROXY_URL=https://api.tanxj.xyz/api/llm/interpret
VITE_WORKER_BASE_URL=https://api.tanxj.xyz
```

## Pages settings

```text
Production branch: main
Build command: npm ci --ignore-scripts && npm run demo:build
Build output directory: demo/dist
```

## Worker secrets

Do not put provider keys or proxy access keys in frontend variables. Keep them
only in Cloudflare Worker secrets:

```text
LLM_API_KEY=...
LLM_BASE_URL=https://api.deepseek.com
LLM_MODEL=deepseek-v4-pro
PROXY_ACCESS_KEY=...
ADMIN_USERNAME=...
ADMIN_PASSWORD=...
WECHAT_APP_ID=...
WECHAT_APP_SECRET=...
ADMIN_WECHAT_OPENIDS=...
ALLOWED_ORIGIN=https://tanxj.xyz,http://tanxj.xyz,https://www.tanxj.xyz,http://www.tanxj.xyz
```

Do not create `VITE_*` variables for admin passwords, Worker secrets, provider
keys, or WeChat secrets. The dashboard only stores the returned admin session
token in the browser.

Legacy `DEEPSEEK_API_KEY`, `DEEPSEEK_BASE_URL`, and `DEEPSEEK_MODEL` are still
supported by the Worker while migrating.
