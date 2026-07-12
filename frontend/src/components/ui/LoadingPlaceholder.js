import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ScaledText as Text } from './ScaledText';
import { tournamentColors } from '../../styles/tournamentUi';

export function LoadingPlaceholder({
  message = 'Loading…',
  compact = false,
  style,
}) {
  return (
    <View
      style={[
        {
          alignItems: 'center',
          justifyContent: 'center',
          paddingVertical: compact ? 24 : 48,
          paddingHorizontal: 16,
          gap: 12,
        },
        style,
      ]}
    >
      <ActivityIndicator size="small" color={tournamentColors.primary} />
      <Text
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: tournamentColors.textMuted,
          textAlign: 'center',
        }}
      >
        {message}
      </Text>
    </View>
  );
}
