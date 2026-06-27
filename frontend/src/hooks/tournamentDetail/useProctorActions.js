import { useCallback, useMemo, useState } from 'react';
import {
  acceptTournamentProctorTransfer,
  assignTournamentProctor,
  declineTournamentProctorTransfer,
  removeTournamentProctor,
  requestTournamentProctorTransfer,
  searchTournamentManualAddUsers,
} from '../../services/tournamentService';
import { formatApiError } from '../useScreenFeedback';

export function useProctorActions({
  tournamentId,
  detail,
  isHost,
  groupStageProctored,
  approvedItems,
  currentUserId,
  isProgressing,
  loadDetail,
  clearAll,
  showError,
  showSuccess,
  dispatchLoading,
}) {
  const [proctorSearchQuery, setProctorSearchQuery] = useState('');
  const [proctorSearchResults, setProctorSearchResults] = useState([]);
  const [isSearchingProctors, setIsSearchingProctors] = useState(false);
  const [busyProctorUserId, setBusyProctorUserId] = useState(null);

  const onSearchProctorUsers = useCallback(async () => {
    try {
      clearAll();
      const normalizedQuery = String(proctorSearchQuery || '').trim();
      if (normalizedQuery.length < 2) {
        showError('Search query must be at least 2 characters.');
        return;
      }
      setIsSearchingProctors(true);
      const response = await searchTournamentManualAddUsers(tournamentId, {
        q: normalizedQuery,
        limit: 10,
      });
      setProctorSearchResults(response.items || []);
    } catch (error) {
      showError(formatApiError(error, 'Unable to search users'));
    } finally {
      setIsSearchingProctors(false);
    }
  }, [clearAll, proctorSearchQuery, showError, tournamentId]);

  const onAssignProctor = useCallback(
    async (userId) => {
      const normalizedUserId = String(userId || '').trim();
      const hostId = String(detail?.hostUserId || '').trim();
      if (!normalizedUserId || normalizedUserId === hostId) return;
      if ((detail?.scoreEditorUserIds || []).map(String).includes(normalizedUserId)) return;

      try {
        clearAll();
        setBusyProctorUserId(normalizedUserId);
        await assignTournamentProctor(tournamentId, normalizedUserId);
        showSuccess('Proctor assigned.');
        await loadDetail();
        await onSearchProctorUsers();
      } catch (error) {
        showError(formatApiError(error, 'Unable to assign proctor'));
      } finally {
        setBusyProctorUserId(null);
      }
    },
    [clearAll, detail?.hostUserId, detail?.scoreEditorUserIds, loadDetail, onSearchProctorUsers, showError, showSuccess, tournamentId]
  );

  const onAssignProctors = useCallback(
    async (userIds = []) => {
      const hostId = String(detail?.hostUserId || '').trim();
      const existingEditorIds = new Set((detail?.scoreEditorUserIds || []).map(String));
      const normalizedIds = [
        ...new Set(
          userIds
            .map((id) => String(id).trim())
            .filter(Boolean)
            .filter((userId) => userId !== hostId && !existingEditorIds.has(userId))
        ),
      ];

      if (normalizedIds.length === 0) return;

      try {
        clearAll();
        dispatchLoading({ type: 'set', key: 'progressing', value: true });
        let assignedCount = 0;
        for (const userId of normalizedIds) {
          await assignTournamentProctor(tournamentId, userId);
          assignedCount += 1;
        }
        showSuccess(assignedCount === 1 ? 'Proctor assigned.' : `${assignedCount} proctors assigned.`);
        await loadDetail();
        await onSearchProctorUsers();
      } catch (error) {
        showError(formatApiError(error, 'Unable to assign proctors'));
      } finally {
        dispatchLoading({ type: 'set', key: 'progressing', value: false });
      }
    },
    [clearAll, detail?.hostUserId, detail?.scoreEditorUserIds, dispatchLoading, loadDetail, onSearchProctorUsers, showError, showSuccess, tournamentId]
  );

  const onRemoveProctor = useCallback(
    async (userId) => {
      try {
        clearAll();
        setBusyProctorUserId(userId);
        await removeTournamentProctor(tournamentId, userId);
        showSuccess('Proctor removed.');
        await loadDetail();
      } catch (error) {
        showError(formatApiError(error, 'Unable to remove proctor'));
      } finally {
        setBusyProctorUserId(null);
      }
    },
    [clearAll, loadDetail, showError, showSuccess, tournamentId]
  );

  const onRequestProctorTransfer = useCallback(
    async (targetUserId) => {
      try {
        clearAll();
        dispatchLoading({ type: 'set', key: 'progressing', value: true });
        await requestTournamentProctorTransfer(tournamentId, targetUserId);
        showSuccess('Handoff requested. The other player must accept.');
        await loadDetail();
      } catch (error) {
        showError(formatApiError(error, 'Unable to request proctor transfer'));
      } finally {
        dispatchLoading({ type: 'set', key: 'progressing', value: false });
      }
    },
    [clearAll, dispatchLoading, loadDetail, showError, showSuccess, tournamentId]
  );

  const onAcceptProctorTransfer = useCallback(async () => {
    try {
      clearAll();
      dispatchLoading({ type: 'set', key: 'progressing', value: true });
      await acceptTournamentProctorTransfer(tournamentId);
      showSuccess('You are now a proctor for this tournament.');
      await loadDetail();
    } catch (error) {
      showError(formatApiError(error, 'Unable to accept proctor transfer'));
    } finally {
      dispatchLoading({ type: 'set', key: 'progressing', value: false });
    }
  }, [clearAll, dispatchLoading, loadDetail, showError, showSuccess, tournamentId]);

  const onDeclineProctorTransfer = useCallback(async () => {
    try {
      clearAll();
      dispatchLoading({ type: 'set', key: 'progressing', value: true });
      await declineTournamentProctorTransfer(tournamentId);
      showSuccess('Proctor transfer declined.');
      await loadDetail();
    } catch (error) {
      showError(formatApiError(error, 'Unable to decline proctor transfer'));
    } finally {
      dispatchLoading({ type: 'set', key: 'progressing', value: false });
    }
  }, [clearAll, dispatchLoading, loadDetail, showError, showSuccess, tournamentId]);

  const proctorProps = useMemo(
    () =>
      isHost && groupStageProctored
        ? {
            hostUserId: detail?.hostUserId || null,
            proctorUserIds: detail?.scoreEditorUserIds || [],
            approvedRoster: approvedItems,
            proctorTransferRequest: detail?.proctorTransferRequest || null,
            currentUserId,
            searchQuery: proctorSearchQuery,
            onSearchQueryChange: setProctorSearchQuery,
            onSearchUsers: onSearchProctorUsers,
            isSearchingUsers: isSearchingProctors,
            userSearchResults: proctorSearchResults,
            busyProctorUserId,
            onAssignProctor,
            onAssignProctors,
            onRemoveProctor,
            onRequestTransfer: onRequestProctorTransfer,
            onAcceptTransfer: onAcceptProctorTransfer,
            onDeclineTransfer: onDeclineProctorTransfer,
          isProgressing,
          }
        : null,
    [
      approvedItems,
      busyProctorUserId,
      currentUserId,
      detail?.hostUserId,
      detail?.proctorTransferRequest,
      detail?.scoreEditorUserIds,
      groupStageProctored,
      isHost,
      isProgressing,
      isSearchingProctors,
      onAcceptProctorTransfer,
      onAssignProctor,
      onAssignProctors,
      onDeclineProctorTransfer,
      onRemoveProctor,
      onRequestProctorTransfer,
      onSearchProctorUsers,
      proctorSearchQuery,
      proctorSearchResults,
    ]
  );

  return {
    proctorSearchQuery,
    setProctorSearchQuery,
    proctorSearchResults,
    isSearchingProctors,
    busyProctorUserId,
    onSearchProctorUsers,
    onAssignProctor,
    onAssignProctors,
    onRemoveProctor,
    onRequestProctorTransfer,
    onAcceptProctorTransfer,
    onDeclineProctorTransfer,
    proctorProps,
  };
}
