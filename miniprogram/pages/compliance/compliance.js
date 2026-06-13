const { SHARE_PATH, SHARE_TITLE } = require("../../config");

Page({
  data: {
    modelTitleTapCount: 0,
  },

  handleModelTitleTap() {
    const now = Date.now();

    if (!this.lastModelTitleTapAt || now - this.lastModelTitleTapAt > 2500) {
      this.modelTitleTapCount = 0;
    }

    this.lastModelTitleTapAt = now;
    this.modelTitleTapCount = (this.modelTitleTapCount || 0) + 1;

    if (this.modelTitleTapCount < 7) {
      return;
    }

    this.modelTitleTapCount = 0;
    wx.navigateTo({
      url: "/pages/settings/settings?from=hidden-admin",
    });
  },

  onShareAppMessage() {
    return {
      title: `${SHARE_TITLE}使用说明`,
      path: SHARE_PATH,
    };
  },

  onShareTimeline() {
    return {
      title: `${SHARE_TITLE}使用说明`,
      query: "",
    };
  },
});
