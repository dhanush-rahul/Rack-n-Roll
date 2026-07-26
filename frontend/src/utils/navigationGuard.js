/** Set before programmatic tab/history navigation to skip the web exit guard once. */
export const ignoreNextPopStateRef = { current: false };

/** Skip the Android home-screen exit prompt after in-app back navigation. */
export const ignoreNextHardwareBackRef = { current: false };

const IN_APP_BACK_IGNORE_MS = 750;

function scheduleInAppBackIgnoreReset() {
  setTimeout(() => {
    ignoreNextPopStateRef.current = false;
    ignoreNextHardwareBackRef.current = false;
  }, IN_APP_BACK_IGNORE_MS);
}

/** Call before any in-app back navigation (header back, stack pop, tab switch). */
export function markIgnoreNextPopState() {
  ignoreNextPopStateRef.current = true;
  ignoreNextHardwareBackRef.current = true;
  scheduleInAppBackIgnoreReset();
}
