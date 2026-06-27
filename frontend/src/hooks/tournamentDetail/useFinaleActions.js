import { useCallback, useState } from 'react';
import {
  completeTournamentWithFinalStage,
  completeTournamentWithoutFinalStage,
  fetchTournamentGroupStandings,
  startTournamentFinalStage,
} from '../../services/tournamentService';
import { formatApiError } from '../useScreenFeedback';

export function useFinaleActions({
  tournamentId,
  isDoubles,
  loadDetail,
  loadFinalStageScores,
  onLoadGroupsTab,
  onLoadFinaleTab,
  clearAll,
  showError,
  showSuccess,
  dispatchLoading,
  setActiveTab,
}) {
  const [groupStandings, setGroupStandings] = useState([]);
  const [suggestedFinalistIds, setSuggestedFinalistIds] = useState({});
  const [selectedFinalistIds, setSelectedFinalistIds] = useState({});
  const [isFinaleModalVisible, setIsFinaleModalVisible] = useState(false);
  const [finaleActionConfirm, setFinaleActionConfirm] = useState(null);
  const [tournamentCompleteMessage, setTournamentCompleteMessage] = useState('');
  const [isFinaleLaunchConfirmVisible, setIsFinaleLaunchConfirmVisible] = useState(false);
  const [isLoadingFinaleCandidates, setIsLoadingFinaleCandidates] = useState(false);
  const [finalBestOfInput, setFinalBestOfInput] = useState('3');
  const [finalStageProctoredInput, setFinalStageProctoredInput] = useState(false);
  const [winnersPerGroupInput] = useState('3');

  const selectedFinalistCount = Object.values(selectedFinalistIds).filter(Boolean).length;

  const onToggleFinalist = useCallback((playerId) => {
    setSelectedFinalistIds((previousState) => ({
      ...previousState,
      [playerId]: !previousState[playerId],
    }));
  }, []);

  const onStartFinalStage = useCallback(async () => {
    const selectedIds = Object.entries(selectedFinalistIds)
      .filter(([, selected]) => Boolean(selected))
      .map(([id]) => id);

    if (selectedIds.length < 2) {
      showError(`Select at least 2 finalist ${isDoubles ? 'teams' : 'players'} to start finale.`);
      return;
    }

    try {
      clearAll();
      dispatchLoading({ type: 'set', key: 'progressing', value: true });
      const response = await startTournamentFinalStage(tournamentId, {
        topPerGroup: 2,
        finalStageBestOf: Number(finalBestOfInput),
        finalStageProctored: isDoubles ? false : finalStageProctoredInput,
        ...(isDoubles
          ? {
              selectedTeamIds: Object.entries(selectedFinalistIds)
                .filter(([, selected]) => Boolean(selected))
                .map(([teamId]) => teamId),
            }
          : {
              selectedPlayerIds: Object.entries(selectedFinalistIds)
                .filter(([, selected]) => Boolean(selected))
                .map(([playerId]) => playerId),
            }),
      });
      showSuccess(
        `Final stage started with ${response.finalistCount} ${isDoubles ? 'teams' : 'players'}.`
      );
      setIsFinaleModalVisible(false);
      setGroupStandings([]);
      setSelectedFinalistIds({});
      setSuggestedFinalistIds({});
      await Promise.all([loadDetail(), loadFinalStageScores({ hydrateInputs: true }), onLoadGroupsTab()]);
      setActiveTab('finale');
    } catch (error) {
      showError(formatApiError(error, 'Unable to start final stage'));
    } finally {
      dispatchLoading({ type: 'set', key: 'progressing', value: false });
    }
  }, [
    clearAll,
    dispatchLoading,
    finalBestOfInput,
    finalStageProctoredInput,
    isDoubles,
    loadDetail,
    loadFinalStageScores,
    onLoadGroupsTab,
    selectedFinalistIds,
    setActiveTab,
    showError,
    showSuccess,
    tournamentId,
  ]);

  const onOpenFinaleModal = useCallback(async () => {
    setIsFinaleModalVisible(true);

    try {
      clearAll();
      setIsLoadingFinaleCandidates(true);
      const response = await fetchTournamentGroupStandings(tournamentId);
      setGroupStandings(response.groups || []);

      const suggestedSelection = {};
      (response.groups || []).forEach((group) => {
        (group.suggestedFinalists || []).forEach((finalistId) => {
          suggestedSelection[finalistId] = true;
        });
      });

      setSuggestedFinalistIds(suggestedSelection);
      setSelectedFinalistIds(suggestedSelection);
    } catch (error) {
      setGroupStandings([]);
      setSelectedFinalistIds({});
      setSuggestedFinalistIds({});
      showError(formatApiError(error, 'Unable to load group standings'));
    } finally {
      setIsLoadingFinaleCandidates(false);
    }
  }, [clearAll, showError, tournamentId]);

  const onCompleteWithoutFinals = useCallback(async () => {
    try {
      clearAll();
      dispatchLoading({ type: 'set', key: 'progressing', value: true });
      await completeTournamentWithoutFinalStage(tournamentId, {
        winnersPerGroup: Number(winnersPerGroupInput),
      });
      await loadDetail();
      await onLoadGroupsTab();
      setActiveTab('groups');
      setTournamentCompleteMessage(
        'The tournament has ended using group-stage results. Top 3 players in each group are medalled in the standings.'
      );
    } catch (error) {
      showError(formatApiError(error, 'Unable to finalize tournament'));
    } finally {
      dispatchLoading({ type: 'set', key: 'progressing', value: false });
    }
  }, [clearAll, dispatchLoading, loadDetail, onLoadGroupsTab, setActiveTab, showError, tournamentId, winnersPerGroupInput]);

  const onConfirmFinaleAction = useCallback(async () => {
    if (finaleActionConfirm === 'start') {
      setFinaleActionConfirm(null);
      await onOpenFinaleModal();
      return;
    }

    if (finaleActionConfirm === 'skip') {
      setFinaleActionConfirm(null);
      await onCompleteWithoutFinals();
    }
  }, [finaleActionConfirm, onCompleteWithoutFinals, onOpenFinaleModal]);

  const onCompleteWithFinale = useCallback(async () => {
    try {
      clearAll();
      dispatchLoading({ type: 'set', key: 'progressing', value: true });
      await completeTournamentWithFinalStage(tournamentId);
      await Promise.all([loadDetail(), onLoadFinaleTab(), onLoadGroupsTab()]);
      setActiveTab('groups');
      setTournamentCompleteMessage(
        'The tournament has ended using finale results. Top 3 finale places are medalled in the standings.'
      );
    } catch (error) {
      showError(formatApiError(error, 'Unable to complete tournament from finale'));
    } finally {
      dispatchLoading({ type: 'set', key: 'progressing', value: false });
    }
  }, [clearAll, dispatchLoading, loadDetail, onLoadFinaleTab, onLoadGroupsTab, setActiveTab, showError, tournamentId]);

  return {
    groupStandings,
    suggestedFinalistIds,
    selectedFinalistIds,
    selectedFinalistCount,
    isFinaleModalVisible,
    setIsFinaleModalVisible,
    finaleActionConfirm,
    setFinaleActionConfirm,
    tournamentCompleteMessage,
    setTournamentCompleteMessage,
    isFinaleLaunchConfirmVisible,
    setIsFinaleLaunchConfirmVisible,
    isLoadingFinaleCandidates,
    finalBestOfInput,
    setFinalBestOfInput,
    finalStageProctoredInput,
    setFinalStageProctoredInput,
    winnersPerGroupInput,
    onToggleFinalist,
    onStartFinalStage,
    onOpenFinaleModal,
    onCompleteWithoutFinals,
    onConfirmFinaleAction,
    onCompleteWithFinale,
  };
}
