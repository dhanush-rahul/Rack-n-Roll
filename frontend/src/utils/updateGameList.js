/** Map a game list, reusing the previous array reference when nothing changed. */
export function updateGameList(games, mergeFn) {
  if (!Array.isArray(games) || games.length === 0) {
    return games;
  }

  let changed = false;
  const next = games.map((game) => {
    const merged = mergeFn(game);

    if (merged !== game) {
      changed = true;
    }

    return merged;
  });

  return changed ? next : games;
}
