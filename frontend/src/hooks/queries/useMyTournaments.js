import { useQuery } from '@tanstack/react-query';
import { fetchMyTournaments } from '../../services/tournamentService';
import { DISCOVER_STALE_TIME_MS } from '../../config/queryClient';
import { myTournamentsQueryKey } from './queryKeys';

export function useMyTournaments({
  page = 1,
  pageSize = 10,
  sort = 'activity',
  q = '',
  filter = 'all',
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: myTournamentsQueryKey({ page, pageSize, sort, q, filter }),
    queryFn: () =>
      fetchMyTournaments({
        page,
        pageSize,
        sort,
        filter,
        ...(q ? { q } : {}),
      }),
    staleTime: DISCOVER_STALE_TIME_MS,
    enabled,
    select: (response) => ({
      items: response.items || [],
      pagination: response.pagination || null,
      stats: response.stats || { total: 0, hostingCount: 0, playingCount: 0 },
    }),
  });
}
