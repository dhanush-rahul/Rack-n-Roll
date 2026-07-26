import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { ignoreNextPopStateRef } from '../utils/navigationGuard';

const GUARD_STATE = { racknrollBackGuard: true };

/**
 * Traps the browser Back button on web at the app root and asks whether the user wants to leave.
 * In-app navigation (tabs, stack back) should not trigger the exit prompt.
 */
export function useWebBrowserBackGuard({ enabled = true, navigationRef } = {}) {
  const [exitConfirmVisible, setExitConfirmVisible] = useState(false);
  const isExitingRef = useRef(false);
  const guardInstalledRef = useRef(false);

  const pushGuardState = useCallback(() => {
    if (typeof window === 'undefined') {
      return;
    }

    window.history.pushState(GUARD_STATE, '', window.location.href);
  }, []);

  const installHistoryGuard = useCallback(() => {
    if (typeof window === 'undefined' || guardInstalledRef.current) {
      return;
    }

    guardInstalledRef.current = true;

    if (!window.history.state?.racknrollBackGuard) {
      window.history.replaceState(window.history.state ?? { initial: true }, '', window.location.href);
      pushGuardState();
    }
  }, [pushGuardState]);

  const cancelExit = useCallback(() => {
    setExitConfirmVisible(false);
    pushGuardState();
  }, [pushGuardState]);

  const confirmExit = useCallback(() => {
    setExitConfirmVisible(false);

    if (typeof window === 'undefined') {
      return;
    }

    isExitingRef.current = true;

    const previousUrl = document.referrer;
    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    if (previousUrl) {
      window.location.assign(previousUrl);
      return;
    }

    window.location.assign('about:blank');
  }, []);

  useEffect(() => {
    if (Platform.OS !== 'web' || !enabled || typeof window === 'undefined') {
      return undefined;
    }

    installHistoryGuard();

    const onPopState = () => {
      if (isExitingRef.current) {
        isExitingRef.current = false;
        return;
      }

      if (ignoreNextPopStateRef.current) {
        pushGuardState();
        return;
      }

      window.setTimeout(() => {
        if (navigationRef?.isReady?.() && navigationRef.canGoBack()) {
          pushGuardState();
          return;
        }

        setExitConfirmVisible(true);
        pushGuardState();
      }, 0);
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      guardInstalledRef.current = false;
    };
  }, [enabled, installHistoryGuard, navigationRef, pushGuardState]);

  return {
    exitConfirmVisible,
    confirmExit,
    cancelExit,
  };
}
