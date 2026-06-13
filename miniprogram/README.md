# WeChat Mini Program Shell

This directory contains a WeChat Mini Program for the Ziwei astrology demo.
It keeps the `web-view` path for the备案 route and adds a native Mini Program
flow for the core chart and LLM report experience.

## What is included

- Native home page with entry actions.
- Native birth form, iztro-backed Ziwei/Four-Pillars summary, Worker-backed LLM
  request, and sectioned report display.
- Settings page for local backend access key management and launch-domain
  checklist, plus a minimal backend connectivity test.
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
7. Tap `测试后端连接` to verify the request legal domain, backend access key,
   Worker, and model link.
8. If the backend test fails on a phone, tap `复制诊断信息`. The copied text does
   not include the backend access key.
9. Use `清除本机数据` on the settings page when you need to reset local key,
   birth profile, consent, and latest report cache.
10. Tap `打开原生排盘`, confirm the send-consent checkbox, and generate one
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

1. Birth date, birth time, and gender input, saved in local WeChat storage with
   a reset action.
2. Local summary cards from the iztro astrolabe.
3. Native Ziwei twelve-palace list with main stars, support stars, and decadal
   ranges.
4. Explicit send-consent checkbox before the native LLM request; the consent
   flag is saved in local WeChat storage.
5. Backend access key managed on the settings page and saved in local WeChat
   storage.
6. Background LLM job submission through
   `https://api.tanxj.xyz/api/llm/jobs`, with local polling and restore after
   returning to the page.
7. Progress and error states for slow, queued, or blocked LLM jobs.
8. Sectioned LLM report display.
9. Latest LLM report cached in local WeChat storage for the same birth profile,
   with a clear action on the native page. The cache does not store the backend
   access key.
10. Copy action for the latest native LLM report, including a usage-boundary
    note and no backend access key.

Regenerate the vendor bundle after upgrading `iztro`:

```bash
npm run mini:vendor
```

Print the current project-internal readiness gates and the remaining manual
review gates:

```bash
npm run mini:readiness
```

Check the public H5 and Worker domains before review/upload:

```bash
npm run mini:domain-check
```

Run this before a preview, upload, or review submission:

```bash
npm run mini:preflight
```

Run the broader release gate before creating an experience-version draft:

```bash
npm run mini:release-check -- --require-clean
```

This runs the readiness report, Mini Program preflight, builds the retained
H5/备案 route, checks that the Git worktree is clean, and prints the remaining
manual gates. Add `--with-domain-check` when you also want to verify the public
H5 and Worker domains in the same release gate:

```bash
npm run mini:release-check -- --require-clean --with-domain-check
```

Generate a QR code for phone preview through WeChat DevTools:

```bash
npm run mini:preview
```

The QR image and preview metadata are written to `/tmp/ziwei-mini-devtools/`.
Override the directory with `MINI_ARTIFACT_DIR` or `--artifact-dir <path>`.
The command runs `mini:readiness` and `mini:preflight` first, then calls the
local WeChat DevTools CLI with this Mini Program project.

Generate a local, secret-free phone QA record after creating a preview QR:

```bash
npm run mini:phone-qa
```

The record is written to `/tmp/ziwei-mini-devtools/phone-qa-*.md` and pre-fills
the current Git commit plus the latest preview QR path. It is a local testing
artifact; do not paste backend access keys, model API keys, or other secrets
into it.

Upload an experience-version draft only when you are ready to create a new
Mini Program backend draft:

```bash
npm run mini:upload -- --version 0.1.0 --desc "native iztro chart preview" --confirm-upload
```

The upload command runs `mini:release-check -- --require-clean` first and
requires both a version and description. It also requires `--confirm-upload`
because it creates a new draft in the WeChat Mini Program backend. Add
`--with-domain-check` when the upload should also verify the public H5 and
Worker domains before creating the draft:

```bash
npm run mini:upload -- --version 0.1.0 --desc "native iztro chart preview" --confirm-upload --with-domain-check
```

Before submitting for review, copy the version description, review comment, and
reviewer test path from `REVIEW_NOTES.md`.
After scanning a preview QR or opening an experience version, record the real
phone QA result in `PHONE_QA.md`.

The native page still keeps the H5 entry because the web chart is more visual
and useful for cross-checking during the备案 path.

## Current verification snapshot

As of 2026-06-12 on `main`:

- `npm run mini:preflight` passes with 80 checks.
- `npm run mini:readiness` passes all project-internal gates.
- `npm run mini:domain-check` confirms the H5 domain returns HTTPS 200 and the
  Worker route returns HTTP 401 without the backend access key.
- `npm run demo:build` passes for the retained H5/备案 route.
- `npm run mini:release-check -- --require-clean` passes locally.
- `npm run mini:preview` generated a WeChat preview package of about 540 KB.
- `npm run mini:phone-qa` generates a local real-device QA record with the
  latest preview QR path and no secrets.
- GitHub Actions workflow `Build demo and mini program` passed for `main`.
- `PHONE_QA.md` is available as the real-device QA record template.
- `https://www.tanxj.xyz/` resolves through Cloudflare and returns HTTPS 200.
- `https://api.tanxj.xyz/api/llm/interpret` and
  `https://api.tanxj.xyz/api/llm/jobs` resolve through Cloudflare and return
  HTTP 401 without `X-Ziwei-Proxy-Key`, which confirms the Worker routes are
  reachable and key-protected.

The latest local preview QR is written under:

```text
/tmp/ziwei-mini-devtools/preview-*.png
```

The preview command prints the exact QR and metadata paths after it succeeds.

## Release checklist

- [x] Replace `touristappid` with the real AppID.
- [x] Configure `https://api.tanxj.xyz` as request legal domain.
- [x] Add a local Mini Program preflight script.
- [x] Add a public domain check script for the H5 and Worker domains.
- [x] Add a combined Mini Program release-check script.
- [x] Add WeChat DevTools preview/upload helper scripts.
- [x] Add WeChat review notes for version description, review comments, and
      reviewer test path.
- [x] Add phone QA record template for preview or experience-version testing.
- [x] Run `npm run mini:preflight` before preview/upload.
- [x] Run `npm run mini:release-check` before upload.
- [x] Run `npm run mini:domain-check` before review/upload when domain state may
      have changed.
- [x] Run `npm run mini:preview` and generate a preview QR code.
- [x] Add `npm run mini:phone-qa` for local real-device QA records.
- [ ] Scan the preview QR code on a phone.
- [ ] Upload an experience-version draft with `npm run mini:upload -- --version <version> --desc <description> --confirm-upload`.
- [ ] Configure `https://www.tanxj.xyz` as web-view business domain.
- [ ] Add any WeChat domain verification file to the production H5 root if
      requested by the platform.
- [ ] Save the backend access key from `设置与上线检查`.
- [ ] Run `测试后端连接` successfully on a phone.
- [ ] Confirm `清除本机数据` removes local key, birth profile, send consent, and
      latest report cache.
- [ ] Confirm birth date, birth time, and gender restore after reopening and can
      be reset locally.
- [ ] Confirm the native send-consent checkbox before generating an LLM report.
- [ ] Confirm the latest native LLM report restores after reopening the same
      birth profile and can be cleared locally.
- [ ] Confirm the native LLM report can be copied and does not include the
      backend access key.
- [ ] Re-test sharing from the home page, native page, and web-view page.
- [ ] Re-test the native LLM generation path inside WeChat DevTools and on a
      phone.

## Phone QA checklist

Run this after scanning a preview QR or opening an experience version:

- Home page opens and the three action buttons are aligned.
- Native chart page opens without horizontal scrolling.
- Birth date, birth time, and gender changes refresh the local summary cards.
- Birth date, birth time, and gender restore after reopening, and `重置出生信息`
  clears the local saved profile.
- The 4x4 Ziwei board fits the phone width and palace selection updates the
  detail card.
- Settings page saves and clears the backend access key locally.
- Settings page backend test succeeds, or shows a readable domain/key/network
  error.
- Settings page can copy diagnostic text without including the backend access
  key.
- Settings page `清除本机数据` resets local key, birth profile, send consent, and
  latest report cache.
- LLM generation stays disabled until both the key is saved and the send-consent
  checkbox is selected.
- Slow LLM requests show progress text, and a successful response fills the
  sectioned report cards.
- Reopening the same birth profile restores the latest local LLM report, and
  `清除本机解读` removes it.
- `复制解读` copies the sectioned report with a usage-boundary note and no
  backend access key.
- Web-view entry opens `https://www.tanxj.xyz` after the business domain is
  accepted by WeChat.
