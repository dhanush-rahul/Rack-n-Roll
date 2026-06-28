import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, Image, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ScaledText as Text } from '../components/ui/ScaledText';

export const BOOTSTRAP_BACKGROUND = '#4a1520';
const LOGO_TAN = '#d4b896';
const LOGO_SIZE = 200;

export function AppBootstrapScreen({ statusMessage = 'Starting up…', onReady }) {
  const insets = useSafeAreaInsets();
  const readyNotifiedRef = useRef(false);

  const notifyReady = () => {
    if (readyNotifiedRef.current) {
      return;
    }
    readyNotifiedRef.current = true;
    onReady?.();
  };

  useEffect(() => {
    notifyReady();
  }, []);

  return (
    <View
      onLayout={notifyReady}
      style={{
        flex: 1,
        backgroundColor: BOOTSTRAP_BACKGROUND,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 32,
        paddingTop: insets.top,
        paddingBottom: insets.bottom,
      }}
    >
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
          source={require('../../assets/icon.png')}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          resizeMode="cover"
          accessibilityLabel="Rack-N-Roll logo"
        />
      </View>

      <ActivityIndicator size="large" color={LOGO_TAN} style={{ marginTop: 36 }} />

      <Text
        style={{
          marginTop: 16,
          fontSize: 15,
          lineHeight: 22,
          fontWeight: '600',
          color: LOGO_TAN,
          textAlign: 'center',
        }}
      >
        {statusMessage}
      </Text>

      <Text
        style={{
          marginTop: 8,
          fontSize: 13,
          lineHeight: 18,
          color: 'rgba(212, 184, 150, 0.72)',
          textAlign: 'center',
        }}
      >
        This may take a moment after the app has been idle.
      </Text>
    </View>
  );
}
