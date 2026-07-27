import React from 'react';
import { BottomTabBar } from '@react-navigation/bottom-tabs';
import { Platform, View } from 'react-native';
import { PageColumn } from '../layout/PageColumn';
import { useTheme } from '../../context/ThemeContext';
import { WEB_TAB_BAR_FAB_CLEARANCE } from '../../hooks/useTabScreenInsets';

export function CenteredWebTabBar(props) {
  const { colors } = useTheme();

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
      }}
    >
      <PageColumn shellNativeID="racknroll-tab-bar-shell" style={{ transform: [{ translateX: -4 }] }}>
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
            }}
          >
            <BottomTabBar {...props} />
          </View>
        </View>
      </PageColumn>
    </View>
  );
}
