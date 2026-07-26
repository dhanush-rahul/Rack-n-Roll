import React from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { centeredContentStyle, useResponsiveLayout } from '../../utils/responsive';

export function AppHeaderShell({ children, style }) {
  const { colors } = useTheme();
  const { contentMaxWidth, horizontalPadding, isDesktopWeb } = useResponsiveLayout();

  const glassStyle =
    Platform.OS === 'web'
      ? {
          backgroundColor: colors.headerBar,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        }
      : {
          backgroundColor: colors.headerBar,
        };

  return (
    <View
      style={[
        {
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 20,
          width: '100%',
          borderBottomWidth: 1,
          borderBottomColor: colors.headerBarBorder,
        },
        glassStyle,
        isDesktopWeb && {
          shadowColor: colors.mode === 'dark' ? '#000000' : '#0f172a',
          shadowOpacity: colors.mode === 'dark' ? 0.28 : 0.08,
          shadowRadius: 12,
          shadowOffset: { width: 0, height: 4 },
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
