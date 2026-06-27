import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import {
  ReadOnlyBanner,
  TournamentScreenHero,
  TournamentSegmentTabs,
} from '../components/tournament/TournamentChrome';
import { useGroupStageFixtures } from '../hooks/useGroupStageFixtures';
import { useQueryClient } from '@tanstack/react-query';
import { formatApiError, useScreenFeedback } from '../hooks/useScreenFeedback';
import { useFetchScoresheetPages, useScoresheetMeta } from '../hooks/queries/useScoresheetPages';
import { useTournamentGroupStandings } from '../hooks/queries/useTournamentGroupStandings';
import { queryKeys } from '../hooks/queries/queryKeys';
import { STANDINGS_STALE_TIME_MS } from '../config/queryClient';
import {
  acceptTournamentProctorTransfer,
  declineTournamentProctorTransfer,
  fetchTournamentGroupStandings,
  requestTournamentProctorTransfer,
  updateTournamentGameSchedule,
} from '../services/tournamentService';
import { useAuth } from '../context/AuthContext';
import { ProctorHandoffPanel } from '../components/tournament/ProctorHandoffPanel';
import { TeamsSection } from './tournamentDetail/TeamsSection';
import { MatchScheduleModal } from '../components/tournament/MatchScheduleModal';
import { tournamentUi } from '../styles/tournamentUi';
import { findActiveFixtureRoundKeyForSection } from '../utils/fixtureDisplay';
import { buildGroupDisplayName } from '../utils/groupNaming';
import { ScoresheetGroupsTab } from '../components/scoresheet/ScoresheetGroupsTab';
import { ScoresheetGamesTab } from '../components/scoresheet/ScoresheetGamesTab';
import { ScoresheetFinaleTab } from '../components/scoresheet/ScoresheetFinaleTab';

const BASE_SCORESHEET_TABS = [
  { id: 'groups', label: 'Groups' },
  { id: 'games', label: 'Games' },
  { id: 'finale', label: 'Finale' },
];

export function ScoresheetScreen({ route, navigation }) {
  const tournamentId = route?.params?.tournamentId;
  const tournamentTitle = route?.params?.tournamentName || 'Tournament';
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const fetchScoresheetPages = useFetchScoresheetPages();
  const { data: standingsMeta } = useTournamentGroupStandings(tournamentId, {}, { enabled: Boolean(tournamentId) });
  const { data: scoresheetMeta } = useScoresheetMeta(tournamentId, { enabled: Boolean(tournamentId) });
  const [activeTab, setActiveTab] = useState('groups');
  const [canEditPatternScores, setCanEditPatternScores] = useState(false);
  const [proctorTransferRequest, setProctorTransferRequest] = useState(null);
  const [assignedProctors, setAssignedProctors] = useState([]);
  const [isProctorActionBusy, setIsProctorActionBusy] = useState(false);

  const [groupsTabItems, setGroupsTabItems] = useState([]);
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [groupPlayerGameStatsById, setGroupPlayerGameStatsById] = useState({});
  const [isLoadingGroupsTab, setIsLoadingGroupsTab] = useState(false);
  const [hasLoadedGroupsTab, setHasLoadedGroupsTab] = useState(false);

  const [hasLoadedGamesTab, setHasLoadedGamesTab] = useState(false);

  const [finaleGames, setFinaleGames] = useState([]);
  const [isLoadingFinaleTab, setIsLoadingFinaleTab] = useState(false);
  const [hasLoadedFinaleTab, setHasLoadedFinaleTab] = useState(false);

  const [scoresByGameId, setScoresByGameId] = useState({});
  const { errorMessage, showError, clearError } = useScreenFeedback({ successAutoClearMs: 0 });
  const [expandedRoundKey, setExpandedRoundKey] = useState(null);
  const [expandedSectionId, setExpandedSectionId] = useState(null);
  const [expandedFinalRoundNumber, setExpandedFinalRoundNumber] = useState(null);
  const [groupStageProctored, setGroupStageProctored] = useState(false);
  const [finalStageProctored, setFinalStageProctored] = useState(false);
  const [isDoubles, setIsDoubles] = useState(false);
  const [pairFormationMode, setPairFormationMode] = useState('playerPicksPartner');
  const [progressionState, setProgressionState] = useState('registration');
  const [tournamentMetaReady, setTournamentMetaReady] = useState(false);
  const initialTabSetRef = useRef(false);
  const [scheduleTarget, setScheduleTarget] = useState(null);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  const groupsLocked = ['groupStage', 'finalStage', 'completed'].includes(progressionState);

  const scoresheetTabs = useMemo(() => {
    if (!isDoubles) return BASE_SCORESHEET_TABS;
    return [
      BASE_SCORESHEET_TABS[0],
      { id: 'teams', label: 'Teams' },
      BASE_SCORESHEET_TABS[1],
      BASE_SCORESHEET_TABS[2],
    ];
  }, [isDoubles]);

  const groupFixtures = useGroupStageFixtures(tournamentId, groupsTabItems, {}, {
    defaultGamesView: 'mine',
    myGamesUserId: currentUser?.id,
  });

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

  const loadAllGamesByStage = useCallback(async (stage, { playerQuery, player2Query } = {}) => {
    const normalizedPlayerQuery = String(playerQuery || '').trim();
    const normalizedPlayerTwoQuery = String(player2Query || '').trim();
    const params = {
      stage,
      ...(normalizedPlayerQuery ? { playerQuery: normalizedPlayerQuery } : {}),
      ...(normalizedPlayerTwoQuery ? { player2Query: normalizedPlayerTwoQuery } : {}),
    };
    const response = await fetchScoresheetPages(tournamentId, params);
    const items = response.items || [];
    setCanEditPatternScores(Boolean(response.canEdit));
    setProctorTransferRequest(response.proctorTransferRequest || null);
    setAssignedProctors(response.proctors || []);
    if (response.format) setIsDoubles(String(response.format) === 'doubles');
    if (response.pairFormationMode) setPairFormationMode(response.pairFormationMode);
    if (response.progressionState) setProgressionState(response.progressionState);
    if (stage === 'groupStage') setGroupStageProctored(Boolean(response.groupStageProctored));
    if (stage === 'finalStage') setFinalStageProctored(Boolean(response.finalStageProctored));
    return { items, total: Number(response.pagination?.total || items.length || 0) };
  }, [fetchScoresheetPages, tournamentId]);

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

      if (!standingsLoaded && nextGroups.length === 0) clearError();
    } catch (error) {
      setGroupsTabItems([]);
      setGroupPlayerGameStatsById({});
      showError(formatApiError(error, 'Unable to load groups'));
    } finally {
      setIsLoadingGroupsTab(false);
      setHasLoadedGroupsTab(true);
    }
  }, [applyGroupFallback, buildGroupFallbackFromScoresheetGames, clearError, queryClient, showError, tournamentId]);

  const onLoadGamesTab = useCallback(async () => {
    try {
      clearError();
      const items = await groupFixtures.loadAll();
      hydrateScoreInputState(items);
      setHasLoadedGamesTab(true);
    } catch (error) {
      showError(formatApiError(error, 'Unable to load games'));
      setHasLoadedGamesTab(true);
    }
  }, [clearError, groupFixtures, hydrateScoreInputState, showError]);

  const onLoadFinaleTab = useCallback(async () => {
    try {
      setIsLoadingFinaleTab(true);
      clearError();
      const response = await loadAllGamesByStage('finalStage');
      setFinaleGames(response.items || []);
      hydrateScoreInputState(response.items || []);
      const roundNumbers = [...new Set((response.items || []).map((item) => Number(item.roundNumber || 1)))].sort((l, r) => l - r);
      setExpandedFinalRoundNumber(roundNumbers[0] || null);
      setHasLoadedFinaleTab(true);
    } catch (error) {
      setFinaleGames([]);
      showError(formatApiError(error, 'Unable to load finale matches'));
    } finally {
      setIsLoadingFinaleTab(false);
    }
  }, [clearError, hydrateScoreInputState, loadAllGamesByStage, showError]);

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
    if (isDoubles && !groupsLocked) { setActiveTab('teams'); return; }
    if (isDoubles && groupsLocked) setActiveTab('games');
  }, [groupsLocked, isDoubles, tournamentMetaReady]);

  useEffect(() => {
    if (activeTab === 'groups' && !hasLoadedGroupsTab) onLoadGroupsTab();
    if (activeTab === 'games' && !hasLoadedGamesTab) onLoadGamesTab();
    if (activeTab === 'games' && !hasLoadedGroupsTab && !isLoadingGroupsTab) onLoadGroupsTab();
    if (activeTab === 'finale' && !hasLoadedFinaleTab) onLoadFinaleTab();
    if (activeTab === 'teams' && !hasLoadedGroupsTab && !isLoadingGroupsTab) onLoadGroupsTab();
  }, [
    activeTab,
    hasLoadedFinaleTab,
    hasLoadedGamesTab,
    hasLoadedGroupsTab,
    isLoadingGroupsTab,
    onLoadFinaleTab,
    onLoadGamesTab,
    onLoadGroupsTab,
  ]);

  const isLoadingGamesTab = groupFixtures.isLoading;
  const displaySections = groupFixtures.displaySections;
  const fixtureSummaryText = groupFixtures.fixtureSummaryText;

  const groupedFinaleRounds = useMemo(() => {
    const groupedByRound = (finaleGames || []).reduce((acc, game) => {
      const roundNumber = Number(game.roundNumber || 1);
      if (!acc.has(roundNumber)) acc.set(roundNumber, []);
      acc.get(roundNumber).push(game);
      return acc;
    }, new Map());
    return [...groupedByRound.entries()]
      .sort((l, r) => l[0] - r[0])
      .map(([roundNumber, roundGames]) => ({ roundNumber, matches: roundGames }));
  }, [finaleGames]);

  const activeFinalRoundNumber = useMemo(() => {
    const pendingRound = groupedFinaleRounds.find((round) =>
      (round.matches || []).some((match) => String(match.status || '') !== 'completed')
    );
    return pendingRound?.roundNumber || groupedFinaleRounds[0]?.roundNumber || null;
  }, [groupedFinaleRounds]);

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
        const section = groupFixtures.displaySections.find((item) => item.sectionId === sectionId);
        setExpandedRoundKey(findActiveFixtureRoundKeyForSection(section));
        return sectionId;
      });
    },
    [groupFixtures.displaySections]
  );

  const onToggleFinalRound = useCallback((roundNumber) => {
    setExpandedFinalRoundNumber((prev) => (prev === roundNumber ? null : roundNumber));
  }, []);

  const onScheduleMatch = useCallback((target) => {
    setScheduleTarget(target);
  }, []);

  const onSaveMatchSchedule = useCallback(
    async (scheduledStartAt) => {
      if (!scheduleTarget?.gameId || !tournamentId) return;
      try {
        setIsSavingSchedule(true);
        clearError();
        const updated = await updateTournamentGameSchedule(tournamentId, scheduleTarget.gameId, { scheduledStartAt });
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
    [clearError, groupFixtures, scheduleTarget, showError, tournamentId]
  );

  const resolveGroupPlayerGameStats = useCallback(
    (entry) =>
      groupPlayerGameStatsById[String(entry.playerId)] || { gamesPlayed: 0, gamesRemaining: 0 },
    [groupPlayerGameStatsById]
  );

  return (
    <ScrollView
      style={tournamentUi.screen}
      contentContainerStyle={tournamentUi.content}
      removeClippedSubviews={false}
    >
      <View style={{ marginBottom: 16 }}>
        <TournamentScreenHero
          eyebrow="SCORESHEET"
          title={tournamentTitle}
          subtitle="Follow standings, fixtures, and results as the tournament progresses."
          badges={[{ label: canEditPatternScores ? 'Proctor view' : 'View only', tone: 'primary' }]}
          stats={[
            { label: 'GROUPS', value: String(groupsTabItems.length) },
            { label: 'FIXTURES', value: String(displaySections.length) },
            { label: 'FINALE ROUNDS', value: String(groupedFinaleRounds.length) },
          ]}
        />
      </View>

      <View style={{ marginBottom: 12 }}>
        <ProctorHandoffPanel
          currentUserId={currentUser?.id}
          proctors={assignedProctors}
          proctorTransferRequest={proctorTransferRequest}
          isBusy={isProctorActionBusy}
          onRequestTransfer={async (targetUserId) => {
            try {
              setIsProctorActionBusy(true);
              await requestTournamentProctorTransfer(tournamentId, targetUserId);
              setProctorTransferRequest({ toUserId: targetUserId, fromUserId: currentUser?.id });
            } catch (error) {
              showError(formatApiError(error, 'Unable to request proctor handoff'));
            } finally {
              setIsProctorActionBusy(false);
            }
          }}
          onAcceptTransfer={async () => {
            try {
              setIsProctorActionBusy(true);
              await acceptTournamentProctorTransfer(tournamentId);
              setCanEditPatternScores(true);
              setProctorTransferRequest(null);
            } catch (error) {
              showError(formatApiError(error, 'Unable to accept transfer'));
            } finally {
              setIsProctorActionBusy(false);
            }
          }}
          onDeclineTransfer={async () => {
            try {
              setIsProctorActionBusy(true);
              await declineTournamentProctorTransfer(tournamentId);
              setProctorTransferRequest(null);
            } catch (error) {
              showError(formatApiError(error, 'Unable to decline transfer'));
            } finally {
              setIsProctorActionBusy(false);
            }
          }}
        />
        {!canEditPatternScores && <ReadOnlyBanner />}
      </View>

      <View style={{ marginBottom: 16 }}>
        <TournamentSegmentTabs tabs={scoresheetTabs} activeTab={activeTab} onSelectTab={setActiveTab} />
      </View>

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
        />
      ) : activeTab === 'games' ? (
        <ScoresheetGamesTab
          groupFixtures={groupFixtures}
          displaySections={displaySections}
          fixtureSummaryText={fixtureSummaryText}
          isLoadingGamesTab={isLoadingGamesTab}
          scoresByGameId={scoresByGameId}
          expandedSectionId={expandedSectionId}
          onToggleSection={onToggleSection}
          expandedRoundKey={expandedRoundKey}
          onToggleRound={onToggleRound}
          canEditPatternScores={canEditPatternScores}
          groupStageProctored={groupStageProctored}
          tournamentId={tournamentId}
          navigation={navigation}
          onScheduleMatch={onScheduleMatch}
          onLoadGamesTab={onLoadGamesTab}
        />
      ) : (
        <ScoresheetFinaleTab
          groupedFinaleRounds={groupedFinaleRounds}
          isLoadingFinaleTab={isLoadingFinaleTab}
          activeFinalRoundNumber={activeFinalRoundNumber}
          expandedFinalRoundNumber={expandedFinalRoundNumber}
          onToggleFinalRound={onToggleFinalRound}
          onLoadFinaleTab={onLoadFinaleTab}
          onExpandToggle={() => {
            if (groupedFinaleRounds.length === 0) return;
            setExpandedFinalRoundNumber((prev) => (prev === null ? activeFinalRoundNumber : null));
          }}
          scoresByGameId={scoresByGameId}
        />
      )}
    </ScrollView>
  );
}
