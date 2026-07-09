import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

const GUARD_STATE = { racknrollBackGuard: true };

/**
 * Traps the browser Back button on web and always asks whether the user wants to
 * leave the app or stay. In-app navigation should use the header back control.
 */
export function useWebBrowserBackGuard({ enabled = true }) {
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

      window.setTimeout(() => {
        setExitConfirmVisible(true);
      }, 0);
      pushGuardState();
    };

    window.addEventListener('popstate', onPopState);

    return () => {
      window.removeEventListener('popstate', onPopState);
      guardInstalledRef.current = false;
    };
  }, [enabled, installHistoryGuard, pushGuardState]);

  return {
    exitConfirmVisible,
    confirmExit,
    cancelExit,
  };
}
