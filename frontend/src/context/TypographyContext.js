import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import { getFontScale, getSpacingScale } from '../utils/responsive';

const TypographyContext = createContext(null);

export function TypographyProvider({ children }) {
  const { width } = useWindowDimensions();

  const value = useMemo(() => {
    const fontScale = getFontScale(width);
    const spacingScale = getSpacingScale(width);

    const fs = (size) => Math.round(size * fontScale);
    const sp = (size) => Math.round(size * spacingScale);
    const lh = (size, ratio = 1.35) => Math.round(fs(size) * ratio);

    return {
      width,
      fontScale,
      spacingScale,
      isWide: width >= 480,
      isTablet: width >= 768,
      isLargeScreen: width >= 1024,
      isXLargeScreen: width >= 1280,
      fs,
      sp,
      lh,
      type: {
        xs: fs(11),
        sm: fs(12),
        md: fs(13),
        base: fs(14),
        lg: fs(16),
        xl: fs(18),
        xxl: fs(22),
        hero: fs(26),
        display: fs(30),
      },
    };
  }, [width]);

  return <TypographyContext.Provider value={value}>{children}</TypographyContext.Provider>;
}

export function useTypography() {
  const context = useContext(TypographyContext);

  if (!context) {
    const fs = (size) => size;
    const sp = (size) => size;
    return {
      width: 0,
      fontScale: 1,
      spacingScale: 1,
      isWide: false,
      isTablet: false,
      isLargeScreen: false,
      isXLargeScreen: false,
      fs,
      sp,
      lh: (size, ratio = 1.35) => Math.round(size * ratio),
      type: {
        xs: 11,
        sm: 12,
        md: 13,
        base: 14,
        lg: 16,
        xl: 18,
        xxl: 22,
        hero: 26,
        display: 30,
      },
    };
  }

  return context;
}
