import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTypography } from '../context/TypographyContext';

const HEADER_CONTROL_SIZE = 34;

/** @deprecated Prefer useAppHeaderMetrics().bodyHeight */
export const APP_HEADER_BODY_HEIGHT = 58;

export function useAppHeaderMetrics() {
  const insets = useSafeAreaInsets();
  const { sp, isDesktopWeb, isWeb } = useTypography();
  const topInset = isWeb ? 0 : insets.top;
  const headerPaddingV = isWeb && isDesktopWeb ? sp(8) : sp(10);
  const controlSize =
    isWeb && isDesktopWeb ? sp(32) : isDesktopWeb ? sp(30) : HEADER_CONTROL_SIZE;
  const bodyHeight = headerPaddingV * 2 + controlSize;
  const headerHeight = topInset + bodyHeight;

  return {
    insets,
    topInset,
    headerPaddingV,
    controlSize,
    bodyHeight,
    headerHeight,
    contentPaddingTop: headerHeight,
  };
}

export function useAppHeaderInsets() {
  const metrics = useAppHeaderMetrics();
  return {
    insets: metrics.insets,
    headerHeight: metrics.headerHeight,
    contentPaddingTop: metrics.contentPaddingTop,
  };
}
