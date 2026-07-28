import { queryKeys } from './queryKeys';

export function invalidateTournamentCache(queryClient, tournamentId) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: ['discover'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.discoverRegistered() }),
  ];

  if (tournamentId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] }));
    tasks.push(
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId, 'scoresheet'] })
    );
    tasks.push(
      queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId, 'tracker'] })
    );
  }

  return Promise.all(tasks);
}

/** After a score save, patch fixtures locally — only refresh derived views (standings/tracker). */
export function invalidateTournamentCacheAfterScoreSave(queryClient, tournamentId) {
  if (!tournamentId) {
    return Promise.resolve();
  }

  return Promise.all([
    queryClient.invalidateQueries({ queryKey: queryKeys.standings(tournamentId) }),
    queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId, 'tracker'] }),
  ]);
}
