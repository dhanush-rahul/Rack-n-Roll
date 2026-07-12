import { buildKnockoutStandingsFromGames } from './fixtureDisplay';

const GROUP_COUNT_OPTIONS = ['2', '4', '8'];

const BEST_OF_OPTIONS = [
  { value: '1', label: 'Best of 1' },
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
];

const createStageId = () => {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `stage-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export const nextPowerOfTwo = (value) => {
  let size = 1;
  while (size < value) size *= 2;
  return size;
};

export const buildDefaultProgressionState = () => ({
  enabled: false,
  deferAfterGroups: true,
  plannedGroupCount: '4',
  stages: [],
});

export const buildSingleFinaleTemplate = () => ({
  enabled: true,
  plannedGroupCount: '4',
  stages: [
    {
      stageId: createStageId(),
      name: 'Final Stage',
      order: 1,
      format: 'roundRobin',
      bestOf: '3',
      proctored: false,
      topPerGroup: 2,
      advanceCount: 2,
      selectionMode: 'autoStandings',
    },
  ],
});

export const buildFourStageKnockoutTemplate = () => ({
  enabled: true,
  plannedGroupCount: '4',
  stages: [
    {
      stageId: createStageId(),
      name: 'Pre-Quarter Final',
      order: 1,
      format: 'roundRobin',
      bestOf: '3',
      proctored: false,
      topPerGroup: 4,
      advanceCount: 8,
      selectionMode: 'autoStandings',
    },
    {
      stageId: createStageId(),
      name: 'Quarter Final',
      order: 2,
      format: 'knockout',
      bestOf: '3',
      proctored: false,
      advanceCount: 4,
      selectionMode: 'autoStandings',
    },
    {
      stageId: createStageId(),
      name: 'Semi Final',
      order: 3,
      format: 'knockout',
      bestOf: '3',
      proctored: false,
      advanceCount: 2,
      selectionMode: 'autoStandings',
    },
    {
      stageId: createStageId(),
      name: 'Final',
      order: 4,
      format: 'knockout',
      bestOf: '5',
      proctored: false,
      advanceCount: 1,
      selectionMode: 'autoStandings',
    },
  ],
});

export const buildBlankStage = (order = 1) => ({
  stageId: createStageId(),
  name: `Stage ${order}`,
  order,
  format: 'knockout',
  bestOf: '3',
  proctored: false,
  topPerGroup: 2,
  advanceCount: 2,
  selectionMode: 'autoStandings',
});

export const computeStageInputCount = (progressionState, stage, stageIndex) => {
  if (stageIndex <= 0) {
    const groupCount = Number(progressionState.plannedGroupCount || 0);
    const topPerGroup = Number(stage.topPerGroup || 0);
    return groupCount > 0 && topPerGroup > 0 ? groupCount * topPerGroup : 0;
  }
  return Number(progressionState.stages[stageIndex - 1]?.advanceCount || 0);
};

export const validateProgressionPlan = (progressionState) => {
  const errors = [];
  if (!progressionState.enabled) {
    return { valid: true, errors: [], pipeline: [] };
  }

  const stages = progressionState.stages || [];
  if (stages.length === 0) {
    errors.push('Add at least one stage after groups, or choose decide/end after groups.');
    return { valid: false, errors, pipeline: [] };
  }

  const names = new Set();
  const pipeline = [{ label: 'Groups', count: null }];

  stages.forEach((stage, index) => {
    const name = String(stage.name || '').trim();
    if (name.length < 2 || name.length > 40) {
      errors.push(`Stage ${index + 1}: name must be 2–40 characters.`);
    }
    if (names.has(name.toLowerCase())) {
      errors.push(`Stage "${name}" must have a unique name.`);
    }
    names.add(name.toLowerCase());

    const inputCount = computeStageInputCount(progressionState, stage, index);
    pipeline.push({ label: name, count: inputCount, format: stage.format, stageIndex: index });

    if (index === 0 && (!stage.topPerGroup || stage.topPerGroup < 1)) {
      errors.push(`Stage "${name}": set how many advance from each group.`);
    }

    const isLast = index === stages.length - 1;
    const advanceCount = Number(stage.advanceCount || 0);

    if (!isLast) {
      if (advanceCount < 2) {
        errors.push(`Stage "${name}": advance count must be at least 2.`);
      }
      if (inputCount > 0 && advanceCount > inputCount) {
        errors.push(`Stage "${name}": cannot advance more than ${inputCount} participants.`);
      }
      const nextInput = advanceCount;
      if (stages[index + 1] && nextInput > 0 && stages[index + 1].format === 'knockout' && nextInput !== nextPowerOfTwo(nextInput)) {
        pipeline[pipeline.length - 1].byeWarning = `${nextPowerOfTwo(nextInput) - nextInput} byes will be assigned in the next knockout stage.`;
      }
    }
  });

  return { valid: errors.length === 0, errors, pipeline };
};

export const serializeProgressionPlan = (progressionState) => ({
  deferred: Boolean(progressionState.deferAfterGroups),
  stages: (progressionState.stages || []).map((stage, index) => ({
    stageId: stage.stageId,
    name: String(stage.name || '').trim(),
    order: index + 1,
    format: stage.format === 'knockout' ? 'knockout' : 'roundRobin',
    bestOf: Number(stage.bestOf || 3),
    proctored: Boolean(stage.proctored),
    advancement: {
      source: index === 0 ? 'groups' : 'previousStage',
      sourceStageId: index === 0 ? null : progressionState.stages[index - 1]?.stageId || null,
      topPerGroup: index === 0 ? Number(stage.topPerGroup || 2) : null,
      advanceCount:
        index === progressionState.stages.length - 1 && stage.format === 'knockout'
          ? 1
          : Number(stage.advanceCount || 2),
      selectionMode: stage.selectionMode === 'hostManual' ? 'hostManual' : 'autoStandings',
      poolMode: stage.poolMode || stage.advancement?.poolMode || 'combined',
      directPromotePerGroup: index === 0 ? Number(stage.directPromotePerGroup || 0) : 0,
      bypassTargetStageName:
        index === 0 ? String(stage.bypassTargetStageName || '').trim() || null : null,
      advancePerGroupPair: index === 0 ? Number(stage.advancePerGroupPair || 1) : 1,
    },
  })),
});

export const serializeRuntimeStageDraft = (draft) => ({
  stageId: draft.stageId,
  name: String(draft.name || '').trim(),
  format: draft.format === 'knockout' ? 'knockout' : 'roundRobin',
  bestOf: Number(draft.bestOf || 3),
  proctored: Boolean(draft.proctored),
  topPerGroup: Number(draft.topPerGroup || 2),
  advanceCount: Number(draft.advanceCount ?? 2),
  sourceAdvanceCount:
    Number(draft.sourceAdvanceCount) > 0 ? Number(draft.sourceAdvanceCount) : null,
  selectionMode: draft.selectionMode === 'hostManual' ? 'hostManual' : 'autoStandings',
  advancement: {
    topPerGroup: Number(draft.topPerGroup || 2),
    advanceCount: Number(draft.advanceCount ?? 2),
    selectionMode: draft.selectionMode === 'hostManual' ? 'hostManual' : 'autoStandings',
    poolMode: draft.poolMode || 'combined',
    directPromotePerGroup: Number(draft.directPromotePerGroup || 0),
    bypassTargetStageName: String(draft.bypassTargetStageName || '').trim() || null,
    advancePerGroupPair: Number(draft.advancePerGroupPair || 1),
  },
});

export function buildRuntimeStageMetaFromDraft(draft) {
  const serialized = serializeRuntimeStageDraft(draft);
  return {
    ...serialized,
    order: 1,
    status: 'pending',
    advancement: {
      ...serialized.advancement,
      source: 'groups',
    },
  };
}

export function buildRuntimeStageMetaFromDraftForAppend(draft, { sourceStageId, order = 2 } = {}) {
  const serialized = serializeRuntimeStageDraft(draft);
  return {
    ...serialized,
    order,
    status: 'pending',
    advancement: {
      ...serialized.advancement,
      source: 'previousStage',
      sourceStageId: String(sourceStageId || ''),
      advanceCount: Number(draft.advanceCount ?? serialized.advancement.advanceCount ?? 2),
    },
  };
}

export function getStageInputCountFromDetail(detail, stage) {
  const stages = detail?.progressionPlan?.stages || [];
  const stageIndex = stages.findIndex((entry) => String(entry.stageId) === String(stage?.stageId));

  if (stageIndex <= 0) {
    const groupCount = Number(detail?.competitionConfig?.groupCount || 0);
    const topPerGroup = Number(stage?.advancement?.topPerGroup || 0);
    const directPromote = Number(stage?.advancement?.directPromotePerGroup || 0);
    const playingPerGroup = Math.max(topPerGroup - directPromote, 0);
    const poolMode = stage?.advancement?.poolMode || 'combined';

    if (groupCount > 0 && topPerGroup > 0) {
      if (poolMode === 'groupPairKnockout' && groupCount % 2 === 0) {
        return (groupCount / 2) * playingPerGroup * 2;
      }
      return groupCount * playingPerGroup;
    }

    return 0;
  }

  const previousStage = stages[stageIndex - 1];
  const baseCount = Number(previousStage?.advancement?.advanceCount || 0);
  const bypassCount = (detail?.progressionBypass || [])
    .filter(
      (entry) =>
        String(entry.targetStageName || '').trim().toLowerCase() ===
        String(stage?.name || '').trim().toLowerCase()
    )
    .reduce((sum, entry) => sum + (entry.participantIds || []).length, 0);

  return baseCount + bypassCount;
}

export function countUniqueStageParticipants(games = [], isDoubles = false) {
  const participantIds = new Set();
  const roundOneGames = games.filter((game) => Number(game.bracketRound || game.roundNumber || 1) === 1);
  const sourceGames = roundOneGames.length > 0 ? roundOneGames : games;

  sourceGames.forEach((game) => {
    const slotA = isDoubles ? game.teamA?.id || game.teamAId : game.playerA?.id || game.playerAId;
    const slotB = isDoubles ? game.teamB?.id || game.teamBId : game.playerB?.id || game.playerBId;

    if (slotA) participantIds.add(String(slotA));
    if (slotB) participantIds.add(String(slotB));
  });

  return participantIds.size;
}

export function areStageGamesComplete(games = []) {
  if (!games.length) {
    return false;
  }

  return games.every((game) => game.status === 'completed');
}

export function getKnockoutPlayedMatchCount(participantCount) {
  return Math.floor(Math.max(Number(participantCount) || 0, 0) / 2);
}

export function getKnockoutAdvanceCount(participantCount) {
  const count = Math.max(Number(participantCount) || 0, 0);
  if (count <= 1) {
    return count;
  }

  return Math.ceil(count / 2);
}

export function getKnockoutByeCount(participantCount) {
  return Math.max(getKnockoutAdvanceCount(participantCount) - getKnockoutPlayedMatchCount(participantCount), 0);
}

export function isLegacyKnockoutBracket(games = []) {
  if (!games.length) {
    return false;
  }

  const maxRound = games.reduce(
    (max, game) => Math.max(max, Number(game.bracketRound || game.roundNumber || 1)),
    1
  );

  return maxRound > 1 || games.some((game) => game.nextWinnerGameId);
}

export function buildGroupStageParticipantSelection({ groups = [], stage = {}, isDoubles = false }) {
  const topPerGroup = Math.max(Number(stage?.advancement?.topPerGroup || stage?.topPerGroup || 2), 1);
  const directPromotePerGroup = Math.max(Number(stage?.advancement?.directPromotePerGroup || 0), 0);
  const bypassTargetStageName =
    String(stage?.advancement?.bypassTargetStageName || '').trim() || 'next round';
  const playingPerGroup = Math.max(topPerGroup - directPromotePerGroup, 0);
  const groupCount = groups.length;

  const bypassParticipantIds = {};
  const suggestedSelection = {};

  groups.forEach((group) => {
    const entries = isDoubles ? group.teamStandings || [] : group.standings || [];
    const playingRankStart = directPromotePerGroup + 1;
    const playingBand = entries.filter((entry) => {
      const rank = Number(entry.rank || 0);
      return rank >= playingRankStart && rank <= topPerGroup;
    });
    const cutoffPoints = playingBand.reduce((minPoints, entry) => {
      const points = Number(entry.points);
      if (!Number.isFinite(points)) {
        return minPoints;
      }
      return minPoints == null ? points : Math.min(minPoints, points);
    }, null);

    entries.forEach((entry) => {
      const id = isDoubles ? entry.teamId : entry.playerId;
      const rank = Number(entry.rank || 0);
      const points = Number(entry.points);
      if (!id || !rank) {
        return;
      }

      if (directPromotePerGroup > 0 && rank <= directPromotePerGroup) {
        bypassParticipantIds[String(id)] = bypassTargetStageName;
        return;
      }

      const inPlayingBand = rank >= playingRankStart && rank <= topPerGroup;
      const tiedAtCutoff =
        cutoffPoints != null &&
        Number.isFinite(points) &&
        points === cutoffPoints &&
        rank > topPerGroup;

      if (inPlayingBand || tiedAtCutoff) {
        suggestedSelection[String(id)] = true;
      }
    });
  });

  return {
    bypassParticipantIds,
    suggestedSelection,
    expectedCount: groupCount * playingPerGroup,
    bypassTargetStageName,
    topPerGroup,
    directPromotePerGroup,
    playingPerGroup,
  };
}

function getWinnerFromCompletedGame(game, isDoubles) {
  const winnerId = isDoubles ? game.winnerTeamId : game.winnerPlayerId;
  if (!winnerId) {
    return null;
  }

  const id = String(winnerId);

  if (isDoubles) {
    const teamAId = String(game.teamA?.id || game.teamAId || '');
    return {
      id,
      label:
        id === teamAId
          ? game.teamA?.displayName || game.teamA?.customDisplayName || id
          : game.teamB?.displayName || game.teamB?.customDisplayName || id,
    };
  }

  const playerAId = String(game.playerA?.id || game.playerAId || '');
  return {
    id,
    label:
      id === playerAId
        ? game.playerA?.displayName || game.playerA?.username || id
        : game.playerB?.displayName || game.playerB?.username || id,
  };
}

function buildPickerStandingEntry({ id, label, rank, isDoubles }) {
  if (isDoubles) {
    return {
      rank,
      teamId: id,
      displayName: label,
      team: { id, displayName: label },
    };
  }

  return {
    rank,
    playerId: id,
    displayName: label,
    player: { displayName: label },
    playerName: label,
  };
}

export function buildBypassParticipantIdsForStage(stageName, progressionBypass = []) {
  const normalizedStageName = String(stageName || '').trim().toLowerCase();
  const bypassParticipantIds = {};

  progressionBypass.forEach((entry) => {
    const targetName = String(entry.targetStageName || '').trim().toLowerCase();
    if (!targetName || targetName !== normalizedStageName) {
      return;
    }

    (entry.participantIds || []).forEach((participantId) => {
      bypassParticipantIds[String(participantId)] = 'already qualified (bypass)';
    });
  });

  return bypassParticipantIds;
}

export function buildPreviousStageParticipantSelection({
  sourceGames = [],
  sourceStageName = 'previous round',
  isDoubles = false,
  progressionBypass = [],
  stageName = '',
  participantNameById,
  advanceCount = null,
}) {
  const bypassParticipantIds = buildBypassParticipantIdsForStage(stageName, progressionBypass);
  const standings = buildKnockoutStandingsFromGames(sourceGames, isDoubles);
  const defaultPickCount = Math.max(getKnockoutAdvanceCount(standings.length), 2);
  const pickCount =
    Number(advanceCount) > 0 ? Number(advanceCount) : defaultPickCount;

  const suggestedSelection = {};
  standings.slice(0, pickCount).forEach((entry) => {
    const id = String(isDoubles ? entry.teamId : entry.playerId);
    suggestedSelection[id] = true;
  });

  const pickerGroups = [
    {
      divisionId: 'stage-standings',
      divisionName: sourceStageName,
      standings: isDoubles ? [] : standings,
      teamStandings: isDoubles ? standings : [],
    },
  ];

  const bypassIds = Object.keys(bypassParticipantIds);
  if (bypassIds.length > 0) {
    const bypassEntries = bypassIds.map((id, index) =>
      buildPickerStandingEntry({
        id,
        label: participantNameById?.get?.(id) || id,
        rank: index + 1,
        isDoubles,
      })
    );

    pickerGroups.push({
      divisionId: 'bypassed-participants',
      divisionName: 'Already qualified (bypass)',
      standings: isDoubles ? [] : bypassEntries,
      teamStandings: isDoubles ? bypassEntries : [],
    });
  }

  return {
    groupStandings: pickerGroups,
    bypassParticipantIds,
    suggestedSelection,
    expectedCount: pickCount,
  };
}

export function buildCandidateIdParticipantSelection({
  candidateIds = [],
  groupStandings = [],
  groupName = 'Suggested players',
  isDoubles = false,
  progressionBypass = [],
  stageName = '',
  participantNameById,
}) {
  const bypassParticipantIds = buildBypassParticipantIdsForStage(stageName, progressionBypass);
  const selectableIds = candidateIds
    .map(String)
    .filter((id) => !bypassParticipantIds[id]);
  const selectableIdSet = new Set(selectableIds);

  let pickerGroups = [];

  if (groupStandings.length > 0 && selectableIdSet.size > 0) {
    pickerGroups = groupStandings
      .map((group) => {
        const entries = isDoubles ? group.teamStandings || [] : group.standings || [];
        const filtered = entries.filter((entry) => {
          const id = String(isDoubles ? entry.teamId : entry.playerId);
          return selectableIdSet.has(id);
        });

        if (!filtered.length) {
          return null;
        }

        return {
          ...group,
          standings: isDoubles ? [] : filtered,
          teamStandings: isDoubles ? filtered : [],
        };
      })
      .filter(Boolean);
  }

  if (!pickerGroups.length) {
    const entries = selectableIds.map((id, index) =>
      buildPickerStandingEntry({
        id,
        label: participantNameById?.get?.(id) || id,
        rank: index + 1,
        isDoubles,
      })
    );

    pickerGroups = [
      {
        divisionId: 'stage-candidates',
        divisionName: groupName,
        standings: isDoubles ? [] : entries,
        teamStandings: isDoubles ? entries : [],
      },
    ];
  }

  const suggestedSelection = {};
  selectableIds.forEach((id) => {
    suggestedSelection[String(id)] = true;
  });

  const bypassIds = Object.keys(bypassParticipantIds);
  if (bypassIds.length > 0) {
    const bypassEntries = bypassIds.map((id, index) =>
      buildPickerStandingEntry({
        id,
        label: participantNameById?.get?.(id) || id,
        rank: index + 1,
        isDoubles,
      })
    );

    pickerGroups.push({
      divisionId: 'bypassed-participants',
      divisionName: 'Already qualified (bypass)',
      standings: isDoubles ? [] : bypassEntries,
      teamStandings: isDoubles ? bypassEntries : [],
    });
  }

  return {
    groupStandings: pickerGroups,
    bypassParticipantIds,
    suggestedSelection,
    expectedCount: Math.max(selectableIds.length, 2),
  };
}

export function getStageModalBackLabel(sourceTab, progressionStages = []) {
  if (sourceTab === 'games') {
    return 'Back to Games';
  }

  if (String(sourceTab || '').startsWith('stage:')) {
    const stageId = String(sourceTab).replace('stage:', '');
    const sourceStage = progressionStages.find((stage) => String(stage.stageId) === stageId);
    return sourceStage?.name ? `Back to ${sourceStage.name}` : 'Back';
  }

  return 'Back';
}

export { GROUP_COUNT_OPTIONS, BEST_OF_OPTIONS, createStageId };
