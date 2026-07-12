import AsyncStorage from '@react-native-async-storage/async-storage';

const DISMISS_KEY = 'rack_n_roll_web_install_dismissed';

export async function isWebInstallPromptDismissed() {
  const value = await AsyncStorage.getItem(DISMISS_KEY);
  return value === 'true';
}

export async function dismissWebInstallPrompt() {
  await AsyncStorage.setItem(DISMISS_KEY, 'true');
}

export async function resetWebInstallPromptDismissal() {
  await AsyncStorage.removeItem(DISMISS_KEY);
}
