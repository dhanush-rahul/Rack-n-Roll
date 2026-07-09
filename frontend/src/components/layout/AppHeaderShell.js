import React from 'react';
import { View } from 'react-native';
import { centeredContentStyle, useResponsiveLayout } from '../../utils/responsive';

export function AppHeaderShell({ children, style }) {
  const { contentMaxWidth, horizontalPadding, isDesktopWeb } = useResponsiveLayout();

  return (
    <View
      style={[
        {
          width: '100%',
          borderBottomWidth: 1,
          borderBottomColor: '#d3e0e6',
          backgroundColor: '#d3e0e6',
        },
        isDesktopWeb && {
          shadowColor: '#0f172a',
          shadowOpacity: 0.06,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 2 },
        },
        style,
      ]}
    >
      <View
        style={[
          {
            width: '100%',
            paddingHorizontal: horizontalPadding,
          },
          centeredContentStyle(contentMaxWidth),
        ]}
      >
        {children}
      </View>
    </View>
  );
}
