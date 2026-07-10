import React, { useCallback, useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { ConfirmModal } from '../components/ConfirmModal';
import { AddGuestPlayerModal } from '../components/AddGuestPlayerModal';
import { FeedbackModal } from '../components/FeedbackModal';
import { MatchScheduleModal } from '../components/tournament/MatchScheduleModal';
import { useAuth } from '../context/AuthContext';
import { useGroupStageFixtures } from '../hooks/useGroupStageFixtures';
import { useGroupStandings } from '../hooks/useGroupStandings';
import { formatApiError, useScreenFeedback } from '../hooks/useScreenFeedback';
import { logApiError } from '../utils/errorLogger';
import { ScreenScrollShell } from '../components/layout/ScreenScrollShell';
import { HostTournamentTabLayout } from '../components/layout/TournamentTabLayout';
import { useHostTournamentDetail } from '../hooks/queries/useHostTournamentDetail';
import { useHostTournamentRegistrations } from '../hooks/queries/useHostTournamentRegistrations';
import { invalidateTournamentCache } from '../hooks/queries/invalidateTournamentCache';
import { useFetchScoresheetPages } from '../hooks/queries/useScoresheetPages';
import { useTournamentTeamsData } from '../hooks/queries/useTournamentTeamsData';
import { useScoreInputs } from '../hooks/useScoreInputs';
import { updateTournamentGameSchedule } from '../services/tournamentService';
import {
  useExportActions,
  useFinaleActions,
  useProctorActions,
  useRegistrationActions,
} from '../hooks/tournamentDetail';
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
  const queryClient = useQueryClient();
  const fetchScoresheetPages = useFetchScoresheetPages();
  const detailTabInitializedRef = useRef(null);

  const {
    data: detail,
    isLoading: isDetailQueryLoading,
    refetch: refetchDetail,
    error: detailQueryError,
  } = useHostTournamentDetail(tournamentId);

  const {
    data: registrationsData,
    isLoading: isRegistrationsQueryLoading,
    refetch: refetchRegistrations,
  } = useHostTournamentRegistrations(tournamentId);

  const registrations = registrationsData?.items ?? [];

  const [activeTab, setActiveTab] = useState('registrations');
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
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const isDoublesEarly = detail?.competitionConfig?.format === 'doubles';
  const { data: teamsData } = useTournamentTeamsData(tournamentId, {
    enabled: Boolean(tournamentId) && isDoublesEarly,
  });

  const {
    groupsTabItems,
    handicapEnabled,
    finalStageEnabled: standingsFinalStageEnabled,
    finaleStandings,
    groupPlayerGameStatsById,
    isLoading: isLoadingGroupsTab,
    refreshGroupsTabData,
    loadGroupsTab,
  } = useGroupStandings(tournamentId);

  const groupStageBestOf = detail?.competitionConfig?.groupStageBestOf;
  const configuredFinalStageBestOfFromDetail = detail?.competitionConfig?.finalStageBestOf;
  const groupStageProctored = Boolean(detail?.competitionConfig?.groupStageProctored);
  const finalStageProctored = Boolean(detail?.competitionConfig?.finalStageProctored);
  const isDoubles = detail?.competitionConfig?.format === 'doubles';
  const pairFormationMode = detail?.competitionConfig?.pairFormationMode || 'playerPicksPartner';

  const groupFixtures = useGroupStageFixtures(tournamentId, groupsTabItems, groupStageBestOf);

  const scoreInputs = useScoreInputs({
    groupStageBestOf,
    finalStageBestOf: configuredFinalStageBestOfFromDetail ?? 3,
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

  const groupsLocked =
    hasGroupFixtures || ['groupStage', 'finalStage', 'completed'].includes(progressionState);

  const soloPlayerCount = useMemo(() => {
    if (!isDoubles || !canShowGroupAssignmentStep || hasGroupFixtures) {
      return null;
    }

    if (!teamsData) {
      return null;
    }

    return (teamsData.soloPlayers || []).length;
  }, [canShowGroupAssignmentStep, hasGroupFixtures, isDoubles, teamsData]);

  const pendingItems = useMemo(
    () => registrations.filter((item) => item.status === 'underReview'),
    [registrations]
  );

  const approvedItems = useMemo(
    () => registrations.filter((item) => item.status === 'approved'),
    [registrations]
  );

  const isCloseDisabled = Number(approvedItems.length || 0) < 2;

  const shouldShowFinaleTab =
    canShowFinalStageStep || hasFinalStageStarted || finalStageGames.length > 0;

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
      const response = await fetchScoresheetPages(tournamentId, { stage: 'finalStage' });
      const items = response.items || [];

      setCanEditFinalScores(Boolean(response.canEdit));
      setFinalStageGames(items);

      if (hydrateInputs) {
        hydrateScoreInputState(items);
      }

      return items;
    },
    [fetchScoresheetPages, hydrateScoreInputState, tournamentId]
  );

  const loadDetail = useCallback(async () => {
    await refetchDetail();
  }, [refetchDetail]);

  const loadRegistrations = useCallback(async () => {
    await refetchRegistrations();
  }, [refetchRegistrations]);

  const invalidateTournamentQueries = useCallback(async () => {
    await invalidateTournamentCache(queryClient, tournamentId);
  }, [queryClient, tournamentId]);

  useEffect(() => {
    if (!detail || detailTabInitializedRef.current === tournamentId) {
      return;
    }

    detailTabInitializedRef.current = tournamentId;
    setActiveTab(
      detail?.progressionState === 'groupStage'
        ? 'games'
        : detail?.progressionState === 'finalStage'
          ? 'finale'
          : detail?.registrationStatus === 'closed'
            ? 'groups'
            : 'registrations'
    );
  }, [detail, tournamentId]);

  useEffect(() => {
    if (!detailQueryError) {
      return;
    }

    showError(formatApiError(detailQueryError, 'Unable to load tournament detail'));
  }, [detailQueryError, showError]);

  useEffect(() => {
    dispatchLoading({ type: 'set', key: 'detail', value: isDetailQueryLoading && !detail });
    dispatchLoading({ type: 'set', key: 'registrations', value: isRegistrationsQueryLoading && !registrationsData });
  }, [detail, isDetailQueryLoading, isRegistrationsQueryLoading, registrationsData]);

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

  const resolvedFinalStageBestOf = useMemo(() => {
    if (configuredFinalStageBestOfFromDetail != null && Number(configuredFinalStageBestOfFromDetail) > 0) {
      return Math.max(Number(configuredFinalStageBestOfFromDetail), 1);
    }

    const fromGame = (finalStageGames || []).find((game) => Number(game.bestOf) > 0);
    if (fromGame) {
      return Math.max(Number(fromGame.bestOf), 1);
    }

    return 3;
  }, [configuredFinalStageBestOfFromDetail, finalStageGames]);

  const finalDisplaySections = useMemo(
    () =>
      buildFixtureSectionsFromGames(finalStageGames, {
        divisionNameById: finalDivisionNameById,
        groupStageBestOf: resolvedFinalStageBestOf,
        isPlayedScoreEntry,
      }),
    [resolvedFinalStageBestOf, finalDivisionNameById, finalStageGames]
  );

  const finalFixtureSummaryText = useMemo(() => {
    const loadedCount = countFixtureMatches(finalDisplaySections);

    if (loadedCount === 0) {
      return '';
    }

    return `${loadedCount} finale ${loadedCount === 1 ? 'match' : 'matches'} • Best of ${resolvedFinalStageBestOf} series`;
  }, [resolvedFinalStageBestOf, finalDisplaySections]);

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

  const onRefreshDetail = useCallback(async () => {
    try {
      clearError();
      await Promise.all([refetchDetail(), refetchRegistrations()]);
    } catch (error) {
      showError(formatApiError(error, 'Unable to load tournament detail'));
    }
  }, [clearError, refetchDetail, refetchRegistrations, showError]);

  const {
    isExportingWorkbook,
    isEmailExporting,
    onExportWorkbook,
    onEmailExportWorkbook,
  } = useExportActions({ tournamentId, detail, clearAll, showError, showSuccess });

  useEffect(() => {
    detailTabInitializedRef.current = null;
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

  const {
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
  } = useRegistrationActions({
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
  });

  const { proctorProps } = useProctorActions({
    tournamentId,
    detail,
    isHost,
    groupStageProctored,
    approvedItems,
    currentUserId: currentUser?.id,
    isProgressing: loading.progressing,
    loadDetail,
    clearAll,
    showError,
    showSuccess,
    dispatchLoading,
  });

  const {
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
    onToggleFinalist,
    onStartFinalStage,
    onOpenFinaleModal,
    onCompleteWithoutFinals,
    onConfirmFinaleAction,
    onCompleteWithFinale,
  } = useFinaleActions({
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
  });

  const configuredFinalStageBestOf = Math.max(
    Number(configuredFinalStageBestOfFromDetail ?? finalBestOfInput ?? 3),
    1
  );

  const canStartFinale = !loading.progressing && !isLoadingFinaleCandidates && selectedFinalistCount >= 2;


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
            await invalidateTournamentQueries();
          },
        });
      } catch (error) {
        if (error?.code === 'VALIDATION') {
          showError(error.message);
          return;
        }

        if (error?.code === 'LEADERBOARD_INDEX_CONFLICT') {
        showError(
          'Standings indexes need a one-time fix. In backend folder run: npm run fix:leaderboard-indexes — then restart the backend and try again.'
        );
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
      refreshGroupsTabData().catch((error) => {
        logApiError(error, { screen: 'TournamentDetail', action: 'prefetchGroupsTab' });
      });
    }

    if (gamesTabLoadStartedRef.current) {
      return;
    }

    gamesTabLoadStartedRef.current = true;
    onLoadGroupFixtures();
  }, [activeTab, groupsTabItems.length, onLoadGroupFixtures, refreshGroupsTabData]);

  useFocusEffect(
    useCallback(() => {
      if (activeTab !== 'games' || !gamesTabLoadStartedRef.current) {
        return undefined;
      }

      let isCancelled = false;

      (async () => {
        try {
          const refreshed = await refreshGroupFixtures({ preserveFilter: true });
          if (!isCancelled) {
            hydrateScoreInputState(refreshed);
          }
        } catch (error) {
          logApiError(error, { screen: 'TournamentDetail', action: 'refreshGroupFixturesOnFocus' });
        }
      })();

      return () => {
        isCancelled = true;
      };
    }, [activeTab, hydrateScoreInputState, refreshGroupFixtures])
  );

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

  useLayoutEffect(() => {
    navigation.setOptions({ title: tournamentTitle });
  }, [navigation, tournamentTitle]);

  const onScheduleMatch = useCallback((target) => {
    setScheduleTarget(target);
  }, []);

  const onSaveMatchSchedule = useCallback(
    async (scheduledStartAt) => {
      if (!scheduleTarget?.gameId || !tournamentId) {
        return;
      }

      try {
        setIsSavingSchedule(true);
        clearAll();
        const updated = await updateTournamentGameSchedule(tournamentId, scheduleTarget.gameId, {
          scheduledStartAt,
        });
        groupFixtures.patchGame(updated.id, {
          scheduledStartAt: updated.scheduledStartAt,
          canScheduleMatch: updated.canScheduleMatch,
        });
        setScheduleTarget(null);
      } catch (error) {
        showError(formatApiError(error, 'Unable to save match schedule'));
      } finally {
        setIsSavingSchedule(false);
      }
    },
    [clearAll, groupFixtures, scheduleTarget, showError, tournamentId]
  );

  return (
    <ScreenScrollShell contentContainerStyle={{ gap: 16 }}>
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

      <HostTournamentTabLayout
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        shouldShowFinaleTab={shouldShowFinaleTab}
      >
        <SuccessBanner message={successMessage} />

      {activeTab === 'registrations' && (
        <RegistrationsTab
          searchQuery={searchQuery}
          onSearchQueryChange={setSearchQuery}
          onSearchUsers={onSearchUsers}
          onClearUserSearch={onClearUserSearch}
          isSearchingUsers={isSearchingUsers}
          userSearchResults={userSearchResults}
          busyManualAddUserId={busyManualAddUserId}
          onManualAddParticipant={onManualAddParticipant}
          onOpenAddGuestPlayer={onOpenAddGuestPlayer}
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
          proctorProps={proctorProps}
          isDoubles={isDoubles}
          isHost={isHost}
          tournamentId={tournamentId}
          pairFormationMode={pairFormationMode}
          groupsLocked={groupsLocked}
          currentUserId={currentUser?.id}
          onTeamsChanged={async () => {
            await loadRegistrations();
          }}
          onTeamsError={(error) => showError(formatApiError(error, 'Unable to update teams'))}
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
          pairTeamsRandomInput={pairTeamsRandomInput}
          onPairTeamsRandomChange={setPairTeamsRandomInput}
          soloPlayerCount={soloPlayerCount}
          isDoubles={isDoubles}
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
          finalStageEnabled={
            standingsFinalStageEnabled || Boolean(detail?.competitionConfig?.finalStageEnabled)
          }
          finaleStandings={finaleStandings}
          handicapEnabled={handicapEnabled}
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
          onStartGame={({ gameId }) =>
            navigation.navigate('LiveMatchSession', { tournamentId, gameId, autoStart: true })
          }
          onScheduleMatch={onScheduleMatch}
          groupStageProctored={groupStageProctored}
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
          onStartGame={({ gameId }) =>
            navigation.navigate('LiveMatchSession', { tournamentId, gameId, autoStart: true })
          }
          finalStageProctored={finalStageProctored}
        />
      )}
      </HostTournamentTabLayout>

      <FeedbackModal visible={Boolean(errorMessage)} message={errorMessage} onDismiss={clearError} />

      <MatchScheduleModal
        visible={Boolean(scheduleTarget)}
        matchLabel={
          scheduleTarget
            ? `${scheduleTarget.playerAName || 'Player A'} vs ${scheduleTarget.playerBName || 'Player B'}`
            : ''
        }
        initialScheduledAt={scheduleTarget?.scheduledStartAt || null}
        onSave={onSaveMatchSchedule}
        onCancel={() => setScheduleTarget(null)}
        isSaving={isSavingSchedule}
      />

      <FeedbackModal
        visible={Boolean(tournamentCompleteMessage)}
        title="Tournament complete"
        message={tournamentCompleteMessage}
        icon="trophy"
        onDismiss={() => setTournamentCompleteMessage('')}
      />

      <ConfirmModal
        visible={isGuestAddConfirmVisible}
        icon="person"
        title="Add player without an account?"
        message="Use this when someone is playing in person but has not signed up yet. Enter the username they will use when they create an account — their entry links automatically."
        confirmLabel="Continue"
        cancelLabel="Cancel"
        onConfirm={onConfirmGuestAddIntro}
        onCancel={() => setIsGuestAddConfirmVisible(false)}
      />

      <AddGuestPlayerModal
        visible={isGuestAddFormVisible}
        onCancel={() => {
          if (!isAddingGuestPlayer) {
            setIsGuestAddFormVisible(false);
          }
        }}
        onSubmit={onSubmitGuestPlayer}
        isLoading={isAddingGuestPlayer}
      />

      <ConfirmModal
        visible={finaleActionConfirm === 'start'}
        icon="trophy"
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
        icon="trophy"
        title="Launch finale bracket?"
        message={`Create knockout matches for ${selectedFinalistCount} selected ${isDoubles ? 'team' : 'player'}${selectedFinalistCount === 1 ? '' : 's'}. This cannot be undone from the Games tab.`}
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
        icon="warning"
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
        isExporting={isExportingWorkbook}
        isEmailExporting={isEmailExporting}
        onClose={() => setIsHostInfoModalVisible(false)}
        onRefresh={onRefreshDetail}
        onExport={onExportWorkbook}
        onEmailExport={onEmailExportWorkbook}
      />

      <FinalePlayerModal
        visible={isFinaleModalVisible}
        onClose={() => setIsFinaleModalVisible(false)}
        groupStandings={groupStandings}
        isLoadingFinaleCandidates={isLoadingFinaleCandidates}
        selectedFinalistIds={selectedFinalistIds}
        suggestedFinalistIds={suggestedFinalistIds}
        onToggleFinalist={onToggleFinalist}
        selectedFinalistCount={selectedFinalistCount}
        canStartFinale={canStartFinale}
        isProgressing={loading.progressing}
        isDoubles={isDoubles}
        onStartFinalStage={() => setIsFinaleLaunchConfirmVisible(true)}
        finalBestOfInput={finalBestOfInput}
        onFinalBestOfChange={setFinalBestOfInput}
        finalStageProctored={finalStageProctoredInput}
        onFinalStageProctoredChange={setFinalStageProctoredInput}
      />
    </ScreenScrollShell>
  );
}
