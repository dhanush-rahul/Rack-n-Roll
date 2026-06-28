import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTournamentSoloPlayers, fetchTournamentTeams } from '../../services/tournamentService';
import { STANDINGS_STALE_TIME_MS } from '../../config/queryClient';
import { queryKeys } from './queryKeys';

export function useTournamentTeamsData(tournamentId, options = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.teamsData(tournamentId),
    queryFn: async () => {
      const [teamsResponse, solosResponse] = await Promise.all([
        fetchTournamentTeams(tournamentId),
        fetchTournamentSoloPlayers(tournamentId),
      ]);

      return {
        teams: teamsResponse?.items || [],
        soloPlayers: solosResponse?.items || [],
      };
    },
    staleTime: STANDINGS_STALE_TIME_MS,
    enabled: Boolean(tournamentId) && enabled,
  });
}

export function useInvalidateTournamentTeamsData() {
  const queryClient = useQueryClient();

  return (tournamentId) =>
    queryClient.invalidateQueries({ queryKey: queryKeys.teamsData(tournamentId) });
}
