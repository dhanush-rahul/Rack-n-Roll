import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'rack_n_roll_auth_token';
const useSecureStore = Platform.OS !== 'web';

async function migrateLegacyToken() {
  if (!useSecureStore) {
    return null;
  }

  try {
    const legacyToken = await AsyncStorage.getItem(TOKEN_KEY);

    if (!legacyToken) {
      return null;
    }

    await SecureStore.setItemAsync(TOKEN_KEY, legacyToken);
    await AsyncStorage.removeItem(TOKEN_KEY);
    return legacyToken;
  } catch {
    return null;
  }
}

export async function getToken() {
  if (!useSecureStore) {
    return AsyncStorage.getItem(TOKEN_KEY);
  }

  try {
    const secureToken = await SecureStore.getItemAsync(TOKEN_KEY);

    if (secureToken) {
      return secureToken;
    }

    return migrateLegacyToken();
  } catch {
    return AsyncStorage.getItem(TOKEN_KEY);
  }
}

export async function setToken(token) {
  if (!useSecureStore) {
    return AsyncStorage.setItem(TOKEN_KEY, token);
  }

  try {
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    await AsyncStorage.setItem(TOKEN_KEY, token);
  }
}

export async function clearToken() {
  if (!useSecureStore) {
    return AsyncStorage.removeItem(TOKEN_KEY);
  }

  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    // Ignore SecureStore cleanup errors and fall through to AsyncStorage.
  }

  return AsyncStorage.removeItem(TOKEN_KEY);
}
