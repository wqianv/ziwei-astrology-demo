# WeChat Mini Program Shell

This directory contains a WeChat Mini Program for the Ziwei astrology demo.
It keeps the `web-view` path for the备案 route and adds a native Mini Program
flow for the core chart and LLM report experience.

## What is included

- Native home page with entry actions.
- Native birth form, iztro-backed Ziwei/Four-Pillars summary, Worker-backed LLM
  request, and sectioned report display.
- Settings page for local backend access key management and launch-domain
  checklist.
- `web-view` page that opens the production H5 app for the complete Ziwei chart.
- Share entry through the home page and the web-view page.
- Compliance and usage-boundary page for review-friendly wording.

## Local setup

1. Open WeChat DevTools.
2. Import this directory: `miniprogram`.
3. Confirm `appid` in `project.config.json` matches the real Mini Program AppID.
4. Run the local Mini Program preflight:

   ```bash
   npm run mini:preflight
   ```

5. Run the home page, then open `设置与上线检查`.
6. Save the backend access key on the settings page.
7. Tap `打开原生排盘`, confirm the send-consent checkbox, and generate one
   native LLM report.

## Required WeChat platform settings

For the native LLM report flow, configure the request legal domain:

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

If备案 or account subject verification blocks `web-view`, the native flow can
still continue independently once the request legal domain is accepted. The H5
chart remains available as a richer visual reference and backup route.

## Native scope

The native page now bundles `iztro` into `miniprogram/vendor/iztro.js`, so it
can generate lunar dates, four pillars, Ziwei palaces, stars, and decadal ranges
without opening the H5 app:

1. Birth date, birth time, and gender input.
2. Local summary cards from the iztro astrolabe.
3. Native Ziwei twelve-palace list with main stars, support stars, and decadal
   ranges.
4. Explicit send-consent checkbox before the native LLM request; the consent
   flag is saved in local WeChat storage.
5. Backend access key managed on the settings page and saved in local WeChat
   storage.
6. `wx.request` to `https://api.tanxj.xyz/api/llm/interpret`.
7. Progress and error states for slow or blocked LLM requests.
8. Sectioned LLM report display.

Regenerate the vendor bundle after upgrading `iztro`:

```bash
npm run mini:vendor
```

Run this before a preview, upload, or review submission:

```bash
npm run mini:preflight
```

Generate a QR code for phone preview through WeChat DevTools:

```bash
npm run mini:preview
```

The QR image and preview metadata are written to `/tmp/ziwei-mini-devtools/`.
The command runs `mini:preflight` first, then calls the local WeChat DevTools
CLI with this Mini Program project.

Upload an experience-version draft only when you are ready to create a new
Mini Program backend draft:

```bash
npm run mini:upload -- --version 0.1.0 --desc "native iztro chart preview" --confirm-upload
```

The upload command also runs `mini:preflight` first and requires both a version
and description. It also requires `--confirm-upload` because it creates a new
draft in the WeChat Mini Program backend.

The native page still keeps the H5 entry because the web chart is more visual
and useful for cross-checking during the备案 path.

## Release checklist

- [x] Replace `touristappid` with the real AppID.
- [x] Configure `https://api.tanxj.xyz` as request legal domain.
- [x] Add a local Mini Program preflight script.
- [x] Add WeChat DevTools preview/upload helper scripts.
- [ ] Run `npm run mini:preflight` before preview/upload.
- [ ] Run `npm run mini:preview` and scan the QR code on a phone.
- [ ] Upload an experience-version draft with `npm run mini:upload -- --version <version> --desc <description> --confirm-upload`.
- [ ] Configure `https://www.tanxj.xyz` as web-view business domain.
- [ ] Add any WeChat domain verification file to the production H5 root if
      requested by the platform.
- [ ] Save the backend access key from `设置与上线检查`.
- [ ] Confirm the native send-consent checkbox before generating an LLM report.
- [ ] Re-test sharing from the home page, native page, and web-view page.
- [ ] Re-test the native LLM generation path inside WeChat DevTools and on a
      phone.
