import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { dismissWebInstallPrompt, isWebInstallPromptDismissed } from '../utils/webInstallStore';

function detectIosSafari() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return false;
  }

  const userAgent = navigator.userAgent || '';
  const isIos = /iphone|ipad|ipod/i.test(userAgent);
  const isSafari = /safari/i.test(userAgent) && !/crios|fxios|edgios/i.test(userAgent);
  return isIos && isSafari;
}

function isStandaloneWebApp() {
  if (typeof window === 'undefined') {
    return false;
  }

  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches === true ||
    window.navigator?.standalone === true
  );
}

export function useWebInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [isDismissed, setIsDismissed] = useState(true);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIosSafari, setIsIosSafari] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return undefined;
    }

    let cancelled = false;

    (async () => {
      const [dismissed, installed] = await Promise.all([
        isWebInstallPromptDismissed(),
        Promise.resolve(isStandaloneWebApp()),
      ]);

      if (!cancelled) {
        setIsDismissed(dismissed);
        setIsInstalled(installed);
        setIsIosSafari(detectIosSafari());
      }
    })();

    const handleBeforeInstallPrompt = (event) => {
      event.preventDefault();
      setDeferredPrompt(event);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      cancelled = true;
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const dismiss = useCallback(async () => {
    await dismissWebInstallPrompt();
    setIsDismissed(true);
  }, []);

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) {
      return false;
    }

    await deferredPrompt.prompt();
    await deferredPrompt.userChoice;
    setDeferredPrompt(null);
    return true;
  }, [deferredPrompt]);

  const canPromptInstall = Boolean(deferredPrompt);
  const showManualIosInstructions = isIosSafari && !isInstalled;
  const isVisible =
    Platform.OS === 'web' && !isInstalled && !isDismissed && (canPromptInstall || showManualIosInstructions);

  return {
    isVisible,
    canPromptInstall,
    showManualIosInstructions,
    promptInstall,
    dismiss,
  };
}
