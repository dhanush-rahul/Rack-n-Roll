import { useCallback, useEffect, useState } from 'react';
import { getExpoUpdatesModule, isExpoUpdatesAvailable } from '../utils/expoUpdatesSafe';

export function useOtaUpdate({ enabled = true } = {}) {
  const [isChecking, setIsChecking] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [otaUpdateReady, setOtaUpdateReady] = useState(false);
  const [checkError, setCheckError] = useState(null);

  const checkForOtaUpdate = useCallback(async () => {
    const Updates = getExpoUpdatesModule();

    if (!enabled || !Updates?.isEnabled) {
      return false;
    }

    setIsChecking(true);
    setCheckError(null);

    try {
      const result = await Updates.checkForUpdateAsync();

      if (!result.isAvailable) {
        setOtaUpdateReady(false);
        return false;
      }

      setIsDownloading(true);
      await Updates.fetchUpdateAsync();
      setOtaUpdateReady(true);
      return true;
    } catch (error) {
      setCheckError(error);
      setOtaUpdateReady(false);
      return false;
    } finally {
      setIsChecking(false);
      setIsDownloading(false);
    }
  }, [enabled]);

  const applyOtaUpdate = useCallback(async () => {
    const Updates = getExpoUpdatesModule();

    if (!Updates?.isEnabled) {
      return false;
    }

    await Updates.reloadAsync();
    return true;
  }, []);

  useEffect(() => {
    checkForOtaUpdate();
  }, [checkForOtaUpdate]);

  return {
    isChecking,
    isDownloading,
    otaUpdateReady,
    checkError,
    checkForOtaUpdate,
    applyOtaUpdate,
    isEnabled: enabled && isExpoUpdatesAvailable(),
  };
}
