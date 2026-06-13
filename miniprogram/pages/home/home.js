const {
  AD_BANNER_UNIT_ID,
  AD_CUSTOM_UNIT_ID,
  SHARE_PATH,
  SHARE_TITLE,
  SITE_URL,
} = require("../../config");

Page({
  data: {
    adBannerUnitId: AD_BANNER_UNIT_ID,
    adCustomUnitId: AD_CUSTOM_UNIT_ID,
    adHidden: false,
    hasAdUnit: Boolean(AD_CUSTOM_UNIT_ID || AD_BANNER_UNIT_ID),
    siteUrl: SITE_URL,
  },

  openNativeApp() {
    wx.navigateTo({
      url: "/pages/native/native",
    });
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

  handleAdLoad() {
    this.setData({
      adHidden: false,
    });
  },

  handleAdError() {
    this.setData({
      adHidden: true,
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
