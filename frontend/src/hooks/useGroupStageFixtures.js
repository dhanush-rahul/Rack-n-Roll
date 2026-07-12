import { useStageFixtures } from './useStageFixtures';

const resolveGroupStageBestOf = (groupStageBestOfOrConfig) => {
  if (groupStageBestOfOrConfig == null) {
    return undefined;
  }

  if (typeof groupStageBestOfOrConfig === 'object') {
    return groupStageBestOfOrConfig.groupStageBestOf;
  }

  return groupStageBestOfOrConfig;
};

export function useGroupStageFixtures(
  tournamentId,
  groupsTabItems = [],
  groupStageBestOfOrConfig,
  { defaultGamesView = 'all', myGamesUserId = null } = {}
) {
  const fixtures = useStageFixtures(tournamentId, {
    stageId: 'groupStage',
    stageName: 'Group stage',
    bestOf: resolveGroupStageBestOf(groupStageBestOfOrConfig),
    groupsTabItems,
    defaultGamesView,
    myGamesUserId,
    enabled: Boolean(tournamentId),
    isGroupStage: true,
  });

  return {
    ...fixtures,
    groupStageProctored: fixtures.stageProctored,
    loadGroupStageScores: fixtures.loadStageScores,
  };
}
