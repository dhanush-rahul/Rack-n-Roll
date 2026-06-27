import { useCallback, useEffect, useRef, useState } from 'react';
import {
  addGuestTournamentParticipant,
  approveTournamentRegistrationRequest,
  assignTournamentGroupsRandomly,
  closeTournamentRegistration,
  manuallyAddTournamentParticipant,
  rejectTournamentRegistrationRequest,
  searchTournamentManualAddUsers,
  updateHostTournamentSettings,
} from '../../services/tournamentService';
import { formatApiError } from '../useScreenFeedback';

export function useRegistrationActions({
  tournamentId,
  detail,
  isDoubles,
  soloPlayerCount,
  loadDetail,
  loadRegistrations,
  onLoadGroupFixtures,
  onLoadGroupsTab,
  gamesTabLoadStartedRef,
  groupsTabLoadStartedRef,
  clearAll,
  showError,
  showSuccess,
  dispatchLoading,
  setActiveTab,
}) {
  const initializedForTournamentRef = useRef(null);

  const [busyRegistrationId, setBusyRegistrationId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [busyManualAddUserId, setBusyManualAddUserId] = useState(null);
  const [isGuestAddConfirmVisible, setIsGuestAddConfirmVisible] = useState(false);
  const [isGuestAddFormVisible, setIsGuestAddFormVisible] = useState(false);
  const [isAddingGuestPlayer, setIsAddingGuestPlayer] = useState(false);
  const [groupCountInput, setGroupCountInput] = useState('2');
  const [groupStageBestOfInput, setGroupStageBestOfInput] = useState('3');
  const [pairTeamsRandomInput, setPairTeamsRandomInput] = useState(true);
  const [maxParticipantsInput, setMaxParticipantsInput] = useState('');
  const [isSavingMaxParticipants, setIsSavingMaxParticipants] = useState(false);

  useEffect(() => {
    if (!detail || initializedForTournamentRef.current === tournamentId) {
      return;
    }
    initializedForTournamentRef.current = tournamentId;
    setMaxParticipantsInput(String(detail?.maxParticipants || ''));
  }, [detail, tournamentId]);

  const onReviewRegistration = useCallback(
    async (registrationId, nextStatus) => {
      try {
        clearAll();
        setBusyRegistrationId(registrationId);
        if (nextStatus === 'approved') {
          await approveTournamentRegistrationRequest(tournamentId, registrationId);
        } else {
          await rejectTournamentRegistrationRequest(tournamentId, registrationId);
        }
        showSuccess(`Registration ${nextStatus}.`);
        await Promise.all([loadDetail(), loadRegistrations()]);
      } catch (error) {
        showError(formatApiError(error, 'Unable to review registration'));
      } finally {
        setBusyRegistrationId(null);
      }
    },
    [clearAll, loadDetail, loadRegistrations, showError, showSuccess, tournamentId]
  );

  const onClearUserSearch = useCallback(() => {
    setUserSearchResults([]);
    setSearchQuery('');
  }, []);

  const onSearchUsers = useCallback(async () => {
    try {
      clearAll();
      const normalizedQuery = String(searchQuery || '').trim();
      if (normalizedQuery.length < 2) {
        showError('Search query must be at least 2 characters.');
        return;
      }
      setIsSearchingUsers(true);
      const response = await searchTournamentManualAddUsers(tournamentId, {
        q: normalizedQuery,
        limit: 10,
      });
      setUserSearchResults(response.items || []);
    } catch (error) {
      showError(formatApiError(error, 'Unable to search users'));
    } finally {
      setIsSearchingUsers(false);
    }
  }, [clearAll, searchQuery, showError, tournamentId]);

  const onManualAddParticipant = useCallback(
    async (userId) => {
      try {
        clearAll();
        setBusyManualAddUserId(userId);
        const result = await manuallyAddTournamentParticipant(tournamentId, userId);
        const groupSync = result?.groupSync;

        if (groupSync?.gamesCreated > 0) {
          showSuccess(
            `Player added to ${groupSync.divisionName || 'a group'} with ${groupSync.gamesCreated} new fixtures.`
          );
          gamesTabLoadStartedRef.current = false;
          groupsTabLoadStartedRef.current = false;
          await Promise.all([onLoadGroupFixtures(), onLoadGroupsTab()]);
        } else if (groupSync?.alreadyAssigned) {
          showSuccess('Player added. They were already assigned to a group.');
        } else {
          showSuccess('Participant added to the roster.');
        }

        await Promise.all([loadDetail(), loadRegistrations()]);
        setUserSearchResults((current) => current.filter((user) => String(user.id) !== String(userId)));
      } catch (error) {
        showError(formatApiError(error, 'Unable to add participant'));
      } finally {
        setBusyManualAddUserId(null);
      }
    },
    [
      clearAll,
      gamesTabLoadStartedRef,
      groupsTabLoadStartedRef,
      loadDetail,
      loadRegistrations,
      onLoadGroupFixtures,
      onLoadGroupsTab,
      showError,
      showSuccess,
      tournamentId,
    ]
  );

  const onOpenAddGuestPlayer = useCallback(() => {
    clearAll();
    setIsGuestAddConfirmVisible(true);
  }, [clearAll]);

  const onConfirmGuestAddIntro = useCallback(() => {
    setIsGuestAddConfirmVisible(false);
    setIsGuestAddFormVisible(true);
  }, []);

  const onSubmitGuestPlayer = useCallback(
    async ({ name, email }) => {
      try {
        clearAll();
        setIsAddingGuestPlayer(true);
        const result = await addGuestTournamentParticipant(tournamentId, { name, email });
        const groupSync = result?.groupSync;

        if (result?.linkedImmediately) {
          if (groupSync?.gamesCreated > 0) {
            showSuccess(
              `Existing user added to ${groupSync.divisionName || 'a group'} with ${groupSync.gamesCreated} new fixtures.`
            );
            gamesTabLoadStartedRef.current = false;
            groupsTabLoadStartedRef.current = false;
            await Promise.all([onLoadGroupFixtures(), onLoadGroupsTab()]);
          } else {
            showSuccess('Existing user added to the roster.');
          }
        } else if (groupSync?.gamesCreated > 0) {
          showSuccess(
            `Added ${name}. Invite email sent. Placed in ${groupSync.divisionName || 'a group'} with ${groupSync.gamesCreated} new fixtures.`
          );
          gamesTabLoadStartedRef.current = false;
          groupsTabLoadStartedRef.current = false;
          await Promise.all([onLoadGroupFixtures(), onLoadGroupsTab()]);
        } else if (result?.inviteEmailSent) {
          showSuccess(`Added ${name}. Invite email sent.`);
        } else {
          showSuccess(`Added ${name} to the roster. Invite email could not be sent right now.`);
        }

        setIsGuestAddFormVisible(false);
        await Promise.all([loadDetail(), loadRegistrations()]);
      } catch (error) {
        showError(formatApiError(error, 'Unable to add guest player'));
      } finally {
        setIsAddingGuestPlayer(false);
      }
    },
    [
      clearAll,
      gamesTabLoadStartedRef,
      groupsTabLoadStartedRef,
      loadDetail,
      loadRegistrations,
      onLoadGroupFixtures,
      onLoadGroupsTab,
      showError,
      showSuccess,
      tournamentId,
    ]
  );

  const onSaveMaxParticipants = useCallback(async () => {
    const parsedValue = Number(maxParticipantsInput);
    if (!Number.isInteger(parsedValue) || parsedValue < 1) {
      showError('Target roster size must be a whole number of at least 1.');
      return;
    }
    try {
      clearAll();
      setIsSavingMaxParticipants(true);
      const updated = await updateHostTournamentSettings(tournamentId, { maxParticipants: parsedValue });
      setMaxParticipantsInput(String(updated?.maxParticipants || parsedValue));
      showSuccess('Target roster size updated.');
      await loadDetail();
    } catch (error) {
      showError(formatApiError(error, 'Unable to update target roster size'));
    } finally {
      setIsSavingMaxParticipants(false);
    }
  }, [clearAll, loadDetail, maxParticipantsInput, showError, showSuccess, tournamentId]);

  const onCloseRegistration = useCallback(async () => {
    try {
      clearAll();
      dispatchLoading({ type: 'set', key: 'progressing', value: true });
      await closeTournamentRegistration(tournamentId);
      showSuccess('Registration closed.');
      await Promise.all([loadDetail(), loadRegistrations()]);
    } catch (error) {
      showError(formatApiError(error, 'Unable to close registration'));
    } finally {
      dispatchLoading({ type: 'set', key: 'progressing', value: false });
    }
  }, [clearAll, dispatchLoading, loadDetail, loadRegistrations, showError, showSuccess, tournamentId]);

  const onAssignGroups = useCallback(async () => {
    try {
      clearAll();
      dispatchLoading({ type: 'set', key: 'progressing', value: true });
      const response = await assignTournamentGroupsRandomly(tournamentId, {
        groupCount: Number(groupCountInput),
        groupStageBestOf: Number(groupStageBestOfInput),
        ...(isDoubles && soloPlayerCount > 0 ? { pairTeamsRandom: pairTeamsRandomInput } : {}),
      });
      const fixtureCount = (response.gameSummary || []).reduce(
        (total, summary) => total + Number(summary.gameCount || 0),
        0
      );
      const perGroupSummary = (response.gameSummary || [])
        .map((summary) => `${summary.divisionName || 'Group'}: ${summary.gameCount}`)
        .join(' • ');
      showSuccess(
        `Assigned ${response.groupCount} groups with ${fixtureCount} fixtures${perGroupSummary ? ` (${perGroupSummary})` : ''}.`
      );
      gamesTabLoadStartedRef.current = false;
      groupsTabLoadStartedRef.current = false;
      await Promise.all([loadDetail(), onLoadGroupFixtures(), onLoadGroupsTab()]);
      setActiveTab('games');
    } catch (error) {
      showError(formatApiError(error, 'Unable to assign groups'));
    } finally {
      dispatchLoading({ type: 'set', key: 'progressing', value: false });
    }
  }, [
    clearAll,
    dispatchLoading,
    gamesTabLoadStartedRef,
    groupCountInput,
    groupStageBestOfInput,
    groupsTabLoadStartedRef,
    isDoubles,
    loadDetail,
    onLoadGroupFixtures,
    onLoadGroupsTab,
    pairTeamsRandomInput,
    setActiveTab,
    showError,
    showSuccess,
    soloPlayerCount,
    tournamentId,
  ]);

  return {
    busyRegistrationId,
    searchQuery,
    setSearchQuery,
    isSearchingUsers,
    userSearchResults,
    busyManualAddUserId,
    isGuestAddConfirmVisible,
    setIsGuestAddConfirmVisible,
    isGuestAddFormVisible,
    setIsGuestAddFormVisible,
    isAddingGuestPlayer,
    groupCountInput,
    setGroupCountInput,
    groupStageBestOfInput,
    setGroupStageBestOfInput,
    pairTeamsRandomInput,
    setPairTeamsRandomInput,
    maxParticipantsInput,
    setMaxParticipantsInput,
    isSavingMaxParticipants,
    onReviewRegistration,
    onSearchUsers,
    onClearUserSearch,
    onManualAddParticipant,
    onOpenAddGuestPlayer,
    onConfirmGuestAddIntro,
    onSubmitGuestPlayer,
    onSaveMaxParticipants,
    onCloseRegistration,
    onAssignGroups,
  };
}
