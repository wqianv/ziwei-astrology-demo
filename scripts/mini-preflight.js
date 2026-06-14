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
  checkEntryPage(appJson, config);
  checkNativeFlow();
  checkSettingsFlow();
  checkWorkerFlow();
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
    config.LLM_JOB_URL === `${config.REQUEST_DOMAIN}/api/llm/jobs`,
    `LLM job URL is aligned: ${config.LLM_JOB_URL}`,
    "LLM_JOB_URL should be REQUEST_DOMAIN + /api/llm/jobs",
  );
  passIf(
    config.PUBLIC_LLM_JOB_URL === `${config.REQUEST_DOMAIN}/api/llm/public/jobs`,
    `Public LLM job URL is aligned: ${config.PUBLIC_LLM_JOB_URL}`,
    "PUBLIC_LLM_JOB_URL should be REQUEST_DOMAIN + /api/llm/public/jobs",
  );
  passIf(
    config.ADMIN_STATS_URL === `${config.REQUEST_DOMAIN}/api/admin/stats`,
    `Admin stats URL is aligned: ${config.ADMIN_STATS_URL}`,
    "ADMIN_STATS_URL should be REQUEST_DOMAIN + /api/admin/stats",
  );
  passIf(
    config.WEBVIEW_DOMAIN === config.SITE_URL,
    "WEBVIEW_DOMAIN matches SITE_URL",
    "WEBVIEW_DOMAIN should match SITE_URL",
  );
}

function checkPages(appJson) {
  const expectedPages = [
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

function checkEntryPage(appJson, config) {
  const nativeJs = readText("miniprogram/pages/native/native.js");
  const nativeWxml = readText("miniprogram/pages/native/native.wxml");

  passIf(
    Array.isArray(appJson.pages) && appJson.pages[0] === "pages/native/native",
    "Native chart page is the Mini Program launch entry",
    "app.json should launch directly into pages/native/native",
  );
  passIf(
    config.SHARE_PATH === "/pages/native/native" &&
      nativeJs.includes("openCompliance") &&
      nativeWxml.includes("bindtap=\"openCompliance\"") &&
      nativeWxml.includes("使用说明"),
    "Native chart page owns share and bottom usage-guide entry",
    "Native chart page should share itself and expose the usage guide at the bottom",
  );
  passIf(
    nativeWxml.includes("紫微斗数 · 四柱八字") &&
      !nativeWxml.includes("ziwei chart"),
    "Native chart page uses the Chinese product category eyebrow",
    "Native chart page should replace the English ziwei chart eyebrow",
  );
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
    nativeJs.includes("ziweiBoardExpanded: false") &&
      nativeJs.includes("palaceDetailsExpanded: false") &&
      nativeJs.includes("toggleZiweiBoard") &&
      nativeJs.includes("togglePalaceDetails") &&
      nativeWxml.includes("wx:if=\"{{ziweiBoardExpanded}}\"") &&
      nativeWxml.includes("wx:if=\"{{palaceDetailsExpanded}}\""),
    "Native Ziwei board and palace details are collapsible by default",
    "Native Ziwei board and palace details should be collapsible and default collapsed",
  );
  passIf(
    !nativeWxml.includes("原生版已接入 iztro 生成紫微十二宫"),
    "Native Ziwei panel no longer shows engineering implementation copy",
    "Native Ziwei panel should not show the old implementation-detail description",
  );
  passIf(
    nativeJs.includes("buildSummaryRows") &&
      nativeJs.includes("left: summaryCards[index]") &&
      nativeJs.includes("right: summaryCards[index + 1]") &&
      !nativeJs.includes("primaryLocalCard") &&
      nativeWxml.includes("summary-row") &&
      nativeWxml.includes("item.left") &&
      nativeWxml.includes("item.right") &&
      !nativeWxml.includes("summary-card-wide"),
    "Native summary cards use explicit two-column rows",
    "Native summary cards should render with explicit rows instead of relying on flex wrapping",
  );
  passIf(
    reportJs.includes("compactProfileForPrompt") &&
      !buildPromptContainsBoardCells(reportJs),
    "LLM prompt compacts UI-only board data",
    "LLM prompt may include UI-only board data",
    "warn",
  );
  passIf(
    reportJs.includes("queryDate") &&
      reportJs.includes("本次查询日期") &&
      reportJs.includes("generatedAt") &&
      nativeJs.includes("currentQueryDate") &&
      nativeJs.includes("buildBirthCacheKey") &&
      nativeJs.includes("|query:") &&
      nativeWxml.includes("问询日期"),
    "Native LLM prompt and cache are associated with a query date",
    "Native LLM reports should be keyed by birth profile plus query date",
  );
  passIf(
    nativeJs.includes("LLM_REPORT_STORAGE") &&
      nativeJs.includes("LLM_JOB_STORAGE") &&
      nativeJs.includes("PUBLIC_LLM_JOB_URL") &&
      nativeJs.includes("X-Ziwei-Client-Id") &&
      nativeJs.includes("ensureClientId") &&
      nativeJs.includes("pollReportJob") &&
      nativeJs.includes("resumeActiveReportJob") &&
      nativeJs.includes("readReportHistory") &&
      nativeJs.includes("REPORT_HISTORY_LIMIT") &&
      nativeJs.includes("saveReportCache") &&
      nativeJs.includes("readReportCache") &&
      nativeJs.includes("clearCachedReport") &&
      nativeWxml.includes("清除本机解读"),
    "Native user LLM report uses public background jobs, client id, date-keyed history, and can be cleared",
    "Native LLM report should use public background jobs, client id, date-keyed history, and offer a clear action",
  );
  passIf(
    !nativeWxml.includes("设置密钥") &&
      !nativeWxml.includes("更换密钥") &&
      !nativeWxml.includes("去设置访问密钥") &&
      !nativeWxml.includes("还没有保存访问密钥"),
    "Native formal user flow no longer asks ordinary users to configure backend keys",
    "Native user flow should not expose backend key setup controls",
  );
  passIf(
    nativeJs.includes("buildJobSignature") &&
      nativeJs.includes("JIAZI_CYCLE") &&
      nativeJs.includes("activeJobSignature") &&
      nativeWxml.includes("任务签") &&
      !nativeWxml.includes("任务号：{{activeJobId}}"),
    "Native background job uses a restrained ganzhi signature instead of showing the full job id",
    "Native background job should not expose the full job id in the UI",
  );
  passIf(
    nativeJs.includes("copyReport") &&
      nativeJs.includes("buildReportCopyText") &&
      nativeWxml.includes("复制解读") &&
      nativeJs.includes("内容仅作传统文化与娱乐参考"),
    "Native LLM report can be copied with a usage-boundary note",
    "Native LLM report should be copyable without exposing backend secrets",
  );
  passIf(
    nativeJs.includes("BIRTH_PROFILE_STORAGE") &&
      nativeJs.includes("restoreBirthProfile") &&
      nativeJs.includes("saveBirthProfile") &&
      nativeJs.includes("clearBirthProfile") &&
      nativeWxml.includes("重置出生信息"),
    "Native birth profile is saved locally and can be reset",
    "Native birth profile should be saved locally and offer a reset action",
  );
}

function checkSettingsFlow() {
  const settingsJs = readText("miniprogram/pages/settings/settings.js");
  const settingsWxml = readText("miniprogram/pages/settings/settings.wxml");
  const settingsJson = readText("miniprogram/pages/settings/settings.json");
  const complianceJs = readText("miniprogram/pages/compliance/compliance.js");
  const complianceWxml = readText("miniprogram/pages/compliance/compliance.wxml");

  passIf(
    complianceWxml.includes("bindtap=\"handleModelTitleTap\"") &&
      complianceWxml.includes("模型解读") &&
      complianceJs.includes("modelTitleTapCount < 7") &&
      complianceJs.includes("/pages/settings/settings?from=hidden-admin"),
    "Management backend is hidden behind seven taps on the compliance model heading",
    "Management backend should not be visible from the user entry and should use the hidden compliance trigger",
  );
  passIf(
    settingsJson.includes("管理后台") &&
      settingsJs.includes("ADMIN_LOGIN_URL") &&
      settingsJs.includes("wx.login") &&
      settingsJs.includes("wechatCode") &&
      settingsJs.includes("Authorization: `Bearer") &&
      settingsWxml.includes("管理员登录") &&
      settingsWxml.includes("当前会话") &&
      !settingsWxml.includes("管理后台密钥") &&
      !settingsWxml.includes("proxyAccessKey"),
    "Settings page is gated by admin username/password and WeChat identity",
    "Settings page should require admin login and should not expose the old backend-key input",
  );

  passIf(
    settingsJs.includes("testBackend") &&
      settingsJs.includes("wx.request") &&
      settingsJs.includes("formatBackendTestError") &&
      settingsWxml.includes("测试后端连接"),
    "Settings page can test backend connectivity through an admin session",
    "Settings page should include a backend connectivity test button and request flow",
  );
  passIf(
    settingsJs.includes("url not in domain list") &&
      settingsJs.includes("管理登录已过期") &&
      settingsJs.includes("api.tanxj.xyz"),
    "Settings backend test explains domain, session, and network failures",
    "Settings backend test should translate common domain/session/network failures",
  );
  passIf(
    settingsJs.includes("copyDiagnostics") &&
      settingsJs.includes("Secret included: no") &&
      settingsWxml.includes("复制诊断信息") &&
      settingsWxml.includes("诊断信息不包含密码"),
    "Settings page can copy a secret-free diagnostic report",
    "Settings page should copy diagnostics without exposing passwords, tokens, or backend secrets",
  );
  passIf(
    settingsJs.includes("clearLocalData") &&
      settingsJs.includes("BIRTH_PROFILE_STORAGE") &&
      settingsJs.includes("LLM_CONSENT_STORAGE") &&
      settingsJs.includes("LLM_JOB_STORAGE") &&
      settingsJs.includes("LLM_REPORT_STORAGE") &&
      settingsJs.includes("CLIENT_ID_STORAGE") &&
      settingsWxml.includes("清除本机数据"),
    "Settings page can clear locally stored Mini Program data",
    "Settings page should clear local key, client id, birth profile, consent, and report cache",
  );
  passIf(
    settingsJs.includes("ADMIN_STATS_URL") &&
      settingsJs.includes("refreshAdminStats") &&
      settingsJs.includes("buildStatsCards") &&
      settingsWxml.includes("使用统计") &&
      settingsJs.includes("今日限流") &&
      settingsJs.includes("今日失败") &&
      settingsJs.includes("无效密钥"),
    "Settings management backend shows usage, failures, invalid keys, and rate-limit stats",
    "Settings management backend should show Worker usage/failure/rate-limit statistics",
  );
  passIf(
    settingsJs.includes("AD_CUSTOM_UNIT_ID") &&
      settingsJs.includes("AD_BANNER_UNIT_ID") &&
      settingsJs.includes("adStatusText") &&
      settingsWxml.includes("广告配置") &&
      settingsWxml.includes("原生模板广告 unit-id"),
    "Settings management backend shows Mini Program native ad configuration status",
    "Settings page should show ad unit configuration status for launch readiness",
  );
}

function checkWorkerFlow() {
  const worker = readText("backend/cloudflare-worker/src/index.js");
  const wrangler = readText("backend/cloudflare-worker/wrangler.jsonc");

  passIf(
    worker.includes("PUBLIC_JOBS_PATH") &&
      worker.includes("/api/llm/public/jobs") &&
      worker.includes("publicClient") &&
      worker.includes("checkPublicRateLimit") &&
      worker.includes("X-Ziwei-Client-Id"),
    "Worker exposes public Mini Program job endpoints with client-based rate limiting",
    "Worker should expose public job endpoints and rate-limit by Mini Program client id",
  );
  passIf(
    worker.includes("ADMIN_STATS_PATH") &&
      worker.includes("/api/admin/stats") &&
      worker.includes("handleAdminStats") &&
      worker.includes("readMetricBucket") &&
      worker.includes("rateLimited") &&
      worker.includes("invalidKey") &&
      worker.includes("failedJobs"),
    "Worker exposes protected admin stats for usage, failures, invalid keys, and rate limits",
    "Worker should expose protected admin stats with failures and rate-limit counters",
  );
  passIf(
    worker.includes("ADMIN_TASKS_PATH") &&
      worker.includes("/api/admin/tasks") &&
      worker.includes("handleAdminTasks") &&
      worker.includes("admin:tasks:v1") &&
      worker.includes("completedAt"),
    "Worker exposes protected admin tasklist endpoints backed by KV",
    "Worker should expose protected admin tasklist endpoints with dated completion state",
  );
  passIf(
    worker.includes("ADMIN_LOGIN_PATH") &&
      worker.includes("/api/admin/login") &&
      worker.includes("handleAdminLogin") &&
      worker.includes("WECHAT_APP_ID") &&
      worker.includes("WECHAT_APP_SECRET") &&
      worker.includes("ADMIN_WECHAT_OPENIDS") &&
      worker.includes("admin-session:") &&
      worker.includes("Authorization"),
    "Worker supports username/password admin login with Mini Program WeChat identity binding",
    "Worker should support admin sessions and Mini Program openid allow-listing",
  );
  passIf(
    worker.includes("ADMIN_LLM_TEST_PATH") &&
      worker.includes("/api/admin/llm-test") &&
      worker.includes("handleAdminLlmTest") &&
      worker.includes("adminSessionOrProxy"),
    "Worker supports protected admin LLM diagnostics while retaining legacy proxy compatibility",
    "Worker should provide an admin-session LLM test endpoint and keep legacy protected routes compatible",
  );
  passIf(
    wrangler.includes("PUBLIC_HOURLY_LIMIT") &&
      wrangler.includes("PUBLIC_DAILY_LIMIT") &&
      wrangler.includes("PUBLIC_IP_DAILY_LIMIT"),
    "Worker config includes default public rate-limit variables",
    "wrangler config should include public rate-limit variables",
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
  const prompt = buildPrompt(profile, {
    queryDate: "2026-06-13",
    generatedAt: "2026-06-13T00:00:00.000Z",
    timezone: "Asia/Shanghai",
  });
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
      prompt.includes("盘面资料") &&
      !prompt.includes("boardCells") &&
      !prompt.includes("bazi.") &&
      !prompt.includes("ziwei.") &&
      !prompt.includes("iztro"),
    "Runtime smoke built compact user-facing LLM prompt without UI or internal keys",
    "Runtime smoke built an invalid or implementation-leaking LLM prompt",
  );
  passIf(
    prompt.includes("本次查询日期：2026-06-13") &&
      prompt.includes("查询日期：2026-06-13") &&
      prompt.includes("时区：Asia/Shanghai"),
    "Runtime smoke included query date context in the LLM prompt",
    "Runtime smoke prompt should include query date context",
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
  const demoMain = readText("demo/main.tsx");
  const redirects = readText("demo/public/_redirects");

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
  passIf(
    demoMain.includes("function Dashboard") &&
      demoMain.includes("DASHBOARD_SESSION_STORAGE_KEY") &&
      demoMain.includes("ADMIN_LOGIN_ENDPOINT") &&
      demoMain.includes("ADMIN_STATS_ENDPOINT") &&
      demoMain.includes("ADMIN_TASKS_ENDPOINT") &&
      demoMain.includes('"/dashboard"') &&
      redirects.includes("/* /index.html 200"),
    "H5 site includes a protected /dashboard admin route with tasklist",
    "H5 site should render a login-gated dashboard with stats, tasklist, and static route fallback",
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
  const settingsWxml = readText("miniprogram/pages/settings/settings.wxml");

  passIf(
    compliance.includes("不构成确定性判断") &&
      compliance.includes("重大决策") &&
      compliance.includes("发送确认") &&
      (compliance.includes("清除解读缓存") || settingsWxml.includes("清除本机数据")) &&
      compliance.includes("最近一次解读缓存"),
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
  passIf(Boolean(scripts["mini:readiness"]), "package.json has mini:readiness", "package.json missing mini:readiness");
  passIf(Boolean(scripts["mini:domain-check"]), "package.json has mini:domain-check", "package.json missing mini:domain-check");
  passIf(Boolean(scripts["mini:preflight"]), "package.json has mini:preflight", "package.json missing mini:preflight");
  passIf(Boolean(scripts["mini:release-check"]), "package.json has mini:release-check", "package.json missing mini:release-check");
  passIf(Boolean(scripts["mini:preview"]), "package.json has mini:preview", "package.json missing mini:preview");
  passIf(Boolean(scripts["mini:phone-qa"]), "package.json has mini:phone-qa", "package.json missing mini:phone-qa");
  passIf(Boolean(scripts["mini:upload"]), "package.json has mini:upload", "package.json missing mini:upload");
}

function checkDevToolsHelper(packageJson) {
  const scripts = packageJson.scripts || {};
  const helper = readText("scripts/mini-devtools.js");
  const releaseCheck = readText("scripts/mini-release-check.js");
  const readme = readText("miniprogram/README.md");
  const reviewNotes = readText("miniprogram/REVIEW_NOTES.md");
  const phoneQa = readText("miniprogram/PHONE_QA.md");
  const phoneQaScript = readText("scripts/mini-phone-qa.js");

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
      helper.includes("runReadiness()") &&
      helper.includes("runPreflight()") &&
      helper.includes("runReleaseCheck") &&
      helper.includes("--with-domain-check"),
    "WeChat DevTools helper supports preview with readiness/preflight and upload with release-check",
    "WeChat DevTools helper should run readiness/preflight for preview and release-check for upload",
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
      releaseCheck.includes("mini:readiness") &&
      releaseCheck.includes("mini:preflight") &&
      releaseCheck.includes("mini:domain-check") &&
      releaseCheck.includes("demo:build") &&
      releaseCheck.includes("--require-clean") &&
      releaseCheck.includes("--with-domain-check"),
    "Release check verifies readiness, mini preflight, optional domain check, H5 build, and clean-worktree mode",
    "Release check should run readiness/preflight/build and support --require-clean plus --with-domain-check",
  );
  passIf(
    readme.includes("npm run mini:preview") &&
      readme.includes("npm run mini:upload") &&
      readme.includes("npm run mini:domain-check") &&
      readme.includes("npm run mini:release-check") &&
      readme.includes("ziwei-mini-devtools") &&
      readme.includes("--confirm-upload"),
    "README documents WeChat DevTools preview/upload flow",
    "README should document preview/upload helper commands",
  );
  passIf(
      fileExists("scripts/mini-phone-qa.js") &&
      scripts["mini:phone-qa"] === "node scripts/mini-phone-qa.js" &&
      phoneQaScript.includes("findLatestPreview") &&
      phoneQaScript.includes("Do not paste admin passwords") &&
      readme.includes("npm run mini:phone-qa"),
    "Phone QA helper generates secret-free real-device QA records",
    "Phone QA helper should generate a local QA record without exposing secrets",
  );
  passIf(
      fileExists("miniprogram/REVIEW_NOTES.md") &&
      readme.includes("REVIEW_NOTES.md") &&
      reviewNotes.includes("Suggested Review Comment") &&
      reviewNotes.includes("Reviewer Test Path") &&
      reviewNotes.includes("Never commit backend keys"),
    "Review notes document submission copy, tester path, and secret boundary",
    "REVIEW_NOTES.md should document review copy, tester path, and secret handling",
  );
  passIf(
      fileExists("miniprogram/PHONE_QA.md") &&
      readme.includes("PHONE_QA.md") &&
      reviewNotes.includes("PHONE_QA.md") &&
      phoneQa.includes("Required Checks") &&
      phoneQa.includes("Do not paste admin passwords") &&
      phoneQa.includes("Overall result"),
    "Phone QA template documents real-device checks and secret boundary",
    "PHONE_QA.md should document real-device QA checks and secret handling",
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
