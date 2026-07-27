import React from 'react';
import { View } from 'react-native';
import { useResponsiveLayout } from '../../utils/responsive';
import { getPageColumnLayout } from '../../utils/pageColumnLayout';

export function PageColumn({ children, style, insetStyle, shellNativeID }) {
  const { contentMaxWidth, horizontalPadding, width } = useResponsiveLayout();
  const { shell, inset } = getPageColumnLayout(contentMaxWidth, horizontalPadding, width);

  return (
    <View nativeID={shellNativeID} style={[shell, style]}>
      <View style={[inset, insetStyle]}>{children}</View>
    </View>
  );
}
