import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Body row inside AppHeader below the status bar (padding + control + padding). */
export const APP_HEADER_BODY_HEIGHT = 58;

export function useAppHeaderInsets() {
  const insets = useSafeAreaInsets();
  const headerHeight = insets.top + APP_HEADER_BODY_HEIGHT;

  return {
    insets,
    headerHeight,
    contentPaddingTop: headerHeight,
  };
}
