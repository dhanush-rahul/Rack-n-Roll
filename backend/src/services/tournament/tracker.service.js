const Game = require('../../models/game.model');
const Tournament = require('../../models/tournament.model');
const ApiError = require('../../utils/ApiError');
const cache = require('../../utils/cache');
const { buildGroupStandingsList } = require('./leaderboard.service');
const { GROUP_STAGE_ID } = require('./progressionPlan.utils');

const tournamentCachePrefix = (tournamentId) => `tournament:${String(tournamentId)}:`;

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

const buildParticipantGameStats = (games = [], isDoubles = false) => {
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
};

const buildTrackerMatrix = (games = [], groups = []) => {
  const groupMeta = (groups || []).map((group) => ({
    divisionId: String(group.divisionId),
    divisionName: group.divisionName || 'Group',
  }));
  const divisionIds = new Set(groupMeta.map((group) => group.divisionId));
  const roundNumbers = new Set();
  const pendingByRoundAndGroup = new Map();

  let totalGames = 0;
  let completedGames = 0;

  games.forEach((game) => {
    if (isByeGame(game)) {
      return;
    }

    const divisionId = String(game.divisionId || '').trim();
    if (!divisionId || !divisionIds.has(divisionId)) {
      return;
    }

    totalGames += 1;
    const completed = isGameCompleted(game);
    if (completed) {
      completedGames += 1;
    }

    const roundNumber = Math.max(Number(game.roundNumber || 1), 1);
    roundNumbers.add(roundNumber);

    if (!completed) {
      const key = `${roundNumber}:${divisionId}`;
      pendingByRoundAndGroup.set(key, (pendingByRoundAndGroup.get(key) || 0) + 1);
    }
  });

  const sortedRounds = [...roundNumbers].sort((left, right) => left - right);
  const rounds = sortedRounds.map((roundNumber) => {
    const byGroup = {};
    let rowTotal = 0;

    groupMeta.forEach(({ divisionId }) => {
      const pending = pendingByRoundAndGroup.get(`${roundNumber}:${divisionId}`) || 0;
      byGroup[divisionId] = pending;
      rowTotal += pending;
    });

    return { roundNumber, byGroup, rowTotal };
  });

  const pendingByGroup = {};
  let grandTotalPending = 0;

  groupMeta.forEach(({ divisionId }) => {
    const pending = rounds.reduce((sum, row) => sum + Number(row.byGroup[divisionId] || 0), 0);
    pendingByGroup[divisionId] = pending;
    grandTotalPending += pending;
  });

  const pendingGames = Math.max(totalGames - completedGames, 0);

  return {
    groups: groupMeta,
    rounds,
    pendingByGroup,
    grandTotalPending,
    progress: {
      totalGames,
      completedGames,
      pendingGames,
      percentComplete: totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0,
    },
  };
};

const loadTournamentTracker = async (tournamentId, query = {}) => {
  const tournament = await Tournament.findById(tournamentId).select({ _id: 1 }).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const standingsPayload = await buildGroupStandingsList(tournamentId, query);
  const groups = standingsPayload.groups || [];
  const isDoubles = standingsPayload.format === 'doubles';

  const games = await Game.find({
    tournamentId,
    stageId: GROUP_STAGE_ID,
  })
    .select({
      divisionId: 1,
      roundNumber: 1,
      status: 1,
      playerAId: 1,
      playerBId: 1,
      teamAId: 1,
      teamBId: 1,
      bestOf: 1,
      playerASeriesWins: 1,
      playerBSeriesWins: 1,
      winnerPlayerId: 1,
      winnerTeamId: 1,
    })
    .lean();

  const participantGameStats = buildParticipantGameStats(games, isDoubles);
  const tracker = buildTrackerMatrix(games, groups);

  return {
    format: standingsPayload.format,
    pairFormationMode: standingsPayload.pairFormationMode,
    handicapEnabled: standingsPayload.handicapEnabled,
    progressionState: standingsPayload.progressionState,
    groups,
    participantGameStats,
    tracker,
    progress: tracker.progress,
  };
};

const getTournamentTracker = (tournamentId, query = {}) =>
  cache.getOrSet(
    `${tournamentCachePrefix(tournamentId)}tracker:${cache.stableStringify(query)}`,
    cache.ttls().standings,
    () => loadTournamentTracker(tournamentId, query)
  );

module.exports = {
  getTournamentTracker,
  loadTournamentTracker,
};
