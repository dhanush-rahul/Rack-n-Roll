import { Platform } from 'react-native';
import Constants from 'expo-constants';
import * as Application from 'expo-application';

export function getInstalledAppVersionInfo() {
  const appVersion =
    Application.nativeApplicationVersion ||
    Constants.expoConfig?.extra?.appVersion ||
    Constants.expoConfig?.version ||
    '0.0.0';

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
    appVersion: String(appVersion),
    buildNumber: Number.isFinite(buildNumber) ? buildNumber : 0,
    platform: Platform.OS,
  };
}
