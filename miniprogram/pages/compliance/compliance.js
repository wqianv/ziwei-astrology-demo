const { SHARE_PATH, SHARE_TITLE } = require("../../config");

Page({
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
