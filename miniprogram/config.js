const SITE_URL = "https://www.tanxj.xyz";
const REQUEST_DOMAIN = "https://api.tanxj.xyz";
const API_URL = `${REQUEST_DOMAIN}/api/llm/interpret`;
const LLM_JOB_URL = `${REQUEST_DOMAIN}/api/llm/jobs`;
const SHARE_TITLE = "命理排盘工作台";
const BIRTH_PROFILE_STORAGE = "ziwei-mini.birthProfile";
const PROXY_KEY_STORAGE = "ziwei-mini.proxyAccessKey";
const LLM_CONSENT_STORAGE = "ziwei-mini.llmConsentAccepted";
const LLM_REPORT_STORAGE = "ziwei-mini.latestReport";
const LLM_JOB_STORAGE = "ziwei-mini.activeReportJob";

module.exports = {
  API_URL,
  BIRTH_PROFILE_STORAGE,
  LLM_CONSENT_STORAGE,
  LLM_JOB_STORAGE,
  LLM_JOB_URL,
  LLM_REPORT_STORAGE,
  PROXY_KEY_STORAGE,
  REQUEST_DOMAIN,
  SITE_URL,
  WEBVIEW_DOMAIN: SITE_URL,
  SHARE_TITLE,
  SHARE_PATH: "/pages/home/home",
};
