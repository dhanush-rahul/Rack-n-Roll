import { useCallback, useMemo, useState } from 'react';
import { fetchTournamentScoresheet } from '../services/tournamentService';
import {
  buildFixtureSectionsFromGames,
  countFixtureMatches,
  findActiveFixtureRoundKey,
} from '../utils/fixtureDisplay';
import { buildGroupDisplayName, buildDivisionOrderIndex } from '../utils/groupNaming';
import { mergeFilteredGamesAfterSave } from '../utils/fixtureFilterMerge';
import { buildPlayerSearchIndex, filterGamesByPlayerQueries } from '../utils/playerSearch';

const isPlayedScoreEntry = (entry) => {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return false;
  }

  return !(playerAScore === 0 && playerBScore === 0);
};

const resolveGroupStageBestOf = (groupStageBestOfOrConfig) => {
  if (groupStageBestOfOrConfig == null) {
    return undefined;
  }

  if (typeof groupStageBestOfOrConfig === 'object') {
    return groupStageBestOfOrConfig.groupStageBestOf;
  }

  return groupStageBestOfOrConfig;
};

export function useGroupStageFixtures(tournamentId, groupsTabItems = [], groupStageBestOfOrConfig) {
  const resolvedGroupStageBestOf = resolveGroupStageBestOf(groupStageBestOfOrConfig);
  const [games, setGames] = useState([]);
  const [fixtureTotal, setFixtureTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [isFilterExpanded, setIsFilterExpanded] = useState(false);
  const [playerFilterInput, setPlayerFilterInput] = useState('');
  const [opponentFilterInput, setOpponentFilterInput] = useState('');
  const [appliedPlayerFilter, setAppliedPlayerFilter] = useState('');
  const [appliedOpponentFilter, setAppliedOpponentFilter] = useState('');
  const [filterMatchedGames, setFilterMatchedGames] = useState(null);

  const loadGroupStageScores = useCallback(
    async ({ playerQuery, player2Query, updateMainList = true } = {}) => {
      const items = [];
      let page = 1;
      let totalPages = 1;
      const normalizedPlayerQuery = String(playerQuery || '').trim();
      const normalizedPlayerTwoQuery = String(player2Query || '').trim();

      while (page <= totalPages) {
        const response = await fetchTournamentScoresheet(tournamentId, {
          page,
          pageSize: 100,
          stage: 'groupStage',
          ...(normalizedPlayerQuery ? { playerQuery: normalizedPlayerQuery } : {}),
          ...(normalizedPlayerTwoQuery ? { player2Query: normalizedPlayerTwoQuery } : {}),
        });

        if (page === 1) {
          setCanEdit(Boolean(response.canEdit));

          if (updateMainList) {
            setFixtureTotal(Number(response.pagination?.total || 0));
          }

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

      if (updateMainList) {
        setGames(items);
      }

      return items;
    },
    [tournamentId]
  );

  const divisionNameById = useMemo(() => {
    const names = new Map();

    (games || []).forEach((game) => {
      const divisionId = String(game.divisionId || '').trim();
      const divisionName = String(game.divisionName || '').trim();

      if (divisionId && divisionName) {
        names.set(divisionId, divisionName);
      }
    });

    (groupsTabItems || []).forEach((group, index) => {
      const divisionId = String(group?.divisionId || '').trim();

      if (!divisionId || names.has(divisionId)) {
        return;
      }

      names.set(divisionId, group.divisionName || buildGroupDisplayName(index));
    });

    return names;
  }, [games, groupsTabItems]);

  const divisionOrderIndex = useMemo(() => buildDivisionOrderIndex(games), [games]);

  const playerSearchIndex = useMemo(
    () => buildPlayerSearchIndex(groupsTabItems, games),
    [games, groupsTabItems]
  );

  const hasActiveGamesFilter = Boolean(
    String(appliedPlayerFilter || '').trim() || String(appliedOpponentFilter || '').trim()
  );

  const filteredGames = useMemo(() => {
    if (!hasActiveGamesFilter) {
      return games;
    }

    if (Array.isArray(filterMatchedGames)) {
      return filterMatchedGames;
    }

    return filterGamesByPlayerQueries(games, appliedPlayerFilter, appliedOpponentFilter, {
      playerSearchIndex,
    });
  }, [
    appliedOpponentFilter,
    appliedPlayerFilter,
    filterMatchedGames,
    games,
    hasActiveGamesFilter,
    playerSearchIndex,
  ]);

  const displaySections = useMemo(
    () =>
      buildFixtureSectionsFromGames(filteredGames, {
        divisionNameById,
        divisionOrderIndex,
        groupStageBestOf: resolvedGroupStageBestOf,
        isPlayedScoreEntry,
      }),
    [resolvedGroupStageBestOf, divisionNameById, divisionOrderIndex, filteredGames]
  );

  const fixtureSummaryText = useMemo(() => {
    const loadedCount = countFixtureMatches(displaySections);

    if (loadedCount === 0) {
      return '';
    }

    const total = hasActiveGamesFilter
      ? loadedCount
      : Math.max(fixtureTotal, loadedCount, games.length);
    const groupCount = displaySections.length;

    if (hasActiveGamesFilter) {
      return `${loadedCount} matching ${loadedCount === 1 ? 'fixture' : 'fixtures'}${groupCount > 1 ? ` across ${groupCount} groups` : ''}`;
    }

    if (groupCount > 1) {
      return `${total} group-stage fixtures across ${groupCount} groups (${displaySections.map((section) => `${section.sectionName}: ${section.matchCount}`).join(' • ')})`;
    }

    return `${total} group-stage fixtures`;
  }, [displaySections, fixtureTotal, games.length, hasActiveGamesFilter]);

  const activeRoundKey = useMemo(() => findActiveFixtureRoundKey(displaySections), [displaySections]);

  const loadAll = useCallback(async () => {
    setIsLoading(true);

    try {
      if (!hasActiveGamesFilter) {
        setFilterMatchedGames(null);
      }

      const items = await loadGroupStageScores({ updateMainList: true });
      return items;
    } finally {
      setIsLoading(false);
    }
  }, [hasActiveGamesFilter, loadGroupStageScores]);

  const applyFilter = useCallback(async () => {
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
      let allGroupGames = games;

      if (allGroupGames.length === 0) {
        allGroupGames = await loadGroupStageScores({ updateMainList: true });
      }

      const serverMatches = await loadGroupStageScores({
        playerQuery: normalizedPlayerFilter,
        player2Query: normalizedOpponentFilter,
        updateMainList: false,
      });

      const searchIndex = buildPlayerSearchIndex(groupsTabItems, allGroupGames);
      const clientMatches = filterGamesByPlayerQueries(
        allGroupGames,
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
  }, [games, groupsTabItems, loadGroupStageScores, opponentFilterInput, playerFilterInput]);

  const clearFilter = useCallback(() => {
    setPlayerFilterInput('');
    setOpponentFilterInput('');
    setAppliedPlayerFilter('');
    setAppliedOpponentFilter('');
    setFilterMatchedGames(null);
    setIsFilterExpanded(true);
  }, []);

  const refresh = useCallback(
    async ({ preserveFilter = false } = {}) => {
      const shouldPreserveFilter = preserveFilter && hasActiveGamesFilter;
      const previousFiltered = shouldPreserveFilter ? filterMatchedGames : null;

      if (!shouldPreserveFilter) {
        setFilterMatchedGames(null);
      }

      setIsLoading(true);

      try {
        const refreshedGames = await loadGroupStageScores({ updateMainList: true });

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

        const serverMatches = await loadGroupStageScores({
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
      loadGroupStageScores,
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

  return {
    games,
    fixtureTotal,
    isLoading,
    canEdit,
    isFilterExpanded,
    playerFilterInput,
    opponentFilterInput,
    appliedPlayerFilter,
    appliedOpponentFilter,
    filterMatchedGames,
    hasActiveGamesFilter,
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
    setPlayerFilterInput,
    setOpponentFilterInput,
    setIsFilterExpanded,
    loadGroupStageScores,
  };
}
