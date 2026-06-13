const {
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
  SHARE_PATH,
  SHARE_TITLE,
  WEBVIEW_DOMAIN,
} = require("../../config");

Page({
  data: {
    apiUrl: API_URL,
    adminStatsUrl: ADMIN_STATS_URL,
    publicLlmJobUrl: PUBLIC_LLM_JOB_URL,
    llmJobUrl: LLM_JOB_URL,
    requestDomain: REQUEST_DOMAIN,
    webviewDomain: WEBVIEW_DOMAIN,
    adBannerUnitId: AD_BANNER_UNIT_ID,
    adCustomUnitId: AD_CUSTOM_UNIT_ID,
    adStatusText: adStatusText(),
    proxyAccessKey: "",
    proxyKeySaved: false,
    notice: "",
    noticeType: "success",
    testingBackend: false,
    backendTestResult: "",
    backendTestType: "success",
    loadingStats: false,
    statsResult: "",
    statsResultType: "success",
    statsCards: [],
    statsMetaRows: [],
  },

  onShow() {
    const savedProxyAccessKey = wx.getStorageSync(PROXY_KEY_STORAGE) || "";

    this.setData({
      proxyAccessKey: savedProxyAccessKey,
      proxyKeySaved: Boolean(savedProxyAccessKey.trim()),
      notice: savedProxyAccessKey ? "已读取本机保存的后端访问密钥。" : "",
      noticeType: "success",
      backendTestResult: "",
    });

    if (savedProxyAccessKey) {
      this.refreshAdminStats();
    }
  },

  handleProxyKeyInput(event) {
    this.setData({
      proxyAccessKey: event.detail.value,
      proxyKeySaved: false,
      notice: "",
      backendTestResult: "",
      statsResult: "",
    });
  },

  saveProxyKey() {
    const accessKey = this.data.proxyAccessKey.trim();

    if (!accessKey) {
      this.setData({
        notice: "请输入后端访问密钥。",
        noticeType: "warning",
      });
      return;
    }

    wx.setStorageSync(PROXY_KEY_STORAGE, accessKey);
    this.setData({
      proxyAccessKey: accessKey,
      proxyKeySaved: true,
      notice: "已保存到本机微信。我们不会把密钥写入项目代码或页面地址。",
      noticeType: "success",
      backendTestResult: "",
      statsResult: "",
    });
    this.refreshAdminStats();
  },

  clearProxyKey() {
    wx.showModal({
      title: "清除本机密钥",
      content: "清除后，查看管理统计和测试后端连接前需要重新填写管理后台密钥。",
      confirmText: "清除",
      success: (result) => {
        if (!result.confirm) {
          return;
        }

        wx.removeStorageSync(PROXY_KEY_STORAGE);
        this.setData({
          proxyAccessKey: "",
          proxyKeySaved: false,
          notice: "已清除本机保存的后端访问密钥。",
          noticeType: "success",
          backendTestResult: "",
          statsResult: "",
          statsCards: [],
          statsMetaRows: [],
        });
      },
    });
  },

  clearLocalData() {
    wx.showModal({
      title: "清除本机数据",
      content: "将清除本机保存的后端访问密钥、出生信息、发送确认、后台任务和解读历史。不会影响 Cloudflare、微信后台或服务器数据。",
      confirmText: "清除",
      success: (result) => {
        if (!result.confirm) {
          return;
        }

        [
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
          proxyAccessKey: "",
          proxyKeySaved: false,
          notice: "已清除本机保存的数据。",
          noticeType: "success",
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
    const accessKey = this.data.proxyAccessKey.trim();

    if (!accessKey) {
      this.setData({
        statsResult: "请先填写并保存管理后台密钥，再读取统计。",
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
      header: {
        "X-Ziwei-Proxy-Key": accessKey,
      },
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          this.setData({
            statsResult: formatAdminStatsError(response.statusCode, response.data),
            statsResultType: "error",
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
    const accessKey = this.data.proxyAccessKey.trim();

    if (!accessKey) {
      this.setData({
        backendTestResult: "请先填写后端访问密钥，再测试连接。",
        backendTestType: "warning",
      });
      return;
    }

    this.setData({
      testingBackend: true,
      backendTestResult: "正在测试 request 合法域名、后端密钥和模型链路。",
      backendTestType: "warning",
    });

    wx.request({
      url: API_URL,
      method: "POST",
      timeout: 60000,
      header: {
        "Content-Type": "application/json",
        "X-Ziwei-Proxy-Key": accessKey,
      },
      data: {
        prompt: "这是小程序后端连通性测试。请只回复：连接正常。",
      },
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          this.setData({
            backendTestResult: formatBackendTestError(response.statusCode, response.data),
            backendTestType: "error",
          });
          return;
        }

        this.setData({
          backendTestResult: "后端连接测试通过。request 域名、访问密钥和模型链路都已返回成功。",
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

  copyValue(event) {
    const value = event.currentTarget.dataset.value;

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
      backendTestResult: this.data.backendTestResult,
      backendTestType: this.data.backendTestType,
      proxyAccessKey: this.data.proxyAccessKey,
      proxyKeySaved: this.data.proxyKeySaved,
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

function formatBackendTestError(statusCode, data) {
  const rawError =
    data && typeof data.error === "string" ? data.error : "后端没有返回明确错误";

  if (statusCode === 401) {
    return "后端访问密钥不正确。请重新粘贴密钥后再测试。";
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

  if (message.includes("timeout")) {
    return "后端连接测试超时。DeepSeek Pro 或网络可能较慢，可以稍后再试。";
  }

  return "后端连接测试失败。请确认手机网络正常，并且 api.tanxj.xyz 已配置为 request 合法域名。";
}

function formatAdminStatsError(statusCode, data) {
  const rawError =
    data && typeof data.error === "string" ? data.error : "管理统计没有返回明确错误";

  if (statusCode === 401) {
    return "管理后台密钥不正确。请重新粘贴密钥后再刷新统计。";
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
  backendTestResult,
  backendTestType,
  proxyAccessKey,
  proxyKeySaved,
}) {
  const keyStatus = proxyKeySaved
    ? "saved"
    : String(proxyAccessKey || "").trim()
      ? "filled-not-saved"
      : "missing";

  return [
    "Ziwei Mini Program Diagnostics",
    `Time: ${new Date().toISOString()}`,
    `Request domain: ${REQUEST_DOMAIN}`,
    `Web-view domain: ${WEBVIEW_DOMAIN}`,
    `LLM endpoint: ${API_URL}`,
    `LLM job endpoint: ${LLM_JOB_URL}`,
    `Public LLM job endpoint: ${PUBLIC_LLM_JOB_URL}`,
    `Admin stats endpoint: ${ADMIN_STATS_URL}`,
    `Ad status: ${adStatusText()}`,
    `Backend key status: ${keyStatus}`,
    `Backend test status: ${backendTestType || "not-run"}`,
    `Backend test result: ${backendTestResult || "not run"}`,
    "Secret included: no",
  ].join("\n");
}
