import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { darkTheme, lightTheme, THEME_STORAGE_KEY } from '../styles/themeColors';
import { syncLegacyThemePalette } from '../styles/syncLegacyTheme';

const ThemeContext = createContext(null);

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState('dark');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const loadTheme = async () => {
      try {
        const stored = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (!cancelled && (stored === 'light' || stored === 'dark')) {
          setModeState(stored);
        }
      } catch {
        // ignore storage errors
      } finally {
        if (!cancelled) {
          setIsReady(true);
        }
      }
    };

    loadTheme();

    return () => {
      cancelled = true;
    };
  }, []);

  const setMode = useCallback(async (nextMode) => {
    const resolved = nextMode === 'dark' ? 'dark' : 'light';
    setModeState(resolved);
    try {
      await AsyncStorage.setItem(THEME_STORAGE_KEY, resolved);
    } catch {
      // ignore storage errors
    }
  }, []);

  const toggleMode = useCallback(() => {
    setMode(mode === 'dark' ? 'light' : 'dark');
  }, [mode, setMode]);

  const palette = mode === 'dark' ? darkTheme : lightTheme;

  useLayoutEffect(() => {
    syncLegacyThemePalette(palette, mode);
  }, [mode, palette]);

  const value = useMemo(
    () => ({
      mode,
      isDark: mode === 'dark',
      isReady,
      colors: palette,
      setMode,
      toggleMode,
    }),
    [isReady, mode, palette, setMode, toggleMode]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}
