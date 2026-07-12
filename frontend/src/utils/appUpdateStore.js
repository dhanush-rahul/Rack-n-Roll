import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISS_KEY_PREFIX = 'rack_n_roll_optional_update_dismissed';

const buildDismissKey = (latestVersion) => `${DISMISS_KEY_PREFIX}:${String(latestVersion || '').trim()}`;

export async function isOptionalUpdateDismissed(latestVersion) {
  const value = await AsyncStorage.getItem(buildDismissKey(latestVersion));
  return value === 'true';
}

export async function dismissOptionalUpdate(latestVersion) {
  await AsyncStorage.setItem(buildDismissKey(latestVersion), 'true');
}

export async function resetOptionalUpdateDismissal(latestVersion) {
  await AsyncStorage.removeItem(buildDismissKey(latestVersion));
}
