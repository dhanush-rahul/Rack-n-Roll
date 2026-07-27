import React from 'react';
import { Platform, View } from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { getPageColumnLayout } from '../../utils/pageColumnLayout';
import { useResponsiveLayout } from '../../utils/responsive';

export function AppHeaderShell({ children, style }) {
  const { colors } = useTheme();
  const { contentMaxWidth, horizontalPadding, isDesktopWeb, width } = useResponsiveLayout();
  const isWebConstrainedChrome = Platform.OS === 'web' && Boolean(contentMaxWidth);
  const { shell, inset } = getPageColumnLayout(contentMaxWidth, horizontalPadding, width);

  const glassStyle =
    Platform.OS === 'web' && !isWebConstrainedChrome
      ? {
          backgroundColor: colors.headerBar,
          backdropFilter: 'blur(16px) saturate(160%)',
          WebkitBackdropFilter: 'blur(16px) saturate(160%)',
        }
      : {
          backgroundColor: isWebConstrainedChrome ? colors.tabBar : colors.headerBar,
        };

  const chromeBodyStyle = [
    {
      width: '100%',
      borderBottomWidth: 1,
      borderBottomColor: isWebConstrainedChrome ? colors.tabBarBorder : colors.headerBarBorder,
    },
    glassStyle,
    isDesktopWeb &&
      !isWebConstrainedChrome && {
        shadowColor: colors.mode === 'dark' ? '#000000' : '#0f172a',
        shadowOpacity: colors.mode === 'dark' ? 0.28 : 0.08,
        shadowRadius: 12,
        shadowOffset: { width: 0, height: 4 },
      },
  ];

  if (isWebConstrainedChrome) {
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
          },
          style,
        ]}
      >
        <View style={shell}>
          <View style={inset}>
            <View style={chromeBodyStyle}>{children}</View>
          </View>
        </View>
      </View>
    );
  }

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
      <View style={shell}>
        <View style={inset}>{children}</View>
      </View>
    </View>
  );
}
