const Tournament = require('../../models/tournament.model');
const Division = require('../../models/division.model');
const Game = require('../../models/game.model');
const Leaderboard = require('../../models/leaderboard.model');
const Team = require('../../models/team.model');
const Player = require('../../models/player.model');
const { isDoublesTournament, buildTeamSummaryById, resolveDoublesPairingForGroupAssign, randomPairSolos, pairByeWithPlayer } = require('../team.service');
const { recomputeLeaderboardForScope } = require('./leaderboard.service');
const { materializeApprovedPlayers, ensurePlayersFromApprovedRegistrations, materializeApprovedPlayerForUser } = require('./roster.service');
const { mapGameForScoresheet } = require('./permissions');
const {
  parseBestOf,
  parsePositiveInteger,
  shuffleArray,
  buildGroupName,
  normalizeDivisionScopeValue,
  assertHostAccess,
  countPairGames,
  countPairTeamGames,
  pickDivisionForNewPlayer,
  pickDivisionForNewTeam,
  buildPlayerSummaryById,
  buildRoundRobinRounds,
} = require('./shared');
const ApiError = require('../../utils/ApiError');

// ── Incremental game creation ──────────────────────────────────────────────

const createIncrementalGroupStageGamesForTeam = async ({
  tournamentId, divisionId, newTeamId, opponentTeamIds, bestOf, existingGames,
}) => {
  const groupStageLegs = 2;
  let maxRoundNumber = existingGames.reduce(
    (max, game) => Math.max(max, Number(game.roundNumber || 0)),
    0
  );
  const gameDocuments = [];

  opponentTeamIds.forEach((opponentTeamId) => {
    let playedLegs = countPairTeamGames(existingGames, newTeamId, opponentTeamId);

    while (playedLegs < groupStageLegs) {
      maxRoundNumber += 1;
      const swapSides = playedLegs === 1;

      gameDocuments.push({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        stage: 'groupStage',
        roundNumber: maxRoundNumber,
        bestOf: parseBestOf(bestOf, 1),
        teamAId: swapSides ? opponentTeamId : newTeamId,
        teamBId: swapSides ? newTeamId : opponentTeamId,
        scoreEntries: [],
        playerASeriesWins: 0,
        playerBSeriesWins: 0,
        winnerTeamId: null,
        status: 'scheduled',
      });

      playedLegs += 1;
    }
  });

  if (gameDocuments.length === 0) {
    return [];
  }

  return Game.insertMany(gameDocuments);
};

const createIncrementalGroupStageGamesForPlayer = async ({
  tournamentId, divisionId, newPlayerId, opponentIds, bestOf, existingGames,
}) => {
  const groupStageLegs = 2;
  let maxRoundNumber = existingGames.reduce(
    (max, game) => Math.max(max, Number(game.roundNumber || 0)),
    0
  );
  const gameDocuments = [];

  opponentIds.forEach((opponentId) => {
    let playedLegs = countPairGames(existingGames, newPlayerId, opponentId);

    while (playedLegs < groupStageLegs) {
      maxRoundNumber += 1;
      const swapSides = playedLegs === 1;

      gameDocuments.push({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        stage: 'groupStage',
        roundNumber: maxRoundNumber,
        bestOf: parseBestOf(bestOf, 1),
        playerAId: swapSides ? opponentId : newPlayerId,
        playerBId: swapSides ? newPlayerId : opponentId,
        scoreEntries: [],
        playerASeriesWins: 0,
        playerBSeriesWins: 0,
        winnerPlayerId: null,
        status: 'scheduled',
      });

      playedLegs += 1;
    }
  });

  if (gameDocuments.length === 0) {
    return [];
  }

  return Game.insertMany(gameDocuments);
};

// ── Group sync (incremental assignment) ───────────────────────────────────

const syncDoublesApprovedPlayerToGroupsByPlayerId = async (tournamentId, playerId, divisions, tournament) => {
  const normalizedPlayerId = String(playerId || '').trim();

  if (!normalizedPlayerId) {
    return null;
  }

  const existingAssignment = divisions.find((division) =>
    (division.playerIds || []).map((value) => String(value)).includes(normalizedPlayerId)
  );

  if (existingAssignment) {
    return {
      alreadyAssigned: true,
      divisionId: String(existingAssignment._id),
      divisionName: existingAssignment.name,
      gamesCreated: 0,
    };
  }

  const hostUserId = String(tournament.hostUserId);
  let team = null;
  let targetDivision = null;

  const byePlayer = await Player.findOne({
    tournamentId,
    status: 'active',
    teamId: null,
    awaitingPartner: true,
  }).lean();

  if (byePlayer && String(byePlayer._id) !== normalizedPlayerId) {
    team = await pairByeWithPlayer(tournamentId, hostUserId, normalizedPlayerId);
    targetDivision =
      divisions.find((division) =>
        (division.playerIds || []).map((value) => String(value)).includes(String(byePlayer._id))
      ) || pickDivisionForNewTeam(divisions);
  } else {
    targetDivision = pickDivisionForNewPlayer(divisions);
  }

  if (!targetDivision) {
    return null;
  }

  if (!team) {
    await Division.updateOne(
      { _id: targetDivision._id },
      { $addToSet: { playerIds: normalizedPlayerId } }
    );

    await Player.updateOne({ _id: normalizedPlayerId }, { $set: { awaitingPartner: true, teamId: null } });

    return {
      divisionId: String(targetDivision._id),
      divisionName: targetDivision.name,
      gamesCreated: 0,
      awaitingPartner: true,
      alreadyAssigned: false,
    };
  }

  const teamId = String(team.id);
  const opponentTeamIds = (targetDivision.teamIds || [])
    .map((value) => String(value))
    .filter((value) => value !== teamId);

  await Division.updateOne(
    { _id: targetDivision._id },
    {
      $addToSet: {
        playerIds: { $each: [String(team.player1Id), String(team.player2Id)] },
        teamIds: teamId,
      },
    }
  );

  await Team.updateOne({ _id: teamId }, { $set: { divisionId: targetDivision._id } });

  const existingGames = await Game.find({
    tournamentId,
    divisionId: targetDivision._id,
    stage: 'groupStage',
  }).lean();

  const bestOf = parseBestOf(tournament?.competitionConfig?.groupStageBestOf, 1);
  const createdGames = await createIncrementalGroupStageGamesForTeam({
    tournamentId,
    divisionId: String(targetDivision._id),
    newTeamId: teamId,
    opponentTeamIds,
    bestOf,
    existingGames,
  });

  if (createdGames.length > 0) {
    await recomputeLeaderboardForScope(tournamentId, targetDivision._id);
  }

  return {
    divisionId: String(targetDivision._id),
    divisionName: targetDivision.name,
    teamId,
    gamesCreated: createdGames.length,
    alreadyAssigned: false,
  };
};

const syncDoublesApprovedPlayerToGroups = async (tournamentId, userId, divisions, tournament) => {
  const players = await ensurePlayersFromApprovedRegistrations(tournamentId);
  const normalizedUserId = String(userId || '').trim();
  const player = players.find((entry) => String(entry.userId) === normalizedUserId);

  if (!player) {
    return null;
  }

  return syncDoublesApprovedPlayerToGroupsByPlayerId(tournamentId, String(player.id), divisions, tournament);
};

const syncSinglesApprovedPlayerToGroupsByPlayerId = async (tournamentId, playerId, divisions, tournament) => {
  const normalizedPlayerId = String(playerId || '').trim();

  if (!normalizedPlayerId) {
    return null;
  }

  const existingAssignment = divisions.find((division) =>
    (division.playerIds || []).map((value) => String(value)).includes(normalizedPlayerId)
  );

  if (existingAssignment) {
    return {
      alreadyAssigned: true,
      divisionId: String(existingAssignment._id),
      divisionName: existingAssignment.name,
      gamesCreated: 0,
    };
  }

  const targetDivision = pickDivisionForNewPlayer(divisions);

  if (!targetDivision) {
    return null;
  }

  const opponentIds = (targetDivision.playerIds || [])
    .map((value) => String(value))
    .filter((value) => value !== normalizedPlayerId);

  await Division.updateOne(
    { _id: targetDivision._id },
    { $addToSet: { playerIds: normalizedPlayerId } }
  );

  const existingGames = await Game.find({
    tournamentId,
    divisionId: targetDivision._id,
    stage: 'groupStage',
  }).lean();

  const bestOf = parseBestOf(tournament?.competitionConfig?.groupStageBestOf, 1);
  const createdGames = await createIncrementalGroupStageGamesForPlayer({
    tournamentId,
    divisionId: String(targetDivision._id),
    newPlayerId: normalizedPlayerId,
    opponentIds,
    bestOf,
    existingGames,
  });

  if (createdGames.length > 0) {
    await recomputeLeaderboardForScope(tournamentId, targetDivision._id);
  }

  return {
    divisionId: String(targetDivision._id),
    divisionName: targetDivision.name,
    gamesCreated: createdGames.length,
    alreadyAssigned: false,
  };
};

const syncApprovedPlayerToGroupsByPlayerId = async (tournamentId, playerId) => {
  const divisions = await Division.find({ tournamentId, name: { $ne: 'Final Stage' } })
    .sort({ name: 1, _id: 1 })
    .lean();

  if (divisions.length === 0) {
    return null;
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ competitionConfig: 1, hostUserId: 1 })
    .lean();

  if (isDoublesTournament(tournament)) {
    return syncDoublesApprovedPlayerToGroupsByPlayerId(tournamentId, playerId, divisions, tournament);
  }

  return syncSinglesApprovedPlayerToGroupsByPlayerId(tournamentId, playerId, divisions, tournament);
};

const syncApprovedPlayerToGroups = async (tournamentId, userId) => {
  const divisions = await Division.find({ tournamentId, name: { $ne: 'Final Stage' } })
    .sort({ name: 1, _id: 1 })
    .lean();

  if (divisions.length === 0) {
    return null;
  }

  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return null;
  }

  let playerDoc = await Player.findOne({ tournamentId, userId: normalizedUserId, status: 'active' }).lean();

  if (!playerDoc) {
    await materializeApprovedPlayerForUser(tournamentId, normalizedUserId);
    playerDoc = await Player.findOne({ tournamentId, userId: normalizedUserId, status: 'active' }).lean();
  }

  if (!playerDoc) {
    return null;
  }

  return syncApprovedPlayerToGroupsByPlayerId(tournamentId, String(playerDoc._id));
};

// ── Round-robin game creation ──────────────────────────────────────────────

const createRoundRobinTeamGamesForStage = async ({ tournamentId, divisionId, stage, teamIds, bestOf }) => {
  const participantIds = [...teamIds];

  if (participantIds.length < 2) {
    return [];
  }

  const rounds = buildRoundRobinRounds(
    participantIds.map((teamId) => ({ id: teamId })),
    stage === 'groupStage' ? 2 : 1
  );

  const gameDocuments = [];

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      gameDocuments.push({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        stage,
        roundNumber: round.roundNumber,
        bestOf: parseBestOf(bestOf, 1),
        teamAId: match.playerA.id,
        teamBId: match.playerB.id,
        scoreEntries: [],
        playerASeriesWins: 0,
        playerBSeriesWins: 0,
        winnerTeamId: null,
        status: 'scheduled',
      });
    });
  });

  if (gameDocuments.length === 0) {
    return [];
  }

  const createdGames = await Game.insertMany(gameDocuments);
  const teamSummaryById = await buildTeamSummaryById(
    createdGames.flatMap((game) => [game.teamAId, game.teamBId])
  );

  return createdGames.map((game) =>
    mapGameForScoresheet(game.toObject(), new Map(), new Map(), { teamSummaryById })
  );
};

const createRoundRobinGamesForStage = async ({ tournamentId, divisionId, stage, playerIds, bestOf }) => {
  const participantIds = [...playerIds];

  if (participantIds.length < 2) {
    return [];
  }

  const rounds = buildRoundRobinRounds(
    participantIds.map((playerId) => ({ id: playerId })),
    stage === 'groupStage' ? 2 : 1
  );

  const gameDocuments = [];

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      gameDocuments.push({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        stage,
        roundNumber: round.roundNumber,
        bestOf: parseBestOf(bestOf, 1),
        playerAId: match.playerA.id,
        playerBId: match.playerB.id,
        scoreEntries: [],
        playerASeriesWins: 0,
        playerBSeriesWins: 0,
        winnerPlayerId: null,
        status: 'scheduled',
      });
    });
  });

  if (gameDocuments.length === 0) {
    return [];
  }

  const createdGames = await Game.insertMany(gameDocuments);
  const playerSummaryById = await buildPlayerSummaryById(
    createdGames.flatMap((game) => [game.playerAId, game.playerBId])
  );

  return createdGames.map((game) => mapGameForScoresheet(game.toObject(), playerSummaryById));
};

// ── Group assignment ───────────────────────────────────────────────────────

const assignRandomGroupsDoubles = async (tournamentId, hostUserId, payload = {}, tournament) => {
  if (payload.pairTeamsRandom) {
    await randomPairSolos(tournamentId, hostUserId);
  } else {
    await resolveDoublesPairingForGroupAssign(tournamentId);
  }

  const teams = await Team.find({ tournamentId, status: 'active' }).sort({ createdAt: 1, _id: 1 }).lean();

  if (teams.length < 1) {
    throw new ApiError(409, 'NO_TEAMS', 'At least one team is required before assigning groups');
  }

  const normalizedGroupCount = parsePositiveInteger(payload.groupCount, 2);
  if (normalizedGroupCount > 8) {
    throw new ApiError(400, 'GROUP_COUNT_OUT_OF_RANGE', 'groupCount must be between 1 and 8');
  }

  const groupCount = Math.min(normalizedGroupCount, Math.max(teams.length, 1));
  const groupStageBestOf = parseBestOf(payload.groupStageBestOf, 1);
  const randomTeams = shuffleArray(teams);

  await Division.deleteMany({ tournamentId });
  await Game.deleteMany({ tournamentId, stage: 'groupStage' });
  await Leaderboard.deleteMany({ tournamentId });
  await Team.updateMany({ tournamentId, status: 'active' }, { $set: { divisionId: null } });

  const groups = Array.from({ length: groupCount }, (_, groupIndex) => ({
    name: buildGroupName(groupIndex),
    playerIds: [],
    teamIds: [],
  }));

  randomTeams.forEach((team, index) => {
    const targetGroupIndex = index % groupCount;
    groups[targetGroupIndex].teamIds.push(String(team._id));
    groups[targetGroupIndex].playerIds.push(String(team.player1Id), String(team.player2Id));
  });

  const insertedDivisions = await Division.insertMany(
    groups.map((group) => ({
      tournamentId,
      name: group.name,
      playerIds: group.playerIds,
      teamIds: group.teamIds,
      status: 'open',
    }))
  );

  const createdGamesByDivision = [];

  for (const division of insertedDivisions) {
    const divisionTeamIds = (division.teamIds || []).map((teamId) => String(teamId));

    await Team.updateMany(
      { _id: { $in: divisionTeamIds }, tournamentId, status: 'active' },
      { $set: { divisionId: division._id } }
    );

    const createdGames = await createRoundRobinTeamGamesForStage({
      tournamentId,
      divisionId: String(division._id),
      stage: 'groupStage',
      teamIds: divisionTeamIds,
      bestOf: groupStageBestOf,
    });

    await recomputeLeaderboardForScope(tournamentId, division._id);

    createdGamesByDivision.push({
      divisionId: String(division._id),
      divisionName: division.name,
      gameCount: createdGames.length,
    });
  }

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        progressionState: 'groupStage',
        'competitionConfig.groupCount': groupCount,
        'competitionConfig.groupStageBestOf': groupStageBestOf,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    groupCount,
    groupStageBestOf,
    format: 'doubles',
    groups: insertedDivisions.map((division) => ({
      divisionId: String(division._id),
      name: division.name,
      teamCount: (division.teamIds || []).length,
      playerCount: (division.playerIds || []).length,
      teamIds: (division.teamIds || []).map((value) => String(value)),
      playerIds: (division.playerIds || []).map((value) => String(value)),
    })),
    gameSummary: createdGamesByDivision,
  };
};

const assignRandomGroups = async (tournamentId, hostUserId, payload = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);

  if (tournament.registrationStatus !== 'closed') {
    throw new ApiError(409, 'REGISTRATION_MUST_BE_CLOSED', 'Close registration before assigning groups');
  }

  if (!['registration', 'groupSetup'].includes(tournament.progressionState || 'registration')) {
    throw new ApiError(
      409,
      'GROUP_PATTERN_LOCKED',
      'Group pattern is locked after fixtures are generated'
    );
  }

  if (isDoublesTournament(tournament)) {
    return assignRandomGroupsDoubles(tournamentId, hostUserId, payload, tournament);
  }

  const players = await ensurePlayersFromApprovedRegistrations(tournamentId);
  const normalizedGroupCount = parsePositiveInteger(payload.groupCount, 2);

  if (normalizedGroupCount > 8) {
    throw new ApiError(400, 'GROUP_COUNT_OUT_OF_RANGE', 'groupCount must be between 1 and 8');
  }

  const groupCount = Math.min(normalizedGroupCount, Math.max(players.length, 1));
  const groupStageBestOf = parseBestOf(payload.groupStageBestOf, 1);
  const randomPlayers = shuffleArray(players);

  await Division.deleteMany({ tournamentId });
  await Game.deleteMany({ tournamentId, stage: 'groupStage' });
  await Leaderboard.deleteMany({ tournamentId });

  const groups = Array.from({ length: groupCount }, (_, groupIndex) => ({
    name: buildGroupName(groupIndex),
    playerIds: [],
  }));

  randomPlayers.forEach((player, index) => {
    const targetGroupIndex = index % groupCount;
    groups[targetGroupIndex].playerIds.push(player.id);
  });

  const insertedDivisions = await Division.insertMany(
    groups.map((group) => ({
      tournamentId,
      name: group.name,
      playerIds: group.playerIds,
      status: 'open',
    }))
  );

  const createdGamesByDivision = [];

  for (const division of insertedDivisions) {
    const divisionPlayerIds = (division.playerIds || []).map((playerId) => String(playerId));
    const createdGames = await createRoundRobinGamesForStage({
      tournamentId,
      divisionId: String(division._id),
      stage: 'groupStage',
      playerIds: divisionPlayerIds,
      bestOf: groupStageBestOf,
    });

    await recomputeLeaderboardForScope(tournamentId, division._id);

    createdGamesByDivision.push({
      divisionId: String(division._id),
      divisionName: division.name,
      gameCount: createdGames.length,
    });
  }

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        progressionState: 'groupStage',
        'competitionConfig.groupCount': groupCount,
        'competitionConfig.groupStageBestOf': groupStageBestOf,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    groupCount,
    groupStageBestOf,
    groups: insertedDivisions.map((division) => ({
      divisionId: String(division._id),
      name: division.name,
      playerCount: (division.playerIds || []).length,
      playerIds: (division.playerIds || []).map((value) => String(value)),
    })),
    gameSummary: createdGamesByDivision,
  };
};

const regenerateGroupStageFixtures = async (tournamentId, hostUserId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const divisions = await Division.find({ tournamentId, name: { $ne: 'Final Stage' } })
    .sort({ name: 1, _id: 1 })
    .lean();

  if (divisions.length === 0) {
    throw new ApiError(
      409,
      'GROUPS_NOT_CONFIGURED',
      'Groups must be configured before regenerating group-stage fixtures'
    );
  }

  const groupStageBestOf = parseBestOf(tournament.competitionConfig?.groupStageBestOf, 1);

  await Game.deleteMany({ tournamentId, stage: 'groupStage' });
  await Leaderboard.deleteMany({ tournamentId });

  const createdGamesByDivision = [];

  for (const division of divisions) {
    const divisionPlayerIds = (division.playerIds || []).map((playerId) => String(playerId));

    if (divisionPlayerIds.length < 2) {
      createdGamesByDivision.push({
        divisionId: String(division._id),
        divisionName: division.name,
        gameCount: 0,
      });
      continue;
    }

    const createdGames = await createRoundRobinGamesForStage({
      tournamentId,
      divisionId: String(division._id),
      stage: 'groupStage',
      playerIds: divisionPlayerIds,
      bestOf: groupStageBestOf,
    });

    await recomputeLeaderboardForScope(tournamentId, division._id);

    createdGamesByDivision.push({
      divisionId: String(division._id),
      divisionName: division.name,
      gameCount: createdGames.length,
    });
  }

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        progressionState: 'groupStage',
        'competitionConfig.groupStageBestOf': groupStageBestOf,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    groupStageBestOf,
    groups: divisions.map((division) => ({
      divisionId: String(division._id),
      name: division.name,
      playerCount: (division.playerIds || []).length,
      playerIds: (division.playerIds || []).map((value) => String(value)),
    })),
    gameSummary: createdGamesByDivision,
  };
};

module.exports = {
  createIncrementalGroupStageGamesForTeam,
  createIncrementalGroupStageGamesForPlayer,
  syncDoublesApprovedPlayerToGroupsByPlayerId,
  syncDoublesApprovedPlayerToGroups,
  syncSinglesApprovedPlayerToGroupsByPlayerId,
  syncApprovedPlayerToGroupsByPlayerId,
  syncApprovedPlayerToGroups,
  createRoundRobinTeamGamesForStage,
  createRoundRobinGamesForStage,
  assignRandomGroupsDoubles,
  assignRandomGroups,
  regenerateGroupStageFixtures,
};
