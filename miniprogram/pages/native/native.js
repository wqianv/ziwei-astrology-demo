const {
  BIRTH_PROFILE_STORAGE,
  LLM_CONSENT_STORAGE,
  LLM_JOB_STORAGE,
  LLM_JOB_URL,
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
const REPORT_HISTORY_LIMIT = 8;
const HEAVENLY_STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const EARTHLY_BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const JIAZI_CYCLE = Array.from({ length: 60 }, (_, index) =>
  `${HEAVENLY_STEMS[index % 10]}${EARTHLY_BRANCHES[index % 12]}`,
);

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
    queryDate: currentQueryDate(),
    ziweiBoardExpanded: false,
    palaceDetailsExpanded: false,
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
    activeJobId: "",
    activeJobSignature: "",
  },

  onLoad() {
    this.restoreBirthProfile();
    this.syncProxyAccessKey();
    this.refreshProfile();
    this.resumeActiveReportJob();
  },

  onShow() {
    this.syncProxyAccessKey();
    this.resumeActiveReportJob();
  },

  onHide() {
    this.stopTimer();
    this.stopJobPoller();
  },

  onUnload() {
    this.stopTimer();
    this.stopJobPoller();
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
      content: "会清除本机保存的生日、时辰和性别，并恢复为默认示例；不会清除访问密钥和已保存解读。",
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

  toggleZiweiBoard() {
    this.setData({
      ziweiBoardExpanded: !this.data.ziweiBoardExpanded,
    });
  },

  togglePalaceDetails() {
    this.setData({
      palaceDetailsExpanded: !this.data.palaceDetailsExpanded,
    });
  },

  generateReport() {
    const accessKey = this.data.proxyAccessKey.trim();

    if (!accessKey) {
      this.setData({
        error: "请先到设置页保存访问密钥。密钥只保存在本机微信里。",
      });
      return;
    }

    if (!this.data.llmConsentAccepted) {
      this.setData({
        error: "请先勾选生成确认。生成解读时会使用当前出生信息和命盘摘要。",
      });
      return;
    }

    const queryDate = currentQueryDate();
    const reportCacheKey = buildReportCacheKey(this.data, queryDate);
    const prompt = buildPrompt(this.data.profile, {
      queryDate,
      generatedAt: new Date().toISOString(),
      timezone: "Asia/Shanghai",
    });
    const startedAt = new Date().toISOString();
    let jobAccepted = false;

    this.setData({
      queryDate,
      loading: true,
      elapsedSeconds: 0,
      generateButtonText: "提交后台任务",
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
      activeJobId: "",
      activeJobSignature: "",
    });
    this.startTimer();

    wx.request({
      url: LLM_JOB_URL,
      method: "POST",
      timeout: 30000,
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
        const jobId = String(data.jobId || "");

        if (!jobId) {
          this.setData({
            error: "生成服务没有返回任务签，请稍后再试。",
          });
          return;
        }

        jobAccepted = true;
        wx.setStorageSync(PROXY_KEY_STORAGE, accessKey);
        saveActiveReportJob({
          jobId,
          key: reportCacheKey,
          birthKey: buildBirthCacheKey(this.data),
          queryDate,
          startedAt,
        });
        this.setData({
          activeJobId: jobId,
          activeJobSignature: buildJobSignature(jobId),
          proxyKeySaved: true,
          saveNotice: "已提交后台生成；可以停留等待，也可以稍后回来查看。",
          loadingTip: loadingTipFor(this.data.elapsedSeconds),
        });
        this.scheduleJobPoll(accessKey, reportCacheKey, jobId, 1200);
      },
      fail: (error) => {
        this.setData({
          error: formatNetworkError(error),
        });
      },
      complete: () => {
        if (!jobAccepted) {
          this.finishReportJob();
        }
      },
    });
  },

  pollReportJob(accessKey, reportCacheKey, jobId) {
    const queryDate = queryDateFromReportKey(reportCacheKey) || currentQueryDate();

    wx.request({
      url: `${LLM_JOB_URL}/${encodeURIComponent(jobId)}`,
      method: "GET",
      timeout: 20000,
      header: {
        "X-Ziwei-Proxy-Key": accessKey,
      },
      success: (response) => {
        if (response.statusCode < 200 || response.statusCode >= 300) {
          this.finishReportJob(formatRequestError(response.statusCode, response.data));
          return;
        }

        const data = response.data || {};

        if (data.status === "done") {
          this.applyReportData({
            accessKey,
            data: {
              ...data,
              queryDate,
            },
            reportCacheKey,
            cachedReportNotice: `已保存到本机微信，关联问询日期 ${queryDate}。`,
          });
          return;
        }

        if (data.status === "error") {
          this.finishReportJob(data.error || "后台生成失败，请稍后重试。");
          return;
        }

        this.setData({
          loadingTip: loadingTipFor(this.data.elapsedSeconds, data.status),
        });
        this.scheduleJobPoll(accessKey, reportCacheKey, jobId, pollDelayFor(this.data.elapsedSeconds));
      },
      fail: () => {
        this.setData({
          loadingTip: "本机暂时查不到结果；任务仍在生成服务中，稍后会自动再查。",
        });
        this.scheduleJobPoll(accessKey, reportCacheKey, jobId, pollDelayFor(this.data.elapsedSeconds));
      },
    });
  },

  scheduleJobPoll(accessKey, reportCacheKey, jobId, delay) {
    this.stopJobPoller();
    this.pollTimer = setTimeout(() => {
      this.pollReportJob(accessKey, reportCacheKey, jobId);
    }, delay);
  },

  finishReportJob(errorMessage) {
    clearActiveReportJob();
    this.stopTimer();
    this.stopJobPoller();
    this.setData({
      loading: false,
      activeJobId: "",
      activeJobSignature: "",
      error: errorMessage || this.data.error,
      canGenerate: canGenerateReport({
        accessKey: this.data.proxyAccessKey,
        consentAccepted: this.data.llmConsentAccepted,
        loading: false,
      }),
      generateButtonText: "生成原生解读",
    });
  },

  applyReportData({ accessKey, data, reportCacheKey, cachedReportNotice }) {
    const queryDate = data.queryDate || queryDateFromReportKey(reportCacheKey) || currentQueryDate();
    const parsed = parseLLMReport(data.content || "");
    const usage = data.usage || {};
    const reportMeta = `${data.model || "llm"} · 后台生成`;
    const usageText = usage.total_tokens
      ? `tokens: ${usage.prompt_tokens || "-"} prompt / ${
          usage.completion_tokens || "-"
        } completion / ${usage.total_tokens} total`
      : "";
    const reportCache = {
      key: reportCacheKey,
      birthKey: birthKeyFromReportKey(reportCacheKey),
      queryDate,
      savedAt: new Date().toISOString(),
      sections: parsed.sections,
      reportMeta,
      usageText,
      matchedCount: parsed.matchedCount,
    };

    wx.setStorageSync(PROXY_KEY_STORAGE, accessKey);
    saveReportCache(reportCache);
    clearActiveReportJob();
    this.stopTimer();
    this.stopJobPoller();

    if (buildReportCacheKey(this.data, currentQueryDate()) !== reportCacheKey) {
      this.setData({
        loading: false,
        activeJobId: "",
        activeJobSignature: "",
        proxyKeySaved: true,
        generateButtonText: "生成原生解读",
        canGenerate: canGenerateReport({
          accessKey,
          consentAccepted: this.data.llmConsentAccepted,
          loading: false,
        }),
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
      cachedReportNotice,
      proxyKeySaved: true,
      loading: false,
      activeJobId: "",
      activeJobSignature: "",
      queryDate,
      canGenerate: canGenerateReport({
        accessKey,
        consentAccepted: this.data.llmConsentAccepted,
        loading: false,
      }),
      generateButtonText: "生成原生解读",
      saveNotice: "已在本机微信保存访问密钥，下次打开会自动带出。",
    });
  },

  resumeActiveReportJob() {
    const activeJob = readActiveReportJob();
    const accessKey = this.data.proxyAccessKey.trim();
    const queryDate = currentQueryDate();

    if (
      !activeJob ||
      !activeJob.jobId ||
      activeJob.key !== buildReportCacheKey(this.data, queryDate) ||
      this.data.loading
    ) {
      return;
    }

    if (this.data.hasReport) {
      clearActiveReportJob();
      return;
    }

    if (!accessKey) {
      this.setData({
        saveNotice: "有一份解读还没取回；保存访问密钥后会继续查询。",
      });
      return;
    }

    const elapsedSeconds = elapsedSecondsSince(activeJob.startedAt);

    this.setData({
      queryDate,
      loading: true,
      elapsedSeconds,
      generateButtonText: `后台生成中 ${elapsedSeconds}s`,
      loadingTip: loadingTipFor(elapsedSeconds),
      canGenerate: false,
      error: "",
      activeJobId: activeJob.jobId,
      activeJobSignature: buildJobSignature(activeJob.jobId),
      saveNotice: "已恢复后台任务，正在查询结果。",
    });
    this.startTimer();
    this.scheduleJobPoll(accessKey, activeJob.key, activeJob.jobId, 300);
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
    const queryDate = currentQueryDate();
    const cachedReport = readReportCache(buildReportCacheKey({
      birthDate: this.data.birthDate,
      birthTimeIndex: this.data.birthTimeIndex,
      genderIndex: this.data.genderIndex,
    }, queryDate));
    const reportState = cachedReport
      ? {
          hasReport: true,
          sections: cachedReport.sections,
          reportMeta: cachedReport.reportMeta,
          usageText: cachedReport.usageText,
          matchedCount: cachedReport.matchedCount,
          cachedReportNotice: `已恢复 ${cachedReport.queryDate || queryDate} 的本机解读：${formatSavedAt(cachedReport.savedAt)}`,
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
      queryDate,
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
      content: "会清除当前小程序本机保存的解读历史，不会清除访问密钥。",
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
        generateButtonText: `后台生成中 ${nextElapsedSeconds}s`,
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

  stopJobPoller() {
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = undefined;
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

function buildBirthCacheKey({ birthDate, birthTimeIndex, genderIndex }) {
  const option = baseGenderOptions[Number(genderIndex)] || baseGenderOptions[0];

  return `${birthDate}|${birthTimeIndex}|${option.value}`;
}

function buildReportCacheKey(profile, queryDate) {
  return `${buildBirthCacheKey(profile)}|query:${queryDate || currentQueryDate()}`;
}

function saveReportCache(cache) {
  const history = readReportHistory();
  const nextItems = [
    {
      key: cache.key,
      birthKey: cache.birthKey || birthKeyFromReportKey(cache.key),
      queryDate: cache.queryDate || queryDateFromReportKey(cache.key) || currentQueryDate(),
      savedAt: cache.savedAt,
      sections: cache.sections,
      reportMeta: cache.reportMeta,
      usageText: cache.usageText,
      matchedCount: cache.matchedCount,
    },
    ...history.items.filter((item) => item.key !== cache.key),
  ].slice(0, REPORT_HISTORY_LIMIT);

  wx.setStorageSync(LLM_REPORT_STORAGE, {
    version: 2,
    updatedAt: new Date().toISOString(),
    items: nextItems,
  });
}

function readReportCache(key) {
  return readReportHistory().items.find((item) =>
    item.key === key && Array.isArray(item.sections),
  ) || null;
}

function readReportHistory() {
  const cached = wx.getStorageSync(LLM_REPORT_STORAGE);

  if (!cached || typeof cached !== "object") {
    return {
      version: 2,
      items: [],
    };
  }

  if (Array.isArray(cached.items)) {
    return {
      version: 2,
      items: cached.items.filter((item) => item && item.key && Array.isArray(item.sections)),
    };
  }

  if (cached.key && Array.isArray(cached.sections)) {
    return {
      version: 1,
      items: [
        {
          key: cached.key,
          birthKey: birthKeyFromReportKey(cached.key),
          queryDate: queryDateFromReportKey(cached.key),
          savedAt: cached.savedAt,
          sections: cached.sections,
          reportMeta: cached.reportMeta,
          usageText: cached.usageText,
          matchedCount: cached.matchedCount,
        },
      ],
    };
  }

  return {
    version: 2,
    items: [],
  };
}

function saveActiveReportJob(job) {
  wx.setStorageSync(LLM_JOB_STORAGE, {
    jobId: job.jobId,
    key: job.key,
    birthKey: job.birthKey,
    queryDate: job.queryDate,
    startedAt: job.startedAt,
  });
}

function readActiveReportJob() {
  const job = wx.getStorageSync(LLM_JOB_STORAGE);

  if (!job || typeof job !== "object") {
    return null;
  }

  const jobId = String(job.jobId || "");
  const key = String(job.key || "");
  const birthKey = String(job.birthKey || birthKeyFromReportKey(key) || "");
  const queryDate = String(job.queryDate || queryDateFromReportKey(key) || "");
  const startedAt = String(job.startedAt || "");

  if (!jobId || !key) {
    return null;
  }

  return {
    jobId,
    key,
    birthKey,
    queryDate,
    startedAt,
  };
}

function clearActiveReportJob() {
  wx.removeStorageSync(LLM_JOB_STORAGE);
}

function buildJobSignature(jobId) {
  const compactId = String(jobId || "").replace(/[^a-f0-9]/gi, "").toLowerCase();
  const shortCode = compactId.slice(0, 8);

  if (!shortCode) {
    return "";
  }

  const pairs = shortCode.match(/.{1,2}/g) || [];
  const cycleText = pairs.map((pair) =>
    JIAZI_CYCLE[(parseInt(pair.padEnd(2, "0"), 16) || 0) % JIAZI_CYCLE.length],
  ).join(" · ");

  return `${cycleText} / 码 ${shortCode.slice(0, 4)}`;
}

function formatSavedAt(value) {
  if (!value) {
    return "本机缓存";
  }

  return String(value).replace("T", " ").slice(0, 16);
}

function currentQueryDate() {
  return formatDate(new Date());
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function birthKeyFromReportKey(key) {
  return String(key || "").split("|query:")[0] || "";
}

function queryDateFromReportKey(key) {
  const matched = String(key || "").match(/\|query:(\d{4}-\d{2}-\d{2})$/);

  return matched ? matched[1] : "";
}

function buildReportCopyText(data) {
  const genderOption = baseGenderOptions[Number(data.genderIndex)] || baseGenderOptions[0];
  const sectionText = (data.sections || [])
    .filter((section) => section.hasContent)
    .map((section) => [`## ${section.title}`, section.content].join("\n"))
    .join("\n\n");

  return [
    "命理排盘工作台 - 命盘解读",
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

function loadingTipFor(seconds, status) {
  if (status === "queued") {
    return "解读已入队；可以稍后回来查看。";
  }

  if (status === "running") {
    return "正在生成解读；关闭页面也不会取消这次任务。";
  }

  if (seconds < 8) {
    return "正在整理命盘摘要并提交生成。";
  }

  if (seconds < 25) {
    return "解读已提交，页面可以离开，回来会继续取结果。";
  }

  if (seconds < 55) {
    return "DeepSeek Pro 仍在生成分项解读；本机会自动轮询结果。";
  }

  return "这次偏慢也没关系；后台任务完成后会保存到本机微信。";
}

function pollDelayFor(seconds) {
  if (seconds < 20) {
    return 2500;
  }

  if (seconds < 60) {
    return 4000;
  }

  return 7000;
}

function elapsedSecondsSince(value) {
  const startedAt = Date.parse(value);

  if (!Number.isFinite(startedAt)) {
    return 0;
  }

  return Math.max(0, Math.floor((Date.now() - startedAt) / 1000));
}

function formatRequestError(statusCode, data) {
  const rawError =
    data && typeof data.error === "string" ? data.error : "生成服务没有返回明确错误";

  if (statusCode === 401) {
    return "访问密钥不正确。请到设置页重新保存后再试。";
  }

  if (statusCode === 403) {
    return "生成服务拒绝了这次请求。请检查访问配置后再试。";
  }

  if (statusCode === 400 && rawError.includes("Missing prompt")) {
    return "请求内容为空。请返回修改出生信息后再重新生成。";
  }

  if (statusCode === 404 && rawError.includes("Job not found")) {
    return "后台任务已过期或不存在，请重新生成一次。";
  }

  if (statusCode === 413) {
    return "本次解读内容过长，生成服务已拒绝。可以减少附加信息后重试。";
  }

  if (statusCode >= 500) {
    return `生成服务暂时异常（${statusCode}）：${rawError}`;
  }

  return `生成请求失败（${statusCode}）：${rawError}`;
}

function formatNetworkError(error) {
  const message = error && error.errMsg ? error.errMsg : "";

  if (message.includes("url not in domain list")) {
    return "请求被微信拦截。请在小程序后台把 https://api.tanxj.xyz 配置为 request 合法域名。";
  }

  if (message.includes("timeout")) {
    return "本机查询超时。后台任务可能仍在继续，可以稍后回到页面查看。";
  }

  return "网络请求失败。请确认手机网络正常，并且 api.tanxj.xyz 已配置为 request 合法域名。";
}
