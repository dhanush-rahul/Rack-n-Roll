import { Platform } from 'react-native';
import Constants from 'expo-constants';

const API_PORT = 4000;
export const PRODUCTION_API_BASE_URL = 'https://rack-n-roll.onrender.com';

const trimTrailingSlash = (url) => String(url).replace(/\/$/, '');

/** LAN IP from Expo Metro (e.g. 10.0.0.215:8081) — used for physical devices / Expo Go. */
const getExpoDevHost = () => {
  const debuggerHost =
    Constants.expoConfig?.hostUri ||
    Constants.expoGoConfig?.debuggerHost ||
    Constants.manifest?.debuggerHost ||
    Constants.manifest2?.extra?.expoGo?.debuggerHost;

  if (!debuggerHost || typeof debuggerHost !== 'string') {
    return null;
  }

  const host = debuggerHost.split(':')[0]?.trim();
  if (!host || host === 'localhost' || host === '127.0.0.1') {
    return null;
  }

  return host;
};

/**
 * Resolve backend base URL for local dev and production.
 * Set EXPO_PUBLIC_API_BASE_URL in .env, or use "auto" for platform-aware local defaults.
 */
export const resolveApiBaseUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();

  if (fromEnv && fromEnv !== 'auto') {
    return trimTrailingSlash(fromEnv);
  }

  if (Platform.OS === 'web') {
    if (typeof __DEV__ !== 'undefined' && !__DEV__) {
      return PRODUCTION_API_BASE_URL;
    }
    return `http://localhost:${API_PORT}`;
  }

  if (Platform.OS === 'android') {
    const expoHost = getExpoDevHost();
    if (!expoHost) {
      return `http://10.0.2.2:${API_PORT}`;
    }
    return `http://${expoHost}:${API_PORT}`;
  }

  const expoHost = getExpoDevHost();
  if (expoHost) {
    return `http://${expoHost}:${API_PORT}`;
  }

  return `http://localhost:${API_PORT}`;
};
