import { QueryClient } from '@tanstack/react-query';

export const DISCOVER_STALE_TIME_MS = 2 * 60 * 1000;
export const SCORESHEET_STALE_TIME_MS = 15 * 1000;
export const STANDINGS_STALE_TIME_MS = 30 * 1000;
export const HOST_DETAIL_STALE_TIME_MS = 30 * 1000;
export const PROFILE_STALE_TIME_MS = 5 * 60 * 1000;

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnReconnect: true,
    },
  },
});
