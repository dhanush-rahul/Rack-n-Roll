import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';

const REMEMBER_ME_KEY = 'rack_n_roll_remember_me';
const USERNAME_KEY = 'rack_n_roll_remembered_username';
const PASSWORD_KEY = 'rack_n_roll_remembered_password';
const useSecureStore = Platform.OS !== 'web';

async function readValue(key) {
  if (!useSecureStore) {
    return AsyncStorage.getItem(key);
  }

  try {
    return (await SecureStore.getItemAsync(key)) ?? (await AsyncStorage.getItem(key));
  } catch {
    return AsyncStorage.getItem(key);
  }
}

async function writeValue(key, value) {
  if (!useSecureStore) {
    return AsyncStorage.setItem(key, value);
  }

  try {
    await SecureStore.setItemAsync(key, value);
    await AsyncStorage.removeItem(key);
  } catch {
    await AsyncStorage.setItem(key, value);
  }
}

async function removeValue(key) {
  if (!useSecureStore) {
    return AsyncStorage.removeItem(key);
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    // Ignore SecureStore cleanup errors.
  }

  return AsyncStorage.removeItem(key);
}

export async function getRememberMeEnabled() {
  const value = await readValue(REMEMBER_ME_KEY);
  return value === 'true';
}

export async function getRememberedCredentials() {
  const enabled = await getRememberMeEnabled();

  if (!enabled) {
    return null;
  }

  const username = await readValue(USERNAME_KEY);
  const password = await readValue(PASSWORD_KEY);

  if (!username || !password) {
    return null;
  }

  return { username, password };
}

export async function saveRememberedCredentials({ username, password }) {
  await writeValue(REMEMBER_ME_KEY, 'true');
  await writeValue(USERNAME_KEY, String(username || '').trim());
  await writeValue(PASSWORD_KEY, String(password || ''));
}

export async function clearRememberedCredentials() {
  await removeValue(REMEMBER_ME_KEY);
  await removeValue(USERNAME_KEY);
  await removeValue(PASSWORD_KEY);
}
