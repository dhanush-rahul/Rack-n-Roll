import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useApiLoadingCount } from '../../services/apiLoadingStore';
import { tournamentColors } from '../../styles/tournamentUi';

const DEBOUNCE_MS = 200;

export function GlobalLoadingOverlay({ enabled = true }) {
  const isFetching = useIsFetching();
  const isMutating = useIsMutating();
  const apiLoadingCount = useApiLoadingCount();
  const [visible, setVisible] = useState(false);

  const shouldShow = enabled && (isFetching > 0 || isMutating > 0 || apiLoadingCount > 0);

  useEffect(() => {
    if (!shouldShow) {
      const timer = setTimeout(() => setVisible(false), DEBOUNCE_MS);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(() => setVisible(true), DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [shouldShow]);

  if (!visible) {
    return null;
  }

  return (
    <View
      style={{
        ...StyleSheet.absoluteFillObject,
        backgroundColor: tournamentColors.selectedSoftBg,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}
      pointerEvents="none"
    >
      <View
        style={{
          backgroundColor: tournamentColors.heroBg,
          borderRadius: 999,
          padding: 14,
          opacity: 0.92,
        }}
      >
        <ActivityIndicator size="small" color={tournamentColors.heroText} />
      </View>
    </View>
  );
}
