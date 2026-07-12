const crypto = require('crypto');
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
const {
  GROUP_STAGE_ID,
  getStageById,
  getOrderedStages,
  getStageInputCount,
  validateProgressionPlan,
  normalizeProgressionPlanInput,
  buildStageGameFilter,
  getKnockoutAdvanceCount,
} = require('./progressionPlan.utils');
const {
  createKnockoutSingleRoundGames,
  isKnockoutStageComplete,
  resolveWinnerId,
} = require('./knockoutFixtures.service');
const {
  splitGroupAdvancement,
  mergeBypassParticipants,
} = require('./groupAdvancement.service');

const hasStartedPostGroupStage = (tournament) => {
  const stages = getOrderedStages(tournament);
  return stages.some((stage) => stage.status === 'active' || stage.status === 'completed');
};

const assertPlanEditable = (tournament) => {
  const state = tournament.progressionState || 'registration';
  if (['registration', 'groupSetup'].includes(state)) {
    return;
  }
  if (state === 'groupStage' && !hasStartedPostGroupStage(tournament)) {
    return;
  }
  throw new ApiError(409, 'PROGRESSION_PLAN_LOCKED', 'Progression plan cannot be edited after a post-group stage has started');
};

const assertCanAppendProgressionStage = (tournament) => {
  const state = tournament.progressionState || 'registration';
  const stages = getOrderedStages(tournament);

  if (['registration', 'groupSetup'].includes(state)) {
    return;
  }

  if (state === 'groupStage' && !hasStartedPostGroupStage(tournament)) {
    return;
  }

  const pendingStages = stages.filter((stage) => stage.status === 'pending');
  if (pendingStages.length > 0) {
    throw new ApiError(
      409,
      'PENDING_STAGE_EXISTS',
      'A pending stage already exists. Start or cancel it before adding another.'
    );
  }

  const hasProgressedStage = stages.some(
    (stage) => stage.status === 'active' || stage.status === 'completed'
  );
  if (!hasProgressedStage) {
    throw new ApiError(
      409,
      'PROGRESSION_PLAN_LOCKED',
      'Progression plan cannot be edited until a stage has been started from groups.'
    );
  }
};

const assertCanAbandonPendingStage = (tournament) => {
  const state = tournament.progressionState || 'registration';
  if (['registration', 'groupSetup'].includes(state)) {
    return;
  }
  if (state === 'groupStage' && !hasStartedPostGroupStage(tournament)) {
    return;
  }
};

const collectKnockoutParticipantsFromGames = (games = [], isDoubles = false) => {
  const participantIds = new Set();
  const roundOneGames = games.filter((game) => Number(game.bracketRound || game.roundNumber || 1) === 1);
  const sourceGames = roundOneGames.length > 0 ? roundOneGames : games;

  sourceGames.forEach((game) => {
    const slotA = isDoubles ? game.teamAId : game.playerAId;
    const slotB = isDoubles ? game.teamBId : game.playerBId;
    if (slotA) participantIds.add(String(slotA));
    if (slotB) participantIds.add(String(slotB));
  });

  return [...participantIds];
};

const updateProgressionPlan = async (tournamentId, hostUserId, planInput = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  assertPlanEditable(tournament);

  const normalizedPlan = normalizeProgressionPlanInput(planInput);
  const validation = validateProgressionPlan(normalizedPlan, {
    groupCount: tournament.competitionConfig?.groupCount || planInput?.plannedGroupCount,
  });

  if (!validation.valid) {
    throw new ApiError(400, 'INVALID_PROGRESSION_PLAN', validation.errors.join(' '));
  }

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        progressionPlan: normalizedPlan,
        ...(planInput?.plannedGroupCount
          ? { 'competitionConfig.groupCount': parsePositiveInteger(planInput.plannedGroupCount, null) }
          : {}),
      },
    }
  );

  return { tournamentId: String(tournamentId), progressionPlan: normalizedPlan };
};

const resolveSourceStageAdvanceCount = async (tournamentId, tournament, sourceStage) => {
  if (!sourceStage) {
    return 2;
  }

  const isDoubles = isDoublesTournament(tournament);

  if (sourceStage.format === 'knockout') {
    const configuredAdvance = Number(sourceStage.advancement?.advanceCount || 0);
    if (configuredAdvance > 0) {
      return configuredAdvance;
    }

    const games = await Game.find(buildStageGameFilter(tournamentId, sourceStage.stageId)).lean();
    const roundOneGames = games.filter((game) => Number(game.bracketRound || game.roundNumber || 1) === 1);
    const sourceGames = roundOneGames.length > 0 ? roundOneGames : games;
    const participantIds = collectKnockoutParticipantsFromGames(sourceGames, isDoubles);

    return Math.max(getKnockoutAdvanceCount(participantIds.length), 1);
  }

  return Math.max(Number(sourceStage.advancement?.advanceCount || 2), 2);
};

const patchStagesBeforeAppend = async (
  tournamentId,
  tournament,
  existingStages = [],
  { sourceAdvanceCount = null } = {}
) => {
  if (!existingStages.length) {
    return existingStages;
  }

  const stages = [...existingStages];
  const sourceIndex = stages.length - 1;
  const sourceStage = stages[sourceIndex];
  const configuredAdvanceCount = Number(sourceAdvanceCount);
  const nextAdvanceCount =
    Number.isFinite(configuredAdvanceCount) && configuredAdvanceCount > 0
      ? configuredAdvanceCount
      : await resolveSourceStageAdvanceCount(tournamentId, tournament, sourceStage);
  const currentAdvance = Number(sourceStage.advancement?.advanceCount || 0);

  if (currentAdvance !== nextAdvanceCount) {
    stages[sourceIndex] = {
      ...sourceStage,
      advancement: {
        ...sourceStage.advancement,
        advanceCount: nextAdvanceCount,
      },
    };
  }

  return stages;
};

const appendProgressionStage = async (tournamentId, hostUserId, stageInput = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  assertCanAppendProgressionStage(tournament);

  const { sourceAdvanceCount, ...nextStageInput } = stageInput;

  const existingStages = await patchStagesBeforeAppend(
    tournamentId,
    tournament,
    getOrderedStages(tournament),
    { sourceAdvanceCount }
  );
  const normalizedStage = normalizeProgressionPlanInput({
    deferred: Boolean(tournament.progressionPlan?.deferred),
    stages: [
      ...existingStages,
      {
        ...nextStageInput,
        order: existingStages.length + 1,
        status: 'pending',
      },
    ],
  }).stages.slice(-1)[0];

  const mergedPlan = normalizeProgressionPlanInput({
    deferred: false,
    stages: [...existingStages, normalizedStage],
  });

  const validation = validateProgressionPlan(mergedPlan, {
    groupCount: tournament.competitionConfig?.groupCount,
  });

  if (!validation.valid) {
    throw new ApiError(400, 'INVALID_PROGRESSION_PLAN', validation.errors.join(' '));
  }

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        progressionPlan: mergedPlan,
        'competitionConfig.finalStageEnabled': mergedPlan.stages.length > 0,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    progressionPlan: mergedPlan,
    stage: normalizedStage,
  };
};

const abandonPendingProgressionStage = async (tournamentId, hostUserId, stageId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  assertCanAbandonPendingStage(tournament);

  const stage = getStageById(tournament, stageId);
  if (!stage) {
    throw new ApiError(404, 'STAGE_NOT_FOUND', 'Progression stage not found');
  }

  if (stage.status !== 'pending') {
    throw new ApiError(409, 'STAGE_NOT_ABANDONABLE', 'Only pending stages can be abandoned');
  }

  const gameCount = await Game.countDocuments(buildStageGameFilter(tournamentId, stageId));
  if (gameCount > 0) {
    throw new ApiError(409, 'STAGE_HAS_GAMES', 'Cannot abandon a stage that already has games');
  }

  const remainingStages = getOrderedStages(tournament).filter(
    (entry) => String(entry.stageId) !== String(stageId)
  );
  const mergedPlan = normalizeProgressionPlanInput({
    deferred: remainingStages.length === 0,
    stages: remainingStages,
  });

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        progressionPlan: mergedPlan,
        'competitionConfig.finalStageEnabled': remainingStages.some(
          (entry) => entry.status === 'active' || entry.status === 'completed'
        ),
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    progressionPlan: mergedPlan,
  };
};

const getGroupAdvancementPreview = async (tournamentId, hostUserId, stageDraft = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const isDoubles = isDoublesTournament(tournament);
  const groupCount = Number(tournament.competitionConfig?.groupCount || 0);
  const normalizedStage = normalizeProgressionPlanInput({
    stages: [{ ...stageDraft, order: 1 }],
  }).stages[0];

  const split = await splitGroupAdvancement(tournament, normalizedStage, isDoubles, []);

  const topPerGroup = Math.max(Number(normalizedStage.advancement?.topPerGroup || 0), 0);
  const directPromotePerGroup = Math.max(Number(normalizedStage.advancement?.directPromotePerGroup || 0), 0);
  const playingPerGroup = Math.max(topPerGroup - directPromotePerGroup, 0);
  const effectiveGroupCount = Math.max(groupCount, split.rankedByGroup.length);
  const configuredPlayingCount = effectiveGroupCount * playingPerGroup;
  const configuredBypassCount = effectiveGroupCount * directPromotePerGroup;
  const actualPlayingCount = split.pools.reduce(
    (total, pool) => total + (pool.participantIds?.length || 0),
    0
  );

  return {
    groupCount: effectiveGroupCount,
    isEvenGroupCount: effectiveGroupCount % 2 === 0,
    poolMode: split.poolMode,
    topPerGroup,
    directPromotePerGroup,
    playingPerGroup,
    configuredPlayingCount,
    configuredBypassCount,
    actualPlayingCount,
    actualBypassCount: split.bypassIds.length,
    bypassCount: configuredBypassCount,
    bypassTargetStageName: split.bypassTargetStageName,
    pools: split.pools.map((pool) => ({
      key: pool.key,
      label: pool.label,
      participantCount: pool.participantIds.length,
      participantIds: pool.participantIds,
    })),
    groups: split.rankedByGroup.map((group) => ({
      divisionName: group.divisionName,
      configuredAdvanceCount: playingPerGroup,
      configuredBypassCount: directPromotePerGroup,
      readyAdvanceCount: group.playingIds.length,
      standingsReadyCount: group.standingsReadyCount,
      readyBypassCount: group.bypassIds.length,
      rosterCount: group.rosterCount || 0,
    })),
  };
};

const collectGroupFinalists = async (tournament, stage, isDoubles, selectedIds = []) => {
  const divisions = await Division.find({ tournamentId: tournament._id, stageId: null })
    .sort({ name: 1, _id: 1 })
    .lean();

  const groupDivisions = divisions.filter((division) => String(division.name || '') !== 'Final Stage' && !division.stageId);
  const topPerGroup = parsePositiveInteger(stage.advancement?.topPerGroup, 2);

  if (isDoubles) {
    if (selectedIds.length > 0) {
      return [...new Set(selectedIds.map(String))];
    }

    const finalistTeamIds = [];
    for (const division of groupDivisions) {
      await recomputeLeaderboardForScope(tournament._id, division._id);
      const teamLeaderboard = await listTournamentLeaderboard(tournament._id, division._id, 'team');
      const topItems = (teamLeaderboard.items || []).slice(0, topPerGroup);
      if (topItems.length > 0) {
        finalistTeamIds.push(...topItems.map((entry) => String(entry.teamId)));
      } else {
        finalistTeamIds.push(...(division.teamIds || []).slice(0, topPerGroup).map(String));
      }
    }
    return [...new Set(finalistTeamIds)];
  }

  if (selectedIds.length > 0) {
    return [...new Set(selectedIds.map(String))];
  }

  const finalistPlayerIds = [];
  for (const division of groupDivisions) {
    const leaderboard = await recomputeLeaderboardForScope(tournament._id, division._id);
    const topItems = (leaderboard.items || []).slice(0, topPerGroup);
    if (topItems.length > 0) {
      finalistPlayerIds.push(...topItems.map((entry) => String(entry.playerId)));
    } else {
      finalistPlayerIds.push(...(division.playerIds || []).slice(0, topPerGroup).map(String));
    }
  }
  return [...new Set(finalistPlayerIds)];
};

const collectPreviousStageFinalists = async (tournament, stage, isDoubles, selectedIds = []) => {
  const sourceStageId = stage.advancement?.sourceStageId;
  if (!sourceStageId) {
    throw new ApiError(409, 'INVALID_STAGE_SOURCE', 'Previous stage is not configured');
  }

  if (selectedIds.length > 0) {
    return [...new Set(selectedIds.map(String))];
  }

  const sourceStage = getStageById(tournament, sourceStageId);
  if (!sourceStage) {
    throw new ApiError(404, 'STAGE_NOT_FOUND', 'Source stage not found');
  }

  const advanceCount = parsePositiveInteger(stage.advancement?.advanceCount, 2);

  if (sourceStage.format === 'knockout') {
    const completedGames = await Game.find({
      ...buildStageGameFilter(tournament._id, sourceStageId),
      status: 'completed',
    })
      .sort({ bracketRound: 1, bracketPosition: 1, roundNumber: 1 })
      .lean();

    const winners = completedGames
      .map((game) => resolveWinnerId(game, isDoubles))
      .filter(Boolean)
      .map(String);

    const inputCount = getStageInputCount(tournament, stage);
    const limit = inputCount > 0 ? inputCount : winners.length;

    return winners.slice(0, limit);
  }

  const division = await Division.findOne({ tournamentId: tournament._id, stageId: sourceStageId }).lean();
  if (!division) {
    throw new ApiError(409, 'STAGE_DIVISION_MISSING', 'Source stage division not found');
  }

  const leaderboard = await recomputeLeaderboardForScope(tournament._id, division._id, isDoubles ? 'team' : 'player');
  const items = leaderboard.items || [];

  if (isDoubles) {
    return items.slice(0, advanceCount).map((entry) => String(entry.teamId));
  }
  return items.slice(0, advanceCount).map((entry) => String(entry.playerId));
};

const getStageCandidates = async (tournamentId, hostUserId, stageId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const stage = getStageById(tournament, stageId);
  if (!stage) {
    throw new ApiError(404, 'STAGE_NOT_FOUND', 'Progression stage not found');
  }

  const isDoubles = isDoublesTournament(tournament);
  const expectedCount = getStageInputCount(tournament, stage);

  let suggestedIds = [];
  if (stage.advancement?.source === 'groups') {
    suggestedIds = await collectGroupFinalists(tournament, stage, isDoubles, []);
  } else {
    suggestedIds = await collectPreviousStageFinalists(tournament, stage, isDoubles, []);
  }

  suggestedIds = mergeBypassParticipants(tournament, stage.name, suggestedIds);

  return {
    stageId: String(stageId),
    stageName: stage.name,
    format: stage.format,
    expectedCount,
    suggestedIds,
    selectionMode: stage.advancement?.selectionMode || 'autoStandings',
  };
};

const markStageActive = async (tournamentId, stageId) => {
  const tournament = await Tournament.findById(tournamentId).lean();
  const orderedStages = getOrderedStages(tournament);
  const activeIndex = orderedStages.findIndex((stage) => String(stage.stageId) === String(stageId));

  const stages = orderedStages.map((stage, index) => ({
    ...stage,
    status:
      String(stage.stageId) === String(stageId)
        ? 'active'
        : index < activeIndex
          ? 'completed'
          : stage.status === 'completed'
            ? 'completed'
            : 'pending',
  }));

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        progressionState: 'stageActive',
        activeStageId: String(stageId),
        progressionPlan: { deferred: Boolean(tournament.progressionPlan?.deferred), stages },
        'competitionConfig.finalStageEnabled': stages.length > 0,
      },
    }
  );
};

const startProgressionStage = async (tournamentId, hostUserId, stageId, payload = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const stage = getStageById(tournament, stageId);

  if (!stage) {
    throw new ApiError(404, 'STAGE_NOT_FOUND', 'Progression stage not found');
  }

  const isDoubles = isDoublesTournament(tournament);
  const stageFormat = payload.format === 'roundRobin' ? 'roundRobin' : stage.format;
  const bestOf = parseBestOf(payload.bestOf || stage.bestOf, 3);
  const expectedCount = getStageInputCount(tournament, stage);

  const selectedPlayerIds = Array.isArray(payload.selectedPlayerIds)
    ? payload.selectedPlayerIds.map(String).filter(Boolean)
    : [];
  const selectedTeamIds = Array.isArray(payload.selectedTeamIds)
    ? payload.selectedTeamIds.map(String).filter(Boolean)
    : [];

  const promoteBypassParticipantId = String(
    payload.promoteBypassParticipantId || payload.promoteBypass?.participantId || ''
  ).trim();
  const promoteBypassTargetStageName = String(
    payload.promoteBypassTargetStageName || payload.promoteBypass?.targetStageName || ''
  ).trim();

  let participantIds = [];
  let split = null;
  const manualSelection = isDoubles ? selectedTeamIds : selectedPlayerIds;

  if (stage.advancement?.source === 'groups') {
    const manualSelection = isDoubles ? selectedTeamIds : selectedPlayerIds;
    split = await splitGroupAdvancement(tournament, stage, isDoubles, manualSelection);
    participantIds = split.pools.flatMap((pool) => pool.participantIds);

    if (split.bypassIds.length > 0 && split.bypassTargetStageName) {
      const existingBypass = Array.isArray(tournament.progressionBypass) ? tournament.progressionBypass : [];
      const nextBypass = existingBypass.filter(
        (entry) =>
          String(entry.targetStageName || '').trim().toLowerCase() !==
          split.bypassTargetStageName.toLowerCase()
      );
      nextBypass.push({
        targetStageName: split.bypassTargetStageName,
        participantIds: split.bypassIds,
        sourceStageId: String(stageId),
      });
      await Tournament.updateOne({ _id: tournamentId }, { $set: { progressionBypass: nextBypass } });
    }
  } else {
    participantIds = await collectPreviousStageFinalists(
      tournament,
      stage,
      isDoubles,
      manualSelection
    );
    participantIds = mergeBypassParticipants(tournament, stage.name, participantIds);

    if (promoteBypassParticipantId && promoteBypassTargetStageName) {
      participantIds = participantIds.filter((id) => String(id) !== promoteBypassParticipantId);
      const existingBypass = Array.isArray(tournament.progressionBypass) ? tournament.progressionBypass : [];
      const nextBypass = existingBypass.filter(
        (entry) =>
          String(entry.targetStageName || '').trim().toLowerCase() !==
          promoteBypassTargetStageName.toLowerCase()
      );
      nextBypass.push({
        targetStageName: promoteBypassTargetStageName,
        participantIds: [promoteBypassParticipantId],
        sourceStageId: String(stageId),
      });
      await Tournament.updateOne({ _id: tournamentId }, { $set: { progressionBypass: nextBypass } });
    }
  }

  const effectiveExpectedCount =
    manualSelection?.length > 0 ? manualSelection.length : expectedCount;

  if (participantIds.length < 2 && (!split || split.pools.length === 0)) {
    throw new ApiError(409, 'INSUFFICIENT_PARTICIPANTS', 'Need at least 2 participants to start this stage');
  }

  if (
    stage.advancement?.source !== 'groups' &&
    effectiveExpectedCount > 0 &&
    participantIds.length !== effectiveExpectedCount &&
    manualSelection.length === 0
  ) {
    const sourceStage = stage.advancement?.sourceStageId
      ? getStageById(tournament, stage.advancement.sourceStageId)
      : null;
    const allowKnockoutWinnerCount =
      sourceStage?.format === 'knockout' &&
      participantIds.length >= 2 &&
      participantIds.length <= Math.max(expectedCount, participantIds.length);

    if (!allowKnockoutWinnerCount) {
      throw new ApiError(
        400,
        'INVALID_PARTICIPANT_COUNT',
        `This stage requires exactly ${effectiveExpectedCount} participants`
      );
    }
  }

  await Game.deleteMany(buildStageGameFilter(tournamentId, stageId));

  let gameCount = 0;
  let divisionId = null;

  if (stageFormat === 'knockout') {
    const pools =
      split?.pools?.length > 0
        ? split.pools
        : [{ key: 'combined', participantIds }];

    for (const pool of pools) {
      if ((pool.participantIds || []).length < 2) {
        continue;
      }
      const created = await createKnockoutSingleRoundGames({
        tournamentId,
        stageId,
        participantIds: pool.participantIds,
        bestOf,
        isDoubles,
        bracketGroupKey: pool.key,
      });
      gameCount += created.length;
    }
  } else {
    const playingIds =
      split?.pools?.length === 1 && split.pools[0]?.participantIds?.length
        ? split.pools[0].participantIds
        : participantIds;

    if (playingIds.length < 2) {
      throw new ApiError(409, 'INSUFFICIENT_PARTICIPANTS', 'Need at least 2 participants to start this stage');
    }

    const divisionName = stage.name || 'Stage';
    let division = await Division.findOne({ tournamentId, stageId: String(stageId) }).lean();

    if (!division) {
      division = (
        await Division.create({
          tournamentId,
          name: divisionName,
          stageId: String(stageId),
          playerIds: isDoubles ? [] : playingIds,
          teamIds: isDoubles ? playingIds : [],
          status: 'open',
        })
      ).toObject();
    } else {
      await Division.updateOne(
        { _id: division._id },
        {
          $set: {
            name: divisionName,
            playerIds: isDoubles ? [] : playingIds,
            teamIds: isDoubles ? playingIds : [],
            status: 'open',
          },
        }
      );
    }

    divisionId = String(division._id);

    const createdGames = isDoubles
      ? await createRoundRobinTeamGamesForStage({
          tournamentId,
          divisionId,
          stageId: String(stageId),
          teamIds: playingIds,
          bestOf,
        })
      : await createRoundRobinGamesForStage({
          tournamentId,
          divisionId,
          stageId: String(stageId),
          playerIds: playingIds,
          bestOf,
        });

    gameCount = createdGames.length;
    await recomputeLeaderboardForScope(tournamentId, division._id);
  }

  if (gameCount === 0) {
    throw new ApiError(409, 'INSUFFICIENT_PARTICIPANTS', 'Need at least 2 participants to start this stage');
  }

  await markStageActive(tournamentId, stageId);

  return {
    tournamentId: String(tournamentId),
    stageId: String(stageId),
    stageName: stage.name,
    format: stage.format,
    participantCount: participantIds.length,
    gameCount,
    divisionId,
    bypassCount: split?.bypassIds?.length || 0,
    pools: split?.pools?.map((pool) => ({ key: pool.key, label: pool.label, count: pool.participantIds.length })) || [],
  };
};

const isLegacyKnockoutBracket = (games = []) => {
  if (!games.length) {
    return false;
  }

  const maxRound = games.reduce(
    (max, game) => Math.max(max, Number(game.bracketRound || game.roundNumber || 1)),
    1
  );

  return maxRound > 1 || games.some((game) => game.nextWinnerGameId);
};

const regenerateProgressionStageFixtures = async (tournamentId, hostUserId, stageId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const stage = getStageById(tournament, stageId);

  if (!stage) {
    throw new ApiError(404, 'STAGE_NOT_FOUND', 'Progression stage not found');
  }

  if (stage.format !== 'knockout') {
    throw new ApiError(409, 'INVALID_STAGE_FORMAT', 'Only knockout stages can be compacted to a single round');
  }

  if (stage.status === 'pending') {
    throw new ApiError(409, 'STAGE_NOT_STARTED', 'Start the stage before regenerating fixtures');
  }

  const existingGames = await Game.find(buildStageGameFilter(tournamentId, stageId)).lean();
  if (!existingGames.length) {
    throw new ApiError(409, 'STAGE_GAMES_MISSING', 'No stage matches found to regenerate');
  }

  if (!isLegacyKnockoutBracket(existingGames)) {
    return {
      tournamentId: String(tournamentId),
      stageId: String(stageId),
      regenerated: false,
      gameCount: existingGames.length,
      participantCount: collectKnockoutParticipantsFromGames(existingGames, isDoublesTournament(tournament)).length,
    };
  }

  const isDoubles = isDoublesTournament(tournament);
  const participantIds = collectKnockoutParticipantsFromGames(existingGames, isDoubles);

  if (participantIds.length < 2) {
    throw new ApiError(409, 'INSUFFICIENT_PARTICIPANTS', 'Need at least 2 participants to regenerate fixtures');
  }

  const bestOf = parseBestOf(stage.bestOf, 3);
  const bracketGroups = [...new Set(existingGames.map((game) => game.bracketGroupKey || 'combined'))];

  await Game.deleteMany(buildStageGameFilter(tournamentId, stageId));

  let gameCount = 0;
  for (const bracketGroupKey of bracketGroups) {
    const groupGames = existingGames.filter(
      (game) => (game.bracketGroupKey || 'combined') === bracketGroupKey
    );
    const groupParticipantIds = collectKnockoutParticipantsFromGames(groupGames, isDoubles);

    if (groupParticipantIds.length < 2) {
      continue;
    }

    const created = await createKnockoutSingleRoundGames({
      tournamentId,
      stageId,
      participantIds: groupParticipantIds,
      bestOf,
      isDoubles,
      bracketGroupKey: bracketGroupKey === 'combined' ? null : bracketGroupKey,
    });
    gameCount += created.length;
  }

  if (gameCount === 0) {
    throw new ApiError(409, 'INSUFFICIENT_PARTICIPANTS', 'Need at least 2 participants to regenerate fixtures');
  }

  return {
    tournamentId: String(tournamentId),
    stageId: String(stageId),
    regenerated: true,
    gameCount,
    participantCount: participantIds.length,
  };
};

const completeProgressionStage = async (tournamentId, hostUserId, stageId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const stage = getStageById(tournament, stageId);

  if (!stage) {
    throw new ApiError(404, 'STAGE_NOT_FOUND', 'Progression stage not found');
  }

  const isComplete = await isKnockoutStageComplete(tournamentId, stageId);
  const incompleteGames = await Game.countDocuments({
    ...buildStageGameFilter(tournamentId, stageId),
    status: { $ne: 'completed' },
  });

  if (incompleteGames > 0) {
    throw new ApiError(409, 'STAGE_GAMES_INCOMPLETE', 'Complete all stage matches before advancing');
  }

  const stages = getOrderedStages(tournament).map((entry) => ({
    ...entry,
    status:
      String(entry.stageId) === String(stageId)
        ? 'completed'
        : entry.status === 'completed'
          ? 'completed'
          : entry.status,
  }));

  const stageIndex = stages.findIndex((entry) => String(entry.stageId) === String(stageId));
  const nextStage = stages[stageIndex + 1] || null;

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        progressionPlan: {
          deferred: Boolean(tournament.progressionPlan?.deferred),
          stages,
        },
        activeStageId: nextStage ? null : null,
        progressionState: nextStage ? 'stageActive' : 'stageActive',
      },
    }
  );

  if (!nextStage) {
    return finalizeTournamentWithProgression(tournamentId, hostUserId);
  }

  return {
    tournamentId: String(tournamentId),
    completedStageId: String(stageId),
    nextStageId: String(nextStage.stageId),
    nextStageName: nextStage.name,
  };
};

const finalizeTournamentAfterGroups = async (tournamentId, hostUserId, payload = {}) => {
  await assertHostAccess(tournamentId, hostUserId);

  const winnersPerGroup = Math.min(parsePositiveInteger(payload.winnersPerGroup, 3), 5);
  const divisions = await Division.find({ tournamentId, stageId: null, name: { $ne: 'Final Stage' } })
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
        activeStageId: null,
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

const finalizeTournamentWithProgression = async (tournamentId, hostUserId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const stages = getOrderedStages(tournament);
  const lastStage = stages[stages.length - 1];

  if (lastStage?.format === 'knockout') {
    const finalGames = await Game.find({
      ...buildStageGameFilter(tournamentId, lastStage.stageId),
      status: 'completed',
    })
      .sort({ bracketRound: -1 })
      .lean();

    const maxRound = finalGames.reduce((max, game) => Math.max(max, Number(game.bracketRound || 0)), 0);
    const championshipGames = finalGames.filter((game) => Number(game.bracketRound) === maxRound);

    await Tournament.updateOne(
      { _id: tournamentId },
      {
        $set: {
          status: 'completed',
          progressionState: 'completed',
          activeStageId: null,
        },
      }
    );

    return {
      tournamentId: String(tournamentId),
      status: 'completed',
      progressionState: 'completed',
      winners: championshipGames,
    };
  }

  const division = await Division.findOne({ tournamentId, stageId: lastStage?.stageId }).lean();
  const finaleLeaderboard = division
    ? await recomputeLeaderboardForScope(tournamentId, division._id)
    : { items: [] };

  await Tournament.updateOne(
    { _id: tournamentId },
    {
      $set: {
        status: 'completed',
        progressionState: 'completed',
        activeStageId: null,
        'competitionConfig.finalStageEnabled': true,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    status: 'completed',
    progressionState: 'completed',
    winners: finaleLeaderboard.items || [],
  };
};

// Legacy aliases for backward-compatible routes
const startFinalStageFromGroups = async (tournamentId, hostUserId, payload = {}) => {
  const tournament = await Tournament.findById(tournamentId).lean();
  const stages = getOrderedStages(tournament);

  if (stages.length === 0) {
    // Auto-create default final stage plan for legacy calls
    const stageId = crypto.randomUUID();
    const defaultPlan = normalizeProgressionPlanInput({
      stages: [
        {
          stageId,
          name: 'Final Stage',
          order: 1,
          format: 'roundRobin',
          bestOf: payload.finalStageBestOf || 3,
          proctored: payload.finalStageProctored,
          topPerGroup: payload.topPerGroup || 2,
          advanceCount: 2,
        },
      ],
    });
    await Tournament.updateOne({ _id: tournamentId }, { $set: { progressionPlan: defaultPlan } });
    return startProgressionStage(tournamentId, hostUserId, stageId, payload);
  }

  const firstPending = stages.find((stage) => stage.status !== 'completed') || stages[0];
  return startProgressionStage(tournamentId, hostUserId, firstPending.stageId, {
    ...payload,
    selectedPlayerIds: payload.selectedPlayerIds,
    selectedTeamIds: payload.selectedTeamIds,
    bestOf: payload.finalStageBestOf,
  });
};

module.exports = {
  updateProgressionPlan,
  appendProgressionStage,
  abandonPendingProgressionStage,
  getGroupAdvancementPreview,
  getStageCandidates,
  startProgressionStage,
  regenerateProgressionStageFixtures,
  completeProgressionStage,
  finalizeTournamentAfterGroups,
  finalizeTournamentWithProgression,
  startFinalStageFromGroups,
  finalizeTournamentWithoutFinalStage: finalizeTournamentAfterGroups,
  finalizeTournamentWithFinalStage: finalizeTournamentWithProgression,
  validateProgressionPlan,
  normalizeProgressionPlanInput,
};
