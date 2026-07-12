import React from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from './ScaledText';

export const BOOTSTRAP_BACKGROUND = '#4a1520';
const LOGO_TAN = '#d4b896';
const LOGO_SIZE = 200;

export function LoadingScreen({
  statusMessage = 'Loading…',
  subtitle = null,
  fullScreen = true,
  onReady,
}) {
  const insets = useSafeAreaInsets();

  return (
    <View
      onLayout={onReady}
      style={{
        flex: fullScreen ? 1 : undefined,
        minHeight: fullScreen ? undefined : 200,
        backgroundColor: fullScreen ? BOOTSTRAP_BACKGROUND : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: fullScreen ? insets.top : 24,
        paddingBottom: fullScreen ? insets.bottom : 24,
      }}
    >
      {fullScreen && (
        <View
          style={{
            width: LOGO_SIZE,
            height: LOGO_SIZE,
            borderRadius: LOGO_SIZE / 2,
            overflow: 'hidden',
            backgroundColor: BOOTSTRAP_BACKGROUND,
            borderWidth: 2,
            borderColor: 'rgba(212, 184, 150, 0.4)',
            shadowColor: '#000000',
            shadowOpacity: 0.28,
            shadowRadius: 18,
            shadowOffset: { width: 0, height: 8 },
            elevation: 10,
          }}
        >
          <Image
            source={require('../../../assets/icon.png')}
            style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
            resizeMode="cover"
            accessibilityLabel="Rack-N-Roll logo"
          />
        </View>
      )}

      <ActivityIndicator
        size={fullScreen ? 'large' : 'small'}
        color={fullScreen ? LOGO_TAN : '#64748b'}
        style={{ marginTop: fullScreen ? 36 : 0 }}
      />

      <Text
        style={{
          marginTop: 16,
          fontSize: 15,
          lineHeight: 22,
          fontWeight: '600',
          color: fullScreen ? LOGO_TAN : '#64748b',
          textAlign: 'center',
        }}
      >
        {statusMessage}
      </Text>

      {Boolean(subtitle) && (
        <Text
          style={{
            marginTop: 8,
            fontSize: 13,
            lineHeight: 18,
            color: fullScreen ? 'rgba(212, 184, 150, 0.72)' : '#94a3b8',
            textAlign: 'center',
          }}
        >
          {subtitle}
        </Text>
      )}
    </View>
  );
}
