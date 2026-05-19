import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { FeedbackModal } from '../components/FeedbackModal';
import {
  EmptyStateCard,
  FixtureFilterPanel,
  FixtureSummaryBar,
  GroupStandingsCard,
  ReadOnlyBanner,
  SectionCard,
  TabStatsRow,
  TournamentScreenHero,
  TournamentSegmentTabs,
  ToolbarIconButton,
} from '../components/tournament/TournamentChrome';
import { RoundMatchesDisplay } from '../components/RoundMatchesDisplay';
import { useGroupStageFixtures } from '../hooks/useGroupStageFixtures';
import { formatApiError, useScreenFeedback } from '../hooks/useScreenFeedback';
import {
  fetchTournamentGroupStandings,
  fetchTournamentScoresheet,
} from '../services/tournamentService';
import { tournamentUi } from '../styles/tournamentUi';
import { findActiveFixtureRoundKeyForSection } from '../utils/fixtureDisplay';
import { buildGroupDisplayName } from '../utils/groupNaming';

const isPlayedScoreEntry = (entry) => {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return false;
  }

  return !(playerAScore === 0 && playerBScore === 0);
};

const normalizePlayerId = (value) => String(value || '').trim();

const buildGamePlayerIds = (game) => ({
  playerAId: normalizePlayerId(game.playerA?.userId || game.playerA?.id || game.playerAId),
  playerBId: normalizePlayerId(game.playerB?.userId || game.playerB?.id || game.playerBId),
});

const SCORESHEET_TABS = [
  { id: 'groups', label: 'Groups' },
  { id: 'games', label: 'Games' },
  { id: 'finale', label: 'Finale' },
];

export function ScoresheetScreen({ route }) {
  const tournamentId = route?.params?.tournamentId;
  const tournamentTitle = route?.params?.tournamentName || 'Tournament';
  const [activeTab, setActiveTab] = useState('groups');

  const [groupsTabItems, setGroupsTabItems] = useState([]);
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

  const groupFixtures = useGroupStageFixtures(tournamentId, groupsTabItems, {});

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

    setScoresByGameId((previousState) => ({
      ...previousState,
      ...nextState,
    }));
  }, []);

  const loadAllGamesByStage = useCallback(async (stage, { playerQuery, player2Query } = {}) => {
    const items = [];
    let page = 1;
    let totalPages = 1;
    let total = 0;
    const normalizedPlayerQuery = String(playerQuery || '').trim();
    const normalizedPlayerTwoQuery = String(player2Query || '').trim();

    while (page <= totalPages) {
      const response = await fetchTournamentScoresheet(tournamentId, {
        page,
        pageSize: 100,
        stage,
        ...(normalizedPlayerQuery ? { playerQuery: normalizedPlayerQuery } : {}),
        ...(normalizedPlayerTwoQuery ? { player2Query: normalizedPlayerTwoQuery } : {}),
      });

      if (page === 1) {
        total = Number(response.pagination?.total || 0);
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

    return {
      items,
      total,
    };
  }, [tournamentId]);

  const buildGroupFallbackFromScoresheetGames = useCallback(async () => {
    const { items } = await loadAllGamesByStage('groupStage');

    const divisionsById = new Map();
    const gameStatsByPlayerId = new Map();
    const seenGameIds = new Set();

    const ensurePlayerStats = (playerId) => {
      const normalizedPlayerId = String(playerId || '').trim();

      if (!normalizedPlayerId) {
        return null;
      }

      if (!gameStatsByPlayerId.has(normalizedPlayerId)) {
        gameStatsByPlayerId.set(normalizedPlayerId, {
          totalGames: 0,
          gamesPlayed: 0,
        });
      }

      return gameStatsByPlayerId.get(normalizedPlayerId);
    };

    (items || []).forEach((game) => {
      const gameId = String(game.id || game._id || '').trim();
      if (!gameId || seenGameIds.has(gameId)) {
        return;
      }
      seenGameIds.add(gameId);

      const divisionId = String(game.divisionId || '').trim();

      if (!divisionId) {
        return;
      }

      if (!divisionsById.has(divisionId)) {
        divisionsById.set(divisionId, new Map());
      }

      const playersById = divisionsById.get(divisionId);
      const isPlayed = String(game.status || '') === 'completed';

      const sides = [
        {
          id: String(game.playerA?.id || game.playerAId || '').trim(),
          displayName: game.playerA?.displayName || game.playerAId,
        },
        {
          id: String(game.playerB?.id || game.playerBId || '').trim(),
          displayName: game.playerB?.displayName || game.playerBId,
        },
      ];

      sides.forEach((side) => {
        const playerStats = ensurePlayerStats(side.id);

        if (!playerStats) {
          return;
        }

        playerStats.totalGames += 1;

        if (isPlayed) {
          playerStats.gamesPlayed += 1;
        }
      });

      sides.forEach((side) => {
        if (!side.id || playersById.has(side.id)) {
          return;
        }

        playersById.set(side.id, {
          id: side.id,
          displayName: side.displayName || side.id,
        });
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

    return {
      divisionsById,
      gameStatsByPlayerId: serializedGameStatsByPlayerId,
    };
  }, [loadAllGamesByStage]);

  const applyGroupFallback = useCallback((nextGroups, fallbackByDivisionId) => {
    const shouldApplyFallback =
      nextGroups.length === 0 || nextGroups.some((group) => (group.standings || []).length === 0);

    if (!shouldApplyFallback) {
      return nextGroups;
    }

    if (nextGroups.length > 0) {
      return nextGroups.map((group) => {
        if ((group.standings || []).length > 0) {
          return group;
        }

        const fallbackPlayers = [...(fallbackByDivisionId.get(String(group.divisionId))?.values() || [])];
        const fallbackStandings = fallbackPlayers.map((player, index) => ({
          playerId: player.id,
          player,
          rank: index + 1,
          wins: 0,
          losses: 0,
          points: 0,
        }));

        return {
          ...group,
          standings: fallbackStandings,
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
        const response = await fetchTournamentGroupStandings(tournamentId);
        nextGroups = response.groups || [];
        standingsLoaded = true;
      } catch (error) {
        const errorCode = error?.code || error?.response?.data?.error?.code;

        if (errorCode !== 'FORBIDDEN') {
          throw error;
        }
      }

      const fallbackData = await buildGroupFallbackFromScoresheetGames();
      const fallbackByDivisionId = fallbackData.divisionsById;
      setGroupPlayerGameStatsById(fallbackData.gameStatsByPlayerId || {});

      nextGroups = applyGroupFallback(nextGroups, fallbackByDivisionId);

      setGroupsTabItems(nextGroups);

      if (!standingsLoaded && nextGroups.length === 0) {
        clearError();
      }
    } catch (error) {
      setGroupsTabItems([]);
      setGroupPlayerGameStatsById({});
      showError(formatApiError(error, 'Unable to load groups'));
    } finally {
      setIsLoadingGroupsTab(false);
      setHasLoadedGroupsTab(true);
    }
  }, [applyGroupFallback, buildGroupFallbackFromScoresheetGames, clearError, showError, tournamentId]);

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
      const roundNumbers = [...new Set((response.items || []).map((item) => Number(item.roundNumber || 1)))].sort((left, right) => left - right);
      setExpandedFinalRoundNumber(roundNumbers[0] || null);
      setHasLoadedFinaleTab(true);
    } catch (error) {
      setFinaleGames([]);
      showError(formatApiError(error, 'Unable to load finale matches'));
    } finally {
      setIsLoadingFinaleTab(false);
    }
  }, [hydrateScoreInputState, loadAllGamesByStage]);

  useEffect(() => {
    if (activeTab === 'groups' && !hasLoadedGroupsTab) {
      onLoadGroupsTab();
    }

    if (activeTab === 'games' && !hasLoadedGamesTab) {
      onLoadGamesTab();
    }

    if (activeTab === 'games' && !hasLoadedGroupsTab && !isLoadingGroupsTab) {
      onLoadGroupsTab();
    }

    if (activeTab === 'finale' && !hasLoadedFinaleTab) {
      onLoadFinaleTab();
    }
  }, [
    activeTab,
    hasLoadedFinaleTab,
    hasLoadedGamesTab,
    hasLoadedGroupsTab,
    onLoadFinaleTab,
    onLoadGamesTab,
    onLoadGroupsTab,
  ]);

  const isLoadingGamesTab = groupFixtures.isLoading;
  const displaySections = groupFixtures.displaySections;
  const fixtureSummaryText = groupFixtures.fixtureSummaryText;
  const hasActiveGamesFilter = groupFixtures.hasActiveGamesFilter;

  const groupedFinaleRounds = useMemo(() => {
    const groupedByRound = (finaleGames || []).reduce((accumulator, game) => {
      const roundNumber = Number(game.roundNumber || 1);
      if (!accumulator.has(roundNumber)) {
        accumulator.set(roundNumber, []);
      }
      accumulator.get(roundNumber).push(game);
      return accumulator;
    }, new Map());

    return [...groupedByRound.entries()]
      .sort((left, right) => left[0] - right[0])
      .map(([roundNumber, roundGames]) => ({
        roundNumber,
        matches: roundGames,
      }));
  }, [finaleGames]);

  const activeFinalRoundNumber = useMemo(() => {
    const pendingRound = groupedFinaleRounds.find((round) =>
      (round.matches || []).some((match) => String(match.status || '') !== 'completed')
    );

    if (pendingRound) {
      return pendingRound.roundNumber;
    }

    return groupedFinaleRounds[0]?.roundNumber || null;
  }, [groupedFinaleRounds]);

  const onToggleRound = useCallback((roundKey) => {
    setExpandedRoundKey((previousRoundKey) => (previousRoundKey === roundKey ? null : roundKey));
  }, []);

  const onToggleSection = useCallback(
    (sectionId) => {
      setExpandedSectionId((previousSectionId) => {
        if (previousSectionId === sectionId) {
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
    setExpandedFinalRoundNumber((previousRoundNumber) =>
      previousRoundNumber === roundNumber ? null : roundNumber
    );
  }, []);

  const onApplyGamesFilter = useCallback(async () => {
    try {
      clearError();
      const matches = await groupFixtures.applyFilter();
      hydrateScoreInputState(matches);
    } catch (error) {
      showError(formatApiError(error, 'Unable to filter matches'));
    }
  }, [clearError, groupFixtures, hydrateScoreInputState, showError]);

  const renderMatchCard = useCallback(
    (game, roundNumber, matchNumber) => {
      const scoreState = scoresByGameId[game.id] || {
        status: game.status || 'scheduled',
        entries: Array.from({ length: Math.max(Number(game.bestOf || 1), 1) }, (_, index) => ({
          gameNumber: String(index + 1),
          playerAScore: '',
          playerBScore: '',
        })),
      };

      const expectedEntriesCount = Math.max(Number(game.bestOf || 1), 1);
      const scoreInputEntries = Array.from(
        { length: Math.max((scoreState.entries || []).length, expectedEntriesCount) },
        (_, entryIndex) => {
          const currentEntry = scoreState.entries?.[entryIndex];

          return {
            gameNumber: Number(currentEntry?.gameNumber || entryIndex + 1),
            playerAScore: String(currentEntry?.playerAScore ?? ''),
            playerBScore: String(currentEntry?.playerBScore ?? ''),
          };
        }
      );
      const completedGamesCount = (scoreInputEntries || []).filter((entry) => isPlayedScoreEntry(entry)).length;
      const playerAName = game.playerA?.displayName || game.playerAId;
      const playerBName = game.playerB?.displayName || game.playerBId;

      return (
        <View
          key={game.id}
          style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 10, gap: 8, backgroundColor: '#f9fafb' }}
        >
          <Text style={{ fontWeight: '600' }}>
            Match {matchNumber}: {playerAName} vs {playerBName}
          </Text>
          <Text style={{ color: '#4b5563' }}>
            Best of {game.bestOf} • Status: {game.status} • {completedGamesCount}/{expectedEntriesCount}
          </Text>

          <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#fff' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
              <Text style={{ width: 48, fontWeight: '600', color: '#374151', fontSize: 12 }}>Game</Text>
              <Text style={{ flex: 1, fontWeight: '600', color: '#374151', fontSize: 12 }} numberOfLines={1}>
                {playerAName}
              </Text>
              <Text style={{ flex: 1, fontWeight: '600', color: '#374151', fontSize: 12 }} numberOfLines={1}>
                {playerBName}
              </Text>
            </View>

            {scoreInputEntries.map((entry, entryIndex) => {
              const isLastEntry = entryIndex === scoreInputEntries.length - 1;
              const safeEntry = entry || {
                gameNumber: entryIndex + 1,
                playerAScore: '',
                playerBScore: '',
              };

              return (
                <View
                  key={`${game.id}-entry-${entryIndex}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 6,
                    borderBottomWidth: isLastEntry ? 0 : 1,
                    borderBottomColor: '#f3f4f6',
                  }}
                >
                  <Text style={{ width: 48, color: '#111827', fontWeight: '600', fontSize: 12 }}>G{entryIndex + 1}</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#fff', flex: 1 }}
                    placeholder="0"
                    value={safeEntry.playerAScore}
                    keyboardType="numeric"
                    editable={false}
                  />
                  <TextInput
                    style={{ borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, backgroundColor: '#fff', flex: 1 }}
                    placeholder="0"
                    value={safeEntry.playerBScore}
                    keyboardType="numeric"
                    editable={false}
                  />
                </View>
              );
            })}
          </View>
        </View>
      );
    },
    [scoresByGameId]
  );

  const resolveGroupPlayerGameStats = useCallback(
    (entry) =>
      groupPlayerGameStatsById[String(entry.playerId)] || {
        gamesPlayed: 0,
        gamesRemaining: 0,
      },
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
          badges={[{ label: 'View only', tone: 'primary' }]}
          stats={[
            { label: 'GROUPS', value: String(groupsTabItems.length) },
            { label: 'FIXTURES', value: String(displaySections.length) },
            { label: 'FINALE ROUNDS', value: String(groupedFinaleRounds.length) },
          ]}
        />
      </View>

      <View style={{ marginBottom: 12 }}>
        <ReadOnlyBanner />
      </View>

      <View style={{ marginBottom: 16 }}>
        <TournamentSegmentTabs tabs={SCORESHEET_TABS} activeTab={activeTab} onSelectTab={setActiveTab} />
      </View>

      <FeedbackModal visible={Boolean(errorMessage)} message={errorMessage} onDismiss={clearError} />

      {activeTab === 'groups' ? (
        <SectionCard
          title="Group standings"
          subtitle="Rankings update as group-stage matches are completed."
          headerAction={
            <ToolbarIconButton
              label={isLoadingGroupsTab ? '…' : 'Refresh'}
              onPress={onLoadGroupsTab}
              disabled={isLoadingGroupsTab}
            />
          }
        >
          {!isLoadingGroupsTab && groupsTabItems.length === 0 && (
            <EmptyStateCard
              emoji="📋"
              title="No groups yet"
              message="Standings appear after the host closes registration and assigns players to groups."
            />
          )}

          {groupsTabItems.map((group) => (
            <View key={group.divisionId} style={{ marginBottom: 12 }}>
              <GroupStandingsCard
                groupName={group.divisionName}
                standings={group.standings || []}
                resolvePlayerGameStats={resolveGroupPlayerGameStats}
                showExtendedStats
              />
            </View>
          ))}
        </SectionCard>
      ) : activeTab === 'games' ? (
        <SectionCard
          title="Group-stage fixtures"
          subtitle="Browse rounds and match results. Scoring is managed by the host."
          headerAction={
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <ToolbarIconButton
                label={groupFixtures.isFilterExpanded ? 'Hide filter' : 'Filter'}
                onPress={groupFixtures.toggleFilterExpanded}
              />
              <ToolbarIconButton
                label={isLoadingGamesTab ? '…' : 'Refresh'}
                onPress={onLoadGamesTab}
                disabled={isLoadingGamesTab}
              />
            </View>
          }
        >
          {Boolean(fixtureSummaryText) && (
            <View style={{ marginBottom: 12 }}>
              <FixtureSummaryBar text={fixtureSummaryText} />
            </View>
          )}

          {!isLoadingGamesTab && displaySections.length > 0 && (
            <View style={{ marginBottom: 12 }}>
              <TabStatsRow
                stats={[
                  { label: 'GROUPS', value: String(displaySections.length) },
                  {
                    label: 'MATCHES',
                    value: String(
                      displaySections.reduce((total, section) => total + Number(section.matchCount || 0), 0)
                    ),
                  },
                ]}
              />
            </View>
          )}

          {groupFixtures.isFilterExpanded && (
            <FixtureFilterPanel
              playerFilterInput={groupFixtures.playerFilterInput}
              onPlayerFilterInputChange={groupFixtures.setPlayerFilterInput}
              opponentFilterInput={groupFixtures.opponentFilterInput}
              onOpponentFilterInputChange={groupFixtures.setOpponentFilterInput}
              onClearFilter={groupFixtures.clearFilter}
              onApplyFilter={onApplyGamesFilter}
              isLoading={isLoadingGamesTab}
            />
          )}

          {hasActiveGamesFilter && displaySections.length === 0 && !isLoadingGamesTab && (
            <EmptyStateCard emoji="🔍" title="No matches found" message="Try different player names in the filter." />
          )}

          {!hasActiveGamesFilter && displaySections.length === 0 && !isLoadingGamesTab && (
            <EmptyStateCard
              emoji="🎱"
              title="No group-stage games"
              message="Fixtures will show here once the host generates the schedule."
            />
          )}

          {!isLoadingGamesTab && (
            <RoundMatchesDisplay
              displaySections={displaySections}
              fixtureSummaryText=""
              expandedSectionId={expandedSectionId}
              onToggleSection={onToggleSection}
              collapsibleSections
              expandedRoundKey={expandedRoundKey}
              onToggleRound={onToggleRound}
              scoreInputsByGameId={scoresByGameId}
              onChangeScoreInput={() => {}}
              savingGameId={null}
              canEditPatternScores={false}
              filteredActiveRoundNumber={groupFixtures.activeRoundKey}
              canShowFinalStageStep={false}
              isProgressing={false}
              isLoadingFinaleCandidates={false}
              onOpenFinaleModal={() => {}}
              onCompleteWithoutFinals={() => {}}
              showSaveButton={false}
              showAddSeriesButton={false}
              showFinaleActions={false}
            />
          )}
        </SectionCard>
      ) : (
        <SectionCard
          title="Finale bracket"
          subtitle="Knockout rounds and championship matches."
          headerAction={
            <View style={{ flexDirection: 'row', gap: 6 }}>
              <ToolbarIconButton
                label="Expand"
                onPress={() => {
                  if (groupedFinaleRounds.length === 0) {
                    return;
                  }

                  setExpandedFinalRoundNumber((previousRoundNumber) =>
                    previousRoundNumber === null ? activeFinalRoundNumber : null
                  );
                }}
              />
              <ToolbarIconButton
                label={isLoadingFinaleTab ? '…' : 'Refresh'}
                onPress={onLoadFinaleTab}
                disabled={isLoadingFinaleTab}
              />
            </View>
          }
        >
          {groupedFinaleRounds.length === 0 && !isLoadingFinaleTab && (
            <EmptyStateCard
              emoji="🏆"
              title="No finale matches yet"
              message="The bracket appears when the host starts the final stage."
            />
          )}

          {groupedFinaleRounds.length > 0 && (
            <TabStatsRow
              stats={[
                { label: 'ROUNDS', value: String(groupedFinaleRounds.length) },
                {
                  label: 'MATCHES',
                  value: String(
                    groupedFinaleRounds.reduce((total, round) => total + (round.matches || []).length, 0)
                  ),
                },
              ]}
            />
          )}

          {groupedFinaleRounds.map((round) => {
            const isRoundOpen = expandedFinalRoundNumber === round.roundNumber;
            const completedMatchesCount = (round.matches || []).filter((match) => match.status === 'completed').length;
            const totalMatchesCount = (round.matches || []).length;
            const isRoundCompleted = totalMatchesCount > 0 && completedMatchesCount === totalMatchesCount;

            return (
              <View
                key={`final-round-${round.roundNumber}`}
                style={{ marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' }}
              >
                <Pressable
                  onPress={() => onToggleFinalRound(round.roundNumber)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: 12,
                    backgroundColor: isRoundOpen ? '#f8fafc' : '#ffffff',
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <View style={{ flex: 1, gap: 4 }}>
                    <Text style={{ fontWeight: '800', fontSize: 15 }}>
                      Round {round.roundNumber} {isRoundCompleted ? '· Done' : ''}
                    </Text>
                    <Text style={{ color: '#64748b', fontSize: 12 }}>
                      {completedMatchesCount}/{totalMatchesCount} matches complete
                    </Text>
                  </View>
                  {round.roundNumber === activeFinalRoundNumber && (
                    <View style={{ backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, marginRight: 8 }}>
                      <Text style={{ color: '#166534', fontWeight: '700', fontSize: 11 }}>Current</Text>
                    </View>
                  )}
                  <Text style={{ fontSize: 18, fontWeight: '700', color: '#2563eb' }}>{isRoundOpen ? '⌃' : '⌄'}</Text>
                </Pressable>

                {isRoundOpen &&
                  (round.matches || []).map((match, matchIndex) =>
                    renderMatchCard(match, round.roundNumber, matchIndex + 1)
                  )}
              </View>
            );
          })}
        </SectionCard>
      )}
    </ScrollView>
  );
}
