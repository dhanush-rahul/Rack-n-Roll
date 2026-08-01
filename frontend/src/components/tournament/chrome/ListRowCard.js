import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { tournamentColors } from '../../../styles/tournamentUi';

export function ListRowCard({ title, subtitle, children }) {
  const { sp, fs } = useTypography();

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        borderRadius: sp(10),
        padding: sp(10),
        gap: sp(7),
        backgroundColor: tournamentColors.surfaceAlt,
      }}
    >
      <View style={{ gap: sp(2) }}>
        <Text style={{ fontWeight: '700', fontSize: fs(15), color: tournamentColors.text }}>{title}</Text>
        {Boolean(subtitle) && <Text style={{ fontSize: fs(13), color: tournamentColors.textMuted }}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}
