import { useQuery } from '@tanstack/react-query';
import { fetchTournamentTracker } from '../../services/tournamentService';
import { STANDINGS_STALE_TIME_MS } from '../../config/queryClient';
import { queryKeys } from './queryKeys';

export function useTournamentTracker(tournamentId, params = {}, options = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.tracker(tournamentId, params),
    queryFn: () => fetchTournamentTracker(tournamentId, params),
    staleTime: STANDINGS_STALE_TIME_MS,
    enabled: Boolean(tournamentId) && enabled,
  });
}
