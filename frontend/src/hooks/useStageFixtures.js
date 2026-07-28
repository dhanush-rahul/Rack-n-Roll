import { useQueryClient } from '@tanstack/react-query';
import { startTransition, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  buildFixtureSectionsFromGames,
  countFixtureMatches,
  findActiveFixtureRoundKey,
} from '../utils/fixtureDisplay';
import { buildGroupDisplayName, buildDivisionOrderIndex } from '../utils/groupNaming';
import { buildPlayerSearchIndex, filterGamesByPlayerQueries, filterGamesByUserId, scopeGamesToMatchedPlayerDivisions } from '../utils/playerSearch';
import { SCORESHEET_STALE_TIME_MS } from '../config/queryClient';
import { queryKeys } from './queries/queryKeys';
import { fetchAllScoresheetPages } from './queries/tournamentQueryUtils';
import { updateGameList } from '../utils/updateGameList';
import {
  buildFixtureGameIdsKey,
  patchDisplaySectionsFromGames,
} from '../utils/fixtureDisplayPatch';

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
  const gamesRef = useRef([]);
  gamesRef.current = games;
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
  const playerSearchIndexRef = useRef(new Map());
  const displaySectionsCacheRef = useRef([]);
  const displaySectionsGameIdsRef = useRef('');
  const hasLockedFilterResults = Array.isArray(filterMatchedGames);

  useEffect(() => {
    displaySectionsCacheRef.current = [];
    displaySectionsGameIdsRef.current = '';
  }, [appliedOpponentFilter, appliedPlayerFilter, normalizedStageId, tournamentId]);

  const rebuildPlayerSearchIndex = useCallback(
    (sourceGames) => {
      const nextIndex = buildPlayerSearchIndex(groupsTabItems, sourceGames);
      playerSearchIndexRef.current = nextIndex;
      return nextIndex;
    },
    [groupsTabItems]
  );

  const resolveFilteredMatches = useCallback(
    (sourceGames, playerQuery, player2Query) => {
      const normalizedPlayerFilter = String(playerQuery || '').trim();
      const normalizedOpponentFilter = String(player2Query || '').trim();

      if (!normalizedPlayerFilter && !normalizedOpponentFilter) {
        return [];
      }

      const searchIndex =
        playerSearchIndexRef.current.size > 0
          ? playerSearchIndexRef.current
          : rebuildPlayerSearchIndex(sourceGames);

      return filterGamesByPlayerQueries(
        sourceGames,
        normalizedPlayerFilter,
        normalizedOpponentFilter,
        { playerSearchIndex: searchIndex }
      );
    },
    [rebuildPlayerSearchIndex]
  );

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

  const resolveFilteredGamesForDisplay = useCallback(
    (sourceGames, playerQuery, player2Query) => {
      const searchIndex =
        playerSearchIndexRef.current.size > 0
          ? playerSearchIndexRef.current
          : rebuildPlayerSearchIndex(games.length > 0 ? games : sourceGames);

      return scopeGamesToMatchedPlayerDivisions(sourceGames, playerQuery, player2Query, {
        playerSearchIndex: searchIndex,
      });
    },
    [games, rebuildPlayerSearchIndex]
  );

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

        if (!normalizedPlayerQuery && !normalizedPlayerTwoQuery) {
          rebuildPlayerSearchIndex(items);
        }
      }

      return items;
    },
    [isActive, isGroupStage, normalizedStageId, queryClient, rebuildPlayerSearchIndex, tournamentId]
  );

  const gamesForMetadata = useMemo(() => {
    if (hasLockedFilterResults && filterMatchedGames.length > 0) {
      return filterMatchedGames;
    }

    return games;
  }, [filterMatchedGames, games, hasLockedFilterResults]);

  const hasActiveGamesFilter = Boolean(
    String(appliedPlayerFilter || '').trim() || String(appliedOpponentFilter || '').trim()
  );

  const divisionNameById = useMemo(() => {
    const names = new Map();

    if (normalizedStageId && stageName) {
      names.set(normalizedStageId, stageName);
      names.set('__ungrouped', stageName);
    }

    (gamesForMetadata || []).forEach((game) => {
      const divisionId = String(game.divisionId || normalizedStageId || '').trim();
      const divisionName = String(game.divisionName || stageName || '').trim();

      if (divisionId && divisionName) {
        names.set(divisionId, divisionName);
      }
    });

    if (isGroupStage && !hasActiveGamesFilter) {
      (groupsTabItems || []).forEach((group, index) => {
        const divisionId = String(group?.divisionId || '').trim();

        if (!divisionId || names.has(divisionId)) {
          return;
        }

        names.set(divisionId, group.divisionName || buildGroupDisplayName(index));
      });
    }

    return names;
  }, [gamesForMetadata, groupsTabItems, hasActiveGamesFilter, isGroupStage, normalizedStageId, stageName]);

  const divisionOrderIndex = useMemo(() => buildDivisionOrderIndex(gamesForMetadata), [gamesForMetadata]);

  const playerSearchIndex = useMemo(() => {
    if (hasLockedFilterResults) {
      return playerSearchIndexRef.current;
    }

    return rebuildPlayerSearchIndex(games);
  }, [games, hasLockedFilterResults, rebuildPlayerSearchIndex]);

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

    return scopeGamesToMatchedPlayerDivisions(
      filterGamesByPlayerQueries(nextGames, appliedPlayerFilter, appliedOpponentFilter, {
        playerSearchIndex,
      }),
      appliedPlayerFilter,
      appliedOpponentFilter,
      { playerSearchIndex }
    );
  }, [
    appliedOpponentFilter,
    appliedPlayerFilter,
    filterMatchedGames,
    games,
    isMyGamesView,
    myGamesUserId,
    playerSearchIndex,
  ]);

  const displaySections = useMemo(() => {
    const gameIdsKey = buildFixtureGameIdsKey(filteredGames);
    const buildOptions = {
      divisionNameById,
      divisionOrderIndex,
      groupStageBestOf: resolvedBestOf,
      isPlayedScoreEntry,
    };

    if (
      !hasActiveGamesFilter &&
      gameIdsKey &&
      gameIdsKey === displaySectionsGameIdsRef.current &&
      displaySectionsCacheRef.current.length > 0
    ) {
      const patched = patchDisplaySectionsFromGames(
        displaySectionsCacheRef.current,
        filteredGames,
        buildOptions
      );
      displaySectionsCacheRef.current = patched;
      return patched;
    }

    const built = buildFixtureSectionsFromGames(filteredGames, buildOptions).filter(
      (section) => Number(section.matchCount || 0) > 0
    );
    displaySectionsGameIdsRef.current = gameIdsKey;
    displaySectionsCacheRef.current = built;
    return built;
  }, [divisionNameById, divisionOrderIndex, filteredGames, hasActiveGamesFilter, resolvedBestOf]);

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
      if (games.length > 0) {
        rebuildPlayerSearchIndex(games);
      }

      const serverMatches = await loadStageScores({
        playerQuery: normalizedPlayerFilter,
        player2Query: normalizedOpponentFilter,
        updateMainList: false,
      });

      const scopedMatches = resolveFilteredGamesForDisplay(
        serverMatches,
        normalizedPlayerFilter,
        normalizedOpponentFilter
      );

      setFilterMatchedGames(scopedMatches);
      return scopedMatches;
    } finally {
      setIsLoading(false);
    }
  }, [
    games,
    isActive,
    loadStageScores,
    opponentFilterInput,
    playerFilterInput,
    rebuildPlayerSearchIndex,
    resolveFilteredGamesForDisplay,
  ]);

  const clearFilter = useCallback(async () => {
    setPlayerFilterInput('');
    setOpponentFilterInput('');
    setAppliedPlayerFilter('');
    setAppliedOpponentFilter('');
    setIsFilterExpanded(false);
    startTransition(() => {
      setFilterMatchedGames(null);
    });

    if (games.length === 0) {
      setIsLoading(true);
      try {
        await loadStageScores({ updateMainList: true });
      } finally {
        setIsLoading(false);
      }
    }
  }, [games.length, loadStageScores]);

  const refresh = useCallback(
    async ({ preserveFilter = false, silent = false } = {}) => {
      if (!isActive) {
        return [];
      }

      const shouldPreserveFilter = preserveFilter && hasActiveGamesFilter;

      if (!shouldPreserveFilter) {
        setFilterMatchedGames(null);
      }

      if (!silent) {
        setIsLoading(true);
      }

      try {
        if (shouldPreserveFilter) {
          const filtered = await loadStageScores({
            playerQuery: appliedPlayerFilter,
            player2Query: appliedOpponentFilter,
            updateMainList: false,
          });
          const scopedMatches = resolveFilteredGamesForDisplay(
            filtered,
            appliedPlayerFilter,
            appliedOpponentFilter
          );
          setFilterMatchedGames(scopedMatches);
          return scopedMatches;
        }

        const refreshedGames = await loadStageScores({ updateMainList: true });
        return refreshedGames;
      } finally {
        if (!silent) {
          setIsLoading(false);
        }
      }
    },
    [
      appliedOpponentFilter,
      appliedPlayerFilter,
      hasActiveGamesFilter,
      isActive,
      loadStageScores,
      resolveFilteredGamesForDisplay,
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
      String(game.id || game.gameId || '') === normalizedGameId ? { ...game, ...patch } : game;

    const patchList = (previousGames) =>
      Array.isArray(previousGames) ? updateGameList(previousGames, applyPatch) : previousGames;

    if (hasLockedFilterResults) {
      setFilterMatchedGames(patchList);
      return;
    }

    setGames(patchList);
  }, [hasLockedFilterResults]);

  const applySavedGame = useCallback(
    (savedGame) => {
      if (!savedGame?.id) {
        return;
      }

      const normalizedId = String(savedGame.id);
      const savedPlayerAId = String(savedGame.playerAId || savedGame.playerA?.id || '').trim();
      const savedPlayerBId = String(savedGame.playerBId || savedGame.playerB?.id || '').trim();
      const savedRoundNumber = Number(savedGame.roundNumber || 0);

      const mergeSavedGame = (game) => {
        const existingId = String(game.id || game.gameId || '').trim();

        if (existingId === normalizedId) {
          return { ...game, ...savedGame, id: normalizedId };
        }

        if (existingId) {
          return game;
        }

        const gamePlayerAId = String(game.playerAId || game.playerA?.id || '').trim();
        const gamePlayerBId = String(game.playerBId || game.playerB?.id || '').trim();
        const sameRound = Number(game.roundNumber || 0) === savedRoundNumber;
        const samePlayers =
          (gamePlayerAId === savedPlayerAId && gamePlayerBId === savedPlayerBId) ||
          (gamePlayerAId === savedPlayerBId && gamePlayerBId === savedPlayerAId);

        if (sameRound && samePlayers) {
          return { ...game, ...savedGame, id: normalizedId };
        }

        return game;
      };

      const mergeList = (previousGames) =>
        Array.isArray(previousGames) ? updateGameList(previousGames, mergeSavedGame) : previousGames;

      if (hasLockedFilterResults) {
        setFilterMatchedGames(mergeList);
        return;
      }

      startTransition(() => {
        setGames(mergeList);
      });
    },
    [hasLockedFilterResults]
  );

  return {
    games,
    gamesRef,
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
    applySavedGame,
    setPlayerFilterInput,
    setOpponentFilterInput,
    setIsFilterExpanded,
    loadStageScores,
  };
}
