import React, { forwardRef } from 'react';
import { Platform, ScrollView } from 'react-native';

export const TAB_SCREEN_SCROLL_NATIVE_ID = 'racknroll-tab-screen-scroll';

export const TabScreenScrollView = forwardRef(function TabScreenScrollView(
  { style, contentContainerStyle, children, ...rest },
  ref
) {
  return (
    <ScrollView
      ref={ref}
      nativeID={TAB_SCREEN_SCROLL_NATIVE_ID}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={contentContainerStyle}
      showsVerticalScrollIndicator={Platform.OS !== 'web'}
      {...rest}
    >
      {children}
    </ScrollView>
  );
});
