export function mergeFilteredGamesAfterSave(previousFilteredGames, refreshedGames) {
  if (!Array.isArray(previousFilteredGames) || previousFilteredGames.length === 0) {
    return previousFilteredGames;
  }

  const refreshedById = new Map(
    (refreshedGames || []).map((game) => [String(game.id), game])
  );

  return previousFilteredGames.map((game) => refreshedById.get(String(game.id)) || game);
}
