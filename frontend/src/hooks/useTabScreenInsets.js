import { Platform } from 'react-native';
import { useScreenInsets } from './useScreenInsets';

/** Extra bottom padding so scroll content clears the bottom tab bar (native). */
export const TAB_BAR_BASE_HEIGHT = 56;

/** Compact bottom tab row height on web. */
export const WEB_TAB_BAR_BASE_HEIGHT = 38;

/** Space above the tab bar row for the elevated center create button (web). */
export const WEB_TAB_BAR_FAB_CLEARANCE = 12;

/** Extra padding below the tab bar chrome on web. */
export const WEB_TAB_BAR_BOTTOM_PADDING = 8;

/** Extra padding on the right inside the tab bar chrome on web. */
export const WEB_TAB_BAR_RIGHT_PADDING = 12;

export function getTabBarBaseHeight(isWeb = Platform.OS === 'web') {
  return isWeb ? WEB_TAB_BAR_BASE_HEIGHT : TAB_BAR_BASE_HEIGHT;
}

export function useTabScreenInsets() {
  const { insets, scrollPaddingBottom, footerPaddingBottom, contentPaddingHorizontal } = useScreenInsets();
  const isWeb = Platform.OS === 'web';
  const fabClearance = isWeb ? WEB_TAB_BAR_FAB_CLEARANCE : 0;
  const bottomChromePadding = isWeb ? WEB_TAB_BAR_BOTTOM_PADDING : 0;
  const tabBarBaseHeight = getTabBarBaseHeight(isWeb);
  // On web the tab bar is absolutely positioned (CenteredWebTabBar) and overlaps
  // scroll content, so extra padding is needed. On native the tab bar is inline
  // and the scene already ends above it — no extra padding required.
  const tabBarOverlap = isWeb ? tabBarBaseHeight : 0;

  return {
    insets,
    tabBarHeight: tabBarBaseHeight + Math.max(insets.bottom, 0) + fabClearance + bottomChromePadding,
    scrollPaddingBottom: scrollPaddingBottom + tabBarOverlap + fabClearance + bottomChromePadding,
    footerPaddingBottom,
    contentPaddingHorizontal,
  };
}
