import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppUpdateGate } from './src/components/AppUpdateGate';
import { WebStyleEnhancements } from './src/components/layout/WebStyleEnhancements';
import { AuthProvider } from './src/context/AuthContext';
import { ThemeProvider, useTheme } from './src/context/ThemeContext';
import { MenuDrawerProvider } from './src/context/MenuDrawerContext';
import { TypographyProvider } from './src/context/TypographyContext';
import { AppNavigator } from './src/navigation/AppNavigator';
import { queryClient } from './src/config/queryClient';

SplashScreen.preventAutoHideAsync().catch(() => {});

function ThemedStatusBar() {
  const { colors } = useTheme();
  return <StatusBar style={colors.statusBar === 'light' ? 'light' : 'dark'} />;
}

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <TypographyProvider>
            <AuthProvider>
              <MenuDrawerProvider>
                <AppUpdateGate>
                  <WebStyleEnhancements />
                  <ThemedStatusBar />
                  <AppNavigator />
                </AppUpdateGate>
              </MenuDrawerProvider>
            </AuthProvider>
          </TypographyProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
