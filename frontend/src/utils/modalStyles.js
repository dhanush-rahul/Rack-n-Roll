import { Platform } from 'react-native';
import { BREAKPOINTS } from './responsive';

export function getWebModalStyles(width = 0) {
  if (Platform.OS !== 'web') {
    return null;
  }

  const isDesktop = width >= BREAKPOINTS.tablet;

  return {
    overlay: isDesktop ? { padding: 16 } : { padding: 20 },
    card: {
      width: '100%',
      maxWidth: isDesktop ? 340 : 400,
      alignSelf: 'center',
      ...(isDesktop
        ? {
            padding: 16,
            gap: 10,
            borderRadius: 14,
          }
        : null),
    },
    title: isDesktop ? { fontSize: 16, lineHeight: 21 } : null,
    message: isDesktop ? { fontSize: 13, lineHeight: 18 } : null,
    iconWrap: isDesktop ? { width: 40, height: 40, borderRadius: 20, marginBottom: 0 } : null,
    iconSize: isDesktop ? 20 : null,
    sheetCard: isDesktop
      ? {
          width: '100%',
          maxWidth: 380,
          alignSelf: 'center',
          padding: 16,
          gap: 10,
          borderRadius: 14,
        }
      : null,
  };
}

/** @deprecated Use getWebModalStyles(width).card */
export function getWebModalCardStyle(width = 0) {
  return getWebModalStyles(width)?.card ?? null;
}
