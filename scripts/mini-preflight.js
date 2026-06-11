#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const miniprogramRoot = path.join(root, "miniprogram");
const results = [];

function main() {
  const appJson = readJson("miniprogram/app.json");
  const projectConfig = readJson("miniprogram/project.config.json");
  const packageJson = readJson("package.json");
  const config = require(path.join(miniprogramRoot, "config"));

  checkProjectConfig(projectConfig);
  checkDomains(config);
  checkPages(appJson);
  checkNativeFlow();
  checkWebviewFlow(config);
  checkComplianceCopy();
  checkVendorBundle();
  checkPackageScripts(packageJson);
  checkTrackedSensitiveFiles();
  checkSourcePackageSize();

  printResults();
}

function checkProjectConfig(projectConfig) {
  passIf(
    projectConfig.compileType === "miniprogram",
    "project.config.json uses miniprogram compileType",
    `Unexpected compileType: ${projectConfig.compileType}`,
  );
  passIf(
    projectConfig.miniprogramRoot === "./",
    "project.config.json miniprogramRoot points to ./",
    `Unexpected miniprogramRoot: ${projectConfig.miniprogramRoot}`,
  );
  passIf(
    isRealAppId(projectConfig.appid),
    `Project AppID is configured: ${projectConfig.appid}`,
    "Project AppID is missing or still set to a tourist/test value",
  );
  passIf(
    projectConfig.setting && projectConfig.setting.urlCheck === true,
    "WeChat URL check is enabled for release-like builds",
    "WeChat URL check is disabled; release testing may miss legal-domain issues",
    "warn",
  );
}

function checkDomains(config) {
  passIf(
    isHttpsUrl(config.REQUEST_DOMAIN),
    `Request domain is HTTPS: ${config.REQUEST_DOMAIN}`,
    "REQUEST_DOMAIN must be an HTTPS origin",
  );
  passIf(
    isHttpsUrl(config.SITE_URL),
    `Web-view site URL is HTTPS: ${config.SITE_URL}`,
    "SITE_URL must be an HTTPS origin",
  );
  passIf(
    config.API_URL === `${config.REQUEST_DOMAIN}/api/llm/interpret`,
    `LLM API URL is aligned: ${config.API_URL}`,
    "API_URL should be REQUEST_DOMAIN + /api/llm/interpret",
  );
  passIf(
    config.WEBVIEW_DOMAIN === config.SITE_URL,
    "WEBVIEW_DOMAIN matches SITE_URL",
    "WEBVIEW_DOMAIN should match SITE_URL",
  );
}

function checkPages(appJson) {
  const expectedPages = [
    "pages/home/home",
    "pages/native/native",
    "pages/settings/settings",
    "pages/webview/webview",
    "pages/compliance/compliance",
  ];

  expectedPages.forEach((page) => {
    passIf(
      (appJson.pages || []).includes(page),
      `app.json includes ${page}`,
      `app.json is missing ${page}`,
    );

    ["js", "json", "wxml", "wxss"].forEach((extension) => {
      const file = `miniprogram/${page}.${extension}`;
      passIf(fileExists(file), `${file} exists`, `${file} is missing`);
    });
  });
}

function checkNativeFlow() {
  const nativeJs = readText("miniprogram/pages/native/native.js");
  const nativeWxml = readText("miniprogram/pages/native/native.wxml");
  const reportJs = readText("miniprogram/utils/report.js");

  passIf(
    nativeJs.includes("buildNativeProfile") && nativeJs.includes("generateReport"),
    "Native page contains chart generation and LLM report flow",
    "Native page is missing chart generation or LLM report flow",
  );
  passIf(
    nativeJs.includes("LLM_CONSENT_STORAGE") &&
      nativeJs.includes("handleConsentChange") &&
      nativeWxml.includes("checkbox-group"),
    "Native LLM request requires explicit send consent",
    "Native LLM request consent checkbox or handler is missing",
  );
  passIf(
    nativeWxml.includes("chart-board") && nativeWxml.includes("selected-palace"),
    "Native page renders the Ziwei board and selected palace details",
    "Native Ziwei board or selected palace details are missing",
  );
  passIf(
    reportJs.includes("compactProfileForPrompt") &&
      !buildPromptContainsBoardCells(reportJs),
    "LLM prompt compacts UI-only board data",
    "LLM prompt may include UI-only board data",
    "warn",
  );
}

function checkWebviewFlow(config) {
  const webviewWxml = readText("miniprogram/pages/webview/webview.wxml");
  const webviewJs = readText("miniprogram/pages/webview/webview.js");

  passIf(
    webviewWxml.includes("<web-view"),
    "Retained备案 route has a web-view page",
    "web-view route is missing",
  );
  passIf(
    webviewJs.includes("SITE_URL") && isHttpsUrl(config.SITE_URL),
    "web-view route is constrained to SITE_URL",
    "web-view route should use SITE_URL",
  );
}

function checkComplianceCopy() {
  const compliance = readText("miniprogram/pages/compliance/compliance.wxml");

  passIf(
    compliance.includes("不构成确定性判断") &&
      compliance.includes("重大决策") &&
      compliance.includes("发送确认"),
    "Compliance page covers boundary, major decisions, privacy, and send consent",
    "Compliance page should mention boundary, major decisions, privacy, and send consent",
  );
}

function checkVendorBundle() {
  const vendor = "miniprogram/vendor/iztro.js";
  const size = fileExists(vendor) ? fs.statSync(path.join(root, vendor)).size : 0;

  passIf(fileExists(vendor), "Bundled iztro vendor exists", "Bundled iztro vendor is missing");
  passIf(
    size > 100 * 1024,
    `Bundled iztro vendor has expected size: ${formatBytes(size)}`,
    `Bundled iztro vendor looks too small: ${formatBytes(size)}`,
  );
  passIf(
    size < 1024 * 1024,
    `Bundled iztro vendor is within a conservative size budget: ${formatBytes(size)}`,
    `Bundled iztro vendor is large: ${formatBytes(size)}`,
    "warn",
  );
}

function checkPackageScripts(packageJson) {
  const scripts = packageJson.scripts || {};

  passIf(Boolean(scripts["mini:vendor"]), "package.json has mini:vendor", "package.json missing mini:vendor");
  passIf(Boolean(scripts["mini:preflight"]), "package.json has mini:preflight", "package.json missing mini:preflight");
}

function checkTrackedSensitiveFiles() {
  const trackedFiles = gitLsFiles();
  const forbidden = trackedFiles.filter((file) =>
    isTrackedDotenvSecret(file) ||
    file === "miniprogram/project.private.config.json",
  );

  passIf(
    forbidden.length === 0,
    "No dotenv or WeChat private project config is tracked by Git",
    `Sensitive local files are tracked: ${forbidden.join(", ")}`,
  );
}

function isTrackedDotenvSecret(file) {
  if (!/^\.env($|\.)/.test(file)) {
    return false;
  }

  return !file.endsWith(".example");
}

function checkSourcePackageSize() {
  const bytes = directorySize(miniprogramRoot, (file) =>
    !file.endsWith("project.private.config.json"),
  );

  passIf(
    bytes < 2 * 1024 * 1024,
    `Mini Program source package is comfortably below 2 MB: ${formatBytes(bytes)}`,
    `Mini Program source package is near or above 2 MB: ${formatBytes(bytes)}`,
    "warn",
  );
}

function buildPromptContainsBoardCells(reportJs) {
  return /JSON\.stringify\(profile/.test(reportJs) || /boardCells/.test(reportJs);
}

function readJson(relativePath) {
  return JSON.parse(readText(relativePath));
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function fileExists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function isRealAppId(value) {
  return /^wx[a-z0-9]{16}$/i.test(String(value || "")) &&
    value !== "touristappid";
}

function isHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "https:";
  } catch (error) {
    return false;
  }
}

function gitLsFiles() {
  try {
    return execFileSync("git", ["ls-files"], {
      cwd: root,
      encoding: "utf8",
    })
      .split(/\r?\n/)
      .filter(Boolean);
  } catch (error) {
    addResult("warn", "Could not run git ls-files; skipped tracked sensitive file check");
    return [];
  }
}

function directorySize(directory, includeFile) {
  let total = 0;

  fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => {
    const fullPath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      total += directorySize(fullPath, includeFile);
      return;
    }

    if (entry.isFile() && includeFile(fullPath)) {
      total += fs.statSync(fullPath).size;
    }
  });

  return total;
}

function formatBytes(bytes) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}

function passIf(condition, passMessage, failMessage, failLevel = "fail") {
  addResult(condition ? "pass" : failLevel, condition ? passMessage : failMessage);
}

function addResult(level, message) {
  results.push({ level, message });
}

function printResults() {
  const counts = results.reduce(
    (accumulator, result) => {
      accumulator[result.level] += 1;
      return accumulator;
    },
    { pass: 0, warn: 0, fail: 0 },
  );

  results.forEach((result) => {
    const prefix = result.level === "pass" ? "PASS" : result.level === "warn" ? "WARN" : "FAIL";
    console.log(`${prefix} ${result.message}`);
  });

  console.log("");
  console.log(
    `Mini Program preflight: ${counts.pass} passed, ${counts.warn} warning(s), ${counts.fail} failed.`,
  );

  if (counts.fail > 0) {
    process.exitCode = 1;
  }
}

main();
