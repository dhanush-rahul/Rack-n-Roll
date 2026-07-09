import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WebStyleEnhancements } from './src/components/layout/WebStyleEnhancements';
import { AuthProvider } from './src/context/AuthContext';
import { TypographyProvider } from './src/context/TypographyContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { queryClient } from './src/config/queryClient';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <TypographyProvider>
          <AuthProvider>
            <WebStyleEnhancements />
            <StatusBar style="auto" />
            <AppNavigator />
          </AuthProvider>
        </TypographyProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
