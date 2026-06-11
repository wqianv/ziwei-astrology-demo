const { API_URL, SHARE_TITLE, SITE_URL } = require("../../config");
const {
  birthTimes,
  buildLocalCards,
  buildNativeProfile,
  genderOptions: baseGenderOptions,
} = require("../../utils/nativeAstrology");
const { buildPrompt, parseLLMReport, reportSections } = require("../../utils/report");

const PROXY_KEY_STORAGE = "ziwei-mini.proxyAccessKey";

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
    loading: false,
    elapsedSeconds: 0,
    generateButtonText: "生成原生解读",
    error: "",
    saveNotice: "",
    profile: {},
    localCards: [],
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
    const savedProxyAccessKey = wx.getStorageSync(PROXY_KEY_STORAGE) || "";
    this.setData({
      proxyAccessKey: savedProxyAccessKey,
      proxyKeySaved: Boolean(savedProxyAccessKey),
    });
    this.refreshProfile();
  },

  onUnload() {
    this.stopTimer();
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

  handleProxyKeyInput(event) {
    this.setData({
      proxyAccessKey: event.detail.value,
      proxyKeySaved: false,
      saveNotice: "",
    });
  },

  clearProxyKey() {
    wx.removeStorageSync(PROXY_KEY_STORAGE);
    this.setData({
      proxyAccessKey: "",
      proxyKeySaved: false,
      saveNotice: "已清除本机保存的后端访问密钥。",
    });
  },

  openWebApp() {
    wx.navigateTo({
      url: `/pages/webview/webview?url=${encodeURIComponent(SITE_URL)}`,
    });
  },

  generateReport() {
    const accessKey = this.data.proxyAccessKey.trim();

    if (!accessKey) {
      this.setData({
        error: "请先填写后端访问密钥。密钥只保存在本机微信里。",
      });
      return;
    }

    const prompt = buildPrompt(this.data.profile);

    this.startTimer();
    this.setData({
      loading: true,
      elapsedSeconds: 0,
      generateButtonText: "LLM 生成中 0s",
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
            error:
              (response.data && response.data.error) ||
              `LLM 请求失败：${response.statusCode}`,
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
          saveNotice: "已在本机微信保存后端访问密钥，下次打开会自动带出。",
        });
      },
      fail: () => {
        this.setData({
          error: "网络请求失败。请确认 api.tanxj.xyz 已配置为 request 合法域名。",
        });
      },
      complete: () => {
        this.stopTimer();
        this.setData({
          loading: false,
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

    this.setData({
      profile,
      localCards: buildLocalCards(profile),
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
