import { Platform } from 'react-native';

export function getPageColumnLayout(contentMaxWidth, horizontalPadding, screenWidth) {
  const hasMaxWidth = Boolean(contentMaxWidth);
  const columnWidth = hasMaxWidth ? Math.min(contentMaxWidth, screenWidth) : screenWidth;

  const shell = hasMaxWidth
    ? Platform.OS === 'web'
      ? {
          width: columnWidth,
          maxWidth: '100%',
          marginLeft: 'auto',
          marginRight: 'auto',
        }
      : {
          width: '100%',
          maxWidth: contentMaxWidth,
          alignSelf: 'center',
        }
    : { width: '100%' };

  const inset = {
    width: '100%',
    paddingHorizontal: horizontalPadding,
  };

  return { shell, inset, columnWidth };
}

/** @deprecated Prefer PageColumn or getPageColumnLayout */
export function webCenteredColumnStyle(contentMaxWidth, horizontalPadding, screenWidth = null) {
  if (!contentMaxWidth) {
    return {
      width: '100%',
      paddingHorizontal: horizontalPadding,
    };
  }

  const resolvedWidth = screenWidth ? Math.min(contentMaxWidth, screenWidth) : contentMaxWidth;

  return {
    width: Platform.OS === 'web' && screenWidth ? resolvedWidth : '100%',
    maxWidth: Platform.OS === 'web' && screenWidth ? '100%' : contentMaxWidth,
    alignSelf: 'center',
    paddingHorizontal: horizontalPadding,
    ...(Platform.OS === 'web' && screenWidth ? { marginLeft: 'auto', marginRight: 'auto' } : null),
  };
}
