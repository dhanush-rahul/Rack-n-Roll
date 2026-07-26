import { useQuery } from '@tanstack/react-query';
import { fetchDiscoverTournaments } from '../../services/tournamentService';
import { DISCOVER_STALE_TIME_MS } from '../../config/queryClient';

import { discoverQueryKey } from './queryKeys';

export function useDiscoverTournaments({
  page,
  pageSize,
  sort,
  q,
  upcoming = false,
  ongoing = false,
  registrationOpen = false,
  enabled = true,
}) {
  return useQuery({
    queryKey: discoverQueryKey({ page, pageSize, sort, q, upcoming, ongoing, registrationOpen }),
    queryFn: () =>
      fetchDiscoverTournaments({
        page,
        pageSize,
        sort,
        ...(q ? { q } : {}),
        ...(upcoming ? { upcoming: 'true' } : {}),
        ...(ongoing ? { ongoing: 'true' } : {}),
        ...(registrationOpen ? { registrationOpen: 'true' } : {}),
      }),
    staleTime: DISCOVER_STALE_TIME_MS,
    enabled,
    select: (response) => ({
      items: response.items || [],
      pagination: response.pagination || null,
    }),
  });
}
