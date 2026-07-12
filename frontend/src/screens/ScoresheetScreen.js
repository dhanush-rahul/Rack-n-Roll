import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { View } from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import {
  ReadOnlyBanner,
  TournamentScreenHero,
} from '../components/tournament/TournamentChrome';
import { useGroupStageFixtures } from '../hooks/useGroupStageFixtures';
import { useStageFixtures } from '../hooks/useStageFixtures';
import { useQueryClient } from '@tanstack/react-query';
import { formatApiError, useScreenFeedback } from '../hooks/useScreenFeedback';
import { ScreenScrollShell } from '../components/layout/ScreenScrollShell';
import { ScreenSkeleton } from '../components/ui/ScreenSkeleton';
import { ScoresheetTabLayout } from '../components/layout/TournamentTabLayout';
import { useFetchScoresheetPages, useScoresheetMeta } from '../hooks/queries/useScoresheetPages';
import { useTournamentGroupStandings } from '../hooks/queries/useTournamentGroupStandings';
import { queryKeys } from '../hooks/queries/queryKeys';
import { STANDINGS_STALE_TIME_MS } from '../config/queryClient';
import {
  fetchTournamentGroupStandings,
} from '../services/tournamentService';
import { useAuth } from '../context/AuthContext';
import { TeamsSection } from './tournamentDetail/TeamsSection';
import { findActiveFixtureRoundKeyForSection, buildProgressionStandingsSections } from '../utils/fixtureDisplay';
import { useProgressionPlan } from '../hooks/tournamentDetail';
import { buildGroupDisplayName } from '../utils/groupNaming';
import { ScoresheetGroupsTab } from '../components/scoresheet/ScoresheetGroupsTab';
import { ScoresheetGamesTab } from '../components/scoresheet/ScoresheetGamesTab';
import { StageTabView } from './tournamentDetail/StageTabView';

const BASE_SCORESHEET_TABS = [
  { id: 'groups', label: 'Groups' },
];

export function ScoresheetScreen({ route, navigation }) {
  const tournamentId = route?.params?.tournamentId;
  const tournamentTitle = route?.params?.tournamentName || 'Tournament';
  const { currentUser, isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const fetchScoresheetPages = useFetchScoresheetPages();
  const { data: standingsMeta } = useTournamentGroupStandings(tournamentId, {}, { enabled: Boolean(tournamentId) });
  const { data: scoresheetMeta } = useScoresheetMeta(tournamentId, { enabled: Boolean(tournamentId) });
  const [activeTab, setActiveTab] = useState('groups');

  const [groupsTabItems, setGroupsTabItems] = useState([]);
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [groupPlayerGameStatsById, setGroupPlayerGameStatsById] = useState({});
  const [isLoadingGroupsTab, setIsLoadingGroupsTab] = useState(false);
  const [hasLoadedGroupsTab, setHasLoadedGroupsTab] = useState(false);

  const [hasLoadedGamesTab, setHasLoadedGamesTab] = useState(false);

  const [scoresByGameId, setScoresByGameId] = useState({});
  const { errorMessage, showError, clearError } = useScreenFeedback({ successAutoClearMs: 0 });
  const [expandedRoundKey, setExpandedRoundKey] = useState(null);
  const [expandedSectionId, setExpandedSectionId] = useState(null);
  const [loadingStageId, setLoadingStageId] = useState(null);
  const [isDoubles, setIsDoubles] = useState(false);
  const [pairFormationMode, setPairFormationMode] = useState('playerPicksPartner');
  const [progressionState, setProgressionState] = useState('registration');
  const [tournamentMetaReady, setTournamentMetaReady] = useState(false);
  const initialTabSetRef = useRef(false);

  const groupsLocked = ['groupStage', 'finalStage', 'stageActive', 'completed'].includes(progressionState);
  const [stageGamesById, setStageGamesById] = useState({});

  const scoresheetDetail = useMemo(
    () => ({
      progressionPlan: scoresheetMeta?.progressionPlan,
      progressionBypass: scoresheetMeta?.progressionBypass || [],
      progressionState,
      activeStageId: scoresheetMeta?.activeStageId || null,
    }),
    [progressionState, scoresheetMeta]
  );

  const { stageTabs } = useProgressionPlan(scoresheetDetail);

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

  const showGamesTab = groupsLocked;

  const scoresheetTabs = useMemo(() => {
    const tabs = [...BASE_SCORESHEET_TABS];

    if (isDoubles && isAuthenticated) {
      tabs.push({ id: 'teams', label: 'Teams' });
    }

    if (showGamesTab) {
      tabs.push({ id: 'games', label: 'Games' });
    }

    stageTabs.forEach((stage) => {
      tabs.push({
        id: `stage:${stage.stageId}`,
        label: stage.name,
        muted: stage.status === 'locked',
      });
    });

    return tabs;
  }, [isAuthenticated, isDoubles, showGamesTab, stageTabs]);

  const groupFixtures = useGroupStageFixtures(tournamentId, groupsTabItems, {}, {
    defaultGamesView: isAuthenticated ? 'mine' : 'all',
    myGamesUserId: currentUser?.id,
  });
  const {
    refresh: refreshGroupFixtures,
    applyFilter: applyGroupFixturesFilter,
  } = groupFixtures;

  const stageFixtures = useStageFixtures(tournamentId, {
    stageId: activeProgressionStageId,
    stageName: activeProgressionStageMeta?.name || 'Stage',
    bestOf: Math.max(Number(activeProgressionStageMeta?.bestOf || 3), 1),
    groupsTabItems,
    defaultGamesView: isAuthenticated ? 'mine' : 'all',
    myGamesUserId: currentUser?.id,
    enabled: activeStageTabReady,
    isGroupStage: false,
  });
  const {
    loadAll: loadActiveStageFixtures,
    applyFilter: applyActiveStageFixturesFilter,
    refresh: refreshActiveStageFixtures,
  } = stageFixtures;

  const progressionStandingsSections = useMemo(
    () =>
      buildProgressionStandingsSections({
        stages: scoresheetMeta?.progressionPlan?.stages || [],
        stageGamesById,
        isDoubles,
      }),
    [isDoubles, scoresheetMeta?.progressionPlan?.stages, stageGamesById]
  );

  useLayoutEffect(() => {
    navigation.setOptions({ title: tournamentTitle });
  }, [navigation, tournamentTitle]);

  const hydrateScoreInputState = useCallback((items) => {
    const nextState = {};
    items.forEach((game) => {
      const bestOf = Math.max(Number(game.bestOf || 1), (game.scoreEntries || []).length, 1);
      const existingEntriesByGameNumber = new Map(
        (game.scoreEntries || []).map((entry) => [
          Number(entry.gameNumber),
          {
            gameNumber: Number(entry.gameNumber),
            playerAScore: String(entry.playerAScore ?? ''),
            playerBScore: String(entry.playerBScore ?? ''),
          },
        ])
      );
      const entries = Array.from({ length: bestOf }, (_, index) => {
        const gameNumber = index + 1;
        return (
          existingEntriesByGameNumber.get(gameNumber) || {
            gameNumber,
            playerAScore: '',
            playerBScore: '',
          }
        );
      });
      nextState[game.id] = {
        status: game.status || 'scheduled',
        entries: entries.map((entry, index) => ({
          gameNumber: String(entry.gameNumber || index + 1),
          playerAScore: String(entry.playerAScore ?? ''),
          playerBScore: String(entry.playerBScore ?? ''),
        })),
      };
    });
    setScoresByGameId((prev) => ({ ...prev, ...nextState }));
  }, []);

  const loadAllGamesByStage = useCallback(async (stageId, { playerQuery, player2Query } = {}) => {
    const normalizedPlayerQuery = String(playerQuery || '').trim();
    const normalizedPlayerTwoQuery = String(player2Query || '').trim();
    const params = {
      stageId,
      ...(normalizedPlayerQuery ? { playerQuery: normalizedPlayerQuery } : {}),
      ...(normalizedPlayerTwoQuery ? { player2Query: normalizedPlayerTwoQuery } : {}),
    };
    const response = await fetchScoresheetPages(tournamentId, params);
    const items = response.items || [];
    if (response.format) setIsDoubles(String(response.format) === 'doubles');
    if (response.pairFormationMode) setPairFormationMode(response.pairFormationMode);
    if (response.progressionState) setProgressionState(response.progressionState);
    return { items, total: Number(response.pagination?.total || items.length || 0) };
  }, [fetchScoresheetPages, tournamentId]);

  const loadStageScores = useCallback(
    async (stageId) => {
      const { items } = await loadAllGamesByStage(stageId);
      setStageGamesById((current) => ({ ...current, [stageId]: items }));
      hydrateScoreInputState(items);
      return items;
    },
    [hydrateScoreInputState, loadAllGamesByStage]
  );

  const buildGroupFallbackFromScoresheetGames = useCallback(async () => {
    const { items } = await loadAllGamesByStage('groupStage');
    const divisionsById = new Map();
    const gameStatsByPlayerId = new Map();
    const seenGameIds = new Set();

    const ensurePlayerStats = (playerId) => {
      const normalizedPlayerId = String(playerId || '').trim();
      if (!normalizedPlayerId) return null;
      if (!gameStatsByPlayerId.has(normalizedPlayerId)) {
        gameStatsByPlayerId.set(normalizedPlayerId, { totalGames: 0, gamesPlayed: 0 });
      }
      return gameStatsByPlayerId.get(normalizedPlayerId);
    };

    (items || []).forEach((game) => {
      const gameId = String(game.id || game._id || '').trim();
      if (!gameId || seenGameIds.has(gameId)) return;
      seenGameIds.add(gameId);

      const divisionId = String(game.divisionId || '').trim();
      if (!divisionId) return;

      if (!divisionsById.has(divisionId)) divisionsById.set(divisionId, new Map());
      const playersById = divisionsById.get(divisionId);
      const isPlayed = String(game.status || '') === 'completed';

      const sides = [
        { id: String(game.playerA?.id || game.playerAId || '').trim(), displayName: game.playerA?.displayName || game.playerAId },
        { id: String(game.playerB?.id || game.playerBId || '').trim(), displayName: game.playerB?.displayName || game.playerBId },
      ];

      sides.forEach((side) => {
        const playerStats = ensurePlayerStats(side.id);
        if (!playerStats) return;
        playerStats.totalGames += 1;
        if (isPlayed) playerStats.gamesPlayed += 1;
      });

      sides.forEach((side) => {
        if (!side.id || playersById.has(side.id)) return;
        playersById.set(side.id, { id: side.id, displayName: side.displayName || side.id });
      });
    });

    const serializedGameStatsByPlayerId = {};
    gameStatsByPlayerId.forEach((stats, playerId) => {
      const totalGames = Number(stats.totalGames || 0);
      const gamesPlayed = Number(stats.gamesPlayed || 0);
      serializedGameStatsByPlayerId[playerId] = {
        gamesPlayed,
        gamesRemaining: Math.max(totalGames - gamesPlayed, 0),
      };
    });

    return { divisionsById, gameStatsByPlayerId: serializedGameStatsByPlayerId };
  }, [loadAllGamesByStage]);

  const applyGroupFallback = useCallback((nextGroups, fallbackByDivisionId) => {
    const shouldApplyFallback =
      nextGroups.length === 0 || nextGroups.some((group) => (group.standings || []).length === 0);

    if (!shouldApplyFallback) return nextGroups;

    if (nextGroups.length > 0) {
      return nextGroups.map((group) => {
        if ((group.standings || []).length > 0) return group;
        const fallbackPlayers = [...(fallbackByDivisionId.get(String(group.divisionId))?.values() || [])];
        return {
          ...group,
          standings: fallbackPlayers.map((player, index) => ({
            playerId: player.id,
            player,
            rank: index + 1,
            wins: 0,
            losses: 0,
            points: 0,
          })),
        };
      });
    }

    if (fallbackByDivisionId.size > 0) {
      return [...fallbackByDivisionId.entries()].map(([divisionId, playersById], index) => ({
        divisionId,
        divisionName: buildGroupDisplayName(index),
        standings: [...playersById.values()].map((player, playerIndex) => ({
          playerId: player.id,
          player,
          rank: playerIndex + 1,
          wins: 0,
          losses: 0,
          points: 0,
        })),
      }));
    }

    return nextGroups;
  }, []);

  const onLoadGroupsTab = useCallback(async () => {
    try {
      setIsLoadingGroupsTab(true);
      clearError();
      let nextGroups = [];
      let standingsLoaded = false;

      try {
        const response = await queryClient.fetchQuery({
          queryKey: queryKeys.standings(tournamentId),
          queryFn: () => fetchTournamentGroupStandings(tournamentId),
          staleTime: STANDINGS_STALE_TIME_MS,
        });
        nextGroups = response.groups || [];
        setHandicapEnabled(Boolean(response.handicapEnabled));
        setIsDoubles(String(response.format || '') === 'doubles');
        if (response.pairFormationMode) setPairFormationMode(response.pairFormationMode);
        standingsLoaded = true;
      } catch (error) {
        const errorCode = error?.code || error?.response?.data?.error?.code;
        if (errorCode !== 'FORBIDDEN') throw error;
      }

      const fallbackData = await buildGroupFallbackFromScoresheetGames();
      setGroupPlayerGameStatsById(fallbackData.gameStatsByPlayerId || {});
      nextGroups = applyGroupFallback(nextGroups, fallbackData.divisionsById);
      setGroupsTabItems(nextGroups);

      const startedStages = (scoresheetMeta?.progressionPlan?.stages || []).filter(
        (stage) => stage.status === 'active' || stage.status === 'completed'
      );
      await Promise.all(startedStages.map((stage) => loadStageScores(stage.stageId)));

      if (!standingsLoaded && nextGroups.length === 0) clearError();
    } catch (error) {
      setGroupsTabItems([]);
      setGroupPlayerGameStatsById({});
      showError(formatApiError(error, 'Unable to load groups'));
    } finally {
      setIsLoadingGroupsTab(false);
      setHasLoadedGroupsTab(true);
    }
  }, [
    applyGroupFallback,
    buildGroupFallbackFromScoresheetGames,
    clearError,
    loadStageScores,
    queryClient,
    scoresheetMeta?.progressionPlan?.stages,
    showError,
    tournamentId,
  ]);

  const onLoadGamesTab = useCallback(async () => {
    try {
      clearError();
      const items = await refreshGroupFixtures({ preserveFilter: true });
      hydrateScoreInputState(items);
      setHasLoadedGamesTab(true);
    } catch (error) {
      showError(formatApiError(error, 'Unable to load games'));
      setHasLoadedGamesTab(true);
    }
  }, [clearError, hydrateScoreInputState, refreshGroupFixtures, showError]);

  const onApplyGamesFilter = useCallback(async () => {
    try {
      clearError();
      const matches = await applyGroupFixturesFilter();
      hydrateScoreInputState(matches);
    } catch (error) {
      showError(formatApiError(error, 'Unable to filter matches'));
    }
  }, [applyGroupFixturesFilter, clearError, hydrateScoreInputState, showError]);

  const onApplyStageFilter = useCallback(async () => {
    try {
      clearError();
      setLoadingStageId(activeProgressionStageId);
      const matches = await applyActiveStageFixturesFilter();
      hydrateScoreInputState(matches);
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
      hydrateScoreInputState(items);
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

  useEffect(() => {
    if (standingsMeta) {
      setIsDoubles(String(standingsMeta.format || '') === 'doubles');
      if (standingsMeta.pairFormationMode) setPairFormationMode(standingsMeta.pairFormationMode);
      if (standingsMeta.progressionState) setProgressionState(standingsMeta.progressionState);
    }
    if (scoresheetMeta) {
      if (scoresheetMeta.format) setIsDoubles(String(scoresheetMeta.format) === 'doubles');
      if (scoresheetMeta.pairFormationMode) setPairFormationMode(scoresheetMeta.pairFormationMode);
      if (scoresheetMeta.progressionState) setProgressionState(scoresheetMeta.progressionState);
    }
    if (standingsMeta || scoresheetMeta) setTournamentMetaReady(true);
  }, [scoresheetMeta, standingsMeta]);

  useEffect(() => {
    if (!tournamentMetaReady || initialTabSetRef.current) return;
    initialTabSetRef.current = true;
    if (isDoubles && !groupsLocked && isAuthenticated) {
      setActiveTab('teams');
      return;
    }
    if (isDoubles && groupsLocked) setActiveTab('games');
  }, [groupsLocked, isDoubles, isAuthenticated, tournamentMetaReady]);

  useEffect(() => {
    if (activeTab === 'teams' && !isAuthenticated) {
      setActiveTab('groups');
    }
  }, [activeTab, isAuthenticated]);

  useEffect(() => {
    if (activeTab === 'groups' && !hasLoadedGroupsTab) {
      onLoadGroupsTab();
    }
    if (activeTab === 'games' && !hasLoadedGamesTab) {
      onLoadGamesTab();
    }
    if (activeTab === 'teams' && !hasLoadedGroupsTab && !isLoadingGroupsTab) onLoadGroupsTab();
  }, [
    activeTab,
    hasLoadedGamesTab,
    hasLoadedGroupsTab,
    isLoadingGroupsTab,
    onLoadGamesTab,
    onLoadGroupsTab,
  ]);

  useEffect(() => {
    if (!activeProgressionStageId || !activeStageTabReady) {
      return;
    }

    const stageId = activeProgressionStageId;
    let cancelled = false;

    (async () => {
      setLoadingStageId(stageId);
      try {
        const items = await loadActiveStageFixtures();
        if (!cancelled) {
          hydrateScoreInputState(items);
          setStageGamesById((current) => ({ ...current, [stageId]: items }));
        }
      } catch (error) {
        if (!cancelled) {
          showError(formatApiError(error, 'Unable to load stage matches'));
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
    activeStageTabReady,
    hydrateScoreInputState,
    loadActiveStageFixtures,
    showError,
  ]);

  const isLoadingGamesTab = groupFixtures.isLoading;
  const displaySections = groupFixtures.displaySections;
  const fixtureSummaryText = groupFixtures.fixtureSummaryText;

  const onToggleRound = useCallback((roundKey) => {
    setExpandedRoundKey((prev) => (prev === roundKey ? null : roundKey));
  }, []);

  const onToggleSection = useCallback(
    (sectionId) => {
      setExpandedSectionId((prev) => {
        if (prev === sectionId) {
          setExpandedRoundKey(null);
          return null;
        }

        const sections =
          activeTab === 'games'
            ? groupFixtures.displaySections
            : activeTab.startsWith('stage:')
              ? stageFixtures.displaySections
              : [];

        const section = sections.find((item) => item.sectionId === sectionId);
        setExpandedRoundKey(findActiveFixtureRoundKeyForSection(section));
        return sectionId;
      });
    },
    [activeTab, groupFixtures.displaySections, stageFixtures.displaySections]
  );

  const resolveGroupPlayerGameStats = useCallback(
    (entry) =>
      groupPlayerGameStatsById[String(entry.playerId)] || { gamesPlayed: 0, gamesRemaining: 0 },
    [groupPlayerGameStatsById]
  );

  if (!tournamentMetaReady) {
    return <ScreenSkeleton />;
  }

  return (
    <ScreenScrollShell contentContainerStyle={{ gap: 16 }}>
      <View style={{ marginBottom: 16 }}>
        <TournamentScreenHero
          eyebrow="SCORESHEET"
          title={tournamentTitle}
          subtitle="Follow standings, fixtures, and results as the tournament progresses."
          badges={[{ label: 'View only', tone: 'primary' }]}
          stats={[
            { label: 'GROUPS', value: String(groupsTabItems.length) },
            { label: 'FIXTURES', value: String(displaySections.length) },
            { label: 'ROUNDS', value: String(stageTabs.length) },
          ]}
        />
      </View>

      <View style={{ marginBottom: 12 }}>
        <ReadOnlyBanner />
      </View>

      <ScoresheetTabLayout tabs={scoresheetTabs} activeTab={activeTab} onSelectTab={setActiveTab}>
      {activeTab === 'teams' ? (
        <TeamsSection
          tournamentId={tournamentId}
          isHost={false}
          pairFormationMode={pairFormationMode}
          groupsLocked={groupsLocked}
          currentUserId={currentUser?.id}
          onError={(error) => showError(formatApiError(error, 'Unable to update teams'))}
        />
      ) : activeTab === 'groups' ? (
        <ScoresheetGroupsTab
          isLoadingGroupsTab={isLoadingGroupsTab}
          groupsTabItems={groupsTabItems}
          resolveGroupPlayerGameStats={resolveGroupPlayerGameStats}
          handicapEnabled={handicapEnabled}
          onLoadGroupsTab={onLoadGroupsTab}
          progressionStandingsSections={progressionStandingsSections}
          isDoubles={isDoubles}
        />
      ) : activeTab === 'games' ? (
        <ScoresheetGamesTab
          isLoadingGamesTab={isLoadingGamesTab}
          displaySections={displaySections}
          fixtureSummaryText={fixtureSummaryText}
          scoresByGameId={scoresByGameId}
          expandedSectionId={expandedSectionId}
          onToggleSection={onToggleSection}
          expandedRoundKey={expandedRoundKey}
          onToggleRound={onToggleRound}
          onLoadGamesTab={onLoadGamesTab}
          isFilterExpanded={groupFixtures.isFilterExpanded}
          onToggleFilter={groupFixtures.toggleFilterExpanded}
          playerFilterInput={groupFixtures.playerFilterInput}
          onPlayerFilterInputChange={groupFixtures.setPlayerFilterInput}
          opponentFilterInput={groupFixtures.opponentFilterInput}
          onOpponentFilterInputChange={groupFixtures.setOpponentFilterInput}
          onClearFilter={groupFixtures.clearFilter}
          onApplyFilter={onApplyGamesFilter}
          hasActiveFilter={groupFixtures.hasActiveGamesFilter}
          activeRoundKey={groupFixtures.activeRoundKey}
          defaultSeriesMaxGames={3}
          showMyGamesToggle={isAuthenticated}
          isMyGamesView={groupFixtures.isMyGamesView}
          onSetGamesView={groupFixtures.setGamesView}
        />
      ) : activeTab.startsWith('stage:') ? (
        (() => {
          const stageId = activeTab.replace('stage:', '');
          const stage =
            stageTabs.find((entry) => String(entry.stageId) === String(stageId)) || {
              stageId,
              name: scoresheetTabs.find((tab) => tab.id === activeTab)?.label || 'Stage',
              status: 'active',
            };

          return (
            <StageTabView
              stage={stage}
              isLoading={loadingStageId === stageId || stageFixtures.isLoading}
              games={stageFixtures.games}
              displaySections={stageFixtures.displaySections}
              scoreInputsByGameId={scoresByGameId}
              onChangeScoreInput={() => {}}
              savingGameId={null}
              onSaveMatchScores={() => {}}
              canEdit={false}
              showSaveButton={false}
              viewOnly
              expandedSectionId={expandedSectionId}
              onToggleSection={onToggleSection}
              expandedRoundKey={expandedRoundKey}
              onToggleRound={onToggleRound}
              defaultSeriesMaxGames={Math.max(Number(stage.bestOf || 3), 1)}
              showStageProgressionPanel={false}
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
              showMyGamesToggle={isAuthenticated}
              isMyGamesView={stageFixtures.isMyGamesView}
              onSetGamesView={stageFixtures.setGamesView}
            />
          );
        })()
      ) : null}
      </ScoresheetTabLayout>

      <FeedbackModal visible={Boolean(errorMessage)} message={errorMessage} onDismiss={clearError} />
    </ScreenScrollShell>
  );
}
