import { useMemo } from 'react';
import { discoverUi } from '../styles/tournamentUi';
import { useTypography } from '../context/TypographyContext';

export function useDiscoverSurfaceCard(overrides = null) {
  const { sp, isWeb, isTablet } = useTypography();
  const compactWeb = isWeb && isTablet;

  return useMemo(
    () => [
      discoverUi.surfaceCard,
      {
        padding: sp(compactWeb ? 11 : 13),
        borderRadius: sp(compactWeb ? 12 : 14),
        gap: sp(compactWeb ? 10 : 12),
      },
      overrides,
    ],
    [compactWeb, overrides, sp]
  );
}
