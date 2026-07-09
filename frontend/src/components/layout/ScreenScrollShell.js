import React from 'react';
import { Platform, ScrollView } from 'react-native';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { tournamentUi } from '../../styles/tournamentUi';
import { centeredContentStyle, useResponsiveLayout } from '../../utils/responsive';

export function ScreenScrollShell({
  children,
  style,
  contentContainerStyle,
  ...scrollProps
}) {
  const { contentMaxWidth, horizontalPadding, isDesktopWeb } = useResponsiveLayout();
  const { scrollPaddingBottom } = useScreenInsets();

  return (
    <ScrollView
      style={[
        tournamentUi.screen,
        isDesktopWeb && { backgroundColor: '#eef2f6' },
        style,
      ]}
      contentContainerStyle={[
        {
          paddingHorizontal: horizontalPadding,
          paddingTop: isDesktopWeb ? 20 : 16,
          paddingBottom: scrollPaddingBottom,
        },
        centeredContentStyle(contentMaxWidth),
        contentContainerStyle,
      ]}
      removeClippedSubviews={false}
      showsVerticalScrollIndicator={Platform.OS === 'web'}
      {...scrollProps}
    >
      {children}
    </ScrollView>
  );
}
