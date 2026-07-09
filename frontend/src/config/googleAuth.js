import { Platform } from 'react-native';

const readClientId = (value) => String(value || '').trim();

export const googleAuthConfig = {
  webClientId: readClientId(process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID),
  iosClientId: readClientId(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  androidClientId: readClientId(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
};

export function isGoogleSignInConfigured() {
  return Boolean(googleAuthConfig.webClientId);
}

/** Google sign-in is native-only until web OAuth is fully configured. */
export function isGoogleSignInAvailable() {
  return Platform.OS !== 'web' && isGoogleSignInConfigured();
}

export function resolveGoogleAuthRequestConfig() {
  const { webClientId, iosClientId, androidClientId } = googleAuthConfig;

  return {
    webClientId,
    iosClientId: iosClientId || webClientId,
    androidClientId: androidClientId || webClientId,
  };
}
