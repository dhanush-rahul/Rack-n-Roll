import { useQuery } from '@tanstack/react-query';
import { fetchTournamentGroupStandings } from '../../services/tournamentService';
import { STANDINGS_STALE_TIME_MS } from '../../config/queryClient';
import { queryKeys } from './queryKeys';

export function useTournamentGroupStandings(tournamentId, params = {}, options = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.standings(tournamentId, params),
    queryFn: () => fetchTournamentGroupStandings(tournamentId, params),
    staleTime: STANDINGS_STALE_TIME_MS,
    enabled: Boolean(tournamentId) && enabled,
  });
}
