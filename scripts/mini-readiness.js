#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const miniprogramRoot = path.join(root, "miniprogram");

function main() {
  const appJson = readJson("miniprogram/app.json");
  const projectConfig = readJson("miniprogram/project.config.json");
  const packageJson = readJson("package.json");
  const config = require(path.join(miniprogramRoot, "config"));

  const projectGates = [
    {
      label: "Real Mini Program AppID is configured",
      passed: isRealAppId(projectConfig.appid),
      evidence: projectConfig.appid || "missing",
    },
    {
      label: "Native Mini Program route is present",
      passed: includesPage(appJson, "pages/native/native"),
      evidence: "pages/native/native",
    },
    {
      label: "Retained H5 filing route is present",
      passed: includesPage(appJson, "pages/webview/webview") && fileIncludes(
        "miniprogram/pages/webview/webview.wxml",
        "<web-view",
      ),
      evidence: "pages/webview/webview -> web-view",
    },
    {
      label: "Request domain and LLM endpoints are aligned",
      passed: config.API_URL === `${config.REQUEST_DOMAIN}/api/llm/interpret` &&
        config.LLM_JOB_URL === `${config.REQUEST_DOMAIN}/api/llm/jobs`,
      evidence: `${config.API_URL}, ${config.LLM_JOB_URL}`,
    },
    {
      label: "H5 domain is configured for the web-view path",
      passed: config.WEBVIEW_DOMAIN === config.SITE_URL && isHttpsUrl(config.SITE_URL),
      evidence: config.WEBVIEW_DOMAIN,
    },
    {
      label: "Release checks and DevTools helpers are wired",
      passed: Boolean(packageJson.scripts["mini:preflight"]) &&
        Boolean(packageJson.scripts["mini:domain-check"]) &&
        Boolean(packageJson.scripts["mini:release-check"]) &&
        Boolean(packageJson.scripts["mini:preview"]) &&
        Boolean(packageJson.scripts["mini:upload"]),
      evidence: "mini:domain-check, mini:preflight, mini:release-check, mini:preview, mini:upload",
    },
    {
      label: "Native privacy and consent controls are present",
      passed: fileIncludes("miniprogram/pages/native/native.js", "LLM_CONSENT_STORAGE") &&
        fileIncludes("miniprogram/pages/native/native.wxml", "checkbox-group") &&
        fileIncludes("miniprogram/pages/settings/settings.js", "clearLocalData"),
      evidence: "send consent, local storage, clear local data",
    },
    {
      label: "Native charting is bundled instead of web-view-only",
      passed: fileExists("miniprogram/vendor/iztro.js") &&
        fileIncludes("miniprogram/utils/nativeAstrology.js", "原生 iztro 排盘"),
      evidence: "vendor/iztro.js + nativeAstrology",
    },
  ];

  const manualGates = [
    `Run npm run mini:domain-check before review/upload if public domain state may have changed.`,
    `Scan the latest preview QR on a phone and run the Phone QA checklist.`,
    `Confirm ${config.REQUEST_DOMAIN} is accepted as a WeChat request legal domain.`,
    `Confirm ${config.WEBVIEW_DOMAIN} is accepted as a web-view business domain if keeping the H5 route in review.`,
    `Save the backend access key locally in the Mini Program settings page.`,
    `Run the settings page backend connectivity test on a phone.`,
    `Generate one native LLM report on a phone and verify restore, clear, and copy actions.`,
    `Upload an experience-version draft only with mini:upload and --confirm-upload.`,
  ];

  console.log("Mini Program readiness report\n");
  console.log("Project-internal gates:");
  projectGates.forEach((gate) => {
    console.log(`${gate.passed ? "PASS" : "FAIL"} ${gate.label}`);
    console.log(`     ${gate.evidence}`);
  });

  console.log("\nManual gates before review/upload:");
  manualGates.forEach((gate) => {
    console.log(`TODO ${gate}`);
  });

  const failed = projectGates.filter((gate) => !gate.passed);
  if (failed.length > 0) {
    console.error(`\nMini Program readiness: ${failed.length} project gate(s) failed.`);
    process.exit(1);
  }

  console.log("\nMini Program readiness: project-internal gates passed.");
}

function includesPage(appJson, page) {
  return Array.isArray(appJson.pages) && appJson.pages.includes(page);
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function fileIncludes(relativePath, pattern) {
  const absolutePath = path.join(root, relativePath);
  return fs.existsSync(absolutePath) &&
    fs.readFileSync(absolutePath, "utf8").includes(pattern);
}

function isHttpsUrl(value) {
  return typeof value === "string" && value.startsWith("https://");
}

function isRealAppId(value) {
  return /^wx[a-z0-9]{16,}$/i.test(value || "") && value !== "touristappid";
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(root, relativePath), "utf8"));
}

main();
