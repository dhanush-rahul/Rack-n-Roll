import { useCallback, useState } from 'react';

import {

  completeProgressionStage,

  completeTournamentAfterGroups,

  completeTournamentWithFinalStage,

  appendProgressionStage,

  abandonPendingProgressionStage,

  fetchGroupAdvancementPreview,

  fetchStageCandidates,

  fetchTournamentGroupStandings,

  startProgressionStage,

} from '../../services/tournamentService';

import {

  serializeRuntimeStageDraft,

  buildGroupStageParticipantSelection,

  buildRuntimeStageMetaFromDraft,

  buildRuntimeStageMetaFromDraftForAppend,

  buildPreviousStageParticipantSelection,

  buildCandidateIdParticipantSelection,

  getKnockoutAdvanceCount,

  countUniqueStageParticipants,

  getStageModalBackLabel,

} from '../../utils/progressionPlanUtils';

import { formatApiError } from '../useScreenFeedback';



export function useProgressionActions({

  tournamentId,

  isDoubles,

  loadDetail,

  loadStageScores,

  onLoadGroupsTab,

  clearAll,

  showError,

  showSuccess,

  dispatchLoading,

  setActiveTab,

  progressionStages = [],

  progressionBypass = [],

  participantNameById,

}) {

  const [activeStageId, setActiveStageId] = useState(null);

  const [activeStageMeta, setActiveStageMeta] = useState(null);

  const [pendingStageDraft, setPendingStageDraft] = useState(null);

  const [persistedPendingStageId, setPersistedPendingStageId] = useState(null);

  const [groupStandings, setGroupStandings] = useState([]);

  const [suggestedParticipantIds, setSuggestedParticipantIds] = useState({});

  const [bypassParticipantIds, setBypassParticipantIds] = useState({});

  const [selectedParticipantIds, setSelectedParticipantIds] = useState({});

  const [isStageModalVisible, setIsStageModalVisible] = useState(false);

  const [stageActionConfirm, setStageActionConfirm] = useState(null);

  const [tournamentCompleteMessage, setTournamentCompleteMessage] = useState('');

  const [isStageLaunchConfirmVisible, setIsStageLaunchConfirmVisible] = useState(false);

  const [isLoadingStageCandidates, setIsLoadingStageCandidates] = useState(false);

  const [advancementPreview, setAdvancementPreview] = useState(null);

  const [isLoadingAdvancementPreview, setIsLoadingAdvancementPreview] = useState(false);

  const [stageModalSourceTab, setStageModalSourceTab] = useState('games');



  const selectedParticipantCount = Object.values(selectedParticipantIds).filter(Boolean).length;



  const resetStageModalState = useCallback(() => {

    setActiveStageId(null);

    setActiveStageMeta(null);

    setPendingStageDraft(null);

    setPersistedPendingStageId(null);

    setGroupStandings([]);

    setSelectedParticipantIds({});

    setSuggestedParticipantIds({});

    setBypassParticipantIds({});

  }, []);



  const onToggleParticipant = useCallback((participantId) => {

    const id = String(participantId);

    if (bypassParticipantIds[id]) {

      return;

    }



    setSelectedParticipantIds((previousState) => ({

      ...previousState,

      [id]: !previousState[id],

    }));

  }, [bypassParticipantIds]);



  const onOpenStageModal = useCallback(

    async (stage, { draft = null, abandonPersistedPendingOnCancel = false, sourceTab = 'games' } = {}) => {

      setActiveStageId(stage.stageId);

      setActiveStageMeta(stage);

      setPendingStageDraft(draft);

      setPersistedPendingStageId(abandonPersistedPendingOnCancel ? stage.stageId : null);

      setStageModalSourceTab(sourceTab);

      setIsStageModalVisible(true);



      try {

        clearAll();

        setIsLoadingStageCandidates(true);



        if (stage.advancement?.source === 'groups' || stage.order === 1) {

          const response = await fetchTournamentGroupStandings(tournamentId);

          const groups = response.groups || [];

          setGroupStandings(groups);

          const selection = buildGroupStageParticipantSelection({

            groups,

            stage,

            isDoubles,

          });



          setBypassParticipantIds(selection.bypassParticipantIds);

          setActiveStageMeta({ ...stage, expectedCount: selection.expectedCount });

          setSuggestedParticipantIds(selection.suggestedSelection);

          const initialSelection = Object.entries(selection.suggestedSelection).reduce(

            (accumulator, [id, selected]) => {

              if (selected) {

                accumulator[String(id)] = true;

              }

              return accumulator;

            },

            {}

          );

          setSelectedParticipantIds(

            stage.advancement?.selectionMode === 'hostManual' ? {} : initialSelection

          );

        } else if (stage.advancement?.sourceStageId) {

          const sourceStageId = String(stage.advancement.sourceStageId);

          const sourceStage = progressionStages.find(

            (entry) => String(entry.stageId) === sourceStageId

          );

          const sourceStageName = sourceStage?.name || 'previous round';

          const [sourceGames, groupStandingsResponse] = await Promise.all([

            loadStageScores(sourceStageId),

            fetchTournamentGroupStandings(tournamentId).catch(() => ({ groups: [] })),

          ]);

          const pickCount = Number(draft?.sourceAdvanceCount) || null;
          const candidatesResponse = await fetchStageCandidates(tournamentId, stage.stageId).catch(() => null);
          const sourceParticipantCount = countUniqueStageParticipants(sourceGames, isDoubles);
          const resolvedPickCount =
            pickCount ||
            Number(sourceStage?.advancement?.advanceCount) ||
            Number(candidatesResponse?.expectedCount) ||
            (sourceParticipantCount > 0 ? getKnockoutAdvanceCount(sourceParticipantCount) : null);

          const selection = buildPreviousStageParticipantSelection({

            sourceGames,

            sourceStageName,

            isDoubles,

            progressionBypass,

            stageName: stage.name,

            participantNameById,

            advanceCount: resolvedPickCount,

          });

          setGroupStandings(selection.groupStandings);

          setBypassParticipantIds(selection.bypassParticipantIds);

          setActiveStageMeta({ ...stage, expectedCount: selection.expectedCount });

          setSuggestedParticipantIds(selection.suggestedSelection);

          setSelectedParticipantIds(

            stage.advancement?.selectionMode === 'hostManual' ? {} : selection.suggestedSelection

          );

        } else {

          const candidatesResponse = await fetchStageCandidates(tournamentId, stage.stageId);
          const pickCount =
            Number(draft?.sourceAdvanceCount) ||
            Number(candidatesResponse?.expectedCount) ||
            null;

          let sourceGames = [];
          if (stage.advancement?.sourceStageId) {
            sourceGames = await loadStageScores(stage.advancement.sourceStageId);
          }

          const sourceParticipantCount = countUniqueStageParticipants(sourceGames, isDoubles);
          const resolvedPickCount =
            pickCount ||
            (sourceParticipantCount > 0 ? getKnockoutAdvanceCount(sourceParticipantCount) : null);

          const selection = buildPreviousStageParticipantSelection({
            sourceGames,
            sourceStageName: stage.name || 'stage',
            isDoubles,
            progressionBypass,
            stageName: stage.name,
            participantNameById,
            advanceCount: resolvedPickCount,
          });

          setGroupStandings(selection.groupStandings);
          setBypassParticipantIds(selection.bypassParticipantIds);
          setActiveStageMeta({ ...stage, expectedCount: selection.expectedCount });
          setSuggestedParticipantIds(selection.suggestedSelection);
          setSelectedParticipantIds(
            stage.advancement?.selectionMode === 'hostManual' ? {} : selection.suggestedSelection
          );

        }

      } catch (error) {

        resetStageModalState();

        setIsStageModalVisible(false);

        showError(formatApiError(error, 'Unable to load stage candidates'));

      } finally {

        setIsLoadingStageCandidates(false);

      }

    },

    [clearAll, isDoubles, loadStageScores, participantNameById, progressionBypass, progressionStages, resetStageModalState, showError, tournamentId]

  );



  const onCloseStageModal = useCallback(async () => {

    setIsStageModalVisible(false);



    if (persistedPendingStageId) {

      try {

        await abandonPendingProgressionStage(tournamentId, persistedPendingStageId);

        await loadDetail();

      } catch (error) {

        showError(formatApiError(error, 'Unable to cancel stage setup'));

      }

    }



    resetStageModalState();

    setActiveTab(stageModalSourceTab || 'games');

  }, [loadDetail, persistedPendingStageId, resetStageModalState, setActiveTab, showError, stageModalSourceTab, tournamentId]);



  const onPreviewGroupAdvancement = useCallback(

    async (draft) => {

      try {

        setIsLoadingAdvancementPreview(true);

        const preview = await fetchGroupAdvancementPreview(tournamentId, serializeRuntimeStageDraft(draft));

        setAdvancementPreview(preview);

      } catch (error) {

        setAdvancementPreview(null);

      } finally {

        setIsLoadingAdvancementPreview(false);

      }

    },

    [tournamentId]

  );



  const onPrepareStageFromGroups = useCallback(

    async (draft) => {

      const stageMeta = buildRuntimeStageMetaFromDraft(draft);

      await onOpenStageModal(stageMeta, { draft, sourceTab: 'games' });

    },

    [onOpenStageModal]

  );



  const onPrepareStageFromPrevious = useCallback(

    async (draft, sourceStage) => {

      const stageMeta = buildRuntimeStageMetaFromDraftForAppend(draft, {

        sourceStageId: sourceStage.stageId,

        order: Number(sourceStage.order || 1) + 1,

      });

      await onOpenStageModal(stageMeta, {

        draft,

        sourceTab: `stage:${sourceStage.stageId}`,

      });

    },

    [onOpenStageModal]

  );



  const onResumePendingStage = useCallback(

    async (stage) => {

      const sourceStageId = String(stage.advancement?.sourceStageId || '');
      const sourceStage = progressionStages.find(
        (entry) => String(entry.stageId) === sourceStageId
      );
      const sourceAdvanceCount = Number(sourceStage?.advancement?.advanceCount);
      const draft =
        sourceAdvanceCount > 0 ? { sourceAdvanceCount } : null;

      await onOpenStageModal(stage, { draft, abandonPersistedPendingOnCancel: true });

    },

    [onOpenStageModal, progressionStages]

  );



  const onStartStage = useCallback(async (startOptions = {}) => {

    if (!activeStageMeta) return;



    const selectedIds = Object.entries(selectedParticipantIds)

      .filter(([, selected]) => Boolean(selected))

      .map(([id]) => id);



    const configuredPickCount = Number(pendingStageDraft?.sourceAdvanceCount);
    const expectedCount =
      configuredPickCount > 0
        ? configuredPickCount
        : Number(activeStageMeta.expectedCount);
    const poolMode = activeStageMeta.advancement?.poolMode || 'combined';
    const isFromGroups =
      activeStageMeta.advancement?.source === 'groups' || activeStageMeta.order === 1;
    const formatOverride = startOptions.formatOverride || null;
    const promoteBypassParticipantId = String(startOptions.promoteBypassParticipantId || '').trim();
    const promoteBypassTargetStageName = String(
      startOptions.promoteBypassTargetStageName || ''
    ).trim();
    const isKnockoutStart =
      formatOverride !== 'roundRobin' && activeStageMeta.format === 'knockout';

    if (
      !isFromGroups &&
      expectedCount &&
      selectedIds.length > 0 &&
      selectedIds.length !== expectedCount &&
      poolMode === 'combined'
    ) {
      showError(`Select exactly ${expectedCount} ${isDoubles ? 'teams' : 'players'} for this stage.`);
      return;
    }

    if (isKnockoutStart && selectedIds.length % 2 === 1 && !formatOverride && !promoteBypassParticipantId) {
      showError('Choose round-robin or promote one player before starting an odd-sized knockout round.');
      return;
    }

    if (selectedIds.length < 2) {
      showError(`Select at least 2 ${isDoubles ? 'teams' : 'players'} to start this stage.`);
      return;
    }



    try {

      clearAll();

      dispatchLoading({ type: 'set', key: 'progressing', value: true });



      let stageId = activeStageId;

      if (pendingStageDraft) {

        const response = await appendProgressionStage(

          tournamentId,

          {
            ...serializeRuntimeStageDraft(pendingStageDraft),
            ...(Number(pendingStageDraft.sourceAdvanceCount) > 0
              ? { sourceAdvanceCount: Number(pendingStageDraft.sourceAdvanceCount) }
              : {}),
          }

        );

        stageId = response.stage?.stageId;

        if (!stageId) {

          throw new Error('Stage was not created');

        }

      }



      const response = await startProgressionStage(tournamentId, stageId, {

        ...(isDoubles ? { selectedTeamIds: selectedIds } : { selectedPlayerIds: selectedIds }),
        ...(formatOverride === 'roundRobin' ? { format: 'roundRobin' } : {}),
        ...(promoteBypassParticipantId
          ? {
              promoteBypassParticipantId,
              promoteBypassTargetStageName,
            }
          : {}),

      });

      showSuccess(

        `${activeStageMeta.name} started with ${response.participantCount} ${isDoubles ? 'teams' : 'players'}.`

      );

      setIsStageModalVisible(false);

      setIsStageLaunchConfirmVisible(false);

      resetStageModalState();

      await Promise.all([

        loadDetail(),

        loadStageScores(stageId, { hydrateInputs: true, forceRefresh: true }),

        onLoadGroupsTab(),

      ]);

      setActiveTab(`stage:${stageId}`);

    } catch (error) {

      showError(formatApiError(error, `Unable to start ${activeStageMeta?.name || 'stage'}`));

    } finally {

      dispatchLoading({ type: 'set', key: 'progressing', value: false });

    }

  }, [

    activeStageId,

    activeStageMeta,

    clearAll,

    dispatchLoading,

    isDoubles,

    loadDetail,

    loadStageScores,

    onLoadGroupsTab,

    pendingStageDraft,

    resetStageModalState,

    selectedParticipantIds,

    setActiveTab,

    showError,

    showSuccess,

    tournamentId,

  ]);



  const onCompleteAfterGroups = useCallback(async () => {

    try {

      clearAll();

      dispatchLoading({ type: 'set', key: 'progressing', value: true });

      await completeTournamentAfterGroups(tournamentId, { winnersPerGroup: 3 });

      await loadDetail();

      await onLoadGroupsTab();

      setActiveTab('groups');

      setTournamentCompleteMessage('The tournament has ended using group-stage results.');

    } catch (error) {

      showError(formatApiError(error, 'Unable to finalize tournament'));

    } finally {

      dispatchLoading({ type: 'set', key: 'progressing', value: false });

    }

  }, [clearAll, dispatchLoading, loadDetail, onLoadGroupsTab, setActiveTab, showError, tournamentId]);



  const onAdvanceStage = useCallback(

    async (stageId, stageName, isLastStage) => {

      try {

        clearAll();

        dispatchLoading({ type: 'set', key: 'progressing', value: true });

        if (isLastStage) {

          await completeTournamentWithFinalStage(tournamentId);

          setTournamentCompleteMessage(`The tournament has ended after ${stageName}.`);

        } else {

          await completeProgressionStage(tournamentId, stageId);

          showSuccess(`${stageName} finalized.`);

        }

        await loadDetail();

        await onLoadGroupsTab();

      } catch (error) {

        showError(formatApiError(error, `Unable to advance from ${stageName}`));

      } finally {

        dispatchLoading({ type: 'set', key: 'progressing', value: false });

      }

    },

    [clearAll, dispatchLoading, loadDetail, onLoadGroupsTab, showError, showSuccess, tournamentId]

  );



  return {

    activeStageId,

    activeStageMeta,

    groupStandings,

    suggestedParticipantIds,

    bypassParticipantIds,

    selectedParticipantIds,

    selectedParticipantCount,

    isStageModalVisible,

    setIsStageModalVisible,

    stageActionConfirm,

    setStageActionConfirm,

    tournamentCompleteMessage,

    setTournamentCompleteMessage,

    isStageLaunchConfirmVisible,

    setIsStageLaunchConfirmVisible,

    isLoadingStageCandidates,

    advancementPreview,

    isLoadingAdvancementPreview,

    onToggleParticipant,

    onCloseStageModal,

    onOpenStageModal,

    onPreviewGroupAdvancement,

    onPrepareStageFromGroups,

    onPrepareStageFromPrevious,

    onResumePendingStage,

    stageModalBackLabel: getStageModalBackLabel(stageModalSourceTab, progressionStages),

    onStartStage,

    onCompleteAfterGroups,

    onAdvanceStage,

  };

}



// Backward-compatible alias

export const useFinaleActions = useProgressionActions;

