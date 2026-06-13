const {
  AD_BANNER_UNIT_ID,
  AD_CUSTOM_UNIT_ID,
  ADMIN_LLM_TEST_URL,
  ADMIN_LOGIN_URL,
  ADMIN_SESSION_STORAGE,
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
  SHARE_PATH,
  SHARE_TITLE,
  WEBVIEW_DOMAIN,
} = require("../../config");

Page({
  data: {
    apiUrl: API_URL,
    adminLoginUrl: ADMIN_LOGIN_URL,
    adminLlmTestUrl: ADMIN_LLM_TEST_URL,
    adminStatsUrl: ADMIN_STATS_URL,
    publicLlmJobUrl: PUBLIC_LLM_JOB_URL,
    llmJobUrl: LLM_JOB_URL,
    requestDomain: REQUEST_DOMAIN,
    webviewDomain: WEBVIEW_DOMAIN,
    adBannerUnitId: AD_BANNER_UNIT_ID,
    adCustomUnitId: AD_CUSTOM_UNIT_ID,
    adStatusText: adStatusText(),
    adminAuthenticated: false,
    adminUsername: "",
    adminPassword: "",
    adminSessionToken: "",
    adminSessionExpiresAt: "",
    adminOpenidMasked: "",
    loggingIn: false,
    loginResult: "",
    loginResultType: "success",
    loginDebug: "",
    testingBackend: false,
    backendTestResult: "",
    backendTestType: "success",
    loadingStats: false,
    statsResult: "",
    statsResultType: "success",
    statsCards: [],
    statsMetaRows: [],
  },

  onLoad() {
    this.restoreAdminSession();
  },

  onShow() {
    this.restoreAdminSession();
  },

  restoreAdminSession() {
    const session = readAdminSession();

    if (!session) {
      this.setData({
        adminAuthenticated: false,
        adminSessionToken: "",
        adminSessionExpiresAt: "",
        adminOpenidMasked: "",
        statsCards: [],
        statsMetaRows: [],
      });
      return;
    }

    this.setData({
      adminAuthenticated: true,
      adminUsername: session.username,
      adminSessionToken: session.token,
      adminSessionExpiresAt: session.expiresAt,
      adminOpenidMasked: session.openidMasked || "",
      loginResult: "已恢复本机管理会话。",
      loginResultType: "success",
    });
    this.refreshAdminStats();
  },

  handleAdminUsernameInput(event) {
    this.setData({
      adminUsername: event.detail.value,
      loginResult: "",
    });
  },

  handleAdminPasswordInput(event) {
    this.setData({
      adminPassword: event.detail.value,
      loginResult: "",
    });
  },

  submitAdminLogin() {
    const username = this.data.adminUsername.trim();
    const password = this.data.adminPassword.trim();

    if (!username || !password) {
      this.setData({
        loginResult: "请输入管理员用户名和密码。",
        loginResultType: "warning",
      });
      return;
    }

    this.setData({
      loggingIn: true,
      loginResult: "正在获取微信身份并登录管理后台。",
      loginResultType: "warning",
    });

    wx.login({
      success: (loginResult) => {
        if (!loginResult.code) {
          this.finishAdminLogin("没有获取到微信登录 code，请稍后再试。", "error");
          return;
        }

        this.requestAdminLogin({
          username,
          password,
          wechatCode: loginResult.code,
        });
      },
      fail: () => {
        this.setData({
          loginDebug: "wx.login failed",
        });
        this.finishAdminLogin("微信登录失败，无法校验管理员微信身份。", "error");
      },
    });
  },

  requestAdminLogin({ username, password, wechatCode }) {
    wx.request({
      url: ADMIN_LOGIN_URL,
      method: "POST",
      timeout: 20000,
      header: {
        "Content-Type": "application/json",
      },
      data: {
        username,
        password,
        wechatCode,
        platform: "miniprogram",
      },
      success: (response) => {
        const data = response.data || {};

        if (response.statusCode < 200 || response.statusCode >= 300) {
          this.finishAdminLogin(formatAdminLoginError(response.statusCode, data), "error");
          return;
        }

        const token = String(data.token || "");
        const expiresAt = String(data.expiresAt || "");

        if (!token) {
          this.finishAdminLogin("管理后台没有返回会话令牌，请确认 Worker 已部署最新版本。", "error");
          return;
        }

        const session = {
          token,
          username,
          expiresAt,
          openidMasked: data.openidMasked || "",
        };

        wx.setStorageSync(ADMIN_SESSION_STORAGE, session);
        this.setData({
          adminAuthenticated: true,
          adminPassword: "",
          adminSessionToken: token,
          adminSessionExpiresAt: expiresAt,
          adminOpenidMasked: data.openidMasked || "",
          loginResult: "管理后台登录成功。",
          loginResultType: "success",
          loggingIn: false,
        });
        this.refreshAdminStats();
      },
      fail: (error) => {
        this.setData({
          loginDebug: error && error.errMsg ? error.errMsg : JSON.stringify(error || {}),
        });
        this.finishAdminLogin(formatAdminLoginNetworkError(error), "error");
      },
    });
  },

  finishAdminLogin(message, type) {
    this.setData({
      loggingIn: false,
      loginResult: message,
      loginResultType: type,
    });
  },

  logoutAdmin() {
    wx.removeStorageSync(ADMIN_SESSION_STORAGE);
    this.setData({
      adminAuthenticated: false,
      adminSessionToken: "",
      adminSessionExpiresAt: "",
      adminOpenidMasked: "",
      backendTestResult: "",
      statsResult: "",
      statsCards: [],
      statsMetaRows: [],
      loginResult: "已退出管理后台。",
      loginResultType: "success",
      loginDebug: "",
    });
  },

  clearLocalData() {
    wx.showModal({
      title: "清除本机数据",
      content: "将清除本机管理会话、旧版访问密钥、出生信息、发送确认、后台任务、匿名本机标识和解读历史。不会影响 Cloudflare、微信后台或服务器数据。",
      confirmText: "清除",
      success: (result) => {
        if (!result.confirm) {
          return;
        }

        [
          ADMIN_SESSION_STORAGE,
          PROXY_KEY_STORAGE,
          BIRTH_PROFILE_STORAGE,
          LLM_CONSENT_STORAGE,
          LLM_JOB_STORAGE,
          LLM_REPORT_STORAGE,
          CLIENT_ID_STORAGE,
        ].forEach((key) => {
          wx.removeStorageSync(key);
        });

        this.setData({
          adminAuthenticated: false,
          adminSessionToken: "",
          adminSessionExpiresAt: "",
          adminOpenidMasked: "",
          loginResult: "已清除本机保存的数据。",
          loginResultType: "success",
          backendTestResult: "",
          backendTestType: "success",
          statsResult: "",
          statsResultType: "success",
          statsCards: [],
          statsMetaRows: [],
        });
      },
    });
  },

  refreshAdminStats() {
    if (!this.data.adminSessionToken) {
      this.setData({
        statsResult: "请先登录管理后台，再读取统计。",
        statsResultType: "warning",
      });
      return;
    }

    this.setData({
      loadingStats: true,
      statsResult: "正在读取 Worker 使用统计。",
      statsResultType: "warning",
    });

    wx.request({
      url: ADMIN_STATS_URL,
      method: "GET",
      timeout: 20000,
      header: adminHeaders(this.data.adminSessionToken),
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          this.handleAdminRequestFailure({
            message: formatAdminStatsError(response.statusCode, response.data),
            target: "stats",
          });
          return;
        }

        const data = response.data || {};

        this.setData({
          statsCards: buildStatsCards(data),
          statsMetaRows: buildStatsMetaRows(data),
          statsResult: `统计已更新：${formatDateTime(data.generatedAt)}`,
          statsResultType: "success",
        });
      },
      fail: (error) => {
        this.setData({
          statsResult: formatStatsNetworkError(error),
          statsResultType: "error",
        });
      },
      complete: () => {
        this.setData({
          loadingStats: false,
        });
      },
    });
  },

  testBackend() {
    if (!this.data.adminSessionToken) {
      this.setData({
        backendTestResult: "请先登录管理后台，再测试连接。",
        backendTestType: "warning",
      });
      return;
    }

    this.setData({
      testingBackend: true,
      backendTestResult: "正在测试 request 合法域名、管理会话和模型链路。",
      backendTestType: "warning",
    });

    wx.request({
      url: ADMIN_LLM_TEST_URL,
      method: "POST",
      timeout: 60000,
      header: {
        "Content-Type": "application/json",
        ...adminHeaders(this.data.adminSessionToken),
      },
      data: {
        prompt: "这是小程序后端连通性测试。请只回复：连接正常。",
      },
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          this.handleAdminRequestFailure({
            message: formatBackendTestError(response.statusCode, response.data),
            target: "backend",
          });
          return;
        }

        this.setData({
          backendTestResult: "后端连接测试通过。request 域名、管理会话和模型链路都已返回成功。",
          backendTestType: "success",
        });
      },
      fail: (error) => {
        this.setData({
          backendTestResult: formatBackendNetworkError(error),
          backendTestType: "error",
        });
      },
      complete: () => {
        this.setData({
          testingBackend: false,
        });
      },
    });
  },

  handleAdminRequestFailure({ message, target }) {
    const nextData = target === "backend"
      ? {
          backendTestResult: message,
          backendTestType: "error",
        }
      : {
          statsResult: message,
          statsResultType: "error",
        };

    if (String(message || "").includes("登录已过期")) {
      wx.removeStorageSync(ADMIN_SESSION_STORAGE);
      this.setData({
        ...nextData,
        adminAuthenticated: false,
        adminSessionToken: "",
      });
      return;
    }

    this.setData(nextData);
  },

  copyValue(event) {
    const value = event.currentTarget.dataset.value;

    if (!value) {
      wx.showToast({
        title: "暂无内容",
        icon: "none",
      });
      return;
    }

    wx.setClipboardData({
      data: value,
      success: () => {
        wx.showToast({
          title: "已复制",
          icon: "success",
        });
      },
    });
  },

  copyDiagnostics() {
    const diagnostics = buildDiagnostics({
      adminAuthenticated: this.data.adminAuthenticated,
      adminUsername: this.data.adminUsername,
      adminOpenidMasked: this.data.adminOpenidMasked,
      loginResult: this.data.loginResult,
      loginResultType: this.data.loginResultType,
      loginDebug: this.data.loginDebug,
      backendTestResult: this.data.backendTestResult,
      backendTestType: this.data.backendTestType,
      statsResult: this.data.statsResult,
    });

    wx.setClipboardData({
      data: diagnostics,
      success: () => {
        wx.showToast({
          title: "已复制",
          icon: "success",
        });
      },
    });
  },

  openNativeApp() {
    wx.navigateTo({
      url: "/pages/native/native",
    });
  },

  openCompliance() {
    wx.navigateTo({
      url: "/pages/compliance/compliance",
    });
  },

  onShareAppMessage() {
    return {
      title: SHARE_TITLE,
      path: SHARE_PATH,
    };
  },

  onShareTimeline() {
    return {
      title: SHARE_TITLE,
      query: "",
    };
  },
});

function adminHeaders(token) {
  return {
    Authorization: `Bearer ${token}`,
  };
}

function readAdminSession() {
  const session = wx.getStorageSync(ADMIN_SESSION_STORAGE);

  if (!session || typeof session !== "object") {
    return null;
  }

  const token = String(session.token || "");
  const expiresAt = String(session.expiresAt || "");

  if (!token) {
    return null;
  }

  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    wx.removeStorageSync(ADMIN_SESSION_STORAGE);
    return null;
  }

  return {
    token,
    username: String(session.username || ""),
    expiresAt,
    openidMasked: String(session.openidMasked || ""),
  };
}

function formatAdminLoginError(statusCode, data) {
  const rawError =
    data && typeof data.error === "string" ? data.error : "管理登录没有返回明确错误";

  if (statusCode === 401) {
    return "管理员用户名或密码不正确。";
  }

  if (statusCode === 403 && data && data.setupRequired && data.openid) {
    return `微信 openid 尚未配置为管理员：${data.openid}。请把它加入 Worker secret ADMIN_WECHAT_OPENIDS 后再登录。`;
  }

  if (statusCode === 403) {
    return data && data.openidMasked
      ? `当前微信身份不在管理员白名单中：${data.openidMasked}`
      : "当前微信身份不在管理员白名单中。";
  }

  if (statusCode === 500 && rawError.includes("WECHAT_APP_SECRET")) {
    return "Worker 还没有配置 WECHAT_APP_SECRET，无法校验微信 openid。";
  }

  if (statusCode >= 500) {
    return `管理登录暂时异常（${statusCode}）：${rawError}`;
  }

  return `管理登录失败（${statusCode}）：${rawError}`;
}

function formatAdminLoginNetworkError(error) {
  const message = error && error.errMsg ? error.errMsg : "";

  if (message.includes("url not in domain list")) {
    return "请求被微信拦截。请在小程序后台把 https://api.tanxj.xyz 配置为 request 合法域名。";
  }

  if (message.includes("ERR_TUNNEL_CONNECTION_FAILED")) {
    return "管理登录网络失败：当前微信请求被代理/VPN 隧道拦截。请关闭手机代理或切换网络后重试。";
  }

  if (message.includes("timeout")) {
    return "管理登录超时。可以稍后再试。";
  }

  if (message) {
    return `管理登录网络失败：${message}`;
  }

  return "管理登录失败。请确认网络正常，并且 Worker 已部署最新版本。";
}

function formatBackendTestError(statusCode, data) {
  const rawError =
    data && typeof data.error === "string" ? data.error : "后端没有返回明确错误";

  if (statusCode === 401) {
    return "管理登录已过期，请重新登录后再测试。";
  }

  if (statusCode === 400 && rawError.includes("Missing prompt")) {
    return "测试请求没有被后端识别为有效 prompt。请确认 Worker 已部署最新版本。";
  }

  if (statusCode >= 500) {
    return `后端或模型服务暂时异常（${statusCode}）：${rawError}`;
  }

  return `后端连接测试失败（${statusCode}）：${rawError}`;
}

function formatBackendNetworkError(error) {
  const message = error && error.errMsg ? error.errMsg : "";

  if (message.includes("url not in domain list")) {
    return "请求被微信拦截。请在小程序后台把 https://api.tanxj.xyz 配置为 request 合法域名。";
  }

  if (message.includes("ERR_TUNNEL_CONNECTION_FAILED")) {
    return "后端连接测试失败：当前微信请求被代理/VPN 隧道拦截。请关闭手机代理或切换网络后重试。";
  }

  if (message.includes("timeout")) {
    return "后端连接测试超时。DeepSeek Pro 或网络可能较慢，可以稍后再试。";
  }

  return "后端连接测试失败。请确认手机网络正常，并且 api.tanxj.xyz 已配置为 request 合法域名。";
}

function formatAdminStatsError(statusCode, data) {
  const rawError =
    data && typeof data.error === "string" ? data.error : "管理统计没有返回明确错误";

  if (statusCode === 401) {
    return "管理登录已过期，请重新登录后再刷新统计。";
  }

  if (statusCode === 404) {
    return "Worker 还没有部署管理统计接口。请部署最新 Worker 后再试。";
  }

  if (statusCode >= 500) {
    return `管理统计暂时异常（${statusCode}）：${rawError}`;
  }

  return `管理统计读取失败（${statusCode}）：${rawError}`;
}

function formatStatsNetworkError(error) {
  const message = error && error.errMsg ? error.errMsg : "";

  if (message.includes("url not in domain list")) {
    return "请求被微信拦截。请在小程序后台把 https://api.tanxj.xyz 配置为 request 合法域名。";
  }

  if (message.includes("ERR_TUNNEL_CONNECTION_FAILED")) {
    return "管理统计读取失败：当前微信请求被代理/VPN 隧道拦截。请关闭手机代理或切换网络后重试。";
  }

  if (message.includes("timeout")) {
    return "管理统计读取超时。可以稍后再刷新。";
  }

  return "管理统计读取失败。请确认网络正常，并且 Worker 已部署最新版本。";
}

function buildStatsCards(data) {
  const today = data.today || {};
  const hour = data.currentHour || {};
  const total = data.total || {};

  return [
    {
      label: "今日公开生成",
      value: formatNumber(today.publicCreateJob),
      subtext: `本小时 ${formatNumber(hour.publicCreateJob)} / 总计 ${formatNumber(total.publicCreateJob)}`,
    },
    {
      label: "今日完成",
      value: formatNumber(today.completedJobs),
      subtext: `本小时 ${formatNumber(hour.completedJobs)} / 总计 ${formatNumber(total.completedJobs)}`,
    },
    {
      label: "今日失败",
      value: formatNumber(today.failedJobs),
      subtext: `LLM 错误 ${formatNumber(today.llmError)} / 总计 ${formatNumber(total.failedJobs)}`,
    },
    {
      label: "今日限流",
      value: formatNumber(today.rateLimited),
      subtext: `本小时 ${formatNumber(hour.rateLimited)} / 总计 ${formatNumber(total.rateLimited)}`,
    },
    {
      label: "无效密钥",
      value: formatNumber(today.invalidKey),
      subtext: `本小时 ${formatNumber(hour.invalidKey)} / 总计 ${formatNumber(total.invalidKey)}`,
    },
    {
      label: "今日 Token",
      value: formatNumber(today.totalTokens),
      subtext: `输入 ${formatNumber(today.promptTokens)} / 输出 ${formatNumber(today.completionTokens)}`,
    },
  ];
}

function buildStatsMetaRows(data) {
  const limits = data.limits || {};
  const last = data.last || {};

  return [
    {
      label: "公开限流",
      value: `每小时 ${limits.publicHourly || "-"} 次 / 每日 ${limits.publicDaily || "-"} 次 / IP 每日 ${limits.publicIpDaily || "-"}`,
    },
    {
      label: "公开任务接口",
      value: PUBLIC_LLM_JOB_URL,
    },
    {
      label: "管理登录接口",
      value: ADMIN_LOGIN_URL,
    },
    {
      label: "管理统计接口",
      value: ADMIN_STATS_URL,
    },
    {
      label: "最近完成",
      value: formatLastEvent(last.completedJob),
    },
    {
      label: "最近失败",
      value: formatLastEvent(last.failedJob),
    },
    {
      label: "最近限流",
      value: formatLastEvent(last.rateLimited),
    },
  ];
}

function adStatusText() {
  if (AD_CUSTOM_UNIT_ID) {
    return "已配置原生模板广告 ad-custom";
  }

  if (AD_BANNER_UNIT_ID) {
    return "已配置 Banner 广告 ad";
  }

  return "未配置广告单元 ID，正式页面暂不展示广告";
}

function formatLastEvent(value) {
  if (!value) {
    return "暂无";
  }

  const parts = [formatDateTime(value.at)];

  if (value.channel) {
    parts.push(value.channel);
  }

  if (value.reason) {
    parts.push(value.reason);
  }

  if (value.status) {
    parts.push(String(value.status));
  }

  return parts.filter(Boolean).join(" · ");
}

function formatDateTime(value) {
  if (!value) {
    return "-";
  }

  return String(value).replace("T", " ").slice(0, 19);
}

function formatNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return "0";
  }

  return String(Math.floor(number));
}

function buildDiagnostics({
  adminAuthenticated,
  adminUsername,
  adminOpenidMasked,
  loginResult,
  loginResultType,
  loginDebug,
  backendTestResult,
  backendTestType,
  statsResult,
}) {
  return [
    "Ziwei Mini Program Diagnostics",
    `Time: ${new Date().toISOString()}`,
    `Request domain: ${REQUEST_DOMAIN}`,
    `Web-view domain: ${WEBVIEW_DOMAIN}`,
    `LLM endpoint: ${API_URL}`,
    `LLM job endpoint: ${LLM_JOB_URL}`,
    `Public LLM job endpoint: ${PUBLIC_LLM_JOB_URL}`,
    `Admin login endpoint: ${ADMIN_LOGIN_URL}`,
    `Admin stats endpoint: ${ADMIN_STATS_URL}`,
    `Admin LLM test endpoint: ${ADMIN_LLM_TEST_URL}`,
    `Ad status: ${adStatusText()}`,
    `Admin authenticated: ${adminAuthenticated ? "yes" : "no"}`,
    `Admin username: ${adminUsername || "-"}`,
    `Admin openid: ${adminOpenidMasked || "-"}`,
    `Admin login status: ${loginResultType || "not-run"}`,
    `Admin login result: ${loginResult || "not run"}`,
    `Admin login debug: ${loginDebug || "-"}`,
    `Backend test status: ${backendTestType || "not-run"}`,
    `Backend test result: ${backendTestResult || "not run"}`,
    `Stats result: ${statsResult || "not run"}`,
    "Secret included: no",
  ].join("\n");
}
