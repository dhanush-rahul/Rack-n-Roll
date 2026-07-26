import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

function firstNonEmpty(...values) {
  for (const value of values) {
    const normalized = String(value || '').trim();
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

export function getInstalledAppVersionInfo() {
  // On web, expo-application always returns null for nativeApplicationVersion.
  const appVersion = firstNonEmpty(
    Platform.OS === 'web' ? null : Application.nativeApplicationVersion,
    process.env.EXPO_PUBLIC_APP_VERSION,
    Constants.expoConfig?.extra?.appVersion,
    Constants.expoConfig?.version,
    Constants.manifest2?.extra?.expoClient?.version,
    Constants.manifest?.version
  );

  let buildNumber = 0;

  if (Platform.OS === 'android' || Platform.OS === 'ios') {
    buildNumber = Number(Application.nativeBuildVersion || 0);
  }

  if (!buildNumber && Platform.OS === 'android') {
    buildNumber = Number(Constants.expoConfig?.android?.versionCode || 0);
  }

  if (!buildNumber && Platform.OS === 'ios') {
    buildNumber = Number(Constants.expoConfig?.ios?.buildNumber || 0);
  }

  return {
    appVersion: appVersion || '0.0.0',
    buildNumber: Number.isFinite(buildNumber) ? buildNumber : 0,
    platform: Platform.OS,
    isKnownVersion: Boolean(appVersion),
  };
}
