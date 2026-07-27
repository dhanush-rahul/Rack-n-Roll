import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { LegalFooter } from '../legal/LegalLinks';
import { PageColumn } from './PageColumn';
import { useTheme } from '../../context/ThemeContext';
import { useResponsiveLayout } from '../../utils/responsive';

export function WebDesktopFooter() {
  const { colors } = useTheme();
  const { isWeb, contentMaxWidth } = useResponsiveLayout();

  if (!isWeb || !contentMaxWidth) {
    return null;
  }

  return (
    <View style={{ width: '100%', paddingBottom: 3 }}>
      <PageColumn shellNativeID="racknroll-footer-shell" style={{ transform: [{ translateX: -4 }] }}>
        <View
          style={{
            borderTopWidth: 1,
            borderTopColor: colors.tabBarBorder,
            backgroundColor: colors.tabBar,
            paddingVertical: 6,
            paddingHorizontal: 10,
          }}
        >
          <LegalFooter variant="webFooter" style={{ marginTop: 0 }} />
          <Text style={{ marginTop: 3, textAlign: 'center', color: colors.textMuted, fontSize: 10, lineHeight: 13 }}>
            Rack-N-Roll · Pool tournament management
          </Text>
        </View>
      </PageColumn>
    </View>
  );
}
