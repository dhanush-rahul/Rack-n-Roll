import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { tournamentColors } from '../../../styles/tournamentUi';

export function ListRowCard({ title, subtitle, children }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        borderRadius: 12,
        padding: 12,
        gap: 8,
        backgroundColor: '#fafbfc',
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: tournamentColors.text }}>{title}</Text>
        {Boolean(subtitle) && <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}
