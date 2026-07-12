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
import { useStageFixtures } from '../hooks/useStageFixtures';
import { useGroupStandings } from '../hooks/useGroupStandings';
import { formatApiError, useScreenFeedback } from '../hooks/useScreenFeedback';
import { logApiError } from '../utils/errorLogger';
import { ScreenScrollShell } from '../components/layout/ScreenScrollShell';
import { ScreenSkeleton } from '../components/ui/ScreenSkeleton';
import { HostTournamentTabLayout } from '../components/layout/TournamentTabLayout';
import { useHostTournamentDetail } from '../hooks/queries/useHostTournamentDetail';
import { useHostTournamentRegistrations } from '../hooks/queries/useHostTournamentRegistrations';
import { useMyProfile } from '../hooks/queries/useMyProfile';
import { invalidateTournamentCache } from '../hooks/queries/invalidateTournamentCache';
import { useFetchScoresheetPages } from '../hooks/queries/useScoresheetPages';
import { useTournamentTeamsData } from '../hooks/queries/useTournamentTeamsData';
import { useScoreInputs } from '../hooks/useScoreInputs';
import { updateTournamentGameSchedule, regenerateProgressionStageFixtures } from '../services/tournamentService';
import {
  useExportActions,
  useProgressionActions,
  useProgressionPlan,
  useProctorActions,
  useRegistrationActions,
} from '../hooks/tournamentDetail';
import { tournamentUi } from '../styles/tournamentUi';
import {
  buildFixtureSectionsFromGames,
  buildKnockoutStandingsFromGames,
  buildProgressionStandingsSections,
  buildPlayerGameStatsFromGames,
  countFixtureMatches,
  findActiveFixtureRoundKey,
  findActiveFixtureRoundKeyForSection,
} from '../utils/fixtureDisplay';
import { StageStartModal } from './tournamentDetail/StageStartModal';
import { StageTabView } from './tournamentDetail/StageTabView';
import { GamesTab } from './tournamentDetail/GamesTab';
import { GroupsTab } from './tournamentDetail/GroupsTab';
import { HostInfoModal } from './tournamentDetail/HostInfoModal';
import { RegistrationsTab } from './tournamentDetail/RegistrationsTab';
import {
  formatProgressionLabel,
  SuccessBanner,
  TournamentScreenHero,
} from '../components/tournament/TournamentChrome';
import { formatRosterRowTitle, getRosterOutgoingPlayerId } from '../utils/rosterDisplay';
import { getStageInputCountFromDetail, countUniqueStageParticipants, isLegacyKnockoutBracket } from '../utils/progressionPlanUtils';

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
  const scrollRef = useRef(null);
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { data: myProfile } = useMyProfile({ enabled: Boolean(currentUser?.id) });
  const hostHasEmail = Boolean(myProfile?.user?.email);
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
  const [stageGamesById, setStageGamesById] = useState({});
  const [loadingStageId, setLoadingStageId] = useState(null);
  const [canEditFinalScores, setCanEditFinalScores] = useState(false);
  const [expandedRoundKey, setExpandedRoundKey] = useState(null);
  const [expandedSectionId, setExpandedSectionId] = useState(null);
  const groupsTabLoadStartedRef = useRef(false);
  const gamesTabLoadStartedRef = useRef(false);
  const groupsPrefetchStartedRef = useRef(false);
  const finaleTabLoadStartedRef = useRef(false);
  const stageTabLoadStartedRef = useRef(null);
  const stageFixturesRepairRef = useRef(new Set());
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

  const participantNameById = useMemo(() => {
    const map = new Map();

    approvedItems.forEach((item) => {
      const playerId = getRosterOutgoingPlayerId(item);
      if (playerId) {
        map.set(String(playerId), formatRosterRowTitle(item));
      }
    });

    return map;
  }, [approvedItems]);

  const isCloseDisabled = Number(approvedItems.length || 0) < 2;

  const progression = useProgressionPlan(detail);
  const { stageTabs, hasPostGroupStages, hasStartedPostGroupStages, hasPendingStage, nextReadyStage } =
    progression;

  const activeProgressionStageId = useMemo(() => {
    if (!activeTab.startsWith('stage:')) {
      return null;
    }

    const stageId = activeTab.replace('stage:', '');
    if (!stageId || stageId.startsWith('bypass:')) {
      return null;
    }

    return stageId;
  }, [activeTab]);

  const activeProgressionStageMeta = useMemo(
    () =>
      stageTabs.find((entry) => String(entry.stageId) === String(activeProgressionStageId)) || null,
    [activeProgressionStageId, stageTabs]
  );

  const activeStageTabReady = Boolean(
    activeProgressionStageMeta &&
      activeProgressionStageMeta.status !== 'locked' &&
      activeProgressionStageMeta.status !== 'ready' &&
      activeProgressionStageMeta.status !== 'preview' &&
      !activeProgressionStageMeta.isBypassPreview
  );

  const stageFixtures = useStageFixtures(tournamentId, {
    stageId: activeProgressionStageId,
    stageName: activeProgressionStageMeta?.name || 'Stage',
    bestOf: Math.max(
      Number(activeProgressionStageMeta?.bestOf || configuredFinalStageBestOfFromDetail || 3),
      1
    ),
    groupsTabItems,
    enabled: activeStageTabReady,
    isGroupStage: false,
  });
  const {
    loadAll: loadActiveStageFixtures,
    applyFilter: applyActiveStageFixturesFilter,
    refresh: refreshActiveStageFixtures,
  } = stageFixtures;

  const isProgressionDeferred = Boolean(detail?.progressionPlan?.deferred);
  const showProgressionConfigurator =
    canShowFinalStageStep &&
    !isTournamentCompleted &&
    (!hasStartedPostGroupStages || hasPendingStage || isProgressionDeferred);

  const shouldShowFinaleTab = hasPostGroupStages;

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

  const loadStageScores = useCallback(
    async (stageId, { hydrateInputs = false, forceRefresh = false } = {}) => {
      if (forceRefresh) {
        await queryClient.invalidateQueries({
          queryKey: ['tournament', tournamentId, 'scoresheet'],
        });
      }

      const response = await fetchScoresheetPages(tournamentId, { stageId });
      const items = response.items || [];
      setStageGamesById((current) => ({ ...current, [stageId]: items }));
      setCanEditFinalScores(Boolean(response.canEdit));
      if (stageId === 'finalStage' || !stageId) {
        setFinalStageGames(items);
      }
      if (hydrateInputs) {
        hydrateScoreInputState(items, { merge: true });
      }
      return items;
    },
    [fetchScoresheetPages, hydrateScoreInputState, queryClient, tournamentId]
  );

  const loadFinalStageScores = useCallback(
    async (options = {}) => {
      const activeStage = detail?.activeStageId;
      if (activeStage) {
        return loadStageScores(activeStage, options);
      }
      return loadStageScores('finalStage', options);
    },
    [detail?.activeStageId, loadStageScores]
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
        : detail?.progressionState === 'finalStage' || detail?.progressionState === 'stageActive'
          ? detail?.activeStageId
            ? `stage:${detail.activeStageId}`
            : 'groups'
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

  const stageDisplaySectionsById = useMemo(() => {
    const sectionsById = {};
    const planStages = detail?.progressionPlan?.stages || [];

    Object.entries(stageGamesById).forEach(([stageId, games]) => {
      const stageMeta =
        stageTabs.find((stage) => stage.stageId === stageId) ||
        planStages.find((stage) => String(stage.stageId) === String(stageId));
      const divisionNameById = new Map();

      if (stageMeta?.name) {
        divisionNameById.set(String(stageId), stageMeta.name);
        divisionNameById.set('__ungrouped', stageMeta.name);
      }

      (games || []).forEach((game) => {
        const divisionId = String(game.divisionId || stageId).trim() || stageId;
        const divisionName = String(game.divisionName || stageMeta?.name || 'Stage').trim();

        if (divisionId && divisionName) {
          divisionNameById.set(divisionId, divisionName);
        }
      });

      const stageBestOf = Math.max(Number(stageMeta?.bestOf || resolvedFinalStageBestOf), 1);
      sectionsById[stageId] = buildFixtureSectionsFromGames(games || [], {
        divisionNameById,
        groupStageBestOf: stageBestOf,
        isPlayedScoreEntry,
      });
    });

    return sectionsById;
  }, [detail?.progressionPlan?.stages, resolvedFinalStageBestOf, stageGamesById, stageTabs]);

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

  const progressionStandingsSections = useMemo(
    () =>
      buildProgressionStandingsSections({
        stages: detail?.progressionPlan?.stages || [],
        stageGamesById,
        isDoubles,
      }),
    [detail?.progressionPlan?.stages, isDoubles, stageGamesById]
  );

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
    stageTabLoadStartedRef.current = null;
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
      const startedStages = (detail?.progressionPlan?.stages || []).filter(
        (stage) => stage.status === 'active' || stage.status === 'completed'
      );
      await Promise.all([
        loadGroupsTab(),
        loadFinalStageScores(),
        ...startedStages.map((stage) => loadStageScores(stage.stageId)),
      ]);
    } catch (error) {
      showError(formatApiError(error, 'Unable to load groups'));
    } finally {
      dispatchLoading({ type: 'set', key: 'groups', value: false });
    }
  }, [clearError, detail?.progressionPlan?.stages, loadFinalStageScores, loadGroupsTab, loadStageScores, showError]);

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
    removeTarget,
    isRemoveConfirmVisible,
    isRemovingParticipant,
    replaceTarget,
    setReplaceTarget,
    onRequestRemoveParticipant,
    onCancelRemoveParticipant,
    onConfirmRemoveParticipant,
    onChooseReplaceInstead,
    onCancelReplace,
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
    suggestedParticipantIds: suggestedFinalistIds,
    bypassParticipantIds,
    selectedParticipantIds: selectedFinalistIds,
    selectedParticipantCount: selectedFinalistCount,
    isStageModalVisible: isFinaleModalVisible,
    setIsStageModalVisible: setIsFinaleModalVisible,
    tournamentCompleteMessage,
    setTournamentCompleteMessage,
    isLoadingStageCandidates: isLoadingFinaleCandidates,
    advancementPreview,
    isLoadingAdvancementPreview,
    onToggleParticipant: onToggleFinalist,
    onCloseStageModal,
    onPreviewGroupAdvancement,
    onPrepareStageFromGroups,
    onPrepareStageFromPrevious,
    onResumePendingStage,
    onStartStage: onStartFinalStage,
    onCompleteAfterGroups: onCompleteWithoutFinals,
    onAdvanceStage,
    activeStageMeta,
    stageModalBackLabel,
  } = useProgressionActions({
    tournamentId,
    isDoubles,
    loadDetail,
    loadStageScores,
    onLoadGroupsTab,
    onLoadFinaleTab: async () => {
      const activeStage = detail?.activeStageId || stageTabs[0]?.stageId;
      if (activeStage) await loadStageScores(activeStage, { hydrateInputs: true });
    },
    clearAll,
    showError,
    showSuccess,
    dispatchLoading,
    setActiveTab,
    progressionStages: detail?.progressionPlan?.stages || [],
    progressionBypass: progression.progressionBypass || [],
    participantNameById,
  });

  const configuredFinalStageBestOf = Math.max(
    Number(configuredFinalStageBestOfFromDetail ?? activeStageMeta?.bestOf ?? 3),
    1
  );

  const canStartFinale =
    !loading.progressing && !isLoadingFinaleCandidates && selectedFinalistCount >= 2;

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
  }, [applyGroupFixturesFilter, clearError, dispatchLoading, hydrateScoreInputState, showError]);

  const onApplyStageFilter = useCallback(async () => {
    try {
      clearError();
      setLoadingStageId(activeProgressionStageId);
      const matches = await applyActiveStageFixturesFilter();
      hydrateScoreInputState(matches, { merge: true });
    } catch (error) {
      showError(formatApiError(error, 'Unable to filter matches'));
    } finally {
      setLoadingStageId((current) => (current === activeProgressionStageId ? null : current));
    }
  }, [
    activeProgressionStageId,
    applyActiveStageFixturesFilter,
    clearError,
    hydrateScoreInputState,
    showError,
  ]);

  const onRefreshStageFixtures = useCallback(async () => {
    if (!activeProgressionStageId) {
      return;
    }

    try {
      clearError();
      setLoadingStageId(activeProgressionStageId);
      const items = await refreshActiveStageFixtures({ preserveFilter: true });
      hydrateScoreInputState(items, { merge: true });
      setStageGamesById((current) => ({ ...current, [activeProgressionStageId]: items }));
    } catch (error) {
      showError(formatApiError(error, 'Unable to refresh fixtures'));
    } finally {
      setLoadingStageId((current) => (current === activeProgressionStageId ? null : current));
    }
  }, [
    activeProgressionStageId,
    clearError,
    hydrateScoreInputState,
    refreshActiveStageFixtures,
    showError,
  ]);

  const allLoadedStageGames = useMemo(
    () => Object.values(stageGamesById).flat(),
    [stageGamesById]
  );

  const onSaveMatchScores = useCallback(
    async (payload) => {
      const activeStageIdFromTab =
        activeTab.startsWith('stage:') && !activeTab.replace('stage:', '').startsWith('bypass:')
          ? activeTab.replace('stage:', '')
          : null;

      try {
        clearError();
        clearSuccess();

        await saveMatchScoresFromInputs({
          tournamentId,
          ...payload,
          groupStageGames: groupStageGames,
          finalStageGames,
          stageGames: allLoadedStageGames,
          onSuccess: async ({ isFinalStageGame, stageId }) => {
            showSuccess('Match scores saved.');

            if (isFinalStageGame) {
              await onLoadFinaleTab();
              return;
            }

            const resolvedStageId = stageId || activeStageIdFromTab;
            if (resolvedStageId) {
              if (resolvedStageId === activeProgressionStageId) {
                const refreshed = await refreshActiveStageFixtures({ preserveFilter: true });
                hydrateScoreInputState(refreshed, { merge: true });
                setStageGamesById((current) => ({ ...current, [resolvedStageId]: refreshed }));
              } else {
                await loadStageScores(resolvedStageId, { hydrateInputs: true, forceRefresh: true });
              }
              await invalidateTournamentQueries();
              return;
            }

            await queryClient.invalidateQueries({
              queryKey: ['tournament', tournamentId, 'scoresheet'],
            });
            const refreshed = await refreshGroupFixtures({ preserveFilter: true });
            hydrateScoreInputState(refreshed, { merge: true });
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
      activeProgressionStageId,
      activeTab,
      clearError,
      clearSuccess,
      finalStageGames,
      groupStageGames,
      hydrateScoreInputState,
      allLoadedStageGames,
      loadStageScores,
      onLoadFinaleTab,
      queryClient,
      refreshActiveStageFixtures,
      refreshGroupFixtures,
      refreshGroupsTabData,
      saveMatchScoresFromInputs,
      showError,
      showSuccess,
      tournamentId,
      invalidateTournamentQueries,
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
    if (activeTab !== 'groups' || groupsTabItems.length > 0 || groupsPrefetchStartedRef.current) {
      return;
    }

    groupsPrefetchStartedRef.current = true;
    refreshGroupsTabData().catch((error) => {
      logApiError(error, { screen: 'TournamentDetail', action: 'prefetchGroupsTab' });
    });
  }, [activeTab, groupsTabItems.length, refreshGroupsTabData]);

  useEffect(() => {
    if (activeTab !== 'games' || gamesTabLoadStartedRef.current) {
      return;
    }

    gamesTabLoadStartedRef.current = true;
    onLoadGroupFixtures();
  }, [activeTab, onLoadGroupFixtures]);

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
    stageFixturesRepairRef.current = new Set();
  }, [tournamentId]);

  useEffect(() => {
    if (!activeProgressionStageId || !activeStageTabReady) {
      return;
    }

    const stageId = activeProgressionStageId;
    const stageMeta = activeProgressionStageMeta;

    let cancelled = false;

    (async () => {
      setLoadingStageId(stageId);
      try {
        let items = await loadActiveStageFixtures();
        if (!cancelled) {
          hydrateScoreInputState(items, { merge: true });
          setStageGamesById((current) => ({ ...current, [stageId]: items }));
        }

        if (
          !cancelled &&
          stageMeta?.format === 'knockout' &&
          isLegacyKnockoutBracket(items) &&
          !stageFixturesRepairRef.current.has(stageId)
        ) {
          stageFixturesRepairRef.current.add(stageId);
          await regenerateProgressionStageFixtures(tournamentId, stageId);
          items = await refreshActiveStageFixtures({ preserveFilter: false });
          if (!cancelled) {
            hydrateScoreInputState(items, { merge: true });
            setStageGamesById((current) => ({ ...current, [stageId]: items }));
          }
        }
      } catch (error) {
        if (!cancelled) {
          logApiError(error, { screen: 'TournamentDetail', action: 'loadOrRepairStageFixtures', stageId });
        }
      } finally {
        if (!cancelled) {
          setLoadingStageId((current) => (current === stageId ? null : current));
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [
    activeProgressionStageId,
    activeProgressionStageMeta,
    activeStageTabReady,
    hydrateScoreInputState,
    loadActiveStageFixtures,
    refreshActiveStageFixtures,
    tournamentId,
  ]);

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

        const sections =
          activeTab === 'finale'
            ? finalDisplaySections
            : activeTab === 'games'
              ? groupDisplaySections
              : activeTab.startsWith('stage:')
                ? stageFixtures.displaySections
                : groupDisplaySections;
        const section = sections.find((item) => item.sectionId === sectionId);
        setExpandedRoundKey(findActiveFixtureRoundKeyForSection(section));
        return sectionId;
      });
    },
    [activeTab, finalDisplaySections, groupDisplaySections, stageFixtures.displaySections]
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
        if (activeProgressionStageId) {
          stageFixtures.patchGame(updated.id, {
            scheduledStartAt: updated.scheduledStartAt,
            canScheduleMatch: updated.canScheduleMatch,
          });
        } else {
          groupFixtures.patchGame(updated.id, {
            scheduledStartAt: updated.scheduledStartAt,
            canScheduleMatch: updated.canScheduleMatch,
          });
        }
        setScheduleTarget(null);
      } catch (error) {
        showError(formatApiError(error, 'Unable to save match schedule'));
      } finally {
        setIsSavingSchedule(false);
      }
    },
    [clearAll, groupFixtures, scheduleTarget, showError, tournamentId]
  );

  if (isDetailQueryLoading && !detail) {
    return <ScreenSkeleton />;
  }

  return (
    <ScreenScrollShell ref={scrollRef} contentContainerStyle={{ gap: 16 }}>
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
        stageTabs={stageTabs}
        showGamesTab={hasGroupFixtures}
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
          onRequestRemoveParticipant={isHost ? onRequestRemoveParticipant : null}
          replaceTarget={replaceTarget}
          onCancelReplace={onCancelReplace}
          scrollRef={scrollRef}
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
          progressionStandingsSections={progressionStandingsSections}
        />
      )}

      {activeTab === 'games' && hasGroupFixtures && (
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
          canShowFinalStageStep={canShowFinalStageStep && !isTournamentCompleted && hasPostGroupStages}
          showProgressionConfigurator={showProgressionConfigurator}
          groupCount={Number(detail?.competitionConfig?.groupCount || groupsTabItems.length || 0)}
          groupLabels={groupsTabItems.map((group) => group.divisionName).filter(Boolean)}
          isDoubles={isDoubles}
          progressionPreview={advancementPreview}
          isLoadingProgressionPreview={isLoadingAdvancementPreview}
          onPreviewProgression={onPreviewGroupAdvancement}
          onConfigureProgression={async (draft) => {
            if (nextReadyStage) {
              await onResumePendingStage(nextReadyStage);
              return;
            }
            await onPrepareStageFromGroups(draft);
          }}
          onEndAfterGroups={onCompleteWithoutFinals}
          nextStageName={nextReadyStage?.name || null}
          isProgressing={loading.progressing}
          isLoadingFinaleCandidates={isLoadingFinaleCandidates}
          onAddSeriesGame={scoreInputs.onAddSeriesGame}
          onStartGame={({ gameId }) =>
            navigation.navigate('LiveMatchSession', { tournamentId, gameId, autoStart: true })
          }
          onScheduleMatch={onScheduleMatch}
          groupStageProctored={groupStageProctored}
        />
      )}

      {stageTabs.map((stage) => {
        const planStage = (detail?.progressionPlan?.stages || []).find(
          (entry) => String(entry.stageId) === String(stage.stageId)
        );
        const isStageStarted =
          stage.status === 'active' ||
          stage.status === 'complete' ||
          planStage?.status === 'active' ||
          planStage?.status === 'completed' ||
          String(detail?.activeStageId || '') === String(stage.stageId);

        const isActivePlanningStage =
          stage.status === 'active' ||
          planStage?.status === 'active' ||
          String(detail?.activeStageId || '') === String(stage.stageId);

        const hasLaterStageStarted = (detail?.progressionPlan?.stages || []).some(
          (planEntry) =>
            Number(planEntry.order || 0) > Number(stage.order || 0) &&
            (planEntry.status === 'active' || planEntry.status === 'completed')
        );

        return activeTab === `stage:${stage.stageId}` ? (
          <StageTabView
            key={stage.stageId}
            stage={stage}
            isLoading={loadingStageId === stage.stageId || stageFixtures.isLoading}
            games={stageFixtures.games}
            displaySections={stageFixtures.displaySections}
            scoreInputsByGameId={scoreInputs.scoreInputsByGameId}
            onChangeScoreInput={scoreInputs.onChangeScoreInput}
            savingGameId={scoreInputs.savingGameId}
            onSaveMatchScores={onSaveMatchScores}
            canEdit={stageFixtures.canEdit}
            expandedSectionId={expandedSectionId}
            onToggleSection={onToggleSection}
            expandedRoundKey={expandedRoundKey}
            onToggleRound={onToggleRound}
            defaultSeriesMaxGames={Math.max(Number(stage.bestOf || resolvedFinalStageBestOf), 1)}
            participantNameById={participantNameById}
            expectedCount={getStageInputCountFromDetail(detail, stage)}
            isFilterExpanded={stageFixtures.isFilterExpanded}
            onToggleFilter={stageFixtures.toggleFilterExpanded}
            onRefresh={onRefreshStageFixtures}
            playerFilterInput={stageFixtures.playerFilterInput}
            onPlayerFilterInputChange={stageFixtures.setPlayerFilterInput}
            opponentFilterInput={stageFixtures.opponentFilterInput}
            onOpponentFilterInputChange={stageFixtures.setOpponentFilterInput}
            onClearFilter={stageFixtures.clearFilter}
            onApplyFilter={onApplyStageFilter}
            hasActiveFilter={stageFixtures.hasActiveGamesFilter}
            fixtureSummaryText={stageFixtures.fixtureSummaryText}
            activeRoundKey={stageFixtures.activeRoundKey}
            useLiveSessionScoring={Boolean(stage.proctored)}
            showSaveButton={!stage.proctored}
            onStartGame={({ gameId }) =>
              navigation.navigate('LiveMatchSession', { tournamentId, gameId, autoStart: true })
            }
            onScheduleMatch={onScheduleMatch}
            showStageProgressionPanel={
              !isTournamentCompleted &&
              !stage.isBypassPreview &&
              isStageStarted &&
              isActivePlanningStage &&
              !hasLaterStageStarted
            }
            stageParticipantCount={(() => {
              const configuredInput = getStageInputCountFromDetail(detail, stage);
              const uniqueFromGames = countUniqueStageParticipants(stageFixtures.games, isDoubles);

              return Math.max(configuredInput, uniqueFromGames);
            })()}
            onContinueToNextStage={async (draft) => {
              if (nextReadyStage) {
                await onResumePendingStage(nextReadyStage);
                return;
              }
              await onPrepareStageFromPrevious(draft, stage);
            }}
            onEndTournament={() => onAdvanceStage(stage.stageId, stage.name, true)}
            nextStageName={nextReadyStage?.name || null}
            isLastConfiguredStage={
              (detail?.progressionPlan?.stages || []).findIndex(
                (entry) => String(entry.stageId) === String(stage.stageId)
              ) ===
              (detail?.progressionPlan?.stages || []).length - 1
            }
            isProgressing={loading.progressing}
          />
        ) : null;
      })}

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
            setReplaceTarget(null);
          }
        }}
        onSubmit={onSubmitGuestPlayer}
        isLoading={isAddingGuestPlayer}
        title={replaceTarget ? 'Replace with guest player' : 'Add guest player'}
        subtitle={
          replaceTarget
            ? `Replacing ${formatRosterRowTitle(replaceTarget)}. Enter the new roster name and username.`
            : undefined
        }
      />

      <ConfirmModal
        visible={isRemoveConfirmVisible}
        icon="warning"
        title="Remove from roster?"
        message={
          removeTarget
            ? `${formatRosterRowTitle(removeTarget)} will be removed from this tournament. Guest usernames are released. Scheduled group matches for this player will be cancelled unless you replace them.`
            : ''
        }
        confirmLabel="Remove"
        cancelLabel="Cancel"
        alternateLabel="Replace instead"
        onAlternate={onChooseReplaceInstead}
        onConfirm={onConfirmRemoveParticipant}
        onCancel={onCancelRemoveParticipant}
        isLoading={isRemovingParticipant}
        confirmVariant="danger"
      />

      <HostInfoModal
        visible={isHostInfoModalVisible}
        detail={detail}
        isLoadingDetail={loading.detail}
        isLoadingRegistrations={loading.registrations}
        isExporting={isExportingWorkbook}
        isEmailExporting={isEmailExporting}
        hostHasEmail={hostHasEmail}
        onClose={() => setIsHostInfoModalVisible(false)}
        onRefresh={onRefreshDetail}
        onExport={onExportWorkbook}
        onEmailExport={onEmailExportWorkbook}
      />

      <StageStartModal
        visible={isFinaleModalVisible}
        onClose={onCloseStageModal}
        stage={activeStageMeta || nextReadyStage}
        groupStandings={groupStandings}
        participantNameById={participantNameById}
        backButtonLabel={stageModalBackLabel}
        isLoadingStageCandidates={isLoadingFinaleCandidates}
        selectedParticipantIds={selectedFinalistIds}
        suggestedParticipantIds={suggestedFinalistIds}
        bypassParticipantIds={bypassParticipantIds}
        onToggleParticipant={onToggleFinalist}
        canStartStage={canStartFinale}
        isProgressing={loading.progressing}
        isDoubles={isDoubles}
        onStartStage={onStartFinalStage}
      />
    </ScreenScrollShell>
  );
}
