import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchTournamentScoresheet } from '../../services/tournamentService';
import { SCORESHEET_STALE_TIME_MS } from '../../config/queryClient';
import { queryKeys } from './queryKeys';
import { fetchAllScoresheetPages } from './tournamentQueryUtils';

export function useScoresheetMeta(tournamentId, options = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.scoresheet(tournamentId, { meta: true }),
    queryFn: () => fetchTournamentScoresheet(tournamentId, { page: 1, pageSize: 1 }),
    staleTime: SCORESHEET_STALE_TIME_MS,
    enabled: Boolean(tournamentId) && enabled,
  });
}

export function useScoresheetPages(tournamentId, params = {}, options = {}) {
  const { enabled = true } = options;

  return useQuery({
    queryKey: queryKeys.scoresheet(tournamentId, params),
    queryFn: () => fetchAllScoresheetPages(tournamentId, params),
    staleTime: SCORESHEET_STALE_TIME_MS,
    enabled: Boolean(tournamentId) && enabled,
  });
}

export function useFetchScoresheetPages() {
  const queryClient = useQueryClient();

  return useCallback(
    (tournamentId, params = {}) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.scoresheet(tournamentId, params),
        queryFn: () => fetchAllScoresheetPages(tournamentId, params),
        staleTime: SCORESHEET_STALE_TIME_MS,
      }),
    [queryClient]
  );
}
