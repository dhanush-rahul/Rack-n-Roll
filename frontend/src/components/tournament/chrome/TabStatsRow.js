import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { tournamentColors } from '../../../styles/tournamentUi';

export function TabStatsRow({ stats = [] }) {
  const { sp, fs } = useTypography();

  if (stats.length === 0) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp(8) }}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={{
            flexGrow: 1,
            minWidth: '28%',
            paddingVertical: sp(10),
            paddingHorizontal: sp(12),
            borderRadius: sp(12),
            backgroundColor: tournamentColors.surfaceRaised,
            borderWidth: 1,
            borderColor: tournamentColors.cardBorder,
          }}
        >
          <Text style={{ fontSize: fs(11), fontWeight: '700', letterSpacing: 0.6, color: tournamentColors.textMuted }}>
            {stat.label}
          </Text>
          <Text style={{ fontSize: fs(20), fontWeight: '800', color: stat.accent || tournamentColors.text, marginTop: sp(3) }}>
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
}
