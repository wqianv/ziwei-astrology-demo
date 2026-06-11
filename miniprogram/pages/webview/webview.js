const { SHARE_TITLE, SITE_URL } = require("../../config");

function normalizeTargetUrl(value) {
  if (!value) {
    return SITE_URL;
  }

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch (error) {
    decoded = value;
  }

  return decoded.startsWith(SITE_URL) ? decoded : SITE_URL;
}

Page({
  data: {
    targetUrl: SITE_URL,
  },

  onLoad(options) {
    this.setData({
      targetUrl: normalizeTargetUrl(options.url),
    });
  },

  onShareAppMessage() {
    const url = encodeURIComponent(this.data.targetUrl);

    return {
      title: SHARE_TITLE,
      path: `/pages/webview/webview?url=${url}`,
    };
  },

  onShareTimeline() {
    const url = encodeURIComponent(this.data.targetUrl);

    return {
      title: SHARE_TITLE,
      query: `url=${url}`,
    };
  },
});
