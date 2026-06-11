const { SHARE_PATH, SHARE_TITLE, SITE_URL } = require("../../config");

Page({
  data: {
    siteUrl: SITE_URL,
  },

  openWebApp() {
    wx.navigateTo({
      url: `/pages/webview/webview?url=${encodeURIComponent(SITE_URL)}`,
    });
  },

  openCompliance() {
    wx.navigateTo({
      url: "/pages/compliance/compliance",
    });
  },

  copyUrl() {
    wx.setClipboardData({
      data: SITE_URL,
      success: () => {
        wx.showToast({
          title: "已复制",
          icon: "success",
        });
      },
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
