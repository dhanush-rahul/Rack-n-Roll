import { Platform } from 'react-native';
import { useScreenInsets } from './useScreenInsets';

/** Extra bottom padding so scroll content clears the bottom tab bar. */
export const TAB_BAR_BASE_HEIGHT = 56;

/** Space above the tab bar row for the elevated center create button (web). */
export const WEB_TAB_BAR_FAB_CLEARANCE = 22;

export function useTabScreenInsets() {
  const { insets, scrollPaddingBottom, footerPaddingBottom, contentPaddingHorizontal } = useScreenInsets();
  const isWeb = Platform.OS === 'web';
  const fabClearance = isWeb ? WEB_TAB_BAR_FAB_CLEARANCE : 0;
  // On web the tab bar is absolutely positioned (CenteredWebTabBar) and overlaps
  // scroll content, so extra padding is needed. On native the tab bar is inline
  // and the scene already ends above it — no extra padding required.
  const tabBarOverlap = isWeb ? TAB_BAR_BASE_HEIGHT : 0;

  return {
    insets,
    tabBarHeight: TAB_BAR_BASE_HEIGHT + Math.max(insets.bottom, 0) + fabClearance,
    scrollPaddingBottom: scrollPaddingBottom + tabBarOverlap + fabClearance,
    footerPaddingBottom,
    contentPaddingHorizontal,
  };
}
