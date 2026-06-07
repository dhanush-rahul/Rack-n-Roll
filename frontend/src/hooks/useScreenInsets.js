import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** Bottom padding for scroll content above home indicator / nav bar. */
export function useScreenInsets() {
  const insets = useSafeAreaInsets();

  return {
    insets,
    scrollPaddingBottom: 16 + insets.bottom,
    footerPaddingBottom: Math.max(insets.bottom, 14),
    contentPaddingHorizontal: 16,
  };
}
