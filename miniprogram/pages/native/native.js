const {
  API_URL,
  BIRTH_PROFILE_STORAGE,
  LLM_CONSENT_STORAGE,
  LLM_REPORT_STORAGE,
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

const DEFAULT_BIRTH_PROFILE = {
  birthDate: "2003-10-12",
  birthTimeIndex: 1,
  genderIndex: 0,
};

Page({
  data: {
    birthDate: DEFAULT_BIRTH_PROFILE.birthDate,
    birthTimeIndex: DEFAULT_BIRTH_PROFILE.birthTimeIndex,
    birthTimeText: birthTimes[DEFAULT_BIRTH_PROFILE.birthTimeIndex],
    birthTimes,
    genderIndex: DEFAULT_BIRTH_PROFILE.genderIndex,
    genderOptions: decorateGenderOptions(DEFAULT_BIRTH_PROFILE.genderIndex),
    birthProfileSaved: false,
    birthProfileNotice: "",
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
    summaryRows: [],
    ziweiPalaces: [],
    ziweiKeyPalaces: [],
    ziweiBoardCells: [],
    selectedPalace: {},
    sections: emptyReportSections(),
    reportMeta: "",
    usageText: "",
    matchedCount: 0,
    hasReport: false,
    cachedReportNotice: "",
  },

  onLoad() {
    this.restoreBirthProfile();
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
      birthProfileSaved: true,
      birthProfileNotice: "出生信息已保存到本机微信。",
    });
    this.saveBirthProfile();
    this.refreshProfile();
  },

  handleBirthTimeChange(event) {
    this.setData({
      birthTimeIndex: Number(event.detail.value),
      birthTimeText: birthTimes[Number(event.detail.value)],
      birthProfileSaved: true,
      birthProfileNotice: "出生信息已保存到本机微信。",
    });
    this.saveBirthProfile();
    this.refreshProfile();
  },

  selectGender(event) {
    const genderIndex = Number(event.currentTarget.dataset.index);

    this.setData({
      genderIndex,
      genderOptions: decorateGenderOptions(genderIndex),
      birthProfileSaved: true,
      birthProfileNotice: "出生信息已保存到本机微信。",
    });
    this.saveBirthProfile();
    this.refreshProfile();
  },

  restoreBirthProfile() {
    const profile = readBirthProfile();

    if (!profile) {
      return;
    }

    this.setData({
      birthDate: profile.birthDate,
      birthTimeIndex: profile.birthTimeIndex,
      birthTimeText: birthTimes[profile.birthTimeIndex],
      genderIndex: profile.genderIndex,
      genderOptions: decorateGenderOptions(profile.genderIndex),
      birthProfileSaved: true,
      birthProfileNotice: "已恢复本机保存的出生信息。",
    });
  },

  saveBirthProfile() {
    writeBirthProfile({
      birthDate: this.data.birthDate,
      birthTimeIndex: this.data.birthTimeIndex,
      genderIndex: this.data.genderIndex,
    });
  },

  clearBirthProfile() {
    wx.showModal({
      title: "重置出生信息",
      content: "会清除本机保存的生日、时辰和性别，并恢复为默认示例；不会清除后端访问密钥和已保存解读。",
      confirmText: "重置",
      success: (result) => {
        if (!result.confirm) {
          return;
        }

        wx.removeStorageSync(BIRTH_PROFILE_STORAGE);
        this.setData({
          birthDate: DEFAULT_BIRTH_PROFILE.birthDate,
          birthTimeIndex: DEFAULT_BIRTH_PROFILE.birthTimeIndex,
          birthTimeText: birthTimes[DEFAULT_BIRTH_PROFILE.birthTimeIndex],
          genderIndex: DEFAULT_BIRTH_PROFILE.genderIndex,
          genderOptions: decorateGenderOptions(DEFAULT_BIRTH_PROFILE.genderIndex),
          birthProfileSaved: false,
          birthProfileNotice: "已清除本机保存的出生信息。",
        });
        this.refreshProfile();
      },
    });
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
    const reportCacheKey = buildReportCacheKey(this.data);

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
      cachedReportNotice: "",
      sections: emptyReportSections(),
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
        const reportMeta = `${data.model || "llm"} · 后端代理`;
        const usageText = usage.total_tokens
          ? `tokens: ${usage.prompt_tokens || "-"} prompt / ${
              usage.completion_tokens || "-"
            } completion / ${usage.total_tokens} total`
          : "";
        const reportCache = {
          key: reportCacheKey,
          savedAt: new Date().toISOString(),
          sections: parsed.sections,
          reportMeta,
          usageText,
          matchedCount: parsed.matchedCount,
        };

        wx.setStorageSync(PROXY_KEY_STORAGE, accessKey);
        saveReportCache(reportCache);
        if (buildReportCacheKey(this.data) !== reportCacheKey) {
          this.setData({
            proxyKeySaved: true,
            saveNotice: "出生信息已变化；本次解读已保存到原出生信息的本机缓存。",
          });
          return;
        }

        this.setData({
          sections: parsed.sections,
          reportMeta,
          usageText,
          matchedCount: parsed.matchedCount,
          hasReport: true,
          cachedReportNotice: "已保存到本机微信；下次打开相同出生信息会自动恢复。",
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
    const cachedReport = readReportCache(buildReportCacheKey({
      birthDate: this.data.birthDate,
      birthTimeIndex: this.data.birthTimeIndex,
      genderIndex: this.data.genderIndex,
    }));
    const reportState = cachedReport
      ? {
          hasReport: true,
          sections: cachedReport.sections,
          reportMeta: cachedReport.reportMeta,
          usageText: cachedReport.usageText,
          matchedCount: cachedReport.matchedCount,
          cachedReportNotice: `已恢复本机保存的上次解读：${formatSavedAt(cachedReport.savedAt)}`,
        }
      : {
          hasReport: false,
          reportMeta: "",
          usageText: "",
          matchedCount: 0,
          cachedReportNotice: "",
          sections: emptyReportSections(),
        };

    const localCards = buildLocalCards(profile);

    this.setData({
      profile,
      localCards,
      summaryRows: buildSummaryRows(localCards),
      ziweiPalaces: profile.ziwei.palaces,
      ziweiKeyPalaces: profile.ziwei.keyPalaces,
      ziweiBoardCells: decorateBoardCells(
        profile.ziwei.boardCells,
        selectedPalace.name,
      ),
      selectedPalace,
      error: "",
      ...reportState,
    });
  },

  clearCachedReport() {
    wx.showModal({
      title: "清除本机解读",
      content: "只会清除当前小程序本机保存的最近一次解读结果，不会清除后端访问密钥。",
      confirmText: "清除",
      success: (result) => {
        if (!result.confirm) {
          return;
        }

        wx.removeStorageSync(LLM_REPORT_STORAGE);
        this.setData({
          hasReport: false,
          reportMeta: "",
          usageText: "",
          matchedCount: 0,
          cachedReportNotice: "",
          sections: emptyReportSections(),
        });
      },
    });
  },

  copyReport() {
    if (!this.data.hasReport) {
      wx.showToast({
        title: "暂无解读",
        icon: "none",
      });
      return;
    }

    wx.setClipboardData({
      data: buildReportCopyText(this.data),
      success: () => {
        wx.showToast({
          title: "已复制",
          icon: "success",
        });
      },
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

function emptyReportSections() {
  return reportSections.map((section) => ({
    id: section.id,
    title: section.title,
    content: "",
    hasContent: false,
  }));
}

function buildSummaryRows(cards) {
  const rows = [];
  const summaryCards = cards || [];

  for (let index = 0; index < summaryCards.length; index += 2) {
    rows.push({
      key: `summary-row-${index}`,
      left: summaryCards[index],
      right: summaryCards[index + 1] || null,
    });
  }

  return rows;
}

function readBirthProfile() {
  const value = wx.getStorageSync(BIRTH_PROFILE_STORAGE);

  if (!value || typeof value !== "object") {
    return null;
  }

  const birthDate = String(value.birthDate || "");
  const birthTimeIndex = Number(value.birthTimeIndex);
  const genderIndex = Number(value.genderIndex);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(birthDate) ||
    !birthTimes[birthTimeIndex] ||
    !baseGenderOptions[genderIndex]
  ) {
    return null;
  }

  return {
    birthDate,
    birthTimeIndex,
    genderIndex,
  };
}

function writeBirthProfile({ birthDate, birthTimeIndex, genderIndex }) {
  wx.setStorageSync(BIRTH_PROFILE_STORAGE, {
    birthDate,
    birthTimeIndex,
    genderIndex,
  });
}

function buildReportCacheKey({ birthDate, birthTimeIndex, genderIndex }) {
  const option = baseGenderOptions[Number(genderIndex)] || baseGenderOptions[0];

  return `${birthDate}|${birthTimeIndex}|${option.value}`;
}

function saveReportCache(cache) {
  wx.setStorageSync(LLM_REPORT_STORAGE, {
    key: cache.key,
    savedAt: cache.savedAt,
    sections: cache.sections,
    reportMeta: cache.reportMeta,
    usageText: cache.usageText,
    matchedCount: cache.matchedCount,
  });
}

function readReportCache(key) {
  const cached = wx.getStorageSync(LLM_REPORT_STORAGE);

  if (!cached || cached.key !== key || !Array.isArray(cached.sections)) {
    return null;
  }

  return cached;
}

function formatSavedAt(value) {
  if (!value) {
    return "本机缓存";
  }

  return String(value).replace("T", " ").slice(0, 16);
}

function buildReportCopyText(data) {
  const genderOption = baseGenderOptions[Number(data.genderIndex)] || baseGenderOptions[0];
  const sectionText = (data.sections || [])
    .filter((section) => section.hasContent)
    .map((section) => [`## ${section.title}`, section.content].join("\n"))
    .join("\n\n");

  return [
    "命理排盘工作台 - LLM 解读",
    `出生日期：${data.birthDate}`,
    `出生时辰：${data.birthTimeText}`,
    `性别：${genderOption.label}`,
    `报告：${data.reportMeta || "-"}`,
    data.usageText ? `用量：${data.usageText}` : "",
    data.cachedReportNotice ? `本机状态：${data.cachedReportNotice}` : "",
    "",
    sectionText || "暂无分项内容。",
    "",
    "说明：内容仅作传统文化与娱乐参考，不构成确定性判断。",
  ].filter((line) => line !== "").join("\n");
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
