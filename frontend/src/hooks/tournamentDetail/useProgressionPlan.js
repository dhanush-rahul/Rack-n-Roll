import { useMemo } from 'react';

const GROUP_STAGE_ID = 'groupStage';

export function useProgressionPlan(detail) {
  return useMemo(() => {
    const stages = detail?.progressionPlan?.stages || [];
    const progressionBypass = detail?.progressionBypass || [];
    const progressionState = detail?.progressionState || 'registration';
    const activeStageId = detail?.activeStageId || null;

    const bypassByTargetName = progressionBypass.reduce((accumulator, entry) => {
      const key = String(entry.targetStageName || '').trim().toLowerCase();
      if (!key) {
        return accumulator;
      }

      const existing = accumulator.get(key) || [];
      accumulator.set(key, [...existing, ...(entry.participantIds || []).map(String)]);
      return accumulator;
    }, new Map());

    const allStages = stages.map((stage, index) => {
      const priorStages = stages.slice(0, index);
      const priorIncomplete = priorStages.some((entry) => entry.status !== 'completed');
      const dbStatus = stage.status || 'pending';
      const isActive = activeStageId === stage.stageId || dbStatus === 'active';
      const isComplete = dbStatus === 'completed';
      const bypassParticipantIds = bypassByTargetName.get(String(stage.name || '').trim().toLowerCase()) || [];

      let tabStatus = 'locked';

      if (isComplete) tabStatus = 'complete';
      else if (isActive) tabStatus = 'active';
      else if (dbStatus === 'pending' && bypassParticipantIds.length > 0) tabStatus = 'preview';
      else if (!priorIncomplete && (progressionState === 'groupStage' || progressionState === 'stageActive')) {
        tabStatus = 'ready';
      }

      return {
        stageId: stage.stageId,
        name: stage.name,
        order: stage.order,
        format: stage.format,
        bestOf: stage.bestOf,
        proctored: stage.proctored,
        advancement: stage.advancement,
        dbStatus,
        status: tabStatus,
        bypassParticipantIds,
        isBypassPreview: false,
      };
    });

    const existingStageNames = new Set(allStages.map((stage) => String(stage.name || '').trim().toLowerCase()));

    const bypassPreviewTabs = progressionBypass
      .filter((entry) => {
        const targetName = String(entry.targetStageName || '').trim().toLowerCase();
        return targetName && !existingStageNames.has(targetName);
      })
      .reduce((accumulator, entry) => {
        const targetName = String(entry.targetStageName || '').trim();
        const key = targetName.toLowerCase();

        if (accumulator.some((stage) => stage.name.toLowerCase() === key)) {
          return accumulator;
        }

        accumulator.push({
          stageId: `bypass:${key}`,
          name: targetName,
          order: allStages.length + accumulator.length + 1,
          format: 'knockout',
          bestOf: 3,
          proctored: false,
          advancement: null,
          dbStatus: 'pending',
          status: 'preview',
          bypassParticipantIds: (entry.participantIds || []).map(String),
          isBypassPreview: true,
        });

        return accumulator;
      }, []);

    const hasConfiguredStages = stages.length > 0;

    const stageTabs = [...allStages, ...bypassPreviewTabs]
      .filter(
        (stage) =>
          stage.isBypassPreview ||
          hasConfiguredStages ||
          stage.dbStatus === 'active' ||
          stage.dbStatus === 'completed'
      )
      .map(({ dbStatus, ...stage }) => stage);

    const nextReadyStage =
      allStages.find((stage) => stage.dbStatus === 'pending' && stage.status === 'ready') || null;

    const activeStage = allStages.find((stage) => stage.status === 'active') || null;

    const hasStartedPostGroupStages = allStages.some(
      (stage) => stage.dbStatus === 'active' || stage.dbStatus === 'completed'
    );

    const hasPendingStage = allStages.some((stage) => stage.dbStatus === 'pending');
    const hasPostGroupStages = hasStartedPostGroupStages;

    return {
      hasPostGroupStages,
      hasStartedPostGroupStages,
      hasPendingStage,
      stageTabs,
      activeStageId,
      activeStage,
      nextReadyStage,
      progressionBypass,
      groupStageTab: {
        id: 'groups',
        label: 'Groups',
        status: ['groupStage', 'stageActive', 'completed', 'finalStage'].includes(progressionState)
          ? progressionState === 'registration' || progressionState === 'groupSetup'
            ? 'pending'
            : 'active'
          : 'pending',
      },
    };
  }, [detail]);
}

export { GROUP_STAGE_ID };
