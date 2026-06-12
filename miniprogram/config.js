const SITE_URL = "https://www.tanxj.xyz";
const REQUEST_DOMAIN = "https://api.tanxj.xyz";
const API_URL = `${REQUEST_DOMAIN}/api/llm/interpret`;
const SHARE_TITLE = "命理排盘工作台";
const PROXY_KEY_STORAGE = "ziwei-mini.proxyAccessKey";
const LLM_CONSENT_STORAGE = "ziwei-mini.llmConsentAccepted";
const LLM_REPORT_STORAGE = "ziwei-mini.latestReport";

module.exports = {
  API_URL,
  LLM_CONSENT_STORAGE,
  LLM_REPORT_STORAGE,
  PROXY_KEY_STORAGE,
  REQUEST_DOMAIN,
  SITE_URL,
  WEBVIEW_DOMAIN: SITE_URL,
  SHARE_TITLE,
  SHARE_PATH: "/pages/home/home",
};
