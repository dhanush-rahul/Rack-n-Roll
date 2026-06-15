import { useQuery } from '@tanstack/react-query';
import { fetchHostTournamentDetail } from '../../services/tournamentService';
import { HOST_DETAIL_STALE_TIME_MS } from '../../config/queryClient';
import { queryKeys } from './queryKeys';

export function useHostTournamentDetail(tournamentId, { enabled = true } = {}) {
  return useQuery({
    queryKey: queryKeys.hostDetail(tournamentId),
    queryFn: () => fetchHostTournamentDetail(tournamentId),
    staleTime: HOST_DETAIL_STALE_TIME_MS,
    enabled: Boolean(tournamentId) && enabled,
  });
}
