const Tournament = require('../../models/tournament.model');
const Division = require('../../models/division.model');
const Game = require('../../models/game.model');
const Leaderboard = require('../../models/leaderboard.model');
const Team = require('../../models/team.model');
const Player = require('../../models/player.model');
const ApiError = require('../../utils/ApiError');
const { computePoolStats, getHandicapBonusPoints } = require('../../utils/handicapScoring');
const { isDoublesTournament, buildTeamSummaryById } = require('../team.service');
const {
  buildScopeFilter,
  normalizeDivisionScopeValue,
  computeSeriesOutcome,
  buildPlayerSummaryById,
  assertHostAccess,
  parsePositiveInteger,
} = require('./shared');

// ── Doubles leaderboard recompute ──────────────────────────────────────────

const recomputeDoublesLeaderboardForScope = async (tournamentId, divisionId, scopeFilter) => {
  const completedGames = await Game.find({
    ...scopeFilter,
    status: 'completed',
    teamAId: { $ne: null },
    teamBId: { $ne: null },
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const teams = await Team.find({
    tournamentId,
    status: 'active',
    ...(divisionId ? { divisionId: normalizeDivisionScopeValue(divisionId) } : {}),
  }).lean();

  const teamMembersByTeamId = new Map(
    teams.map((team) => [String(team._id), [String(team.player1Id), String(team.player2Id)]])
  );

  const statsByTeamId = new Map();
  const statsByPlayerId = new Map();

  const ensureTeamStats = (teamId) => {
    const normalizedTeamId = String(teamId);
    if (!statsByTeamId.has(normalizedTeamId)) {
      statsByTeamId.set(normalizedTeamId, {
        teamId: normalizedTeamId,
        points: 0, wins: 0, draws: 0, losses: 0,
        scoreFor: 0, scoreAgainst: 0, scoreDifferential: 0,
      });
    }
    return statsByTeamId.get(normalizedTeamId);
  };

  const ensurePlayerStats = (playerId) => {
    const normalizedPlayerId = String(playerId);
    if (!statsByPlayerId.has(normalizedPlayerId)) {
      statsByPlayerId.set(normalizedPlayerId, {
        playerId: normalizedPlayerId,
        points: 0, wins: 0, draws: 0, losses: 0,
        scoreFor: 0, scoreAgainst: 0, scoreDifferential: 0,
      });
    }
    return statsByPlayerId.get(normalizedPlayerId);
  };

  const applyOutcomeToMembers = (teamId, scoreFor, scoreAgainst, outcome) => {
    const members = teamMembersByTeamId.get(String(teamId)) || [];
    members.forEach((playerId) => {
      const playerStats = ensurePlayerStats(playerId);
      playerStats.scoreFor += scoreFor;
      playerStats.scoreAgainst += scoreAgainst;
      playerStats.scoreDifferential = playerStats.scoreFor - playerStats.scoreAgainst;
      if (outcome === 'win') {
        playerStats.wins += 1;
        playerStats.points += 2;
      } else if (outcome === 'loss') {
        playerStats.losses += 1;
      } else {
        playerStats.draws += 1;
        playerStats.points += 1;
      }
    });
  };

  completedGames.forEach((game) => {
    const scoreEntries = Array.isArray(game.scoreEntries) ? game.scoreEntries : [];
    if (scoreEntries.length === 0) return;

    const seriesOutcome = computeSeriesOutcome(game, scoreEntries);
    const teamAStats = ensureTeamStats(game.teamAId);
    const teamBStats = ensureTeamStats(game.teamBId);

    teamAStats.scoreFor += seriesOutcome.scoreForA;
    teamAStats.scoreAgainst += seriesOutcome.scoreForB;
    teamAStats.scoreDifferential = teamAStats.scoreFor - teamAStats.scoreAgainst;
    teamBStats.scoreFor += seriesOutcome.scoreForB;
    teamBStats.scoreAgainst += seriesOutcome.scoreForA;
    teamBStats.scoreDifferential = teamBStats.scoreFor - teamBStats.scoreAgainst;

    if (seriesOutcome.playerASeriesWins > seriesOutcome.playerBSeriesWins) {
      teamAStats.wins += 1;
      teamAStats.points += 2;
      teamBStats.losses += 1;
      applyOutcomeToMembers(game.teamAId, seriesOutcome.scoreForA, seriesOutcome.scoreForB, 'win');
      applyOutcomeToMembers(game.teamBId, seriesOutcome.scoreForB, seriesOutcome.scoreForA, 'loss');
      return;
    }

    if (seriesOutcome.playerBSeriesWins > seriesOutcome.playerASeriesWins) {
      teamBStats.wins += 1;
      teamBStats.points += 2;
      teamAStats.losses += 1;
      applyOutcomeToMembers(game.teamBId, seriesOutcome.scoreForB, seriesOutcome.scoreForA, 'win');
      applyOutcomeToMembers(game.teamAId, seriesOutcome.scoreForA, seriesOutcome.scoreForB, 'loss');
      return;
    }

    teamAStats.draws += 1;
    teamBStats.draws += 1;
    teamAStats.points += 1;
    teamBStats.points += 1;
    applyOutcomeToMembers(game.teamAId, seriesOutcome.scoreForA, seriesOutcome.scoreForB, 'draw');
    applyOutcomeToMembers(game.teamBId, seriesOutcome.scoreForB, seriesOutcome.scoreForA, 'draw');
  });

  const sortEntries = (entries) =>
    [...entries].sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points;
      if (right.scoreDifferential !== left.scoreDifferential) return right.scoreDifferential - left.scoreDifferential;
      if (right.scoreFor !== left.scoreFor) return right.scoreFor - left.scoreFor;
      if (right.wins !== left.wins) return right.wins - left.wins;
      return String(left.teamId || left.playerId).localeCompare(String(right.teamId || right.playerId));
    });

  const orderedTeams = sortEntries([...statsByTeamId.values()]);
  const orderedPlayers = sortEntries([...statsByPlayerId.values()]);

  await Leaderboard.deleteMany({
    ...scopeFilter,
    standingsType: { $in: ['team', 'player'] },
  });

  const leaderboardRows = [
    ...orderedTeams.map((entry, index) => ({
      tournamentId,
      divisionId: normalizeDivisionScopeValue(divisionId),
      standingsType: 'team',
      teamId: entry.teamId,
      rank: index + 1,
      points: entry.points,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
      scoreDifferential: entry.scoreDifferential,
    })),
    ...orderedPlayers.map((entry, index) => ({
      tournamentId,
      divisionId: normalizeDivisionScopeValue(divisionId),
      standingsType: 'player',
      playerId: entry.playerId,
      rank: index + 1,
      points: entry.points,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
      scoreDifferential: entry.scoreDifferential,
    })),
  ];

  if (leaderboardRows.length > 0) {
    try {
      await Leaderboard.insertMany(leaderboardRows);
    } catch (error) {
      if (error?.code === 11000) {
        throw new ApiError(
          409,
          'LEADERBOARD_INDEX_CONFLICT',
          'Leaderboard database indexes are out of date. Restart the backend or run: npm run fix:leaderboard-indexes'
        );
      }
      throw error;
    }
  }

  return {
    tournamentId: String(tournamentId),
    divisionId: normalizeDivisionScopeValue(divisionId),
    items: orderedPlayers.map((entry, index) => ({
      id: `player-${entry.playerId}`,
      playerId: entry.playerId,
      rank: index + 1,
      points: entry.points,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
      scoreDifferential: entry.scoreDifferential,
    })),
  };
};

// ── Singles leaderboard recompute ──────────────────────────────────────────

const recomputeLeaderboardForScope = async (tournamentId, divisionId) => {
  const scopeFilter = buildScopeFilter(tournamentId, divisionId);
  const tournament = await Tournament.findById(tournamentId)
    .select({ competitionConfig: 1 })
    .lean();

  if (isDoublesTournament(tournament)) {
    return recomputeDoublesLeaderboardForScope(tournamentId, divisionId, scopeFilter);
  }

  const handicapEnabled = Boolean(tournament?.competitionConfig?.handicapEnabled);
  const playerHandicapById = new Map();

  if (handicapEnabled) {
    const tournamentPlayers = await Player.find({ tournamentId })
      .select({ _id: 1, handicapEnabled: 1, handicapValue: 1 })
      .lean();

    tournamentPlayers.forEach((player) => {
      playerHandicapById.set(
        String(player._id),
        player.handicapEnabled ? Number(player.handicapValue || 0) : 0
      );
    });
  }

  const completedGames = await Game.find({ ...scopeFilter, status: 'completed' })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const statsByPlayerId = new Map();
  const headToHeadPoints = new Map();

  const getPairKey = (playerAId, playerBId) => {
    const left = String(playerAId);
    const right = String(playerBId);
    return left < right ? `${left}::${right}` : `${right}::${left}`;
  };

  const recordHeadToHeadPoints = (playerAId, playerBId, playerAPoints, playerBPoints) => {
    const pairKey = getPairKey(playerAId, playerBId);
    if (!headToHeadPoints.has(pairKey)) {
      headToHeadPoints.set(pairKey, new Map());
    }
    const pairMap = headToHeadPoints.get(pairKey);
    const normalizedPlayerAId = String(playerAId);
    const normalizedPlayerBId = String(playerBId);
    pairMap.set(normalizedPlayerAId, Number(pairMap.get(normalizedPlayerAId) || 0) + playerAPoints);
    pairMap.set(normalizedPlayerBId, Number(pairMap.get(normalizedPlayerBId) || 0) + playerBPoints);
  };

  const ensurePlayerStats = (playerId) => {
    const normalizedPlayerId = String(playerId);
    if (!statsByPlayerId.has(normalizedPlayerId)) {
      statsByPlayerId.set(normalizedPlayerId, {
        playerId: normalizedPlayerId,
        points: 0, wins: 0, draws: 0, losses: 0,
        scoreFor: 0, scoreAgainst: 0, scoreDifferential: 0,
      });
    }
    return statsByPlayerId.get(normalizedPlayerId);
  };

  completedGames.forEach((game) => {
    const scoreEntries = Array.isArray(game.scoreEntries) ? game.scoreEntries : [];
    if (scoreEntries.length === 0) return;

    const seriesOutcome = computeSeriesOutcome(game, scoreEntries);
    const playerAStats = ensurePlayerStats(game.playerAId);
    const playerBStats = ensurePlayerStats(game.playerBId);

    playerAStats.scoreFor += seriesOutcome.scoreForA;
    playerAStats.scoreAgainst += seriesOutcome.scoreForB;
    playerAStats.scoreDifferential = playerAStats.scoreFor - playerAStats.scoreAgainst;
    playerBStats.scoreFor += seriesOutcome.scoreForB;
    playerBStats.scoreAgainst += seriesOutcome.scoreForA;
    playerBStats.scoreDifferential = playerBStats.scoreFor - playerBStats.scoreAgainst;

    if (seriesOutcome.playerASeriesWins > seriesOutcome.playerBSeriesWins) {
      const handicapBonus = handicapEnabled
        ? getHandicapBonusPoints(
            playerHandicapById.get(String(game.playerAId)) || 0,
            playerHandicapById.get(String(game.playerBId)) || 0
          )
        : 0;
      playerAStats.wins += 1;
      playerAStats.points += 2 + handicapBonus;
      playerBStats.losses += 1;
      recordHeadToHeadPoints(game.playerAId, game.playerBId, 2 + handicapBonus, 0);
      return;
    }

    if (seriesOutcome.playerBSeriesWins > seriesOutcome.playerASeriesWins) {
      const handicapBonus = handicapEnabled
        ? getHandicapBonusPoints(
            playerHandicapById.get(String(game.playerBId)) || 0,
            playerHandicapById.get(String(game.playerAId)) || 0
          )
        : 0;
      playerBStats.wins += 1;
      playerBStats.points += 2 + handicapBonus;
      playerAStats.losses += 1;
      recordHeadToHeadPoints(game.playerAId, game.playerBId, 0, 2 + handicapBonus);
      return;
    }

    playerAStats.draws += 1;
    playerBStats.draws += 1;
    playerAStats.points += 1;
    playerBStats.points += 1;
    recordHeadToHeadPoints(game.playerAId, game.playerBId, 1, 1);
  });

  const compareHeadToHead = (left, right) => {
    const pairKey = getPairKey(left.playerId, right.playerId);
    const pairMap = headToHeadPoints.get(pairKey);
    if (!pairMap) return 0;
    const leftPoints = Number(pairMap.get(left.playerId) || 0);
    const rightPoints = Number(pairMap.get(right.playerId) || 0);
    if (leftPoints === rightPoints) return 0;
    return rightPoints - leftPoints;
  };

  const orderedEntries = [...statsByPlayerId.values()].sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    const headToHeadComparison = compareHeadToHead(left, right);
    if (headToHeadComparison !== 0) return headToHeadComparison;
    if (right.scoreDifferential !== left.scoreDifferential) return right.scoreDifferential - left.scoreDifferential;
    if (right.scoreFor !== left.scoreFor) return right.scoreFor - left.scoreFor;
    if (right.wins !== left.wins) return right.wins - left.wins;
    if (left.losses !== right.losses) return left.losses - right.losses;
    return left.playerId.localeCompare(right.playerId);
  });

  await Leaderboard.deleteMany({ ...scopeFilter, standingsType: 'player' });

  if (orderedEntries.length > 0) {
    await Leaderboard.insertMany(
      orderedEntries.map((entry, index) => ({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        standingsType: 'player',
        playerId: entry.playerId,
        rank: index + 1,
        points: entry.points,
        wins: entry.wins,
        draws: entry.draws,
        losses: entry.losses,
        scoreFor: entry.scoreFor,
        scoreAgainst: entry.scoreAgainst,
        scoreDifferential: entry.scoreDifferential,
      }))
    );
  }

  const refreshedEntries = await Leaderboard.find({ ...scopeFilter, standingsType: 'player' })
    .sort({ rank: 1, playerId: 1 })
    .lean();

  return {
    tournamentId: String(tournamentId),
    divisionId: normalizeDivisionScopeValue(divisionId),
    items: refreshedEntries.map((entry) => ({
      id: String(entry._id),
      playerId: String(entry.playerId),
      rank: entry.rank,
      points: entry.points,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
      scoreDifferential: entry.scoreDifferential,
    })),
  };
};

// ── Leaderboard read ───────────────────────────────────────────────────────

const listTournamentLeaderboard = async (tournamentId, divisionId, standingsType = 'player') => {
  const scopeFilter = {
    ...buildScopeFilter(tournamentId, divisionId),
    standingsType,
  };

  const entries = await Leaderboard.find(scopeFilter).sort({ rank: 1, playerId: 1, teamId: 1 }).lean();

  if (standingsType === 'team') {
    const teamSummaryById = await buildTeamSummaryById(entries.map((entry) => entry.teamId));
    return {
      tournamentId: String(tournamentId),
      divisionId: normalizeDivisionScopeValue(divisionId),
      standingsType,
      items: entries.map((entry) => ({
        id: String(entry._id),
        teamId: String(entry.teamId),
        team: teamSummaryById.get(String(entry.teamId)) || null,
        rank: entry.rank,
        points: entry.points,
        wins: entry.wins,
        draws: entry.draws,
        losses: entry.losses,
        scoreFor: entry.scoreFor,
        scoreAgainst: entry.scoreAgainst,
        scoreDifferential: entry.scoreDifferential,
      })),
    };
  }

  const playerSummaryById = await buildPlayerSummaryById(entries.map((entry) => entry.playerId));

  return {
    tournamentId: String(tournamentId),
    divisionId: normalizeDivisionScopeValue(divisionId),
    items: entries.map((entry) => ({
      id: String(entry._id),
      playerId: String(entry.playerId),
      player: playerSummaryById.get(String(entry.playerId)) || null,
      rank: entry.rank,
      points: entry.points,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
      scoreDifferential: entry.scoreDifferential,
    })),
  };
};

// ── Group standings ────────────────────────────────────────────────────────

const buildGroupStandingsList = async (tournamentId, query = {}) => {
  const defaultTopPerGroup = Math.min(parsePositiveInteger(query.topPerGroup, 2), 8);
  const tournament = await Tournament.findById(tournamentId)
    .select({ competitionConfig: 1, progressionState: 1 })
    .lean();
  const handicapEnabled = Boolean(tournament?.competitionConfig?.handicapEnabled);
  const format = tournament?.competitionConfig?.format || 'singles';
  const pairFormationMode = tournament?.competitionConfig?.pairFormationMode || 'playerPicksPartner';
  const divisions = await Division.find({ tournamentId, name: { $ne: 'Final Stage' } })
    .sort({ name: 1, _id: 1 })
    .lean();

  const groups = [];

  for (const division of divisions) {
    const standings = await listTournamentLeaderboard(tournamentId, division._id);
    const divisionPlayerIds = (division.playerIds || []).map((value) => String(value));
    const divisionPlayerSummaryById = await buildPlayerSummaryById(divisionPlayerIds);
    const rankedStandings = (standings.items || []).filter((entry) =>
      divisionPlayerIds.includes(String(entry.playerId))
    );
    const rankedPlayerIdSet = new Set(rankedStandings.map((entry) => String(entry.playerId)));
    const unrankedPlayerIds = divisionPlayerIds.filter((playerId) => !rankedPlayerIdSet.has(playerId));

    const enrichStandingEntry = (entry) => ({
      ...entry,
      player: divisionPlayerSummaryById.get(String(entry.playerId)) || entry.player || null,
      stats: computePoolStats(entry),
    });

    const mergedStandings = [
      ...rankedStandings.map(enrichStandingEntry),
      ...unrankedPlayerIds.map((playerId, index) =>
        enrichStandingEntry({
          id: `group-${String(division._id)}-${playerId}`,
          playerId,
          player: divisionPlayerSummaryById.get(playerId) || null,
          rank: Number(rankedStandings.length + index + 1),
          points: 0, wins: 0, draws: 0, losses: 0,
          scoreFor: 0, scoreAgainst: 0, scoreDifferential: 0,
        })
      ),
    ];

    let teamStandings = [];

    if (format === 'doubles') {
      const teamLeaderboard = await listTournamentLeaderboard(tournamentId, division._id, 'team');
      const divisionTeamIds = (division.teamIds || []).map((value) => String(value));
      const teamSummaryById = await buildTeamSummaryById(divisionTeamIds);
      const rankedTeamStandings = (teamLeaderboard.items || []).filter((entry) =>
        divisionTeamIds.includes(String(entry.teamId))
      );
      const rankedTeamIdSet = new Set(rankedTeamStandings.map((entry) => String(entry.teamId)));
      const unrankedTeamIds = divisionTeamIds.filter((teamId) => !rankedTeamIdSet.has(teamId));

      const enrichTeamStandingEntry = (entry) => ({
        ...entry,
        team: teamSummaryById.get(String(entry.teamId)) || entry.team || null,
        stats: computePoolStats(entry),
      });

      teamStandings = [
        ...rankedTeamStandings.map(enrichTeamStandingEntry),
        ...unrankedTeamIds.map((teamId, index) =>
          enrichTeamStandingEntry({
            id: `group-${String(division._id)}-team-${teamId}`,
            teamId,
            team: teamSummaryById.get(teamId) || null,
            rank: Number(rankedTeamStandings.length + index + 1),
            points: 0, wins: 0, draws: 0, losses: 0,
            scoreFor: 0, scoreAgainst: 0, scoreDifferential: 0,
          })
        ),
      ];
    }

    groups.push({
      divisionId: String(division._id),
      divisionName: division.name,
      suggestedFinalists:
        format === 'doubles'
          ? teamStandings.slice(0, defaultTopPerGroup).map((entry) => entry.teamId)
          : mergedStandings.slice(0, defaultTopPerGroup).map((entry) => entry.playerId),
      standings: mergedStandings,
      ...(format === 'doubles' ? { teamStandings, playerStandings: mergedStandings } : {}),
    });
  }

  const finalStageEnabled = Boolean(tournament?.competitionConfig?.finalStageEnabled);
  const completedWithFinale =
    tournament?.progressionState === 'completed' && finalStageEnabled;
  let finaleStandings = [];

  if (finalStageEnabled) {
    const finalDivision = await Division.findOne({ tournamentId, name: 'Final Stage' }).lean();

    if (finalDivision) {
      if (format === 'doubles') {
        const divisionTeamIds = (finalDivision.teamIds || []).map((value) => String(value));
        const finaleLeaderboard = await listTournamentLeaderboard(tournamentId, finalDivision._id, 'team');
        const teamSummaryById = await buildTeamSummaryById(divisionTeamIds);
        const rankedStandings = (finaleLeaderboard.items || []).filter((entry) =>
          divisionTeamIds.includes(String(entry.teamId))
        );
        const rankedTeamIdSet = new Set(rankedStandings.map((entry) => String(entry.teamId)));
        const unrankedTeamIds = divisionTeamIds.filter((teamId) => !rankedTeamIdSet.has(teamId));

        const enrichFinaleTeamStandingEntry = (entry) => ({
          ...entry,
          team: teamSummaryById.get(String(entry.teamId)) || entry.team || null,
          stats: computePoolStats(entry),
        });

        finaleStandings = [
          ...rankedStandings.map(enrichFinaleTeamStandingEntry),
          ...unrankedTeamIds.map((teamId, index) =>
            enrichFinaleTeamStandingEntry({
              id: `final-${String(finalDivision._id)}-team-${teamId}`,
              teamId,
              team: teamSummaryById.get(teamId) || null,
              rank: Number(rankedStandings.length + index + 1),
              points: 0, wins: 0, draws: 0, losses: 0,
              scoreFor: 0, scoreAgainst: 0, scoreDifferential: 0,
            })
          ),
        ];
      } else {
        const divisionPlayerIds = (finalDivision.playerIds || []).map((value) => String(value));
        const finaleLeaderboard = await listTournamentLeaderboard(tournamentId, finalDivision._id, 'player');
        const playerSummaryById = await buildPlayerSummaryById(divisionPlayerIds);
        const rankedStandings = (finaleLeaderboard.items || []).filter((entry) =>
          divisionPlayerIds.includes(String(entry.playerId))
        );
        const rankedPlayerIdSet = new Set(rankedStandings.map((entry) => String(entry.playerId)));
        const unrankedPlayerIds = divisionPlayerIds.filter((playerId) => !rankedPlayerIdSet.has(playerId));

        const enrichFinaleStandingEntry = (entry) => ({
          ...entry,
          player: playerSummaryById.get(String(entry.playerId)) || entry.player || null,
          stats: computePoolStats(entry),
        });

        finaleStandings = [
          ...rankedStandings.map(enrichFinaleStandingEntry),
          ...unrankedPlayerIds.map((playerId, index) =>
            enrichFinaleStandingEntry({
              id: `final-${String(finalDivision._id)}-${playerId}`,
              playerId,
              rank: Number(rankedStandings.length + index + 1),
              points: 0, wins: 0, draws: 0, losses: 0,
              scoreFor: 0, scoreAgainst: 0, scoreDifferential: 0,
            })
          ),
        ];
      }
    }
  }

  const tournamentWinners = completedWithFinale ? finaleStandings.slice(0, 3) : [];

  return {
    tournamentId: String(tournamentId),
    topPerGroup: defaultTopPerGroup,
    handicapEnabled,
    format,
    pairFormationMode,
    progressionState: tournament?.progressionState || 'registration',
    finalStageEnabled,
    completedWithFinale,
    finaleStandings,
    tournamentWinners,
    groups,
  };
};

const listGroupStandings = async (tournamentId, userId, query = {}) => {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  return buildGroupStandingsList(tournamentId, query);
};

const listGroupStandingsForHost = async (tournamentId, hostUserId, query = {}) => {
  await assertHostAccess(tournamentId, hostUserId);
  return buildGroupStandingsList(tournamentId, query);
};

module.exports = {
  recomputeDoublesLeaderboardForScope,
  recomputeLeaderboardForScope,
  listTournamentLeaderboard,
  buildGroupStandingsList,
  listGroupStandings,
  listGroupStandingsForHost,
};
