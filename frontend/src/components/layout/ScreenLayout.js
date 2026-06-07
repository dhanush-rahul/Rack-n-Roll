import React from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useScreenInsets } from '../../hooks/useScreenInsets';

export function ScreenScroll({ children, style, contentContainerStyle, keyboardShouldPersistTaps = 'handled', refreshControl }) {
  const { scrollPaddingBottom } = useScreenInsets();

  return (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[{ paddingBottom: scrollPaddingBottom }, contentContainerStyle]}
      keyboardShouldPersistTaps={keyboardShouldPersistTaps}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  );
}

export function StickyFooterScreen({
  children,
  footer,
  style,
  contentContainerStyle,
  keyboardAvoiding = false,
  keyboardVerticalOffset = 0,
}) {
  const { scrollPaddingBottom, footerPaddingBottom } = useScreenInsets();

  const scroll = (
    <ScrollView
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[{ padding: 16, paddingBottom: scrollPaddingBottom + 72, gap: 14 }, contentContainerStyle]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  );

  const body = keyboardAvoiding ? (
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={keyboardVerticalOffset}
    >
      {scroll}
    </KeyboardAvoidingView>
  ) : (
    scroll
  );

  return (
    <View style={{ flex: 1 }}>
      {body}
      <View
        style={{
          paddingHorizontal: 16,
          paddingTop: 12,
          paddingBottom: footerPaddingBottom,
          borderTopWidth: 1,
          borderTopColor: '#e2e8f0',
          backgroundColor: '#f8fafc',
        }}
      >
        {footer}
      </View>
    </View>
  );
}
