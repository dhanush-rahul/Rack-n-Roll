import { Platform, useWindowDimensions } from 'react-native';

export const BREAKPOINTS = {
  compact: 360,
  wide: 480,
  tablet: 768,
  large: 1024,
  xlarge: 1280,
};

/** Scale body text on tablets and large native screens (e.g. iPad). Web uses no scaling. */
export function getFontScale(width, platform = Platform.OS) {
  if (platform === 'web') {
    return 1;
  }

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

export function getSpacingScale(width, platform = Platform.OS) {
  if (platform === 'web') {
    return 1;
  }

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

export function scaleFontSize(size, width, platform = Platform.OS) {
  return Math.round(size * getFontScale(width, platform));
}

export function getContentMaxWidth(width, platform = Platform.OS) {
  const isWeb = platform === 'web';

  if (width >= BREAKPOINTS.xlarge) {
    return isWeb ? 760 : 1100;
  }
  if (width >= BREAKPOINTS.large) {
    return isWeb ? 720 : 1000;
  }
  if (width >= BREAKPOINTS.tablet) {
    return isWeb ? 640 : 900;
  }
  return undefined;
}

export function getHorizontalPadding(width, platform = Platform.OS) {
  if (width >= BREAKPOINTS.xlarge) {
    return platform === 'web' ? 20 : 40;
  }
  if (width >= BREAKPOINTS.large) {
    return platform === 'web' ? 20 : 36;
  }
  if (width >= BREAKPOINTS.tablet) {
    return platform === 'web' ? 16 : 28;
  }
  return 16;
}

export function useResponsiveLayout() {
  const { width, height } = useWindowDimensions();
  const platform = Platform.OS;
  const fontScale = getFontScale(width, platform);
  const isWeb = platform === 'web';
  const isTablet = width >= BREAKPOINTS.tablet;
  const isLargeScreen = width >= BREAKPOINTS.large;
  const isXLargeScreen = width >= BREAKPOINTS.xlarge;
  const isDesktopWeb = isWeb && isLargeScreen;
  const isTabletWeb = isWeb && isTablet && !isLargeScreen;
  const contentMaxWidth = getContentMaxWidth(width, platform);
  const horizontalPadding = getHorizontalPadding(width, platform);

  return {
    width,
    height,
    fontScale,
    isWeb,
    isDesktopWeb,
    isTabletWeb,
    isCompact: width < BREAKPOINTS.compact,
    isWide: width >= BREAKPOINTS.wide,
    isTablet,
    isLargeScreen,
    isXLargeScreen,
    contentMaxWidth,
    horizontalPadding,
    gridColumns: isDesktopWeb ? 2 : 1,
    formMaxWidth: isDesktopWeb ? 440 : isTabletWeb ? 420 : undefined,
    sidebarWidth: isDesktopWeb ? 300 : undefined,
    fs: (size) => Math.round(size * fontScale),
    sp: (size) => Math.round(size * getSpacingScale(width, platform)),
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

export function webCardGridItemStyle(isDesktopWeb, columns = 2) {
  if (!isDesktopWeb) {
    return { width: '100%' };
  }

  const gap = 12;
  const basis = columns === 2 ? '48%' : `${Math.floor(100 / columns) - 2}%`;

  return {
    width: basis,
    flexGrow: 1,
    minWidth: 300,
    maxWidth: columns === 2 ? '49%' : undefined,
    marginBottom: gap,
  };
}

export function webStickyStyle(isDesktopWeb) {
  if (!isDesktopWeb || Platform.OS !== 'web') {
    return null;
  }

  return {
    position: 'sticky',
    top: 16,
    zIndex: 2,
    alignSelf: 'flex-start',
  };
}
