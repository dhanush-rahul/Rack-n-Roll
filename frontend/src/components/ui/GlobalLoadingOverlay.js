import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useIsFetching, useIsMutating } from '@tanstack/react-query';
import { useApiLoadingCount } from '../../services/apiLoadingStore';

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
    <View style={styles.overlay} pointerEvents="none">
      <View style={styles.badge}>
        <ActivityIndicator size="small" color="#ffffff" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
  },
  badge: {
    backgroundColor: 'rgba(15, 23, 42, 0.72)',
    borderRadius: 999,
    padding: 14,
  },
});
