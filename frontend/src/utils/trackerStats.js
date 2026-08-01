const isByeGame = (game = {}) => {
  const hasA = Boolean(game.playerAId || game.teamAId);
  const hasB = Boolean(game.playerBId || game.teamBId);
  return hasA !== hasB;
};

const isGameCompleted = (game = {}) => {
  if (isByeGame(game)) {
    return true;
  }

  if (game.status === 'completed') {
    return true;
  }

  if (game.winnerPlayerId || game.winnerTeamId) {
    return true;
  }

  const bestOf = Math.max(Number(game.bestOf || 1), 1);
  const winsRequired = Math.floor(bestOf / 2) + 1;
  const winsA = Number(game.playerASeriesWins || 0);
  const winsB = Number(game.playerBSeriesWins || 0);

  return winsA >= winsRequired || winsB >= winsRequired;
};

const resolveParticipantId = (game, side, isDoubles) => {
  if (isDoubles) {
    return String(side === 'A' ? game.teamAId : game.teamBId || '').trim();
  }

  return String(side === 'A' ? game.playerAId : game.playerBId || '').trim();
};

export function buildParticipantGameStatsFromGames(games = [], isDoubles = false) {
  const statsById = {};

  games.forEach((game) => {
    if (isByeGame(game)) {
      return;
    }

    const completed = isGameCompleted(game);
    ['A', 'B'].forEach((side) => {
      const participantId = resolveParticipantId(game, side, isDoubles);
      if (!participantId) {
        return;
      }

      if (!statsById[participantId]) {
        statsById[participantId] = {
          totalGames: 0,
          gamesPlayed: 0,
          gamesRemaining: 0,
        };
      }

      statsById[participantId].totalGames += 1;
      if (completed) {
        statsById[participantId].gamesPlayed += 1;
      }
    });
  });

  Object.values(statsById).forEach((stats) => {
    stats.gamesRemaining = Math.max(Number(stats.totalGames || 0) - Number(stats.gamesPlayed || 0), 0);
  });

  return statsById;
}

export function buildStageMatchProgress(games = []) {
  const playableGames = games.filter((game) => {
    const hasA = Boolean(game.playerAId || game.teamAId);
    const hasB = Boolean(game.playerBId || game.teamBId);
    return hasA && hasB;
  });

  const totalGames = playableGames.length;
  const completedGames = playableGames.filter(
    (game) => game.status === 'completed' || game.winnerPlayerId || game.winnerTeamId
  ).length;
  const pendingGames = Math.max(totalGames - completedGames, 0);

  return {
    totalGames,
    completedGames,
    pendingGames,
    percentComplete: totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0,
  };
}
