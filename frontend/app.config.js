const appJson = require('./app.json');
const packageJson = require('./package.json');

function toGoogleIosUrlScheme(clientId) {
  const normalized = String(clientId || '').trim();
  const match = normalized.match(/^([\w-]+)\.apps\.googleusercontent\.com$/);

  if (!match) {
    return null;
  }

  return `com.googleusercontent.apps.${match[1]}`;
}

const iosClientId =
  process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;
const iosUrlScheme = toGoogleIosUrlScheme(iosClientId);

const plugins = appJson.expo.plugins.filter((plugin) => {
  if (plugin === '@react-native-google-signin/google-signin') {
    return false;
  }

  if (Array.isArray(plugin) && plugin[0] === '@react-native-google-signin/google-signin') {
    return false;
  }

  return true;
});

if (iosUrlScheme) {
  plugins.push([
    '@react-native-google-signin/google-signin',
    {
      iosUrlScheme,
    },
  ]);
}

module.exports = {
  expo: {
    ...appJson.expo,
    version: packageJson.version,
    plugins,
  },
};
