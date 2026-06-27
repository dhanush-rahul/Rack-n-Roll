const Game = require('../../models/game.model');
const ApiError = require('../../utils/ApiError');
const { assertCanEditTournamentScores, canUserEditTournamentScores } = require('../tournament');
const {
  releaseStaleControllerIfNeeded,
  clearTakeoverRequest,
  withControllerActivity,
  getActiveEntry,
  ensureBreakerForActiveGame,
  isLegRequiredForGame,
  mapLiveMatchState,
  assertLiveScoringEnabled,
} = require('./seriesState');

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

module.exports = { startGameSession, getLiveMatchState };
