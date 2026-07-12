import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  buildFixtureSectionsFromGames,
  countFixtureMatches,
  findActiveFixtureRoundKey,
} from '../utils/fixtureDisplay';
import { buildGroupDisplayName, buildDivisionOrderIndex } from '../utils/groupNaming';
import { mergeFilteredGamesAfterSave } from '../utils/fixtureFilterMerge';
import { buildPlayerSearchIndex, filterGamesByPlayerQueries, filterGamesByUserId } from '../utils/playerSearch';
import { SCORESHEET_STALE_TIME_MS } from '../config/queryClient';
import { queryKeys } from './queries/queryKeys';
import { fetchAllScoresheetPages } from './queries/tournamentQueryUtils';

const isPlayedScoreEntry = (entry) => {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return false;
  }

  return !(playerAScore === 0 && playerBScore === 0);
};

export function useStageFixtures(
  tournamentId,
  {
    stageId = null,
    stageName = 'Stage',
    bestOf = 1,
    groupsTabItems = [],
    defaultGamesView = 'all',
    myGamesUserId = null,
    enabled = true,
    isGroupStage = false,
  } = {}
) {
  const queryClient = useQueryClient();
  const resolvedBestOf = Math.max(Number(bestOf || 1), 1);
  const normalizedStageId = stageId ? String(stageId) : null;
  const isActive = Boolean(tournamentId && normalizedStageId && enabled);

  const [games, setGames] = useState([]);
  const [fixtureTotal, setFixtureTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [stageProctored, setStageProctored] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [playerFilterInput, setPlayerFilterInput] = useState('');
  const [opponentFilterInput, setOpponentFilterInput] = useState('');
  const [appliedPlayerFilter, setAppliedPlayerFilter] = useState('');
  const [appliedOpponentFilter, setAppliedOpponentFilter] = useState('');
  const [filterMatchedGames, setFilterMatchedGames] = useState(null);
  const [gamesView, setGamesView] = useState(defaultGamesView);

  useEffect(() => {
    setGames([]);
    setFixtureTotal(0);
    setFilterMatchedGames(null);
    setAppliedPlayerFilter('');
    setAppliedOpponentFilter('');
    setPlayerFilterInput('');
    setOpponentFilterInput('');
    setIsFilterExpanded(false);
    setGamesView(defaultGamesView);
  }, [defaultGamesView, normalizedStageId, tournamentId]);

  const loadStageScores = useCallback(
    async ({ playerQuery, player2Query, updateMainList = true } = {}) => {
      if (!isActive) {
        return [];
      }

      const normalizedPlayerQuery = String(playerQuery || '').trim();
      const normalizedPlayerTwoQuery = String(player2Query || '').trim();
      const params = {
        stageId: normalizedStageId,
        ...(normalizedPlayerQuery ? { playerQuery: normalizedPlayerQuery } : {}),
        ...(normalizedPlayerTwoQuery ? { player2Query: normalizedPlayerTwoQuery } : {}),
      };

      const response = await queryClient.fetchQuery({
        queryKey: queryKeys.scoresheet(tournamentId, params),
        queryFn: () => fetchAllScoresheetPages(tournamentId, params),
        staleTime: SCORESHEET_STALE_TIME_MS,
      });

      const items = response.items || [];

      if (updateMainList) {
        setCanEdit(Boolean(response.canEdit));
        setStageProctored(
          Boolean(
            isGroupStage
              ? response.groupStageProctored
              : response.finalStageProctored || response.groupStageProctored
          )
        );
        setFixtureTotal(Number(response.pagination?.total || items.length || 0));
        setGames(items);
      }

      return items;
    },
    [isActive, isGroupStage, normalizedStageId, queryClient, tournamentId]
  );

  const divisionNameById = useMemo(() => {
    const names = new Map();

    if (normalizedStageId && stageName) {
      names.set(normalizedStageId, stageName);
      names.set('__ungrouped', stageName);
    }

    (games || []).forEach((game) => {
      const divisionId = String(game.divisionId || normalizedStageId || '').trim();
      const divisionName = String(game.divisionName || stageName || '').trim();

      if (divisionId && divisionName) {
        names.set(divisionId, divisionName);
      }
    });

    if (isGroupStage) {
      (groupsTabItems || []).forEach((group, index) => {
        const divisionId = String(group?.divisionId || '').trim();

        if (!divisionId || names.has(divisionId)) {
          return;
        }

        names.set(divisionId, group.divisionName || buildGroupDisplayName(index));
      });
    }

    return names;
  }, [games, groupsTabItems, isGroupStage, normalizedStageId, stageName]);

  const divisionOrderIndex = useMemo(() => buildDivisionOrderIndex(games), [games]);

  const playerSearchIndex = useMemo(
    () => buildPlayerSearchIndex(groupsTabItems, games),
    [games, groupsTabItems]
  );

  const hasActiveGamesFilter = Boolean(
    String(appliedPlayerFilter || '').trim() || String(appliedOpponentFilter || '').trim()
  );

  const isMyGamesView = gamesView === 'mine';

  const filteredGames = useMemo(() => {
    let nextGames = games;

    if (isMyGamesView && myGamesUserId) {
      nextGames = filterGamesByUserId(nextGames, myGamesUserId, { playerSearchIndex });
    }

    if (Array.isArray(filterMatchedGames)) {
      return filterMatchedGames;
    }

    if (!String(appliedPlayerFilter || '').trim() && !String(appliedOpponentFilter || '').trim()) {
      return nextGames;
    }

    return filterGamesByPlayerQueries(nextGames, appliedPlayerFilter, appliedOpponentFilter, {
      playerSearchIndex,
    });
  }, [
    appliedOpponentFilter,
    appliedPlayerFilter,
    filterMatchedGames,
    games,
    isMyGamesView,
    myGamesUserId,
    playerSearchIndex,
  ]);

  const displaySections = useMemo(
    () =>
      buildFixtureSectionsFromGames(filteredGames, {
        divisionNameById,
        divisionOrderIndex,
        groupStageBestOf: resolvedBestOf,
        isPlayedScoreEntry,
      }),
    [divisionNameById, divisionOrderIndex, filteredGames, resolvedBestOf]
  );

  const fixtureLabel = isGroupStage ? 'group-stage' : String(stageName || 'stage').trim();

  const fixtureSummaryText = useMemo(() => {
    const loadedCount = countFixtureMatches(displaySections);

    if (loadedCount === 0) {
      return '';
    }

    const total = hasActiveGamesFilter || isMyGamesView
      ? loadedCount
      : Math.max(fixtureTotal, loadedCount, games.length);
    const sectionCount = displaySections.length;

    if (isMyGamesView) {
      return `${loadedCount} of your ${loadedCount === 1 ? 'match' : 'matches'}${sectionCount > 1 ? ` across ${sectionCount} sections` : ''}`;
    }

    if (hasActiveGamesFilter) {
      return `${loadedCount} matching ${loadedCount === 1 ? 'fixture' : 'fixtures'}${sectionCount > 1 ? ` across ${sectionCount} sections` : ''}`;
    }

    if (isGroupStage && sectionCount > 1) {
      return `${total} ${fixtureLabel} fixtures across ${sectionCount} groups (${displaySections.map((section) => `${section.sectionName}: ${section.matchCount}`).join(' • ')})`;
    }

    return `${total} ${fixtureLabel} ${total === 1 ? 'fixture' : 'fixtures'}`;
  }, [
    displaySections,
    fixtureLabel,
    fixtureTotal,
    games.length,
    hasActiveGamesFilter,
    isGroupStage,
    isMyGamesView,
  ]);

  const activeRoundKey = useMemo(() => findActiveFixtureRoundKey(displaySections), [displaySections]);

  const loadAll = useCallback(async () => {
    if (!isActive) {
      return [];
    }

    setIsLoading(true);

    try {
      if (!hasActiveGamesFilter) {
        setFilterMatchedGames(null);
      }

      return await loadStageScores({ updateMainList: true });
    } finally {
      setIsLoading(false);
    }
  }, [hasActiveGamesFilter, isActive, loadStageScores]);

  const applyFilter = useCallback(async () => {
    if (!isActive) {
      return [];
    }

    const normalizedPlayerFilter = String(playerFilterInput || '').trim();
    const normalizedOpponentFilter = String(opponentFilterInput || '').trim();

    setAppliedPlayerFilter(normalizedPlayerFilter);
    setAppliedOpponentFilter(normalizedOpponentFilter);
    setIsFilterExpanded(true);

    if (!normalizedPlayerFilter && !normalizedOpponentFilter) {
      setFilterMatchedGames(null);
      return [];
    }

    setIsLoading(true);
    setFilterMatchedGames([]);

    try {
      let allStageGames = games;

      if (allStageGames.length === 0) {
        allStageGames = await loadStageScores({ updateMainList: true });
      }

      const serverMatches = await loadStageScores({
        playerQuery: normalizedPlayerFilter,
        player2Query: normalizedOpponentFilter,
        updateMainList: false,
      });

      const searchIndex = buildPlayerSearchIndex(groupsTabItems, allStageGames);
      const clientMatches = filterGamesByPlayerQueries(
        allStageGames,
        normalizedPlayerFilter,
        normalizedOpponentFilter,
        { playerSearchIndex: searchIndex }
      );

      const mergedMatches = serverMatches.length > 0 ? serverMatches : clientMatches;
      setFilterMatchedGames(mergedMatches);
      return mergedMatches;
    } finally {
      setIsLoading(false);
    }
  }, [games, groupsTabItems, isActive, loadStageScores, opponentFilterInput, playerFilterInput]);

  const clearFilter = useCallback(() => {
    setPlayerFilterInput('');
    setOpponentFilterInput('');
    setAppliedPlayerFilter('');
    setAppliedOpponentFilter('');
    setFilterMatchedGames(null);
    setIsFilterExpanded(false);
  }, []);

  const refresh = useCallback(
    async ({ preserveFilter = false } = {}) => {
      if (!isActive) {
        return [];
      }

      const shouldPreserveFilter = preserveFilter && hasActiveGamesFilter;
      const previousFiltered = shouldPreserveFilter ? filterMatchedGames : null;

      if (!shouldPreserveFilter) {
        setFilterMatchedGames(null);
      }

      setIsLoading(true);

      try {
        const refreshedGames = await loadStageScores({ updateMainList: true });

        if (!shouldPreserveFilter) {
          return refreshedGames;
        }

        if (Array.isArray(previousFiltered) && previousFiltered.length > 0) {
          const merged = mergeFilteredGamesAfterSave(previousFiltered, refreshedGames);
          setFilterMatchedGames(merged);
          return merged;
        }

        const normalizedPlayerFilter = String(appliedPlayerFilter || '').trim();
        const normalizedOpponentFilter = String(appliedOpponentFilter || '').trim();

        if (!normalizedPlayerFilter && !normalizedOpponentFilter) {
          return refreshedGames;
        }

        const serverMatches = await loadStageScores({
          playerQuery: normalizedPlayerFilter,
          player2Query: normalizedOpponentFilter,
          updateMainList: false,
        });

        const searchIndex = buildPlayerSearchIndex(groupsTabItems, refreshedGames);
        const clientMatches = filterGamesByPlayerQueries(
          refreshedGames,
          normalizedPlayerFilter,
          normalizedOpponentFilter,
          { playerSearchIndex: searchIndex }
        );

        const mergedMatches = serverMatches.length > 0 ? serverMatches : clientMatches;
        setFilterMatchedGames(mergedMatches);
        return mergedMatches;
      } finally {
        setIsLoading(false);
      }
    },
    [
      appliedOpponentFilter,
      appliedPlayerFilter,
      filterMatchedGames,
      groupsTabItems,
      hasActiveGamesFilter,
      isActive,
      loadStageScores,
    ]
  );

  const toggleFilterExpanded = useCallback(() => {
    setIsFilterExpanded((previousState) => {
      const nextState = !previousState;

      if (nextState) {
        setPlayerFilterInput(appliedPlayerFilter);
        setOpponentFilterInput(appliedOpponentFilter);
      }

      return nextState;
    });
  }, [appliedOpponentFilter, appliedPlayerFilter]);

  const patchGame = useCallback((gameId, patch) => {
    const normalizedGameId = String(gameId || '').trim();

    if (!normalizedGameId) {
      return;
    }

    const applyPatch = (game) =>
      String(game.id || '') === normalizedGameId ? { ...game, ...patch } : game;

    setGames((previousGames) => previousGames.map(applyPatch));
    setFilterMatchedGames((previousGames) =>
      Array.isArray(previousGames) ? previousGames.map(applyPatch) : previousGames
    );
  }, []);

  return {
    games,
    fixtureTotal,
    isLoading,
    canEdit,
    stageProctored,
    isFilterExpanded,
    playerFilterInput,
    opponentFilterInput,
    appliedPlayerFilter,
    appliedOpponentFilter,
    filterMatchedGames,
    hasActiveGamesFilter,
    gamesView,
    isMyGamesView,
    divisionNameById,
    divisionOrderIndex,
    playerSearchIndex,
    filteredGames,
    displaySections,
    fixtureSummaryText,
    activeRoundKey,
    loadAll,
    applyFilter,
    clearFilter,
    refresh,
    toggleFilterExpanded,
    setGamesView,
    patchGame,
    setPlayerFilterInput,
    setOpponentFilterInput,
    setIsFilterExpanded,
    loadStageScores,
  };
}
