import React from 'react';
import { View } from 'react-native';
import { useResponsiveLayout } from '../../utils/responsive';

export function WebTwoColumnLayout({ left, right, gap = 24, leftWidth }) {
  const { isDesktopWeb, sidebarWidth } = useResponsiveLayout();

  if (!isDesktopWeb) {
    return (
      <View style={{ gap: 16 }}>
        {left}
        {right}
      </View>
    );
  }

  const resolvedLeftWidth = leftWidth || sidebarWidth || 300;

  return (
    <View style={{ flexDirection: 'row', gap, alignItems: 'stretch', width: '100%' }}>
      <View style={{ width: resolvedLeftWidth, flexShrink: 0 }}>{left}</View>
      <View style={{ flex: 1, minWidth: 0 }}>{right}</View>
    </View>
  );
}

export function WebFormColumns({ left, right, gap = 16 }) {
  const { isDesktopWeb } = useResponsiveLayout();

  if (!isDesktopWeb) {
    return (
      <View style={{ gap }}>
        {left}
        {right}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 20, alignItems: 'flex-start', width: '100%' }}>
      <View style={{ flex: 1, minWidth: 0, gap }}>{left}</View>
      <View style={{ flex: 1, minWidth: 0, gap }}>{right}</View>
    </View>
  );
}
