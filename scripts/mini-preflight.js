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
  checkSettingsFlow();
  checkNativeRuntimeSmoke();
  checkWebviewFlow(config);
  checkComplianceCopy();
  checkVendorBundle();
  checkPackageScripts(packageJson);
  checkDevToolsHelper(packageJson);
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

function checkSettingsFlow() {
  const settingsJs = readText("miniprogram/pages/settings/settings.js");
  const settingsWxml = readText("miniprogram/pages/settings/settings.wxml");

  passIf(
    settingsJs.includes("testBackend") &&
      settingsJs.includes("wx.request") &&
      settingsJs.includes("formatBackendTestError") &&
      settingsWxml.includes("测试后端连接"),
    "Settings page can test backend connectivity without exposing the key",
    "Settings page should include a backend connectivity test button and request flow",
  );
  passIf(
    settingsJs.includes("url not in domain list") &&
      settingsJs.includes("后端访问密钥不正确") &&
      settingsJs.includes("api.tanxj.xyz"),
    "Settings backend test explains domain, key, and network failures",
    "Settings backend test should translate common domain/key/network failures",
  );
}

function checkNativeRuntimeSmoke() {
  const {
    buildLocalCards,
    buildNativeProfile,
  } = require(path.join(miniprogramRoot, "utils/nativeAstrology"));
  const {
    buildPrompt,
    parseLLMReport,
    reportSections,
  } = require(path.join(miniprogramRoot, "utils/report"));
  const profile = buildNativeProfile({
    birthDate: "2003-10-12",
    birthTimeIndex: 1,
    gender: "male",
  });
  const boardCells = profile.ziwei && profile.ziwei.boardCells
    ? profile.ziwei.boardCells
    : [];
  const palaces = profile.ziwei && profile.ziwei.palaces
    ? profile.ziwei.palaces
    : [];
  const prompt = buildPrompt(profile);
  const parsedReport = parseLLMReport(buildSampleMarkdownReport(reportSections));

  passIf(
    profile.ziwei && profile.ziwei.status === "原生 iztro 排盘",
    "Runtime smoke uses bundled iztro rather than fallback charting",
    "Runtime smoke fell back instead of using bundled iztro",
  );
  passIf(
    profile.birth && profile.birth.lunar && profile.birth.chineseDate,
    `Runtime smoke produced lunar and Chinese date: ${profile.birth.lunar}`,
    "Runtime smoke did not produce lunar or Chinese date",
  );
  passIf(
    palaces.length === 12,
    "Runtime smoke produced 12 Ziwei palaces",
    `Runtime smoke produced ${palaces.length} Ziwei palaces`,
  );
  passIf(
    boardCells.length === 16 &&
      boardCells.filter((cell) => !cell.empty).length === 12 &&
      boardCells.filter((cell) => cell.empty).length === 4,
    "Runtime smoke produced a 4x4 Ziwei board with 12 palace cells",
    "Runtime smoke produced an invalid Ziwei board layout",
  );
  passIf(
    boardCells.some((cell) => !cell.empty && cell.name === "命宫" && cell.isMing),
    "Runtime smoke placed ming palace on the board",
    "Runtime smoke did not place ming palace on the board",
  );
  passIf(
    profile.ziwei.mingPalace &&
      profile.ziwei.mingPalace.name === "命宫" &&
      profile.ziwei.bodyPalace &&
      profile.ziwei.bodyPalace.name,
    "Runtime smoke identified ming/body palaces",
    "Runtime smoke did not identify ming/body palaces",
  );
  passIf(
    buildLocalCards(profile).some((card) => card.title === "命宫主星"),
    "Runtime smoke produced native summary cards",
    "Runtime smoke did not produce the native summary cards",
  );
  passIf(
    prompt.includes("基础命盘摘要") &&
      prompt.includes("结构化数据") &&
      !prompt.includes("boardCells"),
    "Runtime smoke built compact LLM prompt without UI board cells",
    "Runtime smoke built an invalid or overly UI-heavy LLM prompt",
  );
  passIf(
    prompt.length < 12000,
    `Runtime smoke prompt remains within a conservative length: ${prompt.length} chars`,
    `Runtime smoke prompt is unexpectedly long: ${prompt.length} chars`,
    "warn",
  );
  passIf(
    parsedReport.matchedCount === reportSections.length &&
      parsedReport.sections.every((section) => section.hasContent),
    "Runtime smoke parsed all LLM report sections",
    "Runtime smoke failed to parse all LLM report sections",
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

function buildSampleMarkdownReport(reportSections) {
  return reportSections
    .map((section) => [
      `## ${section.title}`,
      "人话解释：这是一段用于预检解析器的示例内容。",
      "盘面依据：这里模拟模型按章节返回依据。",
      "建议：这里模拟模型按章节返回建议。",
    ].join("\n"))
    .join("\n\n");
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
  passIf(Boolean(scripts["mini:release-check"]), "package.json has mini:release-check", "package.json missing mini:release-check");
  passIf(Boolean(scripts["mini:preview"]), "package.json has mini:preview", "package.json missing mini:preview");
  passIf(Boolean(scripts["mini:upload"]), "package.json has mini:upload", "package.json missing mini:upload");
}

function checkDevToolsHelper(packageJson) {
  const scripts = packageJson.scripts || {};
  const helper = readText("scripts/mini-devtools.js");
  const releaseCheck = readText("scripts/mini-release-check.js");
  const readme = readText("miniprogram/README.md");

  passIf(
    fileExists("scripts/mini-devtools.js") &&
      scripts["mini:preview"] === "node scripts/mini-devtools.js preview" &&
      scripts["mini:upload"] === "node scripts/mini-devtools.js upload",
    "WeChat DevTools helper is wired to package scripts",
    "WeChat DevTools helper or package script wiring is missing",
  );
  passIf(
    helper.includes('command === "preview"') &&
      helper.includes('command === "upload"') &&
      helper.includes("runPreflight()"),
    "WeChat DevTools helper supports preview/upload with preflight",
    "WeChat DevTools helper should support preview/upload and run preflight",
  );
  passIf(
    helper.includes("Upload requires --version <version> and --desc <description>"),
    "Upload helper requires version and description",
    "Upload helper should require version and description before uploading",
  );
  passIf(
    helper.includes("confirm-upload") && helper.includes("WeChat backend draft"),
    "Upload helper requires explicit upload confirmation",
    "Upload helper should require --confirm-upload before creating a backend draft",
  );
  passIf(
    fileExists("scripts/mini-release-check.js") &&
      scripts["mini:release-check"] === "node scripts/mini-release-check.js" &&
      releaseCheck.includes("mini:preflight") &&
      releaseCheck.includes("demo:build") &&
      releaseCheck.includes("--require-clean"),
    "Release check verifies mini preflight, H5 build, and clean-worktree mode",
    "Release check should run preflight/build and support --require-clean",
  );
  passIf(
    readme.includes("npm run mini:preview") &&
      readme.includes("npm run mini:upload") &&
      readme.includes("npm run mini:release-check") &&
      readme.includes("ziwei-mini-devtools") &&
      readme.includes("--confirm-upload"),
    "README documents WeChat DevTools preview/upload flow",
    "README should document preview/upload helper commands",
  );
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
