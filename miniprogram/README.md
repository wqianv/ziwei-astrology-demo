# WeChat Mini Program Shell

This directory contains a WeChat Mini Program for the Ziwei astrology demo.
It keeps the `web-view` path for the备案 route and adds a native Mini Program
MVP for the core flow.

## What is included

- Native home page with entry actions.
- Native birth form, lightweight chart summary, Worker-backed LLM request, and
  sectioned report display.
- Settings page for local backend access key management and launch-domain
  checklist.
- `web-view` page that opens the production H5 app for the complete Ziwei chart.
- Share entry through the home page and the web-view page.
- Compliance and usage-boundary page for review-friendly wording.

## Local setup

1. Open WeChat DevTools.
2. Import this directory: `miniprogram`.
3. Replace `appid` in `project.config.json` with the real Mini Program AppID.
4. Run the home page, then open `设置与上线检查`.
5. Save the backend access key on the settings page.
6. Tap `打开原生排盘` and generate one native LLM report.

## Required WeChat platform settings

For the native MVP, configure the request legal domain:

```text
https://api.tanxj.xyz
```

For the retained `web-view`/备案 route, configure the Mini Program web-view
business domain in the WeChat public platform:

```text
https://www.tanxj.xyz
```

The H5 app calls the Worker at `https://api.tanxj.xyz` from inside the web-view.
Keep the Worker CORS allowlist aligned with the production frontend domain.
The native Mini Program request normally sends no browser `Origin`; the current
Worker accepts requests without an `Origin` header and still requires
`X-Ziwei-Proxy-Key`.

If备案 or account subject verification blocks `web-view`, the native MVP can
still continue independently once the request legal domain is accepted. The
complete Ziwei chart remains a later native component.

## Native MVP scope

The native page intentionally uses a lightweight Ganzhi/Five-Elements summary
to prove the Mini Program interaction loop first:

1. Birth date, birth time, and gender input.
2. Local summary cards.
3. Backend access key managed on the settings page and saved in local WeChat
   storage.
4. `wx.request` to `https://api.tanxj.xyz/api/llm/interpret`.
5. Progress and error states for slow or blocked LLM requests.
6. Sectioned LLM report display.

The exact Ziwei chart and refined lunar conversion are still provided by the
H5 web app and should be migrated as a later native module.

## Release checklist

- [ ] Replace `touristappid` with the real AppID.
- [ ] Configure `https://api.tanxj.xyz` as request legal domain.
- [ ] Configure `https://www.tanxj.xyz` as web-view business domain.
- [ ] Add any WeChat domain verification file to the production H5 root if
      requested by the platform.
- [ ] Save the backend access key from `设置与上线检查`.
- [ ] Re-test sharing from the home page, native page, and web-view page.
- [ ] Re-test the native LLM generation path inside WeChat DevTools and on a
      phone.
