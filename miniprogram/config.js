const SITE_URL = "https://www.tanxj.xyz";
const REQUEST_DOMAIN = "https://api.tanxj.xyz";
const API_URL = `${REQUEST_DOMAIN}/api/llm/interpret`;
const LLM_JOB_URL = `${REQUEST_DOMAIN}/api/llm/jobs`;
const PUBLIC_LLM_JOB_URL = `${REQUEST_DOMAIN}/api/llm/public/jobs`;
const ADMIN_STATS_URL = `${REQUEST_DOMAIN}/api/admin/stats`;
const SHARE_TITLE = "谈玄机命理排盘";
const AD_CUSTOM_UNIT_ID = "";
const AD_BANNER_UNIT_ID = "";
const BIRTH_PROFILE_STORAGE = "ziwei-mini.birthProfile";
const PROXY_KEY_STORAGE = "ziwei-mini.proxyAccessKey";
const CLIENT_ID_STORAGE = "ziwei-mini.clientId";
const LLM_CONSENT_STORAGE = "ziwei-mini.llmConsentAccepted";
const LLM_REPORT_STORAGE = "ziwei-mini.latestReport";
const LLM_JOB_STORAGE = "ziwei-mini.activeReportJob";

module.exports = {
  AD_BANNER_UNIT_ID,
  AD_CUSTOM_UNIT_ID,
  ADMIN_STATS_URL,
  API_URL,
  BIRTH_PROFILE_STORAGE,
  CLIENT_ID_STORAGE,
  LLM_CONSENT_STORAGE,
  LLM_JOB_STORAGE,
  LLM_JOB_URL,
  LLM_REPORT_STORAGE,
  PUBLIC_LLM_JOB_URL,
  PROXY_KEY_STORAGE,
  REQUEST_DOMAIN,
  SITE_URL,
  WEBVIEW_DOMAIN: SITE_URL,
  SHARE_TITLE,
  SHARE_PATH: "/pages/home/home",
};
