import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { AppIcon } from '../../ui/AppIcon';
import { useDiscoverSurfaceCard } from '../../../hooks/useDiscoverSurfaceCard';
import { useTypography } from '../../../context/TypographyContext';
import { tournamentColors } from '../../../styles/tournamentUi';

export function EmptyStateCard({ icon = 'pool', title, message }) {
  const { sp, fs } = useTypography();
  const surfaceCardStyle = useDiscoverSurfaceCard({
    alignItems: 'center',
    paddingVertical: sp(20),
    gap: sp(8),
  });

  return (
    <View style={surfaceCardStyle}>
      <View
        style={{
          width: sp(48),
          height: sp(48),
          borderRadius: sp(24),
          backgroundColor: tournamentColors.primarySoft,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <AppIcon name={icon} size={sp(24)} color={tournamentColors.primary} />
      </View>
      <Text style={{ fontSize: fs(16), fontWeight: '800', color: tournamentColors.text, textAlign: 'center' }}>
        {title}
      </Text>
      <Text style={{ fontSize: fs(14), lineHeight: fs(20), color: tournamentColors.textMuted, textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}
