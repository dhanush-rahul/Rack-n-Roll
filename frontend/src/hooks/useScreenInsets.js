import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Bottom padding for scroll content above home indicator / Android nav bar. */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();
  const bottomInset = Math.max(insets.bottom, Platform.OS === 'android' ? 20 : 0);

  return {
    insets,
    scrollPaddingBottom: 16 + bottomInset,
    footerPaddingBottom: Math.max(bottomInset, 14),
    contentPaddingHorizontal: 16,
  };
}
