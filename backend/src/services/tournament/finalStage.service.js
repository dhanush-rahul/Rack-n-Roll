const Tournament = require('../../models/tournament.model');
const Division = require('../../models/division.model');
const Game = require('../../models/game.model');
const Player = require('../../models/player.model');
const Team = require('../../models/team.model');
const ApiError = require('../../utils/ApiError');
const { isDoublesTournament } = require('../team.service');
const { recomputeLeaderboardForScope, listTournamentLeaderboard } = require('./leaderboard.service');
const { createRoundRobinGamesForStage, createRoundRobinTeamGamesForStage } = require('./fixtures.service');
const { assertHostAccess, parseBestOf, parsePositiveInteger } = require('./shared');

const startFinalStageFromGroups = async (tournamentId, hostUserId, payload = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);

  const topPerGroup = Math.min(parsePositiveInteger(payload.topPerGroup, 2), 8);
  const finalStageBestOf = parseBestOf(payload.finalStageBestOf, 3);
  const isDoubles = isDoublesTournament(tournament);
  const finalStageProctored = isDoubles ? false : Boolean(payload.finalStageProctored);

  const divisions = await Division.find({ tournamentId }).sort({ name: 1, _id: 1 }).lean();

  if (divisions.length === 0) {
    throw new ApiError(409, 'GROUPS_NOT_CONFIGURED', 'Groups must be configured before starting finals');
  }

  if (isDoubles) {
    const finalistTeamIds = [];
    const selectedTeamIds = Array.isArray(payload.selectedTeamIds)
      ? [...new Set(payload.selectedTeamIds.map((value) => String(value)).filter(Boolean))]
      : [];

    if (selectedTeamIds.length > 0) {
      const selectedTeams = await Team.find({
        tournamentId,
        _id: { $in: selectedTeamIds },
        status: 'active',
      })
        .select({ _id: 1 })
        .lean();

      if (selectedTeams.length !== selectedTeamIds.length) {
        throw new ApiError(400, 'INVALID_FINALIST_SELECTION', 'One or more selected finalist teams are invalid');
      }

      finalistTeamIds.push(...selectedTeamIds);
    }

    if (selectedTeamIds.length === 0) {
      for (const division of divisions) {
        if (String(division.name || '') === 'Final Stage') continue;

        await recomputeLeaderboardForScope(tournamentId, division._id);
        const teamLeaderboard = await listTournamentLeaderboard(tournamentId, division._id, 'team');
        const topItems = (teamLeaderboard.items || []).slice(0, topPerGroup);

        if (topItems.length > 0) {
          finalistTeamIds.push(...topItems.map((entry) => String(entry.teamId)));
          continue;
        }

        finalistTeamIds.push(...(division.teamIds || []).slice(0, topPerGroup).map((value) => String(value)));
      }
    }

    const uniqueFinalistTeamIds = [...new Set(finalistTeamIds)];

    if (uniqueFinalistTeamIds.length < 2) {
      throw new ApiError(409, 'INSUFFICIENT_FINALISTS', 'Need at least 2 finalist teams to start final stage');
    }

    const finalistTeams = await Team.find({
      tournamentId,
      _id: { $in: uniqueFinalistTeamIds },
      status: 'active',
    }).lean();

    const uniqueFinalistPlayerIds = [
      ...new Set(finalistTeams.flatMap((team) => [String(team.player1Id), String(team.player2Id)])),
    ];

    let finalDivision = await Division.findOne({ tournamentId, name: 'Final Stage' }).lean();

    if (!finalDivision) {
      finalDivision = (
        await Division.create({
          tournamentId,
          name: 'Final Stage',
          playerIds: uniqueFinalistPlayerIds,
          teamIds: uniqueFinalistTeamIds,
          status: 'open',
        })
      ).toObject();
    } else {
      await Division.updateOne(
        { _id: finalDivision._id },
        {
          $set: {
            playerIds: uniqueFinalistPlayerIds,
            teamIds: uniqueFinalistTeamIds,
            status: 'open',
          },
        }
      );
    }

    await Game.deleteMany({ tournamentId, stage: 'finalStage' });

    const createdFinalGames = await createRoundRobinTeamGamesForStage({
      tournamentId,
      divisionId: String(finalDivision._id),
      stage: 'finalStage',
      teamIds: uniqueFinalistTeamIds,
      bestOf: finalStageBestOf,
    });

    await recomputeLeaderboardForScope(tournamentId, finalDivision._id);

    await Tournament.updateOne(
      { _id: tournamentId },
      {
        $set: {
          progressionState: 'finalStage',
          'competitionConfig.finalStageEnabled': true,
          'competitionConfig.finalStageBestOf': finalStageBestOf,
          'competitionConfig.finalStageTopPerGroup': topPerGroup,
          'competitionConfig.finalStageProctored': finalStageProctored,
        },
      }
    );

    return {
      tournamentId: String(tournamentId),
      finalDivisionId: String(finalDivision._id),
      format: 'doubles',
      finalistCount: uniqueFinalistTeamIds.length,
      finalistTeamIds: uniqueFinalistTeamIds,
      finalistPlayerIds: uniqueFinalistPlayerIds,
      finalStageBestOf,
      finalStageProctored,
      gameCount: createdFinalGames.length,
    };
  }

  const finalistPlayerIds = [];
  const selectedPlayerIds = Array.isArray(payload.selectedPlayerIds)
    ? [...new Set(payload.selectedPlayerIds.map((value) => String(value)).filter(Boolean))]
    : [];

  if (selectedPlayerIds.length > 0) {
    const selectedPlayers = await Player.find({
      tournamentId,
      _id: { $in: selectedPlayerIds },
      status: 'active',
    })
      .select({ _id: 1 })
      .lean();

    if (selectedPlayers.length !== selectedPlayerIds.length) {
      throw new ApiError(400, 'INVALID_FINALIST_SELECTION', 'One or more selected finalists are invalid');
    }
  }

  if (selectedPlayerIds.length > 0) {
    finalistPlayerIds.push(...selectedPlayerIds);
  }

  if (selectedPlayerIds.length === 0) {
    for (const division of divisions) {
      const leaderboard = await recomputeLeaderboardForScope(tournamentId, division._id);
      const topItems = (leaderboard.items || []).slice(0, topPerGroup);

      if (topItems.length > 0) {
        finalistPlayerIds.push(...topItems.map((entry) => entry.playerId));
        continue;
      }

      finalistPlayerIds.push(...(division.playerIds || []).slice(0, topPerGroup).map((value) => String(value)));
    }
  }

  const uniqueFinalistPlayerIds = [...new Set(finalistPlayerIds)];

  if (uniqueFinalistPlayerIds.length < 2) {
    throw new ApiError(409, 'INSUFFICIENT_FINALISTS', 'Need at least 2 finalists to start final stage');
  }

  let finalDivision = await Division.findOne({ tournamentId, name: 'Final Stage' }).lean();

  if (!finalDivision) {
    finalDivision = (
      await Division.create({
        tournamentId,
        name: 'Final Stage',
        playerIds: uniqueFinalistPlayerIds,
        status: 'open',
      })
    ).toObject();
  } else {
    await Division.updateOne(
      { _id: finalDivision._id },
      { $set: { playerIds: uniqueFinalistPlayerIds, status: 'open' } }
    );
  }

  await Game.deleteMany({ tournamentId, stage: 'finalStage' });

  const createdFinalGames = await createRoundRobinGamesForStage({
    tournamentId,
    divisionId: String(finalDivision._id),
    stage: 'finalStage',
    playerIds: uniqueFinalistPlayerIds,
    bestOf: finalStageBestOf,
  });

  await recomputeLeaderboardForScope(tournamentId, finalDivision._id);

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        progressionState: 'finalStage',
        'competitionConfig.finalStageEnabled': true,
        'competitionConfig.finalStageBestOf': finalStageBestOf,
        'competitionConfig.finalStageTopPerGroup': topPerGroup,
        'competitionConfig.finalStageProctored': finalStageProctored,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    finalDivisionId: String(finalDivision._id),
    finalistCount: uniqueFinalistPlayerIds.length,
    finalistPlayerIds: uniqueFinalistPlayerIds,
    finalStageBestOf,
    finalStageProctored,
    gameCount: createdFinalGames.length,
  };
};

const finalizeTournamentWithoutFinalStage = async (tournamentId, hostUserId, payload = {}) => {
  await assertHostAccess(tournamentId, hostUserId);

  const winnersPerGroup = Math.min(parsePositiveInteger(payload.winnersPerGroup, 3), 5);
  const divisions = await Division.find({ tournamentId, name: { $ne: 'Final Stage' } })
    .sort({ name: 1 })
    .lean();

  if (divisions.length === 0) {
    throw new ApiError(409, 'GROUPS_NOT_CONFIGURED', 'Groups must be configured before finalizing winners');
  }

  const winners = [];

  for (const division of divisions) {
    const leaderboard = await recomputeLeaderboardForScope(tournamentId, division._id);
    winners.push({
      divisionId: String(division._id),
      divisionName: division.name,
      winners: (leaderboard.items || []).slice(0, winnersPerGroup),
    });
  }

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        status: 'completed',
        progressionState: 'completed',
        'competitionConfig.finalStageEnabled': false,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    status: 'completed',
    progressionState: 'completed',
    winners,
  };
};

const finalizeTournamentWithFinalStage = async (tournamentId, hostUserId) => {
  await assertHostAccess(tournamentId, hostUserId);

  const finalDivision = await Division.findOne({ tournamentId, name: 'Final Stage' }).lean();

  if (!finalDivision) {
    throw new ApiError(409, 'FINALE_NOT_STARTED', 'Finale has not been started for this tournament');
  }

  const incompleteFinalGamesCount = await Game.countDocuments({
    tournamentId,
    stage: 'finalStage',
    status: { $ne: 'completed' },
  });

  if (incompleteFinalGamesCount > 0) {
    throw new ApiError(
      409,
      'FINALE_GAMES_INCOMPLETE',
      'Complete all finale games before ending the tournament'
    );
  }

  const finaleLeaderboard = await recomputeLeaderboardForScope(tournamentId, finalDivision._id);

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        status: 'completed',
        progressionState: 'completed',
        'competitionConfig.finalStageEnabled': true,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    status: 'completed',
    progressionState: 'completed',
    finalDivisionId: String(finalDivision._id),
    winners: finaleLeaderboard.items || [],
  };
};

module.exports = {
  startFinalStageFromGroups,
  finalizeTournamentWithoutFinalStage,
  finalizeTournamentWithFinalStage,
};
