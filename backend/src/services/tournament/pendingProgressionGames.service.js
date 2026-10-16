const Game = require('../../models/game.model');
const Tournament = require('../../models/tournament.model');
const Player = require('../../models/player.model');
const Team = require('../../models/team.model');
const cache = require('../../utils/cache');
const { getOrderedStages, buildStageGameFilter } = require('./progressionPlan.utils');
const { mergeBypassParticipants } = require('./groupAdvancement.service');
const { advanceKnockoutWinner } = require('./knockoutFixtures.service');

const invalidateScoresheetCache = (tournamentId) => {
  cache.delByPrefix(`tournament:${String(tournamentId)}:scoresheet:`);
};

const sideParticipantId = (game, side, isDoubles) => {
  if (isDoubles) {
    return side === 'A' ? game.teamAId : game.teamBId;
  }

  return side === 'A' ? game.playerAId : game.playerBId;
};

const winnerSlotForSide = (side, isDoubles) => {
  if (isDoubles) {
    return side === 'A' ? 'teamA' : 'teamB';
  }

  return side === 'A' ? 'playerA' : 'playerB';
};

const isFeederComplete = (game = {}) =>
  game.status === 'completed' || Boolean(game.winnerPlayerId || game.winnerTeamId);

const loadNameMap = async (participantIds, isDoubles) => {
  const ids = [...new Set(participantIds.map((id) => String(id || '')).filter(Boolean))];

  if (ids.length === 0) {
    return new Map();
  }

  if (isDoubles) {
    const teams = await Team.find({ _id: { $in: ids } }).select({ displayName: 1 }).lean();
    return new Map(teams.map((team) => [String(team._id), team.displayName]));
  }

  const players = await Player.find({ _id: { $in: ids } }).select({ displayName: 1 }).lean();
  return new Map(players.map((player) => [String(player._id), player.displayName]));
};

const participantIdsOnGame = (game) =>
  [game.playerAId, game.playerBId, game.teamAId, game.teamBId].filter(Boolean);

const formatPendingLabel = (feeder, names) => {
  const leftId = String(feeder.playerAId || feeder.teamAId || '');
  const rightId = String(feeder.playerBId || feeder.teamBId || '');
  const leftName = leftId ? names.get(leftId) || 'Player' : null;
  const rightName = rightId ? names.get(rightId) || 'Player' : null;

  if (leftName && rightName) {
    return `Pending (${leftName}/${rightName})`;
  }

  if (leftName || rightName) {
    return `Pending (${leftName || rightName})`;
  }

  return 'Pending';
};

const waitingPhrase = (feeder, names) => {
  const leftId = String(feeder.playerAId || feeder.teamAId || '');
  const rightId = String(feeder.playerBId || feeder.teamBId || '');
  const leftName = leftId ? names.get(leftId) : null;
  const rightName = rightId ? names.get(rightId) : null;

  if (leftName && rightName) {
    return `${leftName} vs ${rightName}`;
  }

  return leftName || rightName || 'the previous match';
};

const buildPendingMatchMeta = async (games = [], isDoubles = false) => {
  const metaByGameId = new Map();
  const feederIds = games.flatMap((game) => game.feedsFromGameIds || []);

  if (feederIds.length === 0) {
    return metaByGameId;
  }

  const feeders = await Game.find({ _id: { $in: feederIds } }).lean();
  const feedersById = new Map(feeders.map((feeder) => [String(feeder._id), feeder]));
  const names = await loadNameMap(feeders.flatMap(participantIdsOnGame), isDoubles);

  games.forEach((game) => {
    const gameFeeders = (game.feedsFromGameIds || [])
      .map((id) => feedersById.get(String(id)))
      .filter(Boolean);

    if (gameFeeders.length === 0) {
      return;
    }

    let playerAPendingLabel = null;
    let playerBPendingLabel = null;

    gameFeeders.forEach((feeder) => {
      const slot = feeder.winnerSlot;
      const side = slot === 'playerA' || slot === 'teamA' ? 'A' : slot === 'playerB' || slot === 'teamB' ? 'B' : null;

      if (!side || sideParticipantId(game, side, isDoubles)) {
        return;
      }

      const label = formatPendingLabel(feeder, names);

      if (side === 'A') {
        playerAPendingLabel = label;
      } else {
        playerBPendingLabel = label;
      }
    });

    const unfinished = gameFeeders.filter((feeder) => !isFeederComplete(feeder));
    const missingSide = !sideParticipantId(game, 'A', isDoubles) || !sideParticipantId(game, 'B', isDoubles);
    let scoreBlockedReason = null;

    if (unfinished.length > 0) {
      const namesList = unfinished.map((feeder) => waitingPhrase(feeder, names));
      const joined =
        namesList.length === 1
          ? namesList[0]
          : `${namesList.slice(0, -1).join(', ')} and ${namesList[namesList.length - 1]}`;
      scoreBlockedReason = `Waiting for ${joined} to finish.`;
    } else if (missingSide) {
      scoreBlockedReason = 'This match is waiting for a player.';
    }

    metaByGameId.set(String(game._id), {
      playerAPendingLabel,
      playerBPendingLabel,
      scoreBlockedReason,
    });
  });

  return metaByGameId;
};

const getProgressionScoreBlockReason = async (game) => {
  if (!game || !(game.feedsFromGameIds || []).length) {
    return null;
  }

  const feeders = await Game.find({ _id: { $in: game.feedsFromGameIds } })
    .select({ winnerSlot: 1, teamAId: 1, teamBId: 1 })
    .lean();
  const isDoubles =
    Boolean(game.teamAId || game.teamBId) ||
    feeders.some(
      (feeder) =>
        String(feeder.winnerSlot || '').startsWith('team') || feeder.teamAId || feeder.teamBId
    );
  const meta = await buildPendingMatchMeta([game], isDoubles);
  return meta.get(String(game._id))?.scoreBlockedReason || null;
};

const slotFromFeeder = (game, isDoubles) => {
  const winnerId = isDoubles ? game.winnerTeamId : game.winnerPlayerId;

  if (isFeederComplete(game) && winnerId) {
    return { kind: 'known', participantId: String(winnerId), feederGameId: game._id };
  }

  return { kind: 'pending', feederGameId: game._id };
};

const materializeNextKnockoutPendingGames = async ({ tournamentId, sourceStageId, isDoubles }) => {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    return [];
  }

  const stages = getOrderedStages(tournament);
  const sourceIndex = stages.findIndex((stage) => String(stage.stageId) === String(sourceStageId));
  const sourceStage = sourceIndex >= 0 ? stages[sourceIndex] : null;
  const nextStage = sourceIndex >= 0 ? stages[sourceIndex + 1] : null;

  if (!sourceStage || sourceStage.format !== 'knockout' || !nextStage || nextStage.format !== 'knockout') {
    return [];
  }

  const existingNext = await Game.find(buildStageGameFilter(tournamentId, nextStage.stageId)).lean();
  const hasStartedScoring = existingNext.some(
    (game) => game.status !== 'scheduled' || (game.scoreEntries || []).some((entry) => entry?.endReason)
  );

  if (hasStartedScoring) {
    return existingNext;
  }

  if (existingNext.length > 0) {
    await Game.deleteMany(buildStageGameFilter(tournamentId, nextStage.stageId));
  }

  const sourceGames = await Game.find(buildStageGameFilter(tournamentId, sourceStage.stageId))
    .sort({ bracketGroupKey: 1, bracketPosition: 1, _id: 1 })
    .lean();

  if (sourceGames.length === 0) {
    return [];
  }

  const playingIds = new Set(sourceGames.flatMap((game) => participantIdsOnGame(game).map(String)));
  const bypassIds = mergeBypassParticipants(tournament, nextStage.name, []).filter((id) => !playingIds.has(String(id)));
  const slots = [
    ...bypassIds.map((participantId) => ({ kind: 'known', participantId: String(participantId), feederGameId: null })),
    ...sourceGames.map((game) => slotFromFeeder(game, isDoubles)),
  ];

  if (slots.length === 0) {
    return [];
  }

  const plans = [];

  for (let index = 0; index < slots.length; index += 2) {
    plans.push({
      left: slots[index],
      right: slots[index + 1] || null,
      position: plans.length + 1,
    });
  }

  const requestedBestOf = Number(nextStage.bestOf || 3);
  const bestOf = [1, 3, 5, 7].includes(requestedBestOf) ? requestedBestOf : 3;
  const docs = plans.map((plan) => {
    const loneKnown = plan.left?.kind === 'known' && !plan.right;
    const gameDoc = {
      tournamentId,
      divisionId: null,
      stageId: String(nextStage.stageId),
      bracketGroupKey: null,
      roundNumber: 1,
      bracketRound: 1,
      bracketPosition: plan.position,
      bestOf,
      scoreEntries: [],
      playerASeriesWins: 0,
      playerBSeriesWins: 0,
      winnerPlayerId: null,
      winnerTeamId: null,
      status: loneKnown ? 'completed' : 'scheduled',
      feedsFromGameIds: [plan.left?.feederGameId, plan.right?.feederGameId].filter(Boolean),
      winnerSlot: null,
    };

    const applySide = (slot, side) => {
      if (!slot || slot.kind !== 'known' || !slot.participantId) {
        return;
      }

      if (isDoubles) {
        if (side === 'A') gameDoc.teamAId = slot.participantId;
        else gameDoc.teamBId = slot.participantId;
      } else if (side === 'A') {
        gameDoc.playerAId = slot.participantId;
      } else {
        gameDoc.playerBId = slot.participantId;
      }
    };

    applySide(plan.left, 'A');
    applySide(plan.right, 'B');

    if (loneKnown) {
      if (isDoubles) gameDoc.winnerTeamId = plan.left.participantId;
      else gameDoc.winnerPlayerId = plan.left.participantId;
    }

    return gameDoc;
  });

  const created = await Game.insertMany(docs);

  for (let index = 0; index < plans.length; index += 1) {
    const parentId = created[index]._id;
    const wire = async (slot, side) => {
      if (!slot?.feederGameId) {
        return;
      }

      await Game.updateOne(
        { _id: slot.feederGameId },
        { $set: { winnerSlot: winnerSlotForSide(side, isDoubles) } }
      );
    };

    await wire(plans[index].left, 'A');
    await wire(plans[index].right, 'B');
    await Game.updateOne({ _id: parentId }, { $set: { feedsFromGameIds: docs[index].feedsFromGameIds } });
  }

  invalidateScoresheetCache(tournamentId);
  return created;
};

const finalizeDownstreamIfBye = async (parentId, isDoubles) => {
  const parent = await Game.findById(parentId);

  if (!parent || parent.status === 'completed') {
    return parent;
  }

  const feederIds = parent.feedsFromGameIds || [];

  if (feederIds.length === 0) {
    return parent;
  }

  const feeders = await Game.find({ _id: { $in: feederIds } }).lean();
  const allWinnersKnown =
    feeders.length > 0 && feeders.every((feeder) => feeder.winnerPlayerId || feeder.winnerTeamId);
  const hasA = Boolean(sideParticipantId(parent, 'A', isDoubles));
  const hasB = Boolean(sideParticipantId(parent, 'B', isDoubles));

  if (!allWinnersKnown || hasA === hasB) {
    return parent;
  }

  const winnerId = hasA ? sideParticipantId(parent, 'A', isDoubles) : sideParticipantId(parent, 'B', isDoubles);
  parent.status = 'completed';

  if (isDoubles) {
    parent.winnerTeamId = winnerId;
  } else {
    parent.winnerPlayerId = winnerId;
  }

  await parent.save();
  return parent;
};

const syncDownstreamProgressionGame = async (completedGame, isDoubles) => {
  if (!completedGame) {
    return null;
  }

  const parent = await advanceKnockoutWinner(completedGame, isDoubles);

  if (!parent?._id) {
    return null;
  }

  await finalizeDownstreamIfBye(parent._id, isDoubles);
  invalidateScoresheetCache(completedGame.tournamentId);
  return parent;
};

const refreshMaterializedStageSlots = async (games = [], isDoubles = false) => {
  const feederIds = games.flatMap((game) => game.feedsFromGameIds || []);

  if (feederIds.length === 0) {
    return;
  }

  const feeders = await Game.find({ _id: { $in: feederIds } }).lean();

  for (const feeder of feeders) {
    if (isFeederComplete(feeder)) {
      await syncDownstreamProgressionGame(feeder, isDoubles);
    }
  }
};

module.exports = {
  buildPendingMatchMeta,
  getProgressionScoreBlockReason,
  materializeNextKnockoutPendingGames,
  syncDownstreamProgressionGame,
  refreshMaterializedStageSlots,
};
