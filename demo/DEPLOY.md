# GitHub Pages deployment

This demo can be deployed as a static GitHub Pages site.

## What works on GitHub Pages

- Zi Wei Dou Shu chart
- Ba Zi chart
- Local interpretation template
- Report section UI
- DeepSeek interpretation when the user enters their own API key in the
  browser

## DeepSeek modes

GitHub Pages cannot run the local `/api/deepseek/interpret` proxy because it is
a static host.

The demo supports two production modes:

1. User-owned key mode. The user enters a DeepSeek API key in the page. The key
   is stored only in that user's browser `localStorage` after a successful
   generation. It is not committed, uploaded to GitHub Pages, or sent to our
   backend.
2. Hosted proxy mode. Deploy a small serverless proxy and let the frontend call
   that endpoint.

Do not put `DEEPSEEK_API_KEY` in frontend variables. Instead, deploy a small serverless proxy, then add its URL as a repository variable:

```text
DEEPSEEK_PROXY_URL=https://your-proxy.example.com/api/deepseek/interpret
```

The GitHub Actions workflow passes it to the frontend as `VITE_DEEPSEEK_PROXY_URL`.

The repository includes a Cloudflare Workers scaffold in:

```text
backend/cloudflare-worker
```

Use it when we want the site to work without asking every user for their own
DeepSeek key.

## Workflow

The workflow is in:

```text
.github/workflows/pages.yml
```

It builds `demo/` and uploads `demo/dist` to GitHub Pages.
