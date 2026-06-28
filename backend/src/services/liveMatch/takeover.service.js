const Game = require('../../models/game.model');
const Tournament = require('../../models/tournament.model');
const ApiError = require('../../utils/ApiError');
const { assertCanEditTournamentScores } = require('../tournament');
const {
  clearTakeoverRequest,
  withControllerActivity,
  assertSessionController,
  mapLiveMatchState,
  assertLiveScoringEnabled,
} = require('./seriesState');

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

  return mapLiveMatchState(game.toObject(), true, userId);
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
  game.seriesState = clearTakeoverRequest(withControllerActivity({ ...seriesBase }, requesterId));
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

module.exports = {
  requestLiveMatchTakeover,
  handoffLiveMatchScoring,
  hostForceTakeoverLiveMatch,
  declineLiveMatchTakeover,
  cancelLiveMatchTakeover,
};
