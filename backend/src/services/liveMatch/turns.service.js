const Game = require('../../models/game.model');
const ApiError = require('../../utils/ApiError');
const { assertCanEditTournamentScores, recomputeLeaderboardForScope } = require('../tournament');
const {
  END_GAME_REASONS,
  parseBestOf,
  winsRequiredForBestOf,
  computeSeriesWinsFromEntries,
  clearTakeoverRequest,
  withControllerActivity,
  assertSessionController,
  prepareActiveGameEntry,
  isLegRequiredForGame,
  getActiveEntry,
  mapLiveMatchState,
  assertLiveScoringEnabled,
} = require('./seriesState');

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
      throw new ApiError(409, 'LEG_REQUIRED', 'Mark the leg winner before passing the table.');
    }

    if (!hasLeg && !wantsLeg) {
      throw new ApiError(409, 'LEG_REQUIRED', 'Mark the leg winner before passing the table.');
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

  return { ...state, seriesComplete, nextGameNumber };
};

module.exports = { advanceGameTurn, endSeriesGame };
