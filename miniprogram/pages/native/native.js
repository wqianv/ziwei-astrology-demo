const {
  API_URL,
  LLM_CONSENT_STORAGE,
  PROXY_KEY_STORAGE,
  SHARE_TITLE,
  SITE_URL,
} = require("../../config");
const {
  birthTimes,
  buildLocalCards,
  buildNativeProfile,
  genderOptions: baseGenderOptions,
} = require("../../utils/nativeAstrology");
const { buildPrompt, parseLLMReport, reportSections } = require("../../utils/report");

Page({
  data: {
    birthDate: "2003-10-12",
    birthTimeIndex: 1,
    birthTimeText: birthTimes[1],
    birthTimes,
    genderIndex: 0,
    genderOptions: decorateGenderOptions(0),
    proxyAccessKey: "",
    proxyKeySaved: false,
    llmConsentAccepted: false,
    canGenerate: false,
    loading: false,
    elapsedSeconds: 0,
    generateButtonText: "生成原生解读",
    loadingTip: "正在整理出生信息与命盘摘要。",
    error: "",
    saveNotice: "",
    profile: {},
    localCards: [],
    ziweiPalaces: [],
    ziweiKeyPalaces: [],
    ziweiBoardCells: [],
    selectedPalace: {},
    sections: reportSections.map((section) => ({
      id: section.id,
      title: section.title,
      content: "",
      hasContent: false,
    })),
    reportMeta: "",
    usageText: "",
    matchedCount: 0,
    hasReport: false,
  },

  onLoad() {
    this.syncProxyAccessKey();
    this.refreshProfile();
  },

  onShow() {
    this.syncProxyAccessKey();
  },

  onUnload() {
    this.stopTimer();
  },

  syncProxyAccessKey() {
    const savedProxyAccessKey = wx.getStorageSync(PROXY_KEY_STORAGE) || "";
    const llmConsentAccepted = wx.getStorageSync(LLM_CONSENT_STORAGE) === true;

    this.setData({
      proxyAccessKey: savedProxyAccessKey,
      proxyKeySaved: Boolean(savedProxyAccessKey.trim()),
      llmConsentAccepted,
      canGenerate: canGenerateReport({
        accessKey: savedProxyAccessKey,
        consentAccepted: llmConsentAccepted,
        loading: this.data.loading,
      }),
    });
  },

  handleBirthDateChange(event) {
    this.setData({
      birthDate: event.detail.value,
    });
    this.refreshProfile();
  },

  handleBirthTimeChange(event) {
    this.setData({
      birthTimeIndex: Number(event.detail.value),
      birthTimeText: birthTimes[Number(event.detail.value)],
    });
    this.refreshProfile();
  },

  selectGender(event) {
    const genderIndex = Number(event.currentTarget.dataset.index);

    this.setData({
      genderIndex,
      genderOptions: decorateGenderOptions(genderIndex),
    });
    this.refreshProfile();
  },

  selectPalace(event) {
    const palaceName = event.currentTarget.dataset.name;

    if (!palaceName) {
      return;
    }

    const selectedPalace = findPalaceByName(this.data.ziweiPalaces, palaceName);

    if (!selectedPalace) {
      return;
    }

    this.setData({
      selectedPalace,
      ziweiBoardCells: decorateBoardCells(
        this.data.profile.ziwei.boardCells,
        selectedPalace.name,
      ),
    });
  },

  handleConsentChange(event) {
    const values = event.detail.value || [];
    const llmConsentAccepted = values.includes("accepted");

    wx.setStorageSync(LLM_CONSENT_STORAGE, llmConsentAccepted);
    this.setData({
      llmConsentAccepted,
      canGenerate: canGenerateReport({
        accessKey: this.data.proxyAccessKey,
        consentAccepted: llmConsentAccepted,
        loading: this.data.loading,
      }),
      error: "",
    });
  },

  openWebApp() {
    wx.navigateTo({
      url: `/pages/webview/webview?url=${encodeURIComponent(SITE_URL)}`,
    });
  },

  openSettings() {
    wx.navigateTo({
      url: "/pages/settings/settings",
    });
  },

  generateReport() {
    const accessKey = this.data.proxyAccessKey.trim();

    if (!accessKey) {
      this.setData({
        error: "请先到设置页保存后端访问密钥。密钥只保存在本机微信里。",
      });
      return;
    }

    if (!this.data.llmConsentAccepted) {
      this.setData({
        error: "请先勾选发送确认。生成解读时会把当前出生信息和命盘摘要发送到后端。",
      });
      return;
    }

    const prompt = buildPrompt(this.data.profile);

    this.startTimer();
    this.setData({
      loading: true,
      elapsedSeconds: 0,
      generateButtonText: "LLM 生成中 0s",
      loadingTip: loadingTipFor(0),
      canGenerate: false,
      error: "",
      saveNotice: "",
      hasReport: false,
      reportMeta: "",
      usageText: "",
      matchedCount: 0,
    });

    wx.request({
      url: API_URL,
      method: "POST",
      timeout: 120000,
      header: {
        "Content-Type": "application/json",
        "X-Ziwei-Proxy-Key": accessKey,
      },
      data: {
        prompt,
      },
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          this.setData({
            error: formatRequestError(response.statusCode, response.data),
          });
          return;
        }

        const data = response.data || {};
        const parsed = parseLLMReport(data.content || "");
        const usage = data.usage || {};
        const usageText = usage.total_tokens
          ? `tokens: ${usage.prompt_tokens || "-"} prompt / ${
              usage.completion_tokens || "-"
            } completion / ${usage.total_tokens} total`
          : "";

        wx.setStorageSync(PROXY_KEY_STORAGE, accessKey);
        this.setData({
          sections: parsed.sections,
          reportMeta: `${data.model || "llm"} · 后端代理`,
          usageText,
          matchedCount: parsed.matchedCount,
          hasReport: true,
          proxyKeySaved: true,
          canGenerate: canGenerateReport({
            accessKey,
            consentAccepted: this.data.llmConsentAccepted,
            loading: true,
          }),
          saveNotice: "已在本机微信保存后端访问密钥，下次打开会自动带出。",
        });
      },
      fail: (error) => {
        this.setData({
          error: formatNetworkError(error),
        });
      },
      complete: () => {
        this.stopTimer();
        this.setData({
          loading: false,
          canGenerate: canGenerateReport({
            accessKey: this.data.proxyAccessKey,
            consentAccepted: this.data.llmConsentAccepted,
            loading: false,
          }),
          generateButtonText: "生成原生解读",
        });
      },
    });
  },

  refreshProfile() {
    const gender = baseGenderOptions[this.data.genderIndex].value;
    const profile = buildNativeProfile({
      birthDate: this.data.birthDate,
      birthTimeIndex: this.data.birthTimeIndex,
      gender,
    });
    const previousPalaceName =
      this.data.selectedPalace && this.data.selectedPalace.name
        ? this.data.selectedPalace.name
        : "命宫";
    const selectedPalace =
      findPalaceByName(profile.ziwei.palaces, previousPalaceName) ||
      profile.ziwei.mingPalace;

    this.setData({
      profile,
      localCards: buildLocalCards(profile),
      ziweiPalaces: profile.ziwei.palaces,
      ziweiKeyPalaces: profile.ziwei.keyPalaces,
      ziweiBoardCells: decorateBoardCells(
        profile.ziwei.boardCells,
        selectedPalace.name,
      ),
      selectedPalace,
      hasReport: false,
      error: "",
      sections: reportSections.map((section) => ({
        id: section.id,
        title: section.title,
        content: "",
        hasContent: false,
      })),
    });
  },

  startTimer() {
    this.stopTimer();
    this.timer = setInterval(() => {
      const nextElapsedSeconds = this.data.elapsedSeconds + 1;
      this.setData({
        elapsedSeconds: nextElapsedSeconds,
        generateButtonText: `LLM 生成中 ${nextElapsedSeconds}s`,
        loadingTip: loadingTipFor(nextElapsedSeconds),
      });
    }, 1000);
  },

  stopTimer() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  },

  onShareAppMessage() {
    return {
      title: SHARE_TITLE,
      path: "/pages/native/native",
    };
  },

  onShareTimeline() {
    return {
      title: SHARE_TITLE,
      query: "",
    };
  },
});

function decorateGenderOptions(activeIndex) {
  return baseGenderOptions.map((item, index) => ({
    ...item,
    active: index === activeIndex,
  }));
}

function decorateBoardCells(cells, selectedName) {
  return (cells || []).map((cell) => ({
    ...cell,
    isSelected: !cell.empty && cell.name === selectedName,
  }));
}

function findPalaceByName(palaces, name) {
  return (palaces || []).find((palace) => palace.name === name);
}

function canGenerateReport({ accessKey, consentAccepted, loading }) {
  return Boolean(String(accessKey || "").trim()) && Boolean(consentAccepted) && !loading;
}

function loadingTipFor(seconds) {
  if (seconds < 8) {
    return "正在整理出生信息与命盘摘要。";
  }

  if (seconds < 25) {
    return "正在请求 DeepSeek Pro，通常需要多等一会儿。";
  }

  if (seconds < 55) {
    return "模型还在生成分项解读，请保持页面打开。";
  }

  return "这次请求偏慢；如果超过 2 分钟，可以稍后重试。";
}

function formatRequestError(statusCode, data) {
  const rawError =
    data && typeof data.error === "string" ? data.error : "后端没有返回明确错误";

  if (statusCode === 401) {
    return "后端访问密钥不正确。请到设置页重新保存密钥后再试。";
  }

  if (statusCode === 403) {
    return "后端拒绝了这次请求。请检查 Worker 允许来源配置，或确认当前环境是小程序 request。";
  }

  if (statusCode === 400 && rawError.includes("Missing prompt")) {
    return "请求内容为空。请返回修改出生信息后再重新生成。";
  }

  if (statusCode === 413) {
    return "本次解读内容过长，后端已拒绝。可以减少附加信息后重试。";
  }

  if (statusCode >= 500) {
    return `后端或模型服务暂时异常（${statusCode}）：${rawError}`;
  }

  return `LLM 请求失败（${statusCode}）：${rawError}`;
}

function formatNetworkError(error) {
  const message = error && error.errMsg ? error.errMsg : "";

  if (message.includes("url not in domain list")) {
    return "请求被微信拦截。请在小程序后台把 https://api.tanxj.xyz 配置为 request 合法域名。";
  }

  if (message.includes("timeout")) {
    return "请求超时。DeepSeek Pro 有时较慢，可以稍后重试。";
  }

  return "网络请求失败。请确认手机网络正常，并且 api.tanxj.xyz 已配置为 request 合法域名。";
}
