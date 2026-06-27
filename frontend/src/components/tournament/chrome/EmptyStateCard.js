import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { AppIcon } from '../../ui/AppIcon';
import { discoverUi, tournamentColors } from '../../../styles/tournamentUi';

export function EmptyStateCard({ icon = 'pool', title, message }) {
  return (
    <View style={[discoverUi.surfaceCard, { alignItems: 'center', paddingVertical: 24, gap: 10 }]}>
      <View
        style={{
          width: 56,
          height: 56,
          borderRadius: 28,
          backgroundColor: '#eff4ff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppIcon name={icon} size={28} color={tournamentColors.primary} />
      </View>
      <Text style={{ fontSize: 17, fontWeight: '800', color: tournamentColors.text, textAlign: 'center' }}>
        {title}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: tournamentColors.textMuted, textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}
