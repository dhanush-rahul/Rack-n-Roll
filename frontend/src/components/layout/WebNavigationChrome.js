import React from 'react';
import { Platform, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { LegalFooter } from '../legal/LegalLinks';
import { tournamentColors } from '../../styles/tournamentUi';
import { centeredContentStyle, useResponsiveLayout } from '../../utils/responsive';

export function WebDesktopFooter() {
  const { isDesktopWeb, contentMaxWidth, horizontalPadding } = useResponsiveLayout();

  if (Platform.OS !== 'web' || !isDesktopWeb) {
    return null;
  }

  return (
    <View
      style={{
        borderTopWidth: 1,
        borderTopColor: '#e2e8f0',
        backgroundColor: '#ffffff',
        paddingVertical: 16,
      }}
    >
      <View style={[{ width: '100%', paddingHorizontal: horizontalPadding }, centeredContentStyle(contentMaxWidth)]}>
        <LegalFooter style={{ marginTop: 0 }} />
        <Text style={{ marginTop: 8, textAlign: 'center', color: tournamentColors.textMuted, fontSize: 11 }}>
          Rack-N-Roll · Pool tournament management
        </Text>
      </View>
    </View>
  );
}
