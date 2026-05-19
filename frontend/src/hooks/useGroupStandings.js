import { useCallback, useState } from 'react';
import {
  fetchTournamentGroupStandings,
  fetchTournamentScoresheet,
} from '../services/tournamentService';
import { buildPlayerGameStatsFromGames } from '../utils/fixtureDisplay';
import { buildGroupDisplayName } from '../utils/groupNaming';

export function useGroupStandings(tournamentId) {
  const [groupsTabItems, setGroupsTabItems] = useState([]);
  const [groupPlayerGameStatsById, setGroupPlayerGameStatsById] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const buildGroupFallbackFromScoresheetGames = useCallback(async () => {
    const games = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const response = await fetchTournamentScoresheet(tournamentId, {
        page,
        pageSize: 100,
        stage: 'groupStage',
      });

      if (page === 1) {
        totalPages = Math.max(response.pagination?.totalPages || 0, 1);
        if ((response.pagination?.totalPages || 0) === 0) {
          totalPages = 0;
        }
      }

      games.push(...(response.items || []));

      if (totalPages === 0) {
        break;
      }

      page += 1;
    }

    const divisionsById = new Map();

    games.forEach((game) => {
      const divisionId = String(game.divisionId || '').trim();

      if (!divisionId) {
        return;
      }

      if (!divisionsById.has(divisionId)) {
        divisionsById.set(divisionId, new Map());
      }

      const playersById = divisionsById.get(divisionId);

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
        if (!side.id || playersById.has(side.id)) {
          return;
        }

        playersById.set(side.id, {
          id: side.id,
          displayName: side.displayName || side.id,
        });
      });
    });

    return {
      games,
      divisionsById,
      gameStatsByPlayerId: buildPlayerGameStatsFromGames(games),
    };
  }, [tournamentId]);

  const refreshGroupsTabData = useCallback(async () => {
    const [standingsResponse, fallbackData] = await Promise.all([
      fetchTournamentGroupStandings(tournamentId),
      buildGroupFallbackFromScoresheetGames(),
    ]);

    let nextGroups = standingsResponse.groups || [];
    const fallbackByDivisionId = fallbackData.divisionsById;

    setGroupPlayerGameStatsById(
      fallbackData.gameStatsByPlayerId || buildPlayerGameStatsFromGames(fallbackData.games || [])
    );

    const shouldApplyFallback =
      nextGroups.length === 0 ||
      nextGroups.some((group) => (group.standings || []).length === 0);

    if (shouldApplyFallback) {
      if (nextGroups.length > 0) {
        nextGroups = nextGroups.map((group) => {
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
      } else if (fallbackByDivisionId.size > 0) {
        nextGroups = [...fallbackByDivisionId.entries()].map(([divisionId, playersById], index) => ({
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
    }

    setGroupsTabItems(nextGroups);
    return nextGroups;
  }, [buildGroupFallbackFromScoresheetGames, tournamentId]);

  const loadGroupsTab = useCallback(async () => {
    setIsLoading(true);

    try {
      await refreshGroupsTabData();
    } finally {
      setIsLoading(false);
    }
  }, [refreshGroupsTabData]);

  return {
    groupsTabItems,
    groupPlayerGameStatsById,
    isLoading,
    refreshGroupsTabData,
    loadGroupsTab,
    setGroupsTabItems,
    setGroupPlayerGameStatsById,
  };
}
