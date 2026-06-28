import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { tournamentColors } from '../../../styles/tournamentUi';

export function TabStatsRow({ stats = [] }) {
  const { sp, isWide } = useTypography();

  if (stats.length === 0) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isWide ? sp(10) : 8 }}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={{
            flexGrow: 1,
            minWidth: '28%',
            paddingVertical: isWide ? sp(12) : 12,
            paddingHorizontal: isWide ? sp(14) : 14,
            borderRadius: 14,
            backgroundColor: '#f8fafc',
            borderWidth: 1,
            borderColor: tournamentColors.cardBorder,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.6, color: tournamentColors.textMuted }}>
            {stat.label}
          </Text>
          <Text style={{ fontSize: 22, fontWeight: '800', color: stat.accent || tournamentColors.text, marginTop: 4 }}>
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
