export function invalidateTournamentCache(queryClient, tournamentId) {
  const tasks = [queryClient.invalidateQueries({ queryKey: ['discover'] })];

  if (tournamentId) {
    tasks.push(queryClient.invalidateQueries({ queryKey: ['tournament', tournamentId] }));
  }

  return Promise.all(tasks);
}
