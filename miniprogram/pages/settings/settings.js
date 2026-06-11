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
  },

  onShow() {
    const savedProxyAccessKey = wx.getStorageSync(PROXY_KEY_STORAGE) || "";

    this.setData({
      proxyAccessKey: savedProxyAccessKey,
      proxyKeySaved: Boolean(savedProxyAccessKey.trim()),
      notice: savedProxyAccessKey ? "已读取本机保存的后端访问密钥。" : "",
      noticeType: "success",
    });
  },

  handleProxyKeyInput(event) {
    this.setData({
      proxyAccessKey: event.detail.value,
      proxyKeySaved: false,
      notice: "",
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
