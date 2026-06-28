import { queryKeys } from './queryKeys';

export function invalidateTournamentCache(queryClient, tournamentId) {
  const tasks = [
    queryClient.invalidateQueries({ queryKey: ['discover'] }),
    queryClient.invalidateQueries({ queryKey: queryKeys.discoverRegistered() }),
  ];

  if (tournamentId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] }));
  }

  return Promise.all(tasks);
}
