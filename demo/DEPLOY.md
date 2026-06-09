# GitHub Pages deployment

This demo can be deployed as a static GitHub Pages site.

## What works on GitHub Pages

- Zi Wei Dou Shu chart
- Ba Zi chart
- Local interpretation template
- Report section UI
- LLM interpretation through an OpenAI-compatible API when the user enters their
  own API key in the browser

## LLM modes

GitHub Pages cannot run the local `/api/llm/interpret` proxy because it is a
static host.

The demo supports two production modes:

1. User-owned key mode. The user enters an OpenAI-compatible API key, base URL,
   and model in the page. The key is stored only in that user's browser
   `localStorage` after a successful generation. It is not committed, uploaded
   to GitHub Pages, or sent to our backend.
2. Hosted proxy mode. Deploy a Cloudflare Worker and let the frontend call that
   endpoint. The worker requires a separate proxy access key, sent as
   `X-Ziwei-Proxy-Key`, before it will use our provider API key.

Do not put `LLM_API_KEY` or `PROXY_ACCESS_KEY` in frontend variables. Instead,
deploy a small serverless proxy, then add its URL as a repository variable:

```text
LLM_PROXY_URL=https://your-proxy.example.com/api/llm/interpret
```

The GitHub Actions workflow passes it to the frontend as `VITE_LLM_PROXY_URL`.

The repository includes a Cloudflare Workers scaffold in:

```text
backend/cloudflare-worker
```

Use it when we want the site to work without asking every user for their own
provider key.

Legacy `DEEPSEEK_PROXY_URL` is still supported while migrating.

## Workflow

The workflow is in:

```text
.github/workflows/pages.yml
```

It builds `demo/` and uploads `demo/dist` to GitHub Pages.
