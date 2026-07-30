/** Rack n Roll does not use Expo DOM WebView; exclude incompatible native module on SDK 54. */
module.exports = {
  dependencies: {
    '@expo/dom-webview': {
      platforms: {
        android: null,
        ios: null,
      },
    },
  },
};
