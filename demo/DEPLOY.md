# GitHub Pages deployment

This demo can be deployed as a static GitHub Pages site.

## What works on GitHub Pages

- Zi Wei Dou Shu chart
- Ba Zi chart
- Local interpretation template
- Report section UI

## DeepSeek limitation

GitHub Pages cannot run the local `/api/deepseek/interpret` proxy because it is a static host.

Do not put `DEEPSEEK_API_KEY` in frontend variables. Instead, deploy a small serverless proxy, then add its URL as a repository variable:

```text
DEEPSEEK_PROXY_URL=https://your-proxy.example.com/api/deepseek/interpret
```

The GitHub Actions workflow passes it to the frontend as `VITE_DEEPSEEK_PROXY_URL`.

## Workflow

The workflow is in:

```text
.github/workflows/pages.yml
```

It builds `demo/` and uploads `demo/dist` to GitHub Pages.
