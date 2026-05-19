import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ConfirmModal } from '../components/ConfirmModal';
import { FeedbackModal } from '../components/FeedbackModal';
import { useAuth } from '../context/AuthContext';
import { useGroupStageFixtures } from '../hooks/useGroupStageFixtures';
import { useGroupStandings } from '../hooks/useGroupStandings';
import { formatApiError, useScreenFeedback } from '../hooks/useScreenFeedback';
import { useScoreInputs } from '../hooks/useScoreInputs';
import {
  approveTournamentRegistrationRequest,
  assignTournamentGroupsRandomly,
  closeTournamentRegistration,
  completeTournamentWithFinalStage,
  completeTournamentWithoutFinalStage,
  fetchHostTournamentDetail,
  fetchHostTournamentRegistrations,
  fetchTournamentGroupStandings,
  fetchTournamentScoresheet,
  manuallyAddTournamentParticipant,
  rejectTournamentRegistrationRequest,
  searchTournamentManualAddUsers,
  startTournamentFinalStage,
  updateHostTournamentSettings,
} from '../services/tournamentService';
import { tournamentUi } from '../styles/tournamentUi';
import {
  buildFixtureSectionsFromGames,
  buildPlayerGameStatsFromGames,
  countFixtureMatches,
  findActiveFixtureRoundKey,
  findActiveFixtureRoundKeyForSection,
} from '../utils/fixtureDisplay';
import { FinalePlayerModal } from './tournamentDetail/FinalePlayerModal';
import { FinaleTab } from './tournamentDetail/FinaleTab';
import { GamesTab } from './tournamentDetail/GamesTab';
import { GroupsTab } from './tournamentDetail/GroupsTab';
import { HostInfoModal } from './tournamentDetail/HostInfoModal';
import { RegistrationsTab } from './tournamentDetail/RegistrationsTab';
import {
  formatProgressionLabel,
  SuccessBanner,
  TournamentScreenHero,
} from '../components/tournament/TournamentChrome';
import { TournamentTabBar } from './tournamentDetail/TournamentTabBar';

const isPlayedScoreEntry = (entry) => {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return false;
  }

  return !(playerAScore === 0 && playerBScore === 0);
};

const initialLoadingState = {
  detail: false,
  registrations: false,
  games: false,
  groups: false,
  finale: false,
  progressing: false,
};

function loadingReducer(state, action) {
  if (action.type === 'set') {
    return { ...state, [action.key]: Boolean(action.value) };
  }

  if (action.type === 'merge') {
    return { ...state, ...action.payload };
  }

  return state;
}

export function TournamentDetailScreen({ route, navigation }) {
  const tournamentId = route?.params?.tournamentId;
  const { currentUser } = useAuth();

  const [activeTab, setActiveTab] = useState('registrations');
  const [detail, setDetail] = useState(null);
  const [registrations, setRegistrations] = useState([]);
  const [loading, dispatchLoading] = useReducer(loadingReducer, initialLoadingState);

  const {
    errorMessage,
    successMessage,
    showError,
    showSuccess,
    clearError,
    clearSuccess,
    clearAll,
  } = useScreenFeedback();

  const [isHostInfoModalVisible, setIsHostInfoModalVisible] = useState(false);
  const [maxParticipantsInput, setMaxParticipantsInput] = useState('');
  const [isSavingMaxParticipants, setIsSavingMaxParticipants] = useState(false);

  const [finalStageGames, setFinalStageGames] = useState([]);
  const [canEditFinalScores, setCanEditFinalScores] = useState(false);
  const [expandedRoundKey, setExpandedRoundKey] = useState(null);
  const [expandedSectionId, setExpandedSectionId] = useState(null);
  const groupsTabLoadStartedRef = useRef(false);
  const gamesTabLoadStartedRef = useRef(false);
  const groupsPrefetchStartedRef = useRef(false);
  const finaleTabLoadStartedRef = useRef(false);
  const finaleExpandInitializedRef = useRef(false);
  const toggleHostInfoRef = useRef(() => {});

  const [busyRegistrationId, setBusyRegistrationId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearchingUsers, setIsSearchingUsers] = useState(false);
  const [userSearchResults, setUserSearchResults] = useState([]);
  const [busyManualAddUserId, setBusyManualAddUserId] = useState(null);
  const [groupCountInput, setGroupCountInput] = useState('2');
  const [groupStageBestOfInput, setGroupStageBestOfInput] = useState('3');
  const [finalBestOfInput, setFinalBestOfInput] = useState('3');
  const [winnersPerGroupInput] = useState('3');
  const [groupStandings, setGroupStandings] = useState([]);
  const [suggestedFinalistIds, setSuggestedFinalistIds] = useState({});
  const [selectedFinalistIds, setSelectedFinalistIds] = useState({});
  const [isFinaleModalVisible, setIsFinaleModalVisible] = useState(false);
  const [finaleActionConfirm, setFinaleActionConfirm] = useState(null);
  const [tournamentCompleteMessage, setTournamentCompleteMessage] = useState('');
  const [isFinaleLaunchConfirmVisible, setIsFinaleLaunchConfirmVisible] = useState(false);
  const [isLoadingFinaleCandidates, setIsLoadingFinaleCandidates] = useState(false);

  const {
    groupsTabItems,
    groupPlayerGameStatsById,
    isLoading: isLoadingGroupsTab,
    refreshGroupsTabData,
    loadGroupsTab,
  } = useGroupStandings(tournamentId);

  const groupStageBestOf = detail?.competitionConfig?.groupStageBestOf;
  const configuredFinalStageBestOfFromDetail = detail?.competitionConfig?.finalStageBestOf;

  const groupFixtures = useGroupStageFixtures(tournamentId, groupsTabItems, groupStageBestOf);

  const scoreInputs = useScoreInputs({
    groupStageBestOf,
    finalStageBestOf: configuredFinalStageBestOfFromDetail ?? finalBestOfInput,
  });

  const {
    games: groupStageGames,
    loadAll: loadAllGroupFixtures,
    applyFilter: applyGroupFixturesFilter,
    refresh: refreshGroupFixtures,
    displaySections: groupDisplaySections,
  } = groupFixtures;
  const { hydrateScoreInputState, saveMatchScores: saveMatchScoresFromInputs } = scoreInputs;

  const progressionState = detail?.progressionState || 'registration';
  const isHost = String(detail?.hostUserId || '') === String(currentUser?.id || '');
  const isRegistrationClosed = detail?.registrationStatus === 'closed';
  const canShowCloseRegistrationStep = !isRegistrationClosed;
  const canShowGroupAssignmentStep = isRegistrationClosed && progressionState === 'groupSetup';
  const canShowFinalStageStep = progressionState === 'groupStage';
  const hasFinalStageStarted = progressionState === 'finalStage';
  const isTournamentCompleted = progressionState === 'completed' || detail?.status === 'completed';

  const hasGroupFixtures =
    groupStageGames.length > 0 ||
    groupFixtures.fixtureTotal > 0 ||
    Number(detail?.competitionConfig?.groupCount || 0) > 0;

  const configuredFinalStageBestOf = useMemo(
    () => Math.max(Number(configuredFinalStageBestOfFromDetail ?? finalBestOfInput ?? 3), 1),
    [configuredFinalStageBestOfFromDetail, finalBestOfInput]
  );

  const pendingItems = useMemo(
    () => registrations.filter((item) => item.status === 'underReview'),
    [registrations]
  );

  const approvedItems = useMemo(
    () => registrations.filter((item) => item.status === 'approved'),
    [registrations]
  );

  const isCloseDisabled = Number(approvedItems.length || 0) < 2;

  const selectedFinalistCount = useMemo(
    () => Object.values(selectedFinalistIds).filter((selected) => Boolean(selected)).length,
    [selectedFinalistIds]
  );

  const shouldShowFinaleTab =
    canShowFinalStageStep || hasFinalStageStarted || finalStageGames.length > 0;

  const canStartFinale = !loading.progressing && !isLoadingFinaleCandidates && selectedFinalistCount >= 2;

  const liveGroupPlayerGameStats = useMemo(
    () => buildPlayerGameStatsFromGames(groupStageGames),
    [groupStageGames]
  );

  const resolvePlayerGameStats = useCallback(
    (entry) => {
      const playerId = String(entry?.playerId || '').trim();
      const userId = String(entry?.player?.userId || '').trim();

      return (
        groupPlayerGameStatsById[playerId] ||
        (userId ? groupPlayerGameStatsById[userId] : null) ||
        liveGroupPlayerGameStats[playerId] ||
        (userId ? liveGroupPlayerGameStats[userId] : null) || {
          gamesPlayed: 0,
          gamesRemaining: 0,
        }
      );
    },
    [groupPlayerGameStatsById, liveGroupPlayerGameStats]
  );

  const loadFinalStageScores = useCallback(
    async ({ hydrateInputs = false } = {}) => {
      const items = [];
      let page = 1;
      let totalPages = 1;

      while (page <= totalPages) {
        const response = await fetchTournamentScoresheet(tournamentId, {
          page,
          pageSize: 100,
          stage: 'finalStage',
        });

        if (page === 1) {
          setCanEditFinalScores(Boolean(response.canEdit));
          totalPages = Math.max(response.pagination?.totalPages || 0, 1);

          if ((response.pagination?.totalPages || 0) === 0) {
            totalPages = 0;
          }
        }

        items.push(...(response.items || []));

        if (totalPages === 0) {
          break;
        }

        page += 1;
      }

      setFinalStageGames(items);

      if (hydrateInputs) {
        hydrateScoreInputState(items);
      }

      return items;
    },
    [hydrateScoreInputState, tournamentId]
  );

  const finalDivisionNameById = useMemo(() => {
    const names = new Map();

    (finalStageGames || []).forEach((game) => {
      const divisionId = String(game.divisionId || 'final-stage').trim() || 'final-stage';
      const divisionName = String(game.divisionName || '').trim();

      if (divisionId && divisionName) {
        names.set(divisionId, divisionName);
      }
    });

    if (names.size === 0) {
      names.set('final-stage', 'Final Stage');
    }

    return names;
  }, [finalStageGames]);

  const finalDisplaySections = useMemo(
    () =>
      buildFixtureSectionsFromGames(finalStageGames, {
        divisionNameById: finalDivisionNameById,
        groupStageBestOf: configuredFinalStageBestOf,
        isPlayedScoreEntry,
      }),
    [configuredFinalStageBestOf, finalDivisionNameById, finalStageGames]
  );

  const finalFixtureSummaryText = useMemo(() => {
    const loadedCount = countFixtureMatches(finalDisplaySections);

    if (loadedCount === 0) {
      return '';
    }

    return `${loadedCount} finale ${loadedCount === 1 ? 'match' : 'matches'} • Best of ${configuredFinalStageBestOf} series`;
  }, [configuredFinalStageBestOf, finalDisplaySections]);

  const activeFinalRoundKey = useMemo(
    () => findActiveFixtureRoundKey(finalDisplaySections),
    [finalDisplaySections]
  );

  const firstFinalSectionId = finalDisplaySections[0]?.sectionId ?? null;

  const finalStagePlayers = useMemo(() => {
    const statsByPlayerId = new Map();

    const ensureStats = (playerId, playerName) => {
      const normalizedPlayerId = String(playerId || '');

      if (!normalizedPlayerId) {
        return null;
      }

      if (!statsByPlayerId.has(normalizedPlayerId)) {
        statsByPlayerId.set(normalizedPlayerId, {
          playerId: normalizedPlayerId,
          playerName: playerName || normalizedPlayerId,
          wins: 0,
          losses: 0,
          points: 0,
        });
      }

      return statsByPlayerId.get(normalizedPlayerId);
    };

    (finalStageGames || []).forEach((game) => {
      const playerAStats = ensureStats(
        game.playerA?.id || game.playerAId,
        game.playerA?.displayName || game.playerAId
      );
      const playerBStats = ensureStats(
        game.playerB?.id || game.playerBId,
        game.playerB?.displayName || game.playerBId
      );

      if (!playerAStats || !playerBStats) {
        return;
      }

      const playerASeriesWins = Number(game.playerASeriesWins || 0);
      const playerBSeriesWins = Number(game.playerBSeriesWins || 0);

      if (playerASeriesWins > playerBSeriesWins) {
        playerAStats.wins += 1;
        playerAStats.points += 2;
        playerBStats.losses += 1;
        return;
      }

      if (playerBSeriesWins > playerASeriesWins) {
        playerBStats.wins += 1;
        playerBStats.points += 2;
        playerAStats.losses += 1;
      }
    });

    return [...statsByPlayerId.values()]
      .sort((left, right) => {
        if (right.points !== left.points) {
          return right.points - left.points;
        }

        if (right.wins !== left.wins) {
          return right.wins - left.wins;
        }

        if (left.losses !== right.losses) {
          return left.losses - right.losses;
        }

        return left.playerName.localeCompare(right.playerName);
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));
  }, [finalStageGames]);

  const loadDetail = useCallback(async () => {
    dispatchLoading({ type: 'set', key: 'detail', value: true });

    try {
      const response = await fetchHostTournamentDetail(tournamentId);
      setDetail(response);
      setMaxParticipantsInput(String(response?.maxParticipants || ''));
      setActiveTab(
        response?.progressionState === 'groupStage'
          ? 'games'
          : response?.progressionState === 'finalStage'
            ? 'finale'
            : response?.registrationStatus === 'closed'
              ? 'groups'
              : 'registrations'
      );
    } finally {
      dispatchLoading({ type: 'set', key: 'detail', value: false });
    }
  }, [tournamentId]);

  const loadRegistrations = useCallback(async () => {
    dispatchLoading({ type: 'set', key: 'registrations', value: true });

    try {
      const response = await fetchHostTournamentRegistrations(tournamentId, { page: 1, pageSize: 100 });
      setRegistrations(response.items || []);
    } finally {
      dispatchLoading({ type: 'set', key: 'registrations', value: false });
    }
  }, [tournamentId]);

  const bootstrap = useCallback(async () => {
    try {
      clearError();
      await Promise.all([loadDetail(), loadRegistrations()]);
    } catch (error) {
      showError(formatApiError(error, 'Unable to load tournament detail'));
    }
  }, [clearError, loadDetail, loadRegistrations, showError]);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    groupsTabLoadStartedRef.current = false;
    gamesTabLoadStartedRef.current = false;
    groupsPrefetchStartedRef.current = false;
    finaleTabLoadStartedRef.current = false;
    finaleExpandInitializedRef.current = false;
  }, [tournamentId]);

  toggleHostInfoRef.current = () => {
    setIsHostInfoModalVisible(true);
  };

  const onLoadGroupFixtures = useCallback(async () => {
    try {
      clearError();
      clearSuccess();
      dispatchLoading({ type: 'set', key: 'games', value: true });
      const items = await loadAllGroupFixtures();
      hydrateScoreInputState(items);
    } catch (error) {
      showError(formatApiError(error, 'Unable to load group fixtures'));
    } finally {
      dispatchLoading({ type: 'set', key: 'games', value: false });
    }
  }, [clearError, clearSuccess, hydrateScoreInputState, loadAllGroupFixtures, showError]);

  const onLoadGroupsTab = useCallback(async () => {
    try {
      dispatchLoading({ type: 'set', key: 'groups', value: true });
      clearError();
      await Promise.all([loadGroupsTab(), loadFinalStageScores()]);
    } catch (error) {
      showError(formatApiError(error, 'Unable to load groups'));
    } finally {
      dispatchLoading({ type: 'set', key: 'groups', value: false });
    }
  }, [clearError, loadFinalStageScores, loadGroupsTab, showError]);

  const onLoadFinaleTab = useCallback(async () => {
    try {
      clearError();
      dispatchLoading({ type: 'set', key: 'finale', value: true });
      await loadFinalStageScores({ hydrateInputs: true });
    } catch (error) {
      setFinalStageGames([]);
      showError(formatApiError(error, 'Unable to load finale matches'));
    } finally {
      dispatchLoading({ type: 'set', key: 'finale', value: false });
    }
  }, [clearError, loadFinalStageScores, showError]);

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
        await onSearchUsers();
      } catch (error) {
        showError(formatApiError(error, 'Unable to add participant'));
      } finally {
        setBusyManualAddUserId(null);
      }
    },
    [
      clearAll,
      loadDetail,
      loadRegistrations,
      onLoadGroupFixtures,
      onLoadGroupsTab,
      onSearchUsers,
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
      setDetail(updated);
      setMaxParticipantsInput(String(updated?.maxParticipants || parsedValue));
      showSuccess('Target roster size updated.');
    } catch (error) {
      showError(formatApiError(error, 'Unable to update target roster size'));
    } finally {
      setIsSavingMaxParticipants(false);
    }
  }, [clearAll, maxParticipantsInput, showError, showSuccess, tournamentId]);

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
  }, [clearAll, loadDetail, loadRegistrations, showError, showSuccess, tournamentId]);

  const onAssignGroups = useCallback(async () => {
    try {
      clearAll();
      dispatchLoading({ type: 'set', key: 'progressing', value: true });
      const response = await assignTournamentGroupsRandomly(tournamentId, {
        groupCount: Number(groupCountInput),
        groupStageBestOf: Number(groupStageBestOfInput),
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
    groupCountInput,
    groupStageBestOfInput,
    loadDetail,
    onLoadGroupFixtures,
    onLoadGroupsTab,
    showError,
    showSuccess,
    tournamentId,
  ]);

  const onStartFinalStage = useCallback(async () => {
    try {
      clearAll();
      dispatchLoading({ type: 'set', key: 'progressing', value: true });
      const selectedPlayerIds = Object.entries(selectedFinalistIds)
        .filter(([, selected]) => Boolean(selected))
        .map(([playerId]) => playerId);

      if (selectedPlayerIds.length < 2) {
        showError('Select at least 2 finalists to start finale.');
        dispatchLoading({ type: 'set', key: 'progressing', value: false });
        return;
      }

      const response = await startTournamentFinalStage(tournamentId, {
        topPerGroup: 2,
        finalStageBestOf: Number(finalBestOfInput),
        selectedPlayerIds,
      });
      showSuccess(`Final stage started with ${response.finalistCount} players.`);
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
    finalBestOfInput,
    loadDetail,
    loadFinalStageScores,
    onLoadGroupsTab,
    selectedFinalistIds,
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
        (group.suggestedFinalists || []).forEach((playerId) => {
          suggestedSelection[playerId] = true;
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
  }, [clearAll, showError, showSuccess, tournamentId]);

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
  }, [clearAll, loadDetail, onLoadGroupsTab, showError, tournamentId, winnersPerGroupInput]);

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
      showSuccess('Tournament completed using finale results.');
      await Promise.all([loadDetail(), onLoadFinaleTab(), onLoadGroupsTab()]);
    } catch (error) {
      showError(formatApiError(error, 'Unable to complete tournament from finale'));
    } finally {
      dispatchLoading({ type: 'set', key: 'progressing', value: false });
    }
  }, [clearAll, loadDetail, onLoadFinaleTab, onLoadGroupsTab, showError, showSuccess, tournamentId]);

  const onApplyGamesFilter = useCallback(async () => {
    try {
      clearError();
      dispatchLoading({ type: 'set', key: 'games', value: true });
      const matches = await applyGroupFixturesFilter();
      hydrateScoreInputState(matches);
    } catch (error) {
      showError(formatApiError(error, 'Unable to filter matches'));
    } finally {
      dispatchLoading({ type: 'set', key: 'games', value: false });
    }
  }, [applyGroupFixturesFilter, clearError, hydrateScoreInputState, showError]);

  const onSaveMatchScores = useCallback(
    async (payload) => {
      try {
        clearError();
        clearSuccess();

        await saveMatchScoresFromInputs({
          tournamentId,
          ...payload,
          groupStageGames: groupStageGames,
          finalStageGames,
          onSuccess: async ({ isFinalStageGame }) => {
            showSuccess('Match scores saved.');

            if (isFinalStageGame) {
              await onLoadFinaleTab();
              return;
            }

            const refreshed = await refreshGroupFixtures({ preserveFilter: true });
            hydrateScoreInputState(refreshed);
            await refreshGroupsTabData();
          },
        });
      } catch (error) {
        if (error?.code === 'VALIDATION') {
          showError(error.message);
          return;
        }

        showError(formatApiError(error, 'Unable to save match scores'));
      }
    },
    [
      clearError,
      clearSuccess,
      finalStageGames,
      groupStageGames,
      hydrateScoreInputState,
      onLoadFinaleTab,
      refreshGroupFixtures,
      refreshGroupsTabData,
      saveMatchScoresFromInputs,
      showError,
      showSuccess,
      tournamentId,
    ]
  );

  useLayoutEffect(() => {
    navigation.setParams({
      onInfoPress: () => toggleHostInfoRef.current(),
    });
  }, [navigation, tournamentId]);

  useEffect(() => {
    if (activeTab !== 'groups' || groupsTabLoadStartedRef.current) {
      return;
    }

    groupsTabLoadStartedRef.current = true;
    onLoadGroupsTab();
  }, [activeTab, onLoadGroupsTab]);

  useEffect(() => {
    if (activeTab !== 'games') {
      return;
    }

    if (groupsTabItems.length === 0 && !groupsPrefetchStartedRef.current) {
      groupsPrefetchStartedRef.current = true;
      refreshGroupsTabData().catch(() => {});
    }

    if (gamesTabLoadStartedRef.current) {
      return;
    }

    gamesTabLoadStartedRef.current = true;
    onLoadGroupFixtures();
  }, [activeTab, groupsTabItems.length, onLoadGroupFixtures, refreshGroupsTabData]);

  useEffect(() => {
    if (activeTab !== 'finale' || finaleTabLoadStartedRef.current) {
      return;
    }

    finaleTabLoadStartedRef.current = true;
    onLoadFinaleTab();
  }, [activeTab, onLoadFinaleTab]);

  useEffect(() => {
    if (activeTab !== 'finale' || !firstFinalSectionId || finaleExpandInitializedRef.current) {
      return;
    }

    finaleExpandInitializedRef.current = true;
    setExpandedSectionId((previousSectionId) => previousSectionId || firstFinalSectionId);
    setExpandedRoundKey((previousRoundKey) => previousRoundKey || activeFinalRoundKey);
  }, [activeFinalRoundKey, activeTab, firstFinalSectionId]);

  const onToggleRound = useCallback((roundKey) => {
    setExpandedRoundKey((previousState) => (previousState === roundKey ? null : roundKey));
  }, []);

  const onToggleSection = useCallback(
    (sectionId) => {
      setExpandedSectionId((previousSectionId) => {
        if (previousSectionId === sectionId) {
          setExpandedRoundKey(null);
          return null;
        }

        const sections = activeTab === 'finale' ? finalDisplaySections : groupDisplaySections;
        const section = sections.find((item) => item.sectionId === sectionId);
        setExpandedRoundKey(findActiveFixtureRoundKeyForSection(section));
        return sectionId;
      });
    },
    [activeTab, finalDisplaySections, groupDisplaySections]
  );

  const isLoadingGames = loading.games || groupFixtures.isLoading;
  const tournamentTitle = route?.params?.tournamentName || detail?.name || 'Tournament';

  return (
    <ScrollView style={tournamentUi.screen} contentContainerStyle={tournamentUi.content} removeClippedSubviews={false}>
      <View style={{ marginBottom: 16 }}>
        <TournamentScreenHero
          eyebrow="HOST DASHBOARD"
          title={tournamentTitle}
          subtitle="Tap for tournament snapshot · manage players, groups, and fixtures."
          onPress={() => setIsHostInfoModalVisible(true)}
          badges={[
            {
              label: detail?.registrationStatus === 'closed' ? 'Registration closed' : 'Registration open',
              tone: detail?.registrationStatus === 'closed' ? 'warning' : 'success',
            },
            { label: formatProgressionLabel(progressionState), tone: 'primary' },
            { label: 'Host view', tone: 'host' },
          ]}
          stats={[
            {
              label: 'ROSTER',
              value: `${approvedItems.length} · target ${detail?.maxParticipants || '—'}`,
              accent: '#86efac',
            },
            {
              label: 'PENDING',
              value: String(pendingItems.length),
              accent: '#fde68a',
            },
            {
              label: 'GROUPS',
              value: String(detail?.competitionConfig?.groupCount || groupsTabItems.length || 0),
            },
          ]}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <TournamentTabBar
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          shouldShowFinaleTab={shouldShowFinaleTab}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <SuccessBanner message={successMessage} />
      </View>

      {activeTab === 'registrations' && (
        <RegistrationsTab
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearchUsers={onSearchUsers}
          isSearchingUsers={isSearchingUsers}
          userSearchResults={userSearchResults}
          busyManualAddUserId={busyManualAddUserId}
          onManualAddParticipant={onManualAddParticipant}
          pendingItems={pendingItems}
          approvedItems={approvedItems}
          isLoadingRegistrations={loading.registrations}
          busyRegistrationId={busyRegistrationId}
          onReviewRegistration={onReviewRegistration}
          isRegistrationClosed={isRegistrationClosed}
          isCloseDisabled={isCloseDisabled}
          isProgressing={loading.progressing}
          onCloseRegistration={onCloseRegistration}
          onGoToGroupsTab={() => setActiveTab('groups')}
          maxParticipantsInput={maxParticipantsInput}
          onMaxParticipantsInputChange={setMaxParticipantsInput}
          onSaveMaxParticipants={onSaveMaxParticipants}
          isSavingMaxParticipants={isSavingMaxParticipants}
        />
      )}

      {activeTab === 'groups' && (
        <GroupsTab
          canShowGroupAssignmentStep={canShowGroupAssignmentStep}
          hasGroupFixtures={hasGroupFixtures}
          groupCountInput={groupCountInput}
          onGroupCountChange={setGroupCountInput}
          groupStageBestOfInput={groupStageBestOfInput}
          onGroupStageBestOfChange={setGroupStageBestOfInput}
          isProgressing={loading.progressing}
          onAssignGroups={onAssignGroups}
          isLoadingGroupsTab={isLoadingGroupsTab || loading.groups}
          onLoadGroupsTab={onLoadGroupsTab}
          finalStagePlayers={finalStagePlayers}
          groupsTabItems={groupsTabItems}
          resolvePlayerGameStats={resolvePlayerGameStats}
          isHost={isHost}
          configuredGroupCount={detail?.competitionConfig?.groupCount}
          groupStageBestOf={groupStageBestOf}
          isTournamentCompleted={isTournamentCompleted}
        />
      )}

      {activeTab === 'games' && (
        <GamesTab
          isRegistrationClosed={isRegistrationClosed}
          hasGroupFixtures={hasGroupFixtures}
          isLoadingGames={isLoadingGames}
          isGamesFilterExpanded={groupFixtures.isFilterExpanded}
          onToggleGamesFilter={groupFixtures.toggleFilterExpanded}
          onRefreshGames={onLoadGroupFixtures}
          playerFilterInput={groupFixtures.playerFilterInput}
          onPlayerFilterInputChange={groupFixtures.setPlayerFilterInput}
          opponentFilterInput={groupFixtures.opponentFilterInput}
          onOpponentFilterInputChange={groupFixtures.setOpponentFilterInput}
          onClearGamesFilter={groupFixtures.clearFilter}
          onApplyGamesFilter={onApplyGamesFilter}
          hasActiveGamesFilter={groupFixtures.hasActiveGamesFilter}
          displaySections={groupFixtures.displaySections}
          fixtureSummaryText={groupFixtures.fixtureSummaryText}
          expandedSectionId={expandedSectionId}
          onToggleSection={onToggleSection}
          expandedRoundKey={expandedRoundKey}
          onToggleRound={onToggleRound}
          scoreInputsByGameId={scoreInputs.scoreInputsByGameId}
          onChangeScoreInput={scoreInputs.onChangeScoreInput}
          defaultSeriesMaxGames={Math.max(Number(groupStageBestOf || 1), 1)}
          savingGameId={scoreInputs.savingGameId}
          onSaveMatchScores={onSaveMatchScores}
          canEditGamesScores={groupFixtures.canEdit}
          activeRoundKey={groupFixtures.activeRoundKey}
          canShowFinalStageStep={canShowFinalStageStep && !isTournamentCompleted}
          isProgressing={loading.progressing}
          isLoadingFinaleCandidates={isLoadingFinaleCandidates}
          onRequestStartFinale={() => setFinaleActionConfirm('start')}
          onRequestSkipFinale={() => setFinaleActionConfirm('skip')}
          onAddSeriesGame={scoreInputs.onAddSeriesGame}
        />
      )}

      {activeTab === 'finale' && (
        <FinaleTab
          canEditFinalScores={canEditFinalScores}
          isLoadingFinaleTab={loading.finale}
          onLoadFinaleTab={onLoadFinaleTab}
          finalDisplaySections={finalDisplaySections}
          finalFixtureSummaryText={finalFixtureSummaryText}
          expandedSectionId={expandedSectionId}
          onToggleSection={onToggleSection}
          expandedRoundKey={expandedRoundKey}
          onToggleRound={onToggleRound}
          scoreInputsByGameId={scoreInputs.scoreInputsByGameId}
          onChangeScoreInput={scoreInputs.onChangeScoreInput}
          configuredFinalStageBestOf={configuredFinalStageBestOf}
          savingGameId={scoreInputs.savingGameId}
          onSaveMatchScores={onSaveMatchScores}
          activeFinalRoundKey={activeFinalRoundKey}
          isProgressing={loading.progressing}
          hasFinalStageStarted={hasFinalStageStarted}
          onCompleteWithFinale={onCompleteWithFinale}
        />
      )}

      <FeedbackModal visible={Boolean(errorMessage)} message={errorMessage} onDismiss={clearError} />

      <FeedbackModal
        visible={Boolean(tournamentCompleteMessage)}
        title="Tournament complete"
        message={tournamentCompleteMessage}
        emoji="🏆"
        onDismiss={() => setTournamentCompleteMessage('')}
      />

      <ConfirmModal
        visible={finaleActionConfirm === 'start'}
        emoji="🏆"
        title="Start finale?"
        message="You will choose finalists from group standings and create knockout matches. Group-stage fixtures stay as they are."
        confirmLabel="Continue"
        cancelLabel="Not yet"
        onConfirm={onConfirmFinaleAction}
        onCancel={() => setFinaleActionConfirm(null)}
        isLoading={loading.progressing || isLoadingFinaleCandidates}
      />

      <ConfirmModal
        visible={isFinaleLaunchConfirmVisible}
        emoji="🏆"
        title="Launch finale bracket?"
        message={`Create knockout matches for ${selectedFinalistCount} selected player${selectedFinalistCount === 1 ? '' : 's'}. This cannot be undone from the Games tab.`}
        confirmLabel="Launch finale"
        cancelLabel="Go back"
        onConfirm={async () => {
          setIsFinaleLaunchConfirmVisible(false);
          await onStartFinalStage();
        }}
        onCancel={() => setIsFinaleLaunchConfirmVisible(false)}
        isLoading={loading.progressing}
      />

      <ConfirmModal
        visible={finaleActionConfirm === 'skip'}
        emoji="⚠️"
        title="End tournament without finale?"
        message="This ends the tournament now. There will be no knockout bracket. Top 3 players in each group will be medalled in standings based on group-stage results."
        confirmLabel="End tournament"
        cancelLabel="Go back"
        confirmVariant="danger"
        onConfirm={onConfirmFinaleAction}
        onCancel={() => setFinaleActionConfirm(null)}
        isLoading={loading.progressing}
      />

      <HostInfoModal
        visible={isHostInfoModalVisible}
        detail={detail}
        isLoadingDetail={loading.detail}
        isLoadingRegistrations={loading.registrations}
        onClose={() => setIsHostInfoModalVisible(false)}
        onRefresh={bootstrap}
      />

      <FinalePlayerModal
        visible={isFinaleModalVisible}
        onClose={() => setIsFinaleModalVisible(false)}
        groupStandings={groupStandings}
        isLoadingFinaleCandidates={isLoadingFinaleCandidates}
        selectedFinalistIds={selectedFinalistIds}
        suggestedFinalistIds={suggestedFinalistIds}
        onToggleFinalist={(playerId) =>
          setSelectedFinalistIds((previousState) => ({
            ...previousState,
            [playerId]: !previousState[playerId],
          }))
        }
        selectedFinalistCount={selectedFinalistCount}
        canStartFinale={canStartFinale}
        isProgressing={loading.progressing}
        onStartFinalStage={() => setIsFinaleLaunchConfirmVisible(true)}
        finalBestOfInput={finalBestOfInput}
        onFinalBestOfChange={setFinalBestOfInput}
      />
    </ScrollView>
  );
}
