import { useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  compact: 360,
  wide: 480,
  tablet: 768,
  large: 1024,
  xlarge: 1280,
};

/** Scale body text on tablets and large screens (e.g. iPad, desktop web). */
export function getFontScale(width) {
  if (width >= BREAKPOINTS.xlarge) {
    return 1.9;
  }
  if (width >= BREAKPOINTS.large) {
    return 1.75;
  }
  if (width >= BREAKPOINTS.tablet) {
    return 1.55;
  }
  if (width >= BREAKPOINTS.wide) {
    return 1.25;
  }
  return 1;
}

export function getSpacingScale(width) {
  if (width >= BREAKPOINTS.xlarge) {
    return 1.5;
  }
  if (width >= BREAKPOINTS.large) {
    return 1.4;
  }
  if (width >= BREAKPOINTS.tablet) {
    return 1.3;
  }
  if (width >= BREAKPOINTS.wide) {
    return 1.15;
  }
  return 1;
}

export function scaleFontSize(size, width) {
  return Math.round(size * getFontScale(width));
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const fontScale = getFontScale(width);
  const isTablet = width >= BREAKPOINTS.tablet;
  const isLargeScreen = width >= BREAKPOINTS.large;
  const isXLargeScreen = width >= BREAKPOINTS.xlarge;

  return {
    width,
    height,
    fontScale,
    isCompact: width < BREAKPOINTS.compact,
    isWide: width >= BREAKPOINTS.wide,
    isTablet,
    isLargeScreen,
    isXLargeScreen,
    contentMaxWidth: isXLargeScreen ? 1100 : isLargeScreen ? 1000 : isTablet ? 900 : undefined,
    horizontalPadding: isXLargeScreen ? 40 : isLargeScreen ? 36 : isTablet ? 28 : 16,
    fs: (size) => Math.round(size * fontScale),
    sp: (size) => Math.round(size * getSpacingScale(width)),
  };
}

export function centeredContentStyle(maxWidth) {
  if (!maxWidth) {
    return null;
  }

  return {
    width: '100%',
    maxWidth,
    alignSelf: 'center',
  };
}
