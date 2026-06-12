const {
  API_URL,
  PROXY_KEY_STORAGE,
  REQUEST_DOMAIN,
  SHARE_PATH,
  SHARE_TITLE,
  WEBVIEW_DOMAIN,
} = require("../../config");

Page({
  data: {
    apiUrl: API_URL,
    requestDomain: REQUEST_DOMAIN,
    webviewDomain: WEBVIEW_DOMAIN,
    proxyAccessKey: "",
    proxyKeySaved: false,
    notice: "",
    noticeType: "success",
    testingBackend: false,
    backendTestResult: "",
    backendTestType: "success",
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
  },

  handleProxyKeyInput(event) {
    this.setData({
      proxyAccessKey: event.detail.value,
      proxyKeySaved: false,
      notice: "",
      backendTestResult: "",
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
    });
  },

  clearProxyKey() {
    wx.showModal({
      title: "清除本机密钥",
      content: "清除后，生成 LLM 解读前需要重新填写后端访问密钥。",
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
