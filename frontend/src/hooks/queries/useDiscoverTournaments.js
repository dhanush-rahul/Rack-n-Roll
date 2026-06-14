import { useQuery } from '@tanstack/react-query';
import { fetchDiscoverTournaments } from '../../services/tournamentService';
import { DISCOVER_STALE_TIME_MS } from '../../config/queryClient';

export const discoverQueryKey = ({ page, pageSize, sort, q }) => [
  'discover',
  { page, pageSize, sort, q: q || '' },
];

export function useDiscoverTournaments({ page, pageSize, sort, q, enabled = true }) {
  return useQuery({
    queryKey: discoverQueryKey({ page, pageSize, sort, q }),
    queryFn: () =>
      fetchDiscoverTournaments({
        page,
        pageSize,
        sort,
        ...(q ? { q } : {}),
      }),
    staleTime: DISCOVER_STALE_TIME_MS,
    enabled,
    select: (response) => ({
      items: response.items || [],
      pagination: response.pagination || null,
    }),
  });
}
