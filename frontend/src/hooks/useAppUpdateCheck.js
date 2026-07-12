import { useCallback, useEffect, useMemo, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { fetchAppVersionRequirements } from '../services/appVersionService';
import { getInstalledAppVersionInfo } from '../utils/getInstalledAppVersion';
import { dismissOptionalUpdate, isOptionalUpdateDismissed } from '../utils/appUpdateStore';
import { isVersionGreaterThan, isVersionLessThan } from '../utils/semver';
import { logApiError } from '../utils/errorLogger';

function resolveStoreUrl(requirements, platform) {
  if (platform === 'ios' && requirements?.iosStoreUrl) {
    return requirements.iosStoreUrl;
  }

  return requirements?.androidStoreUrl || null;
}

function evaluateUpdateState(requirements, installed) {
  if (!requirements) {
    return {
      mandatoryUpdate: null,
      optionalUpdate: null,
    };
  }

  const storeUrl = resolveStoreUrl(requirements, installed.platform);

  if (installed.platform === 'web') {
    const belowMinimum = isVersionLessThan(installed.appVersion, requirements.minWebVersion);
    const belowLatest = isVersionGreaterThan(installed.appVersion, requirements.latestVersion);

    if (belowMinimum) {
      return {
        mandatoryUpdate: {
          message: requirements.mandatoryMessage,
          storeUrl: null,
          latestVersion: requirements.latestVersion,
          kind: 'web',
        },
        optionalUpdate: null,
      };
    }

    if (belowLatest) {
      return {
        mandatoryUpdate: null,
        optionalUpdate: {
          message: requirements.updateMessage,
          storeUrl: null,
          latestVersion: requirements.latestVersion,
          kind: 'web',
        },
      };
    }

    return { mandatoryUpdate: null, optionalUpdate: null };
  }

  const minBuild =
    installed.platform === 'ios'
      ? Number(requirements.minIosBuildNumber || 0)
      : Number(requirements.minAndroidVersionCode || 0);

  if (installed.buildNumber > 0 && minBuild > 0 && installed.buildNumber < minBuild) {
    return {
      mandatoryUpdate: {
        message: requirements.mandatoryMessage,
        storeUrl,
        latestVersion: requirements.latestVersion,
        kind: 'store',
      },
      optionalUpdate: null,
    };
  }

  const belowLatest = isVersionGreaterThan(installed.appVersion, requirements.latestVersion);

  if (belowLatest && storeUrl) {
    return {
      mandatoryUpdate: null,
      optionalUpdate: {
        message: requirements.updateMessage,
        storeUrl,
        latestVersion: requirements.latestVersion,
        kind: 'store',
      },
    };
  }

  return { mandatoryUpdate: null, optionalUpdate: null };
}

export function useAppUpdateCheck() {
  const [installed, setInstalled] = useState(() => getInstalledAppVersionInfo());
  const [requirements, setRequirements] = useState(null);
  const [isChecking, setIsChecking] = useState(true);
  const [optionalDismissed, setOptionalDismissed] = useState(false);
  const [checkError, setCheckError] = useState(null);

  const refresh = useCallback(async () => {
    setIsChecking(true);
    setCheckError(null);

    const installedInfo = getInstalledAppVersionInfo();
    setInstalled(installedInfo);

    try {
      const nextRequirements = await fetchAppVersionRequirements();
      setRequirements(nextRequirements);

      if (nextRequirements?.latestVersion) {
        const dismissed = await isOptionalUpdateDismissed(nextRequirements.latestVersion);
        setOptionalDismissed(dismissed);
      } else {
        setOptionalDismissed(false);
      }
    } catch (error) {
      logApiError(error, { screen: 'AppUpdate', action: 'fetchVersionRequirements' });
      setCheckError(error);
    } finally {
      setIsChecking(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const { mandatoryUpdate, optionalUpdate } = useMemo(
    () => evaluateUpdateState(requirements, installed),
    [installed, requirements]
  );

  const visibleOptionalUpdate = optionalUpdate && !optionalDismissed ? optionalUpdate : null;

  const openStore = useCallback(async (url) => {
    const targetUrl = String(url || '').trim();

    if (!targetUrl) {
      return false;
    }

    const canOpen = await Linking.canOpenURL(targetUrl);

    if (!canOpen) {
      return false;
    }

    await Linking.openURL(targetUrl);
    return true;
  }, []);

  const dismissOptional = useCallback(async () => {
    if (!optionalUpdate?.latestVersion) {
      return;
    }

    await dismissOptionalUpdate(optionalUpdate.latestVersion);
    setOptionalDismissed(true);
  }, [optionalUpdate?.latestVersion]);

  const reloadWebApp = useCallback(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') {
      return;
    }

    window.location.reload();
  }, []);

  return {
    installed,
    requirements,
    isChecking,
    checkError,
    mandatoryUpdate,
    optionalUpdate: visibleOptionalUpdate,
    refresh,
    openStore,
    dismissOptional,
    reloadWebApp,
  };
}
