import { useQuery } from '@tanstack/react-query';
import { fetchHostTournamentRegistrations } from '../../services/tournamentService';
import { queryKeys } from './queryKeys';

export function useHostTournamentRegistrations(tournamentId, params = { page: 1, pageSize: 100 }, options = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.registrations(tournamentId, params),
    queryFn: () => fetchHostTournamentRegistrations(tournamentId, params),
    staleTime: 0,
    enabled: Boolean(tournamentId) && enabled,
    select: (response) => ({
      items: response.items || [],
      pagination: response.pagination || null,
    }),
  });
}
