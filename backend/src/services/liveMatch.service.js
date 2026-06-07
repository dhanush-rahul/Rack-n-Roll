const Game = require('../models/game.model');
const Tournament = require('../models/tournament.model');
const ApiError = require('../utils/ApiError');

const LIVE_SESSION_CONTROLLER_TTL_MS = 5 * 60 * 1000;
const {
  assertCanEditTournamentScores,
  recomputeLeaderboardForScope,
  canUserEditTournamentScores,
  isStageProctored,
} = require('./tournament.service');
const { buildLiveMatchInningsStats } = require('../utils/liveMatchInnings');

const END_GAME_REASONS = ['potted8', 'scratchOn8', 'potted8NotCalled', 'potted8BeforeEnd'];

const parseBestOf = (value, fallbackValue = 1) => {
  const parsedValue = Number.parseInt(value, 10);
  if ([1, 3, 5, 7].includes(parsedValue)) {
    return parsedValue;
  }
  return fallbackValue;
};

const winsRequiredForBestOf = (bestOf) => Math.floor(parseBestOf(bestOf, 1) / 2) + 1;

const computeSeriesWinsFromEntries = (scoreEntries = []) => {
  let playerASeriesWins = 0;
  let playerBSeriesWins = 0;

  scoreEntries.forEach((entry) => {
    const playerAScore = Number(entry.playerAScore || 0);
    const playerBScore = Number(entry.playerBScore || 0);
    if (playerAScore > playerBScore) {
      playerASeriesWins += 1;
    } else if (playerBScore > playerAScore) {
      playerBSeriesWins += 1;
    }
  });

  return { playerASeriesWins, playerBSeriesWins };
};

const buildUserSummaryById = async (userIds = []) => {
  const User = require('../models/user.model');
  const normalized = [...new Set(userIds.map((v) => String(v)).filter(Boolean))];
  if (normalized.length === 0) {
    return new Map();
  }
  const users = await User.find({ _id: { $in: normalized } }).select({ _id: 1, name: 1 }).lean();
  return users.reduce((acc, user) => {
    acc.set(String(user._id), {
      userId: String(user._id),
      displayName: user.name || 'Proctor',
    });
    return acc;
  }, new Map());
};

const clearTakeoverRequest = (seriesState = {}) => ({
  ...seriesState,
  takeoverRequestedByUserId: null,
  takeoverRequestedAt: null,
});

const withControllerActivity = (seriesState = {}, userId) => ({
  ...seriesState,
  controllerUserId: userId,
  controllerLastActiveAt: new Date(),
});

const releaseStaleControllerIfNeeded = async (game) => {
  const controllerId = game.seriesState?.controllerUserId;
  if (!controllerId) {
    return { game, released: false };
  }

  const lastActive = game.seriesState?.controllerLastActiveAt;
  const startedAt = game.seriesState?.startedAt;
  const baselineMs = lastActive
    ? new Date(lastActive).getTime()
    : startedAt
      ? new Date(startedAt).getTime()
      : Date.now();

  if (Date.now() - baselineMs < LIVE_SESSION_CONTROLLER_TTL_MS) {
    return { game, released: false };
  }

  const updated = await Game.findOneAndUpdate(
    { _id: game._id, tournamentId: game.tournamentId },
    {
      $set: {
        'seriesState.controllerUserId': null,
        'seriesState.controllerLastActiveAt': null,
        'seriesState.takeoverRequestedByUserId': null,
        'seriesState.takeoverRequestedAt': null,
      },
    },
    { new: true }
  ).lean();

  return { game: updated || game, released: true };
};

const assertSessionController = (game, userId) => {
  const controllerUserId = game.seriesState?.controllerUserId;
  if (!controllerUserId) {
    throw new ApiError(409, 'NO_SESSION_CONTROLLER', 'Start the game session before marking');
  }
  if (String(controllerUserId) !== String(userId)) {
    throw new ApiError(
      403,
      'NOT_SESSION_CONTROLLER',
      'Another proctor is currently scoring this match. Request a takeover to switch.'
    );
  }
};

const buildPlayerSummaryById = async (playerIds = []) => {
  const Player = require('../models/player.model');
  const normalized = [...new Set(playerIds.map((v) => String(v)).filter(Boolean))];
  if (normalized.length === 0) {
    return new Map();
  }
  const players = await Player.find({ _id: { $in: normalized } })
    .select({ _id: 1, userId: 1, displayName: 1, handicapEnabled: 1, handicapValue: 1 })
    .lean();
  return players.reduce((acc, player) => {
    acc.set(String(player._id), {
      id: String(player._id),
      userId: player.userId ? String(player.userId) : null,
      displayName: player.displayName,
      handicapEnabled: Boolean(player.handicapEnabled),
      handicapValue: Number(player.handicapValue || 0),
    });
    return acc;
  }, new Map());
};

const prepareActiveGameEntry = (entry, defaultPlayerId) => {
  if (!entry.currentTurnPlayerId) {
    entry.currentTurnPlayerId = defaultPlayerId;
  }
};

const isLegRequiredForGame = (activeGameNumber) => Number(activeGameNumber) === 1;

const getPreviousGameWinnerPlayerId = (game, entries, activeGameNumber) => {
  const gameNumber = Number(activeGameNumber);
  if (gameNumber <= 1) {
    return null;
  }
  const previousEntry = entries.find((entry) => Number(entry.gameNumber) === gameNumber - 1);
  if (!previousEntry) {
    return null;
  }
  if (Number(previousEntry.playerAScore) > Number(previousEntry.playerBScore)) {
    return String(game.playerAId);
  }
  if (Number(previousEntry.playerBScore) > Number(previousEntry.playerAScore)) {
    return String(game.playerBId);
  }
  return null;
};

const ensureBreakerForActiveGame = (game, entry, entries, activeGameNumber) => {
  if (isLegRequiredForGame(activeGameNumber)) {
    prepareActiveGameEntry(entry, entry.currentTurnPlayerId || game.playerAId);
    return;
  }
  const breakerId = getPreviousGameWinnerPlayerId(game, entries, activeGameNumber);
  prepareActiveGameEntry(entry, breakerId || entry.currentTurnPlayerId || game.playerAId);
};

const getActiveEntry = (game) => {
  const activeGameNumber = Number(game.seriesState?.activeGameNumber || 1);
  const entries = [...(game.scoreEntries || [])];
  let entry = entries.find((e) => Number(e.gameNumber) === activeGameNumber);
  if (!entry) {
    entry = {
      gameNumber: activeGameNumber,
      playerAScore: 0,
      playerBScore: 0,
      turns: [],
      currentTurnPlayerId: game.playerAId,
    };
    entries.push(entry);
  }
  return { activeGameNumber, entries, entry };
};

const mapLiveMatchState = async (game, canEdit, viewerUserId = null) => {
  const playerSummaryById = await buildPlayerSummaryById([game.playerAId, game.playerBId]);
  const controllerUserId = game.seriesState?.controllerUserId
    ? String(game.seriesState.controllerUserId)
    : null;
  const takeoverUserId = game.seriesState?.takeoverRequestedByUserId
    ? String(game.seriesState.takeoverRequestedByUserId)
    : null;
  const userSummaryById = await buildUserSummaryById(
    [controllerUserId, takeoverUserId].filter(Boolean)
  );
  const bestOf = parseBestOf(game.bestOf, 1);
  const activeGameNumber = Number(game.seriesState?.activeGameNumber || 1);
  const activeEntry = (game.scoreEntries || []).find((e) => Number(e.gameNumber) === activeGameNumber);
  const viewerId = viewerUserId ? String(viewerUserId) : null;
  const isInProgress = game.status === 'inProgress';
  const isSessionController = Boolean(
    viewerId && controllerUserId && viewerId === controllerUserId
  );
  const hasTakeoverRequest = Boolean(takeoverUserId);
  const isTakeoverRequester = Boolean(viewerId && takeoverUserId && viewerId === takeoverUserId);
  const tournament = await Tournament.findById(game.tournamentId).select({ hostUserId: 1 }).lean();
  const hostUserId = tournament?.hostUserId ? String(tournament.hostUserId) : null;
  const isHost = Boolean(viewerId && hostUserId && viewerId === hostUserId);
  const canClaimScoring = Boolean(canEdit && isInProgress && !controllerUserId);
  const activeTurns = activeEntry?.turns || [];
  let activeLegWinnerPlayerId = activeEntry?.legWinnerPlayerId
    ? String(activeEntry.legWinnerPlayerId)
    : null;
  if (!activeLegWinnerPlayerId) {
    const legTurn = activeTurns.find((turn) => turn.legWinnerPlayerId);
    if (legTurn?.legWinnerPlayerId) {
      activeLegWinnerPlayerId = String(legTurn.legWinnerPlayerId);
    }
  }
  const inningsStats = buildLiveMatchInningsStats(activeTurns, game.playerAId, game.playerBId);
  const legRequiredForActiveGame = isLegRequiredForGame(activeGameNumber);
  const legSatisfied =
    !legRequiredForActiveGame ||
    Boolean(activeLegWinnerPlayerId);
  const previousGameBreakerPlayerId = legRequiredForActiveGame
    ? null
    : getPreviousGameWinnerPlayerId(game, game.scoreEntries || [], activeGameNumber);
  const canMarkLegWon = Boolean(
    canEdit && isSessionController && isInProgress && legRequiredForActiveGame && !activeLegWinnerPlayerId
  );
  const canMarkVisit = Boolean(canEdit && isSessionController && isInProgress && legSatisfied);

  return {
    gameId: String(game._id),
    tournamentId: String(game.tournamentId),
    bestOf,
    winsRequired: winsRequiredForBestOf(bestOf),
    status: game.status,
    playerA: playerSummaryById.get(String(game.playerAId)) || null,
    playerB: playerSummaryById.get(String(game.playerBId)) || null,
    playerASeriesWins: Number(game.playerASeriesWins || 0),
    playerBSeriesWins: Number(game.playerBSeriesWins || 0),
    winnerPlayerId: game.winnerPlayerId ? String(game.winnerPlayerId) : null,
    activeGameNumber,
    currentTurnPlayerId: activeEntry?.currentTurnPlayerId
      ? String(activeEntry.currentTurnPlayerId)
      : String(game.playerAId),
    activeLegWinnerPlayerId,
    legRequiredForActiveGame,
    legSatisfied,
    previousGameBreakerPlayerId,
    canMarkLegWon,
    canMarkVisit,
    activeGame: activeEntry
      ? {
          gameNumber: activeEntry.gameNumber,
          endReason: activeEntry.endReason || null,
          legWinnerPlayerId: activeLegWinnerPlayerId,
          innings: inningsStats,
          turns: canEdit
            ? (activeEntry.turns || []).map((turn) => ({
                turnNumber: turn.turnNumber,
                playerId: String(turn.playerId),
                markedByProctorUserId: String(turn.markedByProctorUserId),
                legOption: turn.legOption || null,
                legWinnerPlayerId: turn.legWinnerPlayerId ? String(turn.legWinnerPlayerId) : null,
              }))
            : [],
        }
      : null,
    scoreEntries: (game.scoreEntries || []).map((entry) => ({
      gameNumber: entry.gameNumber,
      playerAScore: entry.playerAScore,
      playerBScore: entry.playerBScore,
      endReason: entry.endReason || null,
    })),
    endGameReasonOptions: END_GAME_REASONS,
    canEdit,
    canViewTurnLog: canEdit,
    isHost,
    canClaimScoring,
    sessionController: controllerUserId
      ? userSummaryById.get(controllerUserId) || { userId: controllerUserId, displayName: 'Proctor' }
      : null,
    takeoverRequest: takeoverUserId
      ? {
          userId: takeoverUserId,
          displayName:
            userSummaryById.get(takeoverUserId)?.displayName || 'Proctor',
          requestedAt: game.seriesState?.takeoverRequestedAt || null,
        }
      : null,
    isSessionController,
    canMarkSession: Boolean(canEdit && isSessionController && isInProgress),
    canRequestTakeover: Boolean(
      canEdit && isInProgress && controllerUserId && viewerId && !isSessionController && !isTakeoverRequester
    ),
    canCancelTakeoverRequest: Boolean(canEdit && isTakeoverRequester && hasTakeoverRequest),
    canHandOffScoring: Boolean(canEdit && isSessionController && hasTakeoverRequest),
    canDeclineTakeover: Boolean(canEdit && isSessionController && hasTakeoverRequest),
    canForceTakeover: Boolean(
      isHost && isInProgress && controllerUserId && viewerId && !isSessionController
    ),
  };
};

const assertLiveScoringEnabled = async (tournamentId, game) => {
  const tournament = await Tournament.findById(tournamentId).select({ competitionConfig: 1 }).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  if (!isStageProctored(tournament.competitionConfig || {}, game.stage || 'groupStage')) {
    throw new ApiError(
      403,
      'LIVE_SCORING_DISABLED',
      'Live proctored scoring is not enabled for this stage. Enter scores on the Games tab.'
    );
  }
};

const startGameSession = async (tournamentId, gameId, userId) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  let game = await Game.findOne({ _id: gameId, tournamentId }).lean();
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  await assertLiveScoringEnabled(tournamentId, game);

  if (game.status === 'completed') {
    throw new ApiError(409, 'GAME_ALREADY_COMPLETED', 'This match is already completed');
  }

  ({ game } = await releaseStaleControllerIfNeeded(game));

  if (game.status === 'inProgress') {
    const controllerUserId = game.seriesState?.controllerUserId
      ? String(game.seriesState.controllerUserId)
      : null;
    if (controllerUserId && controllerUserId !== String(userId)) {
      throw new ApiError(
        409,
        'SESSION_IN_USE',
        'Another proctor is scoring this match. Request takeover or wait for scoring to release.'
      );
    }

    const { entries, entry, activeGameNumber } = getActiveEntry(game);
    ensureBreakerForActiveGame(game, entry, entries, activeGameNumber);

    const updated = await Game.findOneAndUpdate(
      { _id: gameId, tournamentId },
      {
        seriesState: clearTakeoverRequest(
          withControllerActivity(
            {
              activeGameNumber,
              startedAt: game.seriesState?.startedAt || new Date(),
            },
            userId
          )
        ),
        scoreEntries: entries,
      },
      { new: true }
    ).lean();

    return mapLiveMatchState(updated, true, userId);
  }

  const { entries, entry, activeGameNumber } = getActiveEntry(game);
  ensureBreakerForActiveGame(game, entry, entries, activeGameNumber);
  if (isLegRequiredForGame(activeGameNumber)) {
    entry.legWinnerPlayerId = null;
    entry.turns = [];
  }

  const updated = await Game.findOneAndUpdate(
    { _id: gameId, tournamentId },
    {
      status: 'inProgress',
      seriesState: clearTakeoverRequest(
        withControllerActivity(
          {
            activeGameNumber,
            startedAt: game.seriesState?.startedAt || new Date(),
          },
          userId
        )
      ),
      scoreEntries: entries,
    },
    { new: true }
  ).lean();

  return mapLiveMatchState(updated, true, userId);
};

const getLiveMatchState = async (tournamentId, gameId, userId) => {
  let game = await Game.findOne({ _id: gameId, tournamentId }).lean();
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  await assertLiveScoringEnabled(tournamentId, game);

  const { game: refreshedGame, released } = await releaseStaleControllerIfNeeded(game);
  game = refreshedGame;
  const canEdit = await canUserEditTournamentScores(tournamentId, userId);
  const state = await mapLiveMatchState(game, canEdit, userId);
  if (released) {
    return { ...state, scoringReleasedDueToInactivity: true };
  }
  return state;
};

const requestLiveMatchTakeover = async (tournamentId, gameId, userId) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  const game = await Game.findOne({ _id: gameId, tournamentId });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }
  await assertLiveScoringEnabled(tournamentId, game);
  if (game.status !== 'inProgress') {
    throw new ApiError(409, 'GAME_NOT_IN_PROGRESS', 'The match session is not active');
  }

  const controllerUserId = game.seriesState?.controllerUserId;
  if (!controllerUserId) {
    throw new ApiError(409, 'NO_SESSION_CONTROLLER', 'Start the game session first');
  }
  if (String(controllerUserId) === String(userId)) {
    throw new ApiError(409, 'ALREADY_SESSION_CONTROLLER', 'You are already scoring this match');
  }

  const seriesBase = game.seriesState?.toObject?.() || { ...game.seriesState };
  game.seriesState = {
    ...seriesBase,
    takeoverRequestedByUserId: userId,
    takeoverRequestedAt: new Date(),
  };
  game.markModified('seriesState');
  await game.save();

  const canEdit = true;
  return mapLiveMatchState(game.toObject(), canEdit, userId);
};

const handoffLiveMatchScoring = async (tournamentId, gameId, userId) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  const game = await Game.findOne({ _id: gameId, tournamentId });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }
  await assertLiveScoringEnabled(tournamentId, game);
  if (game.status !== 'inProgress') {
    throw new ApiError(409, 'GAME_NOT_IN_PROGRESS', 'The match session is not active');
  }

  assertSessionController(game.toObject(), userId);

  const requesterId = game.seriesState?.takeoverRequestedByUserId;
  if (!requesterId) {
    throw new ApiError(409, 'NO_TAKEOVER_REQUEST', 'No takeover request is pending');
  }

  const seriesBase = game.seriesState?.toObject?.() || { ...game.seriesState };
  game.seriesState = clearTakeoverRequest(
    withControllerActivity(
      {
        ...seriesBase,
      },
      requesterId
    )
  );
  game.markModified('seriesState');
  await game.save();

  return mapLiveMatchState(game.toObject(), true, userId);
};

const hostForceTakeoverLiveMatch = async (tournamentId, gameId, userId) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  const tournament = await Tournament.findById(tournamentId).select({ hostUserId: 1 }).lean();
  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }
  if (String(tournament.hostUserId) !== String(userId)) {
    throw new ApiError(403, 'HOST_ONLY', 'Only the host can take over scoring immediately');
  }

  const game = await Game.findOne({ _id: gameId, tournamentId });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }
  await assertLiveScoringEnabled(tournamentId, game);
  if (game.status !== 'inProgress') {
    throw new ApiError(409, 'GAME_NOT_IN_PROGRESS', 'The match session is not active');
  }

  const seriesBase = game.seriesState?.toObject?.() || { ...game.seriesState };
  game.seriesState = clearTakeoverRequest(
    withControllerActivity(
      {
        ...seriesBase,
        activeGameNumber: Number(seriesBase.activeGameNumber || 1),
        startedAt: seriesBase.startedAt || new Date(),
      },
      userId
    )
  );
  game.markModified('seriesState');
  await game.save();

  return mapLiveMatchState(game.toObject(), true, userId);
};

const declineLiveMatchTakeover = async (tournamentId, gameId, userId) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  const game = await Game.findOne({ _id: gameId, tournamentId });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  await assertLiveScoringEnabled(tournamentId, game);

  assertSessionController(game.toObject(), userId);

  const seriesBase = game.seriesState?.toObject?.() || { ...game.seriesState };
  game.seriesState = clearTakeoverRequest(seriesBase);
  game.markModified('seriesState');
  await game.save();

  return mapLiveMatchState(game.toObject(), true, userId);
};

const cancelLiveMatchTakeover = async (tournamentId, gameId, userId) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  const game = await Game.findOne({ _id: gameId, tournamentId });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }

  await assertLiveScoringEnabled(tournamentId, game);

  const requesterId = game.seriesState?.takeoverRequestedByUserId;
  if (!requesterId || String(requesterId) !== String(userId)) {
    throw new ApiError(409, 'NO_TAKEOVER_REQUEST', 'You do not have a pending takeover request');
  }

  const seriesBase = game.seriesState?.toObject?.() || { ...game.seriesState };
  game.seriesState = clearTakeoverRequest(seriesBase);
  game.markModified('seriesState');
  await game.save();

  return mapLiveMatchState(game.toObject(), true, userId);
};

const advanceGameTurn = async (tournamentId, gameId, userId, payload = {}) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  const game = await Game.findOne({ _id: gameId, tournamentId });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }
  await assertLiveScoringEnabled(tournamentId, game);
  if (game.status !== 'inProgress') {
    throw new ApiError(409, 'GAME_NOT_IN_PROGRESS', 'Start the game session before advancing turns');
  }

  assertSessionController(game.toObject(), userId);

  const { entries, entry, activeGameNumber } = getActiveEntry(game.toObject());
  const nextPlayerId = String(payload.nextPlayerId || '').trim();
  const legWinnerPlayerId = String(payload.legWinnerPlayerId || '').trim();
  const legOption = payload.legOption ? String(payload.legOption).trim() : null;
  const legRequiredForGame = isLegRequiredForGame(activeGameNumber);
  const hasLeg = Boolean(entry.legWinnerPlayerId);
  const wantsLeg = Boolean(legWinnerPlayerId);
  const wantsPass = Boolean(nextPlayerId);

  if (wantsLeg && !legRequiredForGame) {
    throw new ApiError(
      409,
      'LEG_NOT_APPLICABLE',
      'Leg is only for the first game of the series. The previous game winner breaks.'
    );
  }

  if (legRequiredForGame) {
    if (hasLeg && wantsLeg) {
      throw new ApiError(
        409,
        'LEG_ALREADY_WON',
        'This game already has a leg winner. End the game to continue the series.'
      );
    }

    if (!hasLeg && wantsPass && !wantsLeg) {
      throw new ApiError(
        409,
        'LEG_REQUIRED',
        'Mark the leg winner before passing the table.'
      );
    }

    if (!hasLeg && !wantsLeg) {
      throw new ApiError(
        409,
        'LEG_REQUIRED',
        'Mark the leg winner before passing the table.'
      );
    }
  } else if (wantsLeg) {
    throw new ApiError(
      409,
      'LEG_NOT_APPLICABLE',
      'Leg is only for the first game of the series. The previous game winner breaks.'
    );
  } else if (!wantsPass) {
    throw new ApiError(400, 'INVALID_ADVANCE_PAYLOAD', 'Provide nextPlayerId to pass the table');
  }

  let resolvedNextPlayerId = null;
  let turnLegWinnerPlayerId = null;

  if (legRequiredForGame && !hasLeg && wantsLeg) {
    if (![String(game.playerAId), String(game.playerBId)].includes(legWinnerPlayerId)) {
      throw new ApiError(400, 'INVALID_LEG_WINNER', 'legWinnerPlayerId must be one of the match players');
    }
    resolvedNextPlayerId = legWinnerPlayerId;
    entry.legWinnerPlayerId = legWinnerPlayerId;
    turnLegWinnerPlayerId = legWinnerPlayerId;
  } else if ((legRequiredForGame && hasLeg && wantsPass) || (!legRequiredForGame && wantsPass)) {
    if (![String(game.playerAId), String(game.playerBId)].includes(nextPlayerId)) {
      throw new ApiError(400, 'INVALID_TURN_PLAYER', 'nextPlayerId must be one of the match players');
    }
    resolvedNextPlayerId = nextPlayerId;
  } else {
    throw new ApiError(400, 'INVALID_ADVANCE_PAYLOAD', 'Provide legWinnerPlayerId or nextPlayerId');
  }

  const turnNumber = (entry.turns || []).length + 1;
  entry.turns = [
    ...(entry.turns || []),
    {
      turnNumber,
      playerId: resolvedNextPlayerId,
      markedByProctorUserId: userId,
      legOption,
      legWinnerPlayerId: turnLegWinnerPlayerId,
    },
  ];
  entry.currentTurnPlayerId = resolvedNextPlayerId;

  game.scoreEntries = entries;
  const seriesBase = game.seriesState?.toObject?.() || { ...game.seriesState };
  game.seriesState = withControllerActivity(
    {
      ...seriesBase,
      activeGameNumber,
      startedAt: seriesBase.startedAt || new Date(),
    },
    userId
  );
  game.markModified('scoreEntries');
  game.markModified('seriesState');
  await game.save();

  return mapLiveMatchState(game.toObject(), true, userId);
};

const endSeriesGame = async (tournamentId, gameId, userId, payload = {}) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  const winnerPlayerId = String(payload.winnerPlayerId || '').trim();
  const endReason = String(payload.endReason || '').trim();

  if (!winnerPlayerId) {
    throw new ApiError(400, 'WINNER_REQUIRED', 'winnerPlayerId is required');
  }
  if (!END_GAME_REASONS.includes(endReason)) {
    throw new ApiError(400, 'INVALID_END_REASON', `endReason must be one of: ${END_GAME_REASONS.join(', ')}`);
  }

  const game = await Game.findOne({ _id: gameId, tournamentId });
  if (!game) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found');
  }
  await assertLiveScoringEnabled(tournamentId, game);
  if (game.status !== 'inProgress') {
    throw new ApiError(409, 'GAME_NOT_IN_PROGRESS', 'Start the game session before ending a game');
  }

  assertSessionController(game.toObject(), userId);

  if (![String(game.playerAId), String(game.playerBId)].includes(winnerPlayerId)) {
    throw new ApiError(400, 'INVALID_WINNER', 'winnerPlayerId must be one of the match players');
  }

  const { entries, entry, activeGameNumber } = getActiveEntry(game.toObject());
  const isPlayerAWinner = String(winnerPlayerId) === String(game.playerAId);

  entry.playerAScore = isPlayerAWinner ? 1 : 0;
  entry.playerBScore = isPlayerAWinner ? 0 : 1;
  entry.endReason = endReason;

  const seriesWins = computeSeriesWinsFromEntries(entries);
  const bestOf = parseBestOf(game.bestOf, 1);
  const winsRequired = winsRequiredForBestOf(bestOf);
  const seriesComplete =
    seriesWins.playerASeriesWins >= winsRequired || seriesWins.playerBSeriesWins >= winsRequired;

  let nextGameNumber = null;
  if (!seriesComplete && activeGameNumber < bestOf) {
    nextGameNumber = activeGameNumber + 1;
    const hasNext = entries.some((e) => Number(e.gameNumber) === nextGameNumber);
    if (!hasNext) {
      const nextEntry = {
        gameNumber: nextGameNumber,
        playerAScore: 0,
        playerBScore: 0,
        turns: [],
        currentTurnPlayerId: winnerPlayerId,
        legWinnerPlayerId: null,
      };
      prepareActiveGameEntry(nextEntry, winnerPlayerId);
      entries.push(nextEntry);
    } else {
      const nextEntry = entries.find((e) => Number(e.gameNumber) === nextGameNumber);
      if (nextEntry) {
        nextEntry.currentTurnPlayerId = winnerPlayerId;
        nextEntry.legWinnerPlayerId = null;
      }
    }
  }

  game.scoreEntries = entries;
  game.playerASeriesWins = seriesWins.playerASeriesWins;
  game.playerBSeriesWins = seriesWins.playerBSeriesWins;
  game.markModified('scoreEntries');

  const seriesBase = game.seriesState?.toObject?.() || { ...game.seriesState };

  if (seriesComplete) {
    game.status = 'completed';
    game.winnerPlayerId =
      seriesWins.playerASeriesWins > seriesWins.playerBSeriesWins ? game.playerAId : game.playerBId;
    game.seriesState = clearTakeoverRequest({
      activeGameNumber,
      startedAt: seriesBase.startedAt,
      controllerUserId: null,
      controllerLastActiveAt: null,
      takeoverRequestedByUserId: null,
      takeoverRequestedAt: null,
    });
  } else {
    game.seriesState = clearTakeoverRequest(
      withControllerActivity(
        {
          ...seriesBase,
          activeGameNumber: nextGameNumber || activeGameNumber,
          startedAt: seriesBase.startedAt || new Date(),
        },
        userId
      )
    );
  }

  await game.save();

  if (seriesComplete) {
    await recomputeLeaderboardForScope(tournamentId, game.divisionId);
  }

  const state = await mapLiveMatchState(game.toObject(), true, userId);

  return {
    ...state,
    seriesComplete,
    nextGameNumber,
  };
};

module.exports = {
  startGameSession,
  getLiveMatchState,
  requestLiveMatchTakeover,
  handoffLiveMatchScoring,
  hostForceTakeoverLiveMatch,
  declineLiveMatchTakeover,
  cancelLiveMatchTakeover,
  advanceGameTurn,
  endSeriesGame,
  END_GAME_REASONS,
};
