const GROUP_STAGE_ID = 'groupStage';

const nextPowerOfTwo = (value) => {
  let size = 1;
  while (size < value) {
    size *= 2;
  }
  return size;
};

const getKnockoutAdvanceCount = (participantCount) => {
  const count = Math.max(Number(participantCount) || 0, 0);
  if (count <= 1) {
    return count;
  }
  return Math.ceil(count / 2);
};

const sortStages = (stages = []) =>
  [...stages].sort((left, right) => Number(left.order || 0) - Number(right.order || 0));

const getStageById = (tournament, stageId) => {
  const stages = tournament?.progressionPlan?.stages || [];
  return stages.find((stage) => String(stage.stageId) === String(stageId)) || null;
};

const getOrderedStages = (tournament) => sortStages(tournament?.progressionPlan?.stages || []);

const getStageInputCount = (tournament, stage) => {
  const stages = getOrderedStages(tournament);
  const stageIndex = stages.findIndex((entry) => String(entry.stageId) === String(stage.stageId));

  if (stageIndex <= 0) {
    const groupCount = Number(tournament?.competitionConfig?.groupCount || 0);
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
  const bypassCount = (tournament?.progressionBypass || [])
    .filter(
      (entry) =>
        String(entry.targetStageName || '').trim().toLowerCase() ===
        String(stage.name || '').trim().toLowerCase()
    )
    .reduce((sum, entry) => sum + (entry.participantIds || []).length, 0);

  return baseCount + bypassCount;
};

const validateProgressionPlan = (plan, { groupCount = null } = {}) => {
  const stages = sortStages(plan?.stages || []);
  const errors = [];

  if (stages.length === 0) {
    return { valid: true, stages: [], errors: [] };
  }

  const names = new Set();

  stages.forEach((stage, index) => {
    const name = String(stage.name || '').trim();
    if (name.length < 2 || name.length > 40) {
      errors.push(`Stage ${index + 1}: name must be 2–40 characters.`);
    }
    if (names.has(name.toLowerCase())) {
      errors.push(`Stage "${name}" must have a unique name.`);
    }
    names.add(name.toLowerCase());

    if (Number(stage.order) !== index + 1) {
      errors.push(`Stage "${name}": order must be contiguous starting at 1.`);
    }

    const inputCount = index === 0
      ? (Number(groupCount) > 0 ? Number(groupCount) * Number(stage.advancement?.topPerGroup || 0) : 0)
      : Number(stages[index - 1]?.advancement?.advanceCount || 0);

    if (index === 0) {
      if (!Number(stage.advancement?.topPerGroup) || stage.advancement.topPerGroup < 1) {
        errors.push(`Stage "${name}": top per group is required.`);
      }
      const directPromote = Number(stage.advancement?.directPromotePerGroup || 0);
      const topPerGroup = Number(stage.advancement?.topPerGroup || 0);
      if (directPromote >= topPerGroup && topPerGroup > 0) {
        errors.push(`Stage "${name}": direct promote count must be less than top per group.`);
      }
      const poolMode = stage.advancement?.poolMode || 'combined';
      if (poolMode === 'groupPairKnockout') {
        if (!groupCount || groupCount % 2 !== 0) {
          errors.push(`Stage "${name}": group-pair knockout requires an even number of groups.`);
        }
        if (stage.format !== 'knockout') {
          errors.push(`Stage "${name}": group-pair mode requires knockout format.`);
        }
      }
      if (!groupCount || groupCount < 1) {
        if (stages.length > 0 && !plan?.deferred) {
          errors.push('Group count is required when progression stages exist.');
        }
      }
    }

    const advanceCount = Number(stage.advancement?.advanceCount || 0);
    const isLast = index === stages.length - 1;

    if (!isLast) {
      const minAdvance = stage.format === 'knockout' ? 1 : 2;
      if (!advanceCount || advanceCount < minAdvance) {
        errors.push(`Stage "${name}": advance count must be at least ${minAdvance}.`);
      }
      if (inputCount > 0 && advanceCount > inputCount) {
        errors.push(`Stage "${name}": cannot advance more than ${inputCount} participants.`);
      }
    } else if (stage.format === 'knockout' && advanceCount !== 1 && advanceCount !== 0) {
      errors.push(`Final knockout stage "${name}" should advance 1 champion.`);
    }

    if (stage.format === 'knockout' && inputCount > 0 && inputCount !== nextPowerOfTwo(inputCount)) {
      const byes = nextPowerOfTwo(inputCount) - inputCount;
      if (byes > 0) {
        // informational only — not a blocking error
      }
    }

    if (stage.format === 'roundRobin' && !isLast && advanceCount < 2) {
      errors.push(`Round-robin stage "${name}": advance count must be at least 2.`);
    }
  });

  return { valid: errors.length === 0, stages, errors };
};

const normalizeProgressionPlanInput = (planInput = {}) => {
  const stages = sortStages(planInput?.stages || []).map((stage, index) => ({
    stageId: String(stage.stageId || '').trim() || require('crypto').randomUUID(),
    name: String(stage.name || '').trim(),
    order: index + 1,
    format: stage.format === 'knockout' ? 'knockout' : 'roundRobin',
    bestOf: [1, 3, 5, 7].includes(Number(stage.bestOf)) ? Number(stage.bestOf) : 3,
    proctored: Boolean(stage.proctored),
    advancement: {
      source: index === 0 ? 'groups' : 'previousStage',
      sourceStageId: index === 0 ? null : String(sortStages(planInput.stages)[index - 1]?.stageId || ''),
      topPerGroup: index === 0 ? Number(stage.advancement?.topPerGroup || stage.topPerGroup || 2) : null,
      advanceCount:
        index === sortStages(planInput.stages).length - 1 && stage.format === 'knockout'
          ? Number(stage.advancement?.advanceCount ?? stage.advanceCount) === 0
            ? 0
            : 1
          : Number(stage.advancement?.advanceCount ?? stage.advanceCount ?? 2),
      selectionMode:
        stage.advancement?.selectionMode === 'hostManual' || stage.selectionMode === 'hostManual'
          ? 'hostManual'
          : 'autoStandings',
      poolMode:
        stage.advancement?.poolMode === 'groupPairKnockout' || stage.advancement?.poolMode === 'randomKnockout'
          ? stage.advancement.poolMode
          : 'combined',
      directPromotePerGroup:
        index === 0 ? Math.max(Number(stage.advancement?.directPromotePerGroup || 0), 0) : 0,
      bypassTargetStageName:
        index === 0 ? String(stage.advancement?.bypassTargetStageName || '').trim() || null : null,
      advancePerGroupPair:
        index === 0 ? Math.max(Number(stage.advancement?.advancePerGroupPair || 1), 1) : 1,
    },
    status: stage.status === 'active' || stage.status === 'completed' ? stage.status : 'pending',
  }));

  return {
    deferred: Boolean(planInput?.deferred),
    stages,
  };
};

const buildStageGameFilter = (tournamentId, stageId) => ({
  tournamentId,
  stageId: String(stageId),
});

module.exports = {
  GROUP_STAGE_ID,
  nextPowerOfTwo,
  getKnockoutAdvanceCount,
  sortStages,
  getStageById,
  getOrderedStages,
  getStageInputCount,
  validateProgressionPlan,
  normalizeProgressionPlanInput,
  buildStageGameFilter,
};
