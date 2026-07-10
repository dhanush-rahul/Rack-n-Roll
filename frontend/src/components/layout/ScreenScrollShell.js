import React, { forwardRef } from 'react';
import { Platform, ScrollView } from 'react-native';
import { useScreenInsets } from '../../hooks/useScreenInsets';
import { tournamentUi } from '../../styles/tournamentUi';
import { centeredContentStyle, useResponsiveLayout } from '../../utils/responsive';

export const ScreenScrollShell = forwardRef(function ScreenScrollShell(
  {
    children,
    style,
    contentContainerStyle,
    ...scrollProps
  },
  ref
) {
  const { contentMaxWidth, horizontalPadding, isDesktopWeb } = useResponsiveLayout();
  const { scrollPaddingBottom } = useScreenInsets();

  return (
    <ScrollView
      ref={ref}
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
});
