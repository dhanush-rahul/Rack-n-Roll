import React from 'react';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Platform, View } from 'react-native';
import { PageColumn } from '../layout/PageColumn';
import { useTheme } from '../../context/ThemeContext';
import { useTypography } from '../../context/TypographyContext';
import {
  WEB_TAB_BAR_FAB_CLEARANCE,
  WEB_TAB_BAR_BOTTOM_PADDING,
  WEB_TAB_BAR_RIGHT_PADDING,
} from '../../hooks/useTabScreenInsets';

export function CenteredWebTabBar(props) {
  const { colors } = useTheme();
  const { sp } = useTypography();

  if (Platform.OS !== 'web') {
    return <BottomTabBar {...props} />;
  }

  return (
    <View
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        overflow: 'visible',
        zIndex: 20,
        paddingTop: WEB_TAB_BAR_FAB_CLEARANCE,
        paddingBottom: sp(WEB_TAB_BAR_BOTTOM_PADDING),
      }}
    >
      <PageColumn shellNativeID="racknroll-tab-bar-shell">
        <View
          nativeID="racknroll-tab-bar-panel"
          style={{
            width: '100%',
            overflow: 'visible',
          }}
        >
          <View
            style={{
              width: '100%',
              borderTopWidth: 1,
              borderTopColor: colors.tabBarBorder,
              backgroundColor: colors.tabBar,
              overflow: 'visible',
              paddingBottom: sp(6),
              paddingRight: sp(WEB_TAB_BAR_RIGHT_PADDING),
            }}
          >
            <BottomTabBar {...props} />
          </View>
        </View>
      </PageColumn>
    </View>
  );
}
