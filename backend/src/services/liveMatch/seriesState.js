const Game = require('../../models/game.model');
const Tournament = require('../../models/tournament.model');
const Player = require('../../models/player.model');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { buildLiveMatchInningsStats } = require('../../utils/liveMatchInnings');
const { isStageProctored } = require('../tournament');

const LIVE_SESSION_CONTROLLER_TTL_MS = 5 * 60 * 1000;
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

const buildPlayerSummaryById = async (playerIds = []) => {
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
  const isSessionController = Boolean(viewerId && controllerUserId && viewerId === controllerUserId);
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
  const legSatisfied = !legRequiredForActiveGame || Boolean(activeLegWinnerPlayerId);
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
          displayName: userSummaryById.get(takeoverUserId)?.displayName || 'Proctor',
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

  if (!isStageProctored(tournament.competitionConfig || {}, game.stageId || game.stage || 'groupStage', tournament)) {
    throw new ApiError(
      403,
      'LIVE_SCORING_DISABLED',
      'Live proctored scoring is not enabled for this stage. Enter scores on the Games tab.'
    );
  }
};

module.exports = {
  LIVE_SESSION_CONTROLLER_TTL_MS,
  END_GAME_REASONS,
  parseBestOf,
  winsRequiredForBestOf,
  computeSeriesWinsFromEntries,
  buildUserSummaryById,
  buildPlayerSummaryById,
  clearTakeoverRequest,
  withControllerActivity,
  releaseStaleControllerIfNeeded,
  assertSessionController,
  prepareActiveGameEntry,
  isLegRequiredForGame,
  getPreviousGameWinnerPlayerId,
  ensureBreakerForActiveGame,
  getActiveEntry,
  mapLiveMatchState,
  assertLiveScoringEnabled,
};
