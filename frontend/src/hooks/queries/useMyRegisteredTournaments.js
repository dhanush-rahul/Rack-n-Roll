import { useQuery } from '@tanstack/react-query';
import { fetchMyRegisteredDiscoverTournaments } from '../../services/tournamentService';
import { DISCOVER_STALE_TIME_MS } from '../../config/queryClient';
import { queryKeys } from './queryKeys';

export function useMyRegisteredTournaments({ enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.discoverRegistered(),
    queryFn: fetchMyRegisteredDiscoverTournaments,
    staleTime: DISCOVER_STALE_TIME_MS,
    enabled,
    select: (response) => response.items || [],
  });
}
