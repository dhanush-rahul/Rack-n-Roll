const Game = require('../../models/game.model');
const { nextPowerOfTwo } = require('./progressionPlan.utils');

const resolveWinnerId = (game, isDoubles) => {
  if (isDoubles) {
    return game.winnerTeamId ? String(game.winnerTeamId) : null;
  }
  return game.winnerPlayerId ? String(game.winnerPlayerId) : null;
};

const slotFieldForWinner = (game, isDoubles) => {
  if (!game.winnerSlot) {
    return null;
  }
  return game.winnerSlot;
};

const pairKnockoutParticipants = (participantIds = []) => {
  const ids = [...participantIds].filter(Boolean);
  const pairs = [];
  let left = 0;
  let right = ids.length - 1;

  while (left < right) {
    pairs.push([ids[left], ids[right]]);
    left += 1;
    right -= 1;
  }

  if (left === right) {
    pairs.push([ids[left], null]);
  }

  return pairs;
};

const createKnockoutSingleRoundGames = async ({
  tournamentId,
  stageId,
  participantIds,
  bestOf,
  isDoubles,
  bracketGroupKey = null,
}) => {
  const ids = [...participantIds].filter(Boolean);
  if (ids.length < 2) {
    return [];
  }

  const pairs = pairKnockoutParticipants(ids);
  const gameDocs = pairs.map(([slotA, slotB], index) => {
    const gameDoc = {
      tournamentId,
      divisionId: null,
      stageId: String(stageId),
      bracketGroupKey: bracketGroupKey ? String(bracketGroupKey) : null,
      roundNumber: 1,
      bracketRound: 1,
      bracketPosition: index + 1,
      bestOf,
      scoreEntries: [],
      playerASeriesWins: 0,
      playerBSeriesWins: 0,
      winnerPlayerId: null,
      winnerTeamId: null,
      status: 'scheduled',
      feedsFromGameIds: [],
      winnerSlot: null,
    };

    if (isDoubles) {
      if (slotA) gameDoc.teamAId = slotA;
      if (slotB) gameDoc.teamBId = slotB;
    } else {
      if (slotA) gameDoc.playerAId = slotA;
      if (slotB) gameDoc.playerBId = slotB;
    }

    if (slotA && !slotB) {
      gameDoc.status = 'completed';
      gameDoc.isBye = true;
      if (isDoubles) gameDoc.winnerTeamId = slotA;
      else gameDoc.winnerPlayerId = slotA;
    } else if (!slotA && slotB) {
      gameDoc.status = 'completed';
      gameDoc.isBye = true;
      if (isDoubles) gameDoc.winnerTeamId = slotB;
      else gameDoc.winnerPlayerId = slotB;
    }

    return gameDoc;
  });

  return Game.insertMany(gameDocs);
};

const createKnockoutBracketGames = async ({
  tournamentId,
  stageId,
  participantIds,
  bestOf,
  isDoubles,
  bracketGroupKey = null,
}) => {
  const ids = [...participantIds];
  if (ids.length < 2) {
    return [];
  }

  const bracketSize = nextPowerOfTwo(ids.length);
  const totalRounds = Math.log2(bracketSize);
  const seededSlots = Array.from({ length: bracketSize }, (_, index) => ids[index] || null);

  const gamesByRound = [];

  for (let round = 1; round <= totalRounds; round += 1) {
    const matchCount = bracketSize / 2 ** round;
    gamesByRound[round - 1] = [];

    for (let position = 1; position <= matchCount; position += 1) {
      const gameDoc = {
        tournamentId,
        divisionId: null,
        stageId: String(stageId),
        bracketGroupKey: bracketGroupKey ? String(bracketGroupKey) : null,
        roundNumber: round,
        bracketRound: round,
        bracketPosition: position,
        bestOf,
        scoreEntries: [],
        playerASeriesWins: 0,
        playerBSeriesWins: 0,
        winnerPlayerId: null,
        winnerTeamId: null,
        status: 'scheduled',
        feedsFromGameIds: [],
        winnerSlot: null,
      };
      gamesByRound[round - 1].push(gameDoc);
    }
  }

  // Link child games to parents
  for (let round = 1; round < totalRounds; round += 1) {
    const currentRoundGames = gamesByRound[round - 1];
    const nextRoundGames = gamesByRound[round];

    currentRoundGames.forEach((game, index) => {
      const parentIndex = Math.floor(index / 2);
      const parentGame = nextRoundGames[parentIndex];
      game._parentIndex = parentIndex;
      game._parentRound = round + 1;
      game._winnerSlot =
        index % 2 === 0 ? (isDoubles ? 'teamA' : 'playerA') : isDoubles ? 'teamB' : 'playerB';
      game.winnerSlot = game._winnerSlot;
      if (parentGame) {
        parentGame.feedsFromGameIds = parentGame.feedsFromGameIds || [];
      }
    });
  }

  // Insert from final round backwards so we have IDs for nextWinnerGameId
  const insertedByRound = [];
  for (let round = totalRounds; round >= 1; round -= 1) {
    const roundDocs = gamesByRound[round - 1];
    const inserted = await Game.insertMany(roundDocs);
    insertedByRound[round - 1] = inserted;
  }

  // Wire nextWinnerGameId and feedsFromGameIds
  for (let round = 1; round < totalRounds; round += 1) {
    const currentInserted = insertedByRound[round - 1];
    const nextInserted = insertedByRound[round];

    for (let index = 0; index < currentInserted.length; index += 1) {
      const game = currentInserted[index];
      const parentIndex = Math.floor(index / 2);
      const parentGame = nextInserted[parentIndex];
      if (!parentGame) continue;

      await Game.updateOne(
        { _id: game._id },
        {
          $set: {
            nextWinnerGameId: parentGame._id,
            winnerSlot: index % 2 === 0 ? (isDoubles ? 'teamA' : 'playerA') : isDoubles ? 'teamB' : 'playerB',
          },
        }
      );

      await Game.updateOne(
        { _id: parentGame._id },
        { $addToSet: { feedsFromGameIds: game._id } }
      );
    }
  }

  // Seed round 1 participants
  const roundOneGames = insertedByRound[0];
  for (let index = 0; index < roundOneGames.length; index += 1) {
    const slotA = seededSlots[index * 2];
    const slotB = seededSlots[index * 2 + 1];
    const update = {};

    if (isDoubles) {
      if (slotA) update.teamAId = slotA;
      if (slotB) update.teamBId = slotB;
    } else {
      if (slotA) update.playerAId = slotA;
      if (slotB) update.playerBId = slotB;
    }

    if (!slotA && slotB) {
      update.status = 'completed';
      if (isDoubles) update.winnerTeamId = slotB;
      else update.winnerPlayerId = slotB;
    } else if (slotA && !slotB) {
      update.status = 'completed';
      if (isDoubles) update.winnerTeamId = slotA;
      else update.winnerPlayerId = slotA;
    }

    if (Object.keys(update).length > 0) {
      await Game.updateOne({ _id: roundOneGames[index]._id }, { $set: update });
    }
  }

  // Auto-advance bye winners
  for (const game of roundOneGames) {
    const refreshed = await Game.findById(game._id).lean();
    if (refreshed?.status === 'completed' && refreshed.nextWinnerGameId) {
      await advanceKnockoutWinner(refreshed, isDoubles);
    }
  }

  const allGames = insertedByRound.flat();
  return allGames;
};

const advanceKnockoutWinner = async (completedGame, isDoubles) => {
  const winnerId = resolveWinnerId(completedGame, isDoubles);
  if (!winnerId || !completedGame.nextWinnerGameId) {
    return null;
  }

  const parentGame = await Game.findById(completedGame.nextWinnerGameId);
  if (!parentGame) {
    return null;
  }

  const slot = completedGame.winnerSlot;
  const update = {};

  if (isDoubles) {
    if (slot === 'teamA') update.teamAId = winnerId;
    if (slot === 'teamB') update.teamBId = winnerId;
  } else {
    if (slot === 'playerA') update.playerAId = winnerId;
    if (slot === 'playerB') update.playerBId = winnerId;
  }

  if (Object.keys(update).length === 0) {
    return parentGame;
  }

  await Game.updateOne({ _id: parentGame._id }, { $set: update });
  return Game.findById(parentGame._id).lean();
};

const isKnockoutStageComplete = async (tournamentId, stageId) => {
  const incompleteCount = await Game.countDocuments({
    tournamentId,
    stageId: String(stageId),
    status: { $ne: 'completed' },
  });
  return incompleteCount === 0;
};

module.exports = {
  createKnockoutSingleRoundGames,
  createKnockoutBracketGames,
  advanceKnockoutWinner,
  isKnockoutStageComplete,
  resolveWinnerId,
  pairKnockoutParticipants,
};
