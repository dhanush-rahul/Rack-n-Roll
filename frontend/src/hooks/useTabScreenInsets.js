import { useScreenInsets } from './useScreenInsets';

/** Extra bottom padding so scroll content clears the bottom tab bar. */
export const TAB_BAR_BASE_HEIGHT = 56;

export function useTabScreenInsets() {
  const { insets, scrollPaddingBottom, footerPaddingBottom, contentPaddingHorizontal } = useScreenInsets();

  return {
    insets,
    tabBarHeight: TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, 0),
    scrollPaddingBottom: scrollPaddingBottom + TAB_BAR_BASE_HEIGHT,
    footerPaddingBottom,
    contentPaddingHorizontal,
  };
}
