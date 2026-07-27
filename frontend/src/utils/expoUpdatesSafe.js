import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo-modules-core';

let updatesModule = null;
let loadAttempted = false;

const disabledUpdates = {
  isEnabled: false,
  checkForUpdateAsync: async () => ({ isAvailable: false }),
  fetchUpdateAsync: async () => ({}),
  reloadAsync: async () => {},
};

function loadUpdatesModule() {
  if (loadAttempted) {
    return updatesModule;
  }

  loadAttempted = true;

  if (Platform.OS === 'web') {
    updatesModule = disabledUpdates;
    return updatesModule;
  }

  const nativeModule = requireOptionalNativeModule('ExpoUpdates');
  if (!nativeModule) {
    updatesModule = disabledUpdates;
    return updatesModule;
  }

  try {
    // Only load JS bindings when the native ExpoUpdates module exists in this binary.
    // eslint-disable-next-line global-require
    updatesModule = require('expo-updates');
  } catch {
    updatesModule = disabledUpdates;
  }

  return updatesModule;
}

export function isExpoUpdatesAvailable() {
  const Updates = loadUpdatesModule();
  return Boolean(Updates?.isEnabled);
}

export function getExpoUpdatesModule() {
  return loadUpdatesModule();
}
