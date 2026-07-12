import React, { useState } from 'react';
import { Platform, View } from 'react-native';
import { useAppUpdateCheck } from '../hooks/useAppUpdateCheck';
import { useOtaUpdate } from '../hooks/useOtaUpdate';
import { MandatoryUpdateModal } from './MandatoryUpdateModal';
import { OptionalUpdateBanner } from './OptionalUpdateBanner';

export function AppUpdateGate({ children }) {
  const [otaBannerDismissed, setOtaBannerDismissed] = useState(false);
  const {
    mandatoryUpdate,
    optionalUpdate,
    openStore,
    dismissOptional,
    reloadWebApp,
  } = useAppUpdateCheck();

  const ota = useOtaUpdate({ enabled: !mandatoryUpdate });

  const handleMandatoryUpdate = async () => {
    if (mandatoryUpdate?.kind === 'web') {
      reloadWebApp();
      return;
    }

    if (mandatoryUpdate?.storeUrl) {
      await openStore(mandatoryUpdate.storeUrl);
    }
  };

  const handleOptionalUpdate = async () => {
    if (optionalUpdate?.kind === 'web') {
      reloadWebApp();
      return;
    }

    if (optionalUpdate?.storeUrl) {
      await openStore(optionalUpdate.storeUrl);
    }
  };

  const showOtaBanner = ota.isEnabled && ota.otaUpdateReady && !mandatoryUpdate && !otaBannerDismissed;

  return (
    <View style={{ flex: 1 }}>
      {!mandatoryUpdate ? children : null}

      {showOtaBanner ? (
        <View
          style={{
            position: 'absolute',
            left: 12,
            right: 12,
            bottom: Platform.OS === 'web' ? 16 : 24,
            zIndex: 30,
          }}
        >
          <OptionalUpdateBanner
            message="A quick app refresh is ready with the latest fixes."
            primaryLabel="Restart app"
            onPrimaryPress={ota.applyOtaUpdate}
            onDismiss={() => setOtaBannerDismissed(true)}
          />
        </View>
      ) : null}

      <MandatoryUpdateModal
        visible={Boolean(mandatoryUpdate)}
        title="Update required"
        message={mandatoryUpdate?.message || 'Please update Rack n Roll to continue.'}
        confirmLabel={mandatoryUpdate?.kind === 'web' ? 'Refresh now' : 'Update in store'}
        onConfirm={handleMandatoryUpdate}
      />

      {optionalUpdate && !mandatoryUpdate ? (
        <View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            top: Platform.OS === 'web' ? 12 : 0,
            left: 12,
            right: 12,
            zIndex: 20,
          }}
        >
          <OptionalUpdateBanner
            message={optionalUpdate.message}
            latestVersion={optionalUpdate.latestVersion}
            primaryLabel={optionalUpdate.kind === 'web' ? 'Refresh' : 'Update'}
            onPrimaryPress={handleOptionalUpdate}
            onDismiss={dismissOptional}
          />
        </View>
      ) : null}
    </View>
  );
}
