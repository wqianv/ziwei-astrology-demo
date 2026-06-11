# WeChat Mini Program Shell

This directory contains a native WeChat Mini Program shell for the deployed
demo at `https://www.tanxj.xyz`.

## What is included

- Native home page with entry actions.
- `web-view` page that opens the production H5 app.
- Share entry through the home page and the web-view page.
- Compliance and usage-boundary page for review-friendly wording.

## Local setup

1. Open WeChat DevTools.
2. Import this directory: `miniprogram`.
3. Replace `appid` in `project.config.json` with the real Mini Program AppID.
4. Run the home page, then tap `打开排盘`.

## Required WeChat platform settings

Before submitting for review, configure the Mini Program web-view business
domain in the WeChat public platform:

```text
https://www.tanxj.xyz
```

The H5 app calls the Worker at `https://api.tanxj.xyz` from inside the web-view.
Keep the Worker CORS allowlist aligned with the production frontend domain.

If the account subject or domain verification does not allow `web-view`, the
fallback path is to rebuild the birth form and report pages as native Mini
Program pages, and keep the Ziwei chart as a later native component.

## Release checklist

- [ ] Replace `touristappid` with the real AppID.
- [ ] Configure `https://www.tanxj.xyz` as web-view business domain.
- [ ] Add any WeChat domain verification file to the production H5 root if
      requested by the platform.
- [ ] Re-test sharing from the home page and web-view page.
- [ ] Re-test the LLM generation path inside WeChat DevTools and on a phone.
