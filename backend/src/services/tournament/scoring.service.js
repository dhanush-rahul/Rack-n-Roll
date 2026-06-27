const Tournament = require('../../models/tournament.model');
const Division = require('../../models/division.model');
const Game = require('../../models/game.model');
const Player = require('../../models/player.model');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const cache = require('../../utils/cache');
const { buildTeamSummaryById } = require('../team.service');
const { recomputeLeaderboardForScope } = require('./leaderboard.service');

const invalidateScoresheetCache = (tournamentId) => {
  cache.delByPrefix(`tournament:${String(tournamentId)}:scoresheet:`);
};
const {
  canUserEditGameScores,
  canUserEditTournamentScores,
  assertCanEditGameScores,
  assertUserCanScheduleMatch,
  mapGameForScoresheet,
} = require('./permissions');
const {
  parseBestOf,
  parsePositiveInteger,
  escapeRegex,
  normalizeDivisionScopeValue,
  normalizeScoreEntries,
  computeSeriesOutcome,
  buildPlayerSummaryById,
  buildUserSummaryById,
  isStageProctored,
} = require('./shared');

const loadTournamentScoresheet = async (tournamentId, userId, query = {}) => {
  const canEdit = userId ? await canUserEditTournamentScores(tournamentId, userId) : false;
  const tournamentMeta = await Tournament.findById(tournamentId)
    .select({ proctorTransferRequest: 1, scoreEditorUserIds: 1, hostUserId: 1, competitionConfig: 1, progressionState: 1 })
    .lean();

  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, 25);
  const pageSize = Math.min(requestedPageSize, 100);
  const stage = query.stage === 'finalStage' ? 'finalStage' : query.stage === 'groupStage' ? 'groupStage' : null;
  const status = ['scheduled', 'inProgress', 'completed'].includes(query.status) ? query.status : null;
  const divisionId = normalizeDivisionScopeValue(query.divisionId);
  const normalizedPlayerQuery = String(query.playerQuery || '').trim();
  const normalizedPlayerTwoQuery = String(query.player2Query || '').trim();

  const resolveTournamentPlayerIdsByQuery = async (searchQuery) => {
    const normalizedSearchQuery = String(searchQuery || '').trim();

    if (!normalizedSearchQuery) {
      return null;
    }

    const searchRegex = new RegExp(escapeRegex(normalizedSearchQuery), 'i');
    const users = await User.find({ $or: [{ name: searchRegex }, { email: searchRegex }] })
      .select({ _id: 1 })
      .lean();

    const matchingUserIds = users.map((user) => user._id);
    const playerFilter = {
      tournamentId,
      status: 'active',
      $or: [{ displayName: searchRegex }],
    };

    if (matchingUserIds.length > 0) {
      playerFilter.$or.push({ userId: { $in: matchingUserIds } });
    }

    const players = await Player.find(playerFilter).select({ _id: 1 }).lean();
    return players.map((player) => player._id);
  };

  const findFilter = { tournamentId };

  if (stage) findFilter.stage = stage;
  if (status) findFilter.status = status;
  if (query.divisionId !== undefined) findFilter.divisionId = divisionId;

  if (normalizedPlayerQuery || normalizedPlayerTwoQuery) {
    const [playerIds, playerTwoIds] = await Promise.all([
      resolveTournamentPlayerIdsByQuery(normalizedPlayerQuery),
      resolveTournamentPlayerIdsByQuery(normalizedPlayerTwoQuery),
    ]);

    if (normalizedPlayerQuery && (!playerIds || playerIds.length === 0)) {
      findFilter._id = { $in: [] };
    }

    if (normalizedPlayerTwoQuery && (!playerTwoIds || playerTwoIds.length === 0)) {
      findFilter._id = { $in: [] };
    }

    if (!findFilter._id) {
      if (normalizedPlayerQuery && normalizedPlayerTwoQuery) {
        findFilter.$or = [
          { playerAId: { $in: playerIds }, playerBId: { $in: playerTwoIds } },
          { playerAId: { $in: playerTwoIds }, playerBId: { $in: playerIds } },
        ];
      } else if (normalizedPlayerQuery) {
        findFilter.$or = [{ playerAId: { $in: playerIds } }, { playerBId: { $in: playerIds } }];
      } else if (normalizedPlayerTwoQuery) {
        findFilter.$or = [{ playerAId: { $in: playerTwoIds } }, { playerBId: { $in: playerTwoIds } }];
      }
    }
  }

  const [games, total, divisions] = await Promise.all([
    Game.find(findFilter)
      .sort({ stage: 1, roundNumber: 1, createdAt: 1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Game.countDocuments(findFilter),
    Division.find({ tournamentId }).select({ _id: 1, name: 1 }).lean(),
  ]);

  const divisionNameById = new Map(
    divisions.map((division) => [String(division._id), division.name])
  );

  const playerSummaryById = await buildPlayerSummaryById(
    games.flatMap((game) => [game.playerAId, game.playerBId].filter(Boolean))
  );
  const teamSummaryById = await buildTeamSummaryById(
    games.flatMap((game) => [game.teamAId, game.teamBId].filter(Boolean))
  );

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const editorUserIds = (tournamentMeta?.scoreEditorUserIds || []).map((value) => String(value));
  const editorSummaryById = await buildUserSummaryById(editorUserIds);

  return {
    tournamentId: String(tournamentId),
    canEdit,
    format: tournamentMeta?.competitionConfig?.format || 'singles',
    pairFormationMode: tournamentMeta?.competitionConfig?.pairFormationMode || 'playerPicksPartner',
    progressionState: tournamentMeta?.progressionState || 'registration',
    groupStageProctored: Boolean(tournamentMeta?.competitionConfig?.groupStageProctored),
    finalStageProctored: Boolean(tournamentMeta?.competitionConfig?.finalStageProctored),
    hostUserId: tournamentMeta?.hostUserId ? String(tournamentMeta.hostUserId) : null,
    proctors: editorUserIds.map((editorId) => ({
      userId: editorId,
      displayName: editorSummaryById.get(editorId)?.name || 'Proctor',
      email: editorSummaryById.get(editorId)?.email || null,
    })),
    proctorTransferRequest: tournamentMeta?.proctorTransferRequest?.toUserId
      ? {
          fromUserId: String(tournamentMeta.proctorTransferRequest.fromUserId || ''),
          toUserId: String(tournamentMeta.proctorTransferRequest.toUserId || ''),
          requestedAt: tournamentMeta.proctorTransferRequest.requestedAt || null,
        }
      : null,
    items: games.map((game) =>
      mapGameForScoresheet(game, playerSummaryById, divisionNameById, {
        canEditMatch: canUserEditGameScores(tournamentMeta, userId, game, playerSummaryById, teamSummaryById),
        teamSummaryById,
        tournamentMeta,
        viewerUserId: userId,
      })
    ),
    pagination: { page, pageSize, total, totalPages },
  };
};

// Scoresheet output is viewer-dependent (canEdit / canEditMatch), so the cache
// key is scoped per user as well as per tournament + query.
const listTournamentScoresheet = (tournamentId, userId, query = {}) => {
  const keyQuery = {
    page: query.page,
    pageSize: query.pageSize,
    stage: query.stage,
    status: query.status,
    divisionId: query.divisionId,
    playerQuery: query.playerQuery,
    player2Query: query.player2Query,
  };

  return cache.getOrSet(
    `tournament:${String(tournamentId)}:scoresheet:${userId ? String(userId) : 'anon'}:${cache.stableStringify(keyQuery)}`,
    cache.ttls().scoresheet,
    () => loadTournamentScoresheet(tournamentId, userId, query)
  );
};

const updateGameScores = async (tournamentId, gameId, userId, payload = {}) => {
  const existingGame = await Game.findOne({ _id: gameId, tournamentId }).lean();

  if (!existingGame) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found for this tournament');
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1, competitionConfig: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const gameStage = existingGame.stage || 'groupStage';

  if (isStageProctored(tournament.competitionConfig || {}, gameStage)) {
    throw new ApiError(
      403,
      'MANUAL_SCORING_DISABLED',
      'This stage uses proctored live scoring. Enter scores from the live match session.'
    );
  }

  await assertCanEditGameScores(tournamentId, userId, existingGame);

  let effectiveBestOf = parseBestOf(existingGame.bestOf, 1);

  if (gameStage === 'groupStage') {
    const configuredGroupStageBestOf = parseBestOf(tournament.competitionConfig?.groupStageBestOf, effectiveBestOf);
    effectiveBestOf = Math.max(effectiveBestOf, configuredGroupStageBestOf);
  }

  if (payload.bestOf !== undefined) {
    effectiveBestOf = Math.max(effectiveBestOf, parseBestOf(payload.bestOf, effectiveBestOf));
  }

  const normalizedScoreEntries = normalizeScoreEntries(payload.scoreEntries);
  effectiveBestOf = Math.max(effectiveBestOf, normalizedScoreEntries.length);
  const seriesOutcome = computeSeriesOutcome(
    { ...existingGame, bestOf: effectiveBestOf },
    normalizedScoreEntries
  );
  const isSeriesComplete = Boolean(seriesOutcome.winnerPlayerId || seriesOutcome.winnerTeamId);
  const nextStatus =
    payload.status === 'scheduled'
      ? 'scheduled'
      : payload.status === 'completed' || isSeriesComplete
        ? 'completed'
        : 'inProgress';

  const updatedGame = await Game.findOneAndUpdate(
    { _id: gameId, tournamentId },
    {
      $set: {
        bestOf: effectiveBestOf,
        scoreEntries: normalizedScoreEntries,
        status: nextStatus,
        playerASeriesWins: seriesOutcome.playerASeriesWins,
        playerBSeriesWins: seriesOutcome.playerBSeriesWins,
        winnerPlayerId: seriesOutcome.winnerPlayerId,
        winnerTeamId: seriesOutcome.winnerTeamId,
      },
    },
    { new: true, runValidators: true }
  ).lean();

  await recomputeLeaderboardForScope(tournamentId, updatedGame.divisionId);

  const playerSummaryById = await buildPlayerSummaryById(
    [updatedGame.playerAId, updatedGame.playerBId].filter(Boolean)
  );
  const teamSummaryById = await buildTeamSummaryById(
    [updatedGame.teamAId, updatedGame.teamBId].filter(Boolean)
  );

  return mapGameForScoresheet(updatedGame, playerSummaryById, new Map(), {
    canEditMatch: canUserEditGameScores(tournament, userId, updatedGame, playerSummaryById, teamSummaryById),
    teamSummaryById,
    tournamentMeta: tournament,
    viewerUserId: userId,
  });
};

const updateGameSchedule = async (tournamentId, gameId, userId, payload = {}) => {
  const existingGame = await Game.findOne({ _id: gameId, tournamentId }).lean();

  if (!existingGame) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found for this tournament');
  }

  await assertUserCanScheduleMatch(tournamentId, userId, existingGame);

  let scheduledStartAt = null;

  if (payload.scheduledStartAt !== undefined && payload.scheduledStartAt !== null && payload.scheduledStartAt !== '') {
    const parsedDate = new Date(payload.scheduledStartAt);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiError(400, 'INVALID_SCHEDULE', 'scheduledStartAt must be a valid date/time');
    }

    scheduledStartAt = parsedDate;
  }

  const updatedGame = await Game.findOneAndUpdate(
    { _id: gameId, tournamentId },
    {
      $set: {
        scheduledStartAt,
        scheduledByUserId: scheduledStartAt ? userId : null,
      },
    },
    { new: true }
  ).lean();

  invalidateScoresheetCache(tournamentId);

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1, competitionConfig: 1 })
    .lean();

  const playerSummaryById = await buildPlayerSummaryById(
    [updatedGame.playerAId, updatedGame.playerBId].filter(Boolean)
  );
  const teamSummaryById = await buildTeamSummaryById(
    [updatedGame.teamAId, updatedGame.teamBId].filter(Boolean)
  );

  return mapGameForScoresheet(updatedGame, playerSummaryById, new Map(), {
    canEditMatch: canUserEditGameScores(tournament, userId, updatedGame, playerSummaryById, teamSummaryById),
    teamSummaryById,
    tournamentMeta: tournament,
    viewerUserId: userId,
  });
};

const upsertAndScoreGroupStageGame = async (tournamentId, userId, payload = {}) => {
  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1, competitionConfig: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  if (tournament.competitionConfig?.groupStageProctored) {
    throw new ApiError(
      403,
      'MANUAL_SCORING_DISABLED',
      'Group stage uses proctored live scoring. Enter scores from the live match session.'
    );
  }

  const roundNumber = parsePositiveInteger(payload.roundNumber, 0);
  if (roundNumber < 1) {
    throw new ApiError(400, 'INVALID_ROUND_NUMBER', 'roundNumber must be an integer >= 1');
  }

  const playerAUserId = String(payload.playerAUserId || '').trim();
  const playerBUserId = String(payload.playerBUserId || '').trim();
  const playerAIdInput = String(payload.playerAId || '').trim();
  const playerBIdInput = String(payload.playerBId || '').trim();

  if ((!playerAUserId && !playerAIdInput) || (!playerBUserId && !playerBIdInput)) {
    throw new ApiError(
      400,
      'PLAYER_IDS_REQUIRED',
      'Provide playerA/playerB identifiers using userId or playerId'
    );
  }

  if (
    (playerAUserId && playerBUserId && playerAUserId === playerBUserId) ||
    (playerAIdInput && playerBIdInput && playerAIdInput === playerBIdInput)
  ) {
    throw new ApiError(400, 'INVALID_MATCHUP', 'A match requires two different players');
  }

  const playerLookupFilter = { tournamentId, status: 'active', $or: [] };

  if (playerAUserId || playerBUserId) {
    const userIds = [playerAUserId, playerBUserId].filter(Boolean);
    playerLookupFilter.$or.push({ userId: { $in: userIds } });
  }

  if (playerAIdInput || playerBIdInput) {
    const playerIds = [playerAIdInput, playerBIdInput].filter(Boolean);
    playerLookupFilter.$or.push({ _id: { $in: playerIds } });
  }

  const tournamentPlayers = await Player.find(playerLookupFilter)
    .select({ _id: 1, userId: 1 })
    .lean();

  const playerByUserId = new Map();
  const playerByPlayerId = new Map();
  tournamentPlayers.forEach((player) => {
    const normalizedPlayerId = String(player._id);
    playerByPlayerId.set(normalizedPlayerId, player);

    if (player.userId) {
      playerByUserId.set(String(player.userId), player);
    }
  });

  const playerA = playerByUserId.get(playerAUserId) || playerByPlayerId.get(playerAIdInput);
  const playerB = playerByUserId.get(playerBUserId) || playerByPlayerId.get(playerBIdInput);

  if (!playerA || !playerB) {
    throw new ApiError(
      409,
      'MATCH_PLAYERS_NOT_AVAILABLE',
      'Both players must be active tournament participants before scoring this match'
    );
  }

  const playerAId = String(playerA._id);
  const playerBId = String(playerB._id);

  await assertCanEditGameScores(tournamentId, userId, {
    stage: 'groupStage',
    playerAId,
    playerBId,
  });

  let game = await Game.findOne({
    tournamentId,
    stage: 'groupStage',
    roundNumber,
    $or: [
      { playerAId, playerBId },
      { playerAId: playerBId, playerBId: playerAId },
    ],
  }).lean();

  const normalizedScoreEntries = normalizeScoreEntries(payload.scoreEntries);

  if (!game) {
    const division = await Division.findOne({
      tournamentId,
      playerIds: { $all: [playerAId, playerBId] },
    })
      .select({ _id: 1 })
      .lean();

    const configuredGroupStageBestOf = parseBestOf(tournament.competitionConfig?.groupStageBestOf, 1);
    const bestOf = parseBestOf(payload.bestOf, configuredGroupStageBestOf);
    const seriesOutcome = computeSeriesOutcome({ bestOf, playerAId, playerBId }, normalizedScoreEntries);
    const isSeriesComplete = Boolean(seriesOutcome.winnerPlayerId);
    const nextStatus =
      payload.status === 'scheduled'
        ? 'scheduled'
        : payload.status === 'completed' || isSeriesComplete
          ? 'completed'
          : 'inProgress';

    const createdGame = await Game.create({
      tournamentId,
      divisionId: normalizeDivisionScopeValue(division?._id),
      stage: 'groupStage',
      roundNumber,
      bestOf,
      playerAId,
      playerBId,
      scoreEntries: normalizedScoreEntries,
      playerASeriesWins: seriesOutcome.playerASeriesWins,
      playerBSeriesWins: seriesOutcome.playerBSeriesWins,
      winnerPlayerId: seriesOutcome.winnerPlayerId,
      status: nextStatus,
    });

    game = createdGame.toObject();
  } else {
    const seriesOutcome = computeSeriesOutcome(game, normalizedScoreEntries);
    const isSeriesComplete = Boolean(seriesOutcome.winnerPlayerId);
    const nextStatus =
      payload.status === 'scheduled'
        ? 'scheduled'
        : payload.status === 'completed' || isSeriesComplete
          ? 'completed'
          : 'inProgress';

    game = await Game.findOneAndUpdate(
      { _id: game._id, tournamentId },
      {
        $set: {
          scoreEntries: normalizedScoreEntries,
          status: nextStatus,
          playerASeriesWins: seriesOutcome.playerASeriesWins,
          playerBSeriesWins: seriesOutcome.playerBSeriesWins,
          winnerPlayerId: seriesOutcome.winnerPlayerId,
        },
      },
      { new: true, runValidators: true }
    ).lean();
  }

  await recomputeLeaderboardForScope(tournamentId, game.divisionId);
  const playerSummaryById = await buildPlayerSummaryById([game.playerAId, game.playerBId]);

  return mapGameForScoresheet(game, playerSummaryById, new Map(), {
    canEditMatch: canUserEditGameScores(tournament, userId, game, playerSummaryById),
  });
};

module.exports = {
  listTournamentScoresheet,
  updateGameScores,
  updateGameSchedule,
  upsertAndScoreGroupStageGame,
};
