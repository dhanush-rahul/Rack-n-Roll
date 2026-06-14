import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { fetchTournamentGroupStandings } from '../services/tournamentService';
import { buildPlayerGameStatsFromGames } from '../utils/fixtureDisplay';
import { buildGroupDisplayName } from '../utils/groupNaming';
import { STANDINGS_STALE_TIME_MS } from '../config/queryClient';
import { queryKeys } from './queries/queryKeys';
import { fetchAllScoresheetPages } from './queries/tournamentQueryUtils';

export function useGroupStandings(tournamentId) {
  const queryClient = useQueryClient();
  const [groupsTabItems, setGroupsTabItems] = useState([]);
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [finalStageEnabled, setFinalStageEnabled] = useState(false);
  const [completedWithFinale, setCompletedWithFinale] = useState(false);
  const [finaleStandings, setFinaleStandings] = useState([]);
  const [tournamentWinners, setTournamentWinners] = useState([]);
  const [groupPlayerGameStatsById, setGroupPlayerGameStatsById] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  const { data: standingsData, refetch: refetchStandings } = useQuery({
    queryKey: queryKeys.standings(tournamentId),
    queryFn: () => fetchTournamentGroupStandings(tournamentId),
    staleTime: STANDINGS_STALE_TIME_MS,
    enabled: false,
  });

  const buildGroupFallbackFromScoresheetGames = useCallback(async () => {
    const response = await queryClient.fetchQuery({
      queryKey: queryKeys.scoresheet(tournamentId, { stage: 'groupStage' }),
      queryFn: () => fetchAllScoresheetPages(tournamentId, { stage: 'groupStage' }),
    });
    const games = response.items || [];

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
  }, [queryClient, tournamentId]);

  const applyStandingsResponse = useCallback(
    async (standingsResponse, fallbackData) => {
      let nextGroups = standingsResponse?.groups || [];
      setHandicapEnabled(Boolean(standingsResponse?.handicapEnabled));
      setFinalStageEnabled(Boolean(standingsResponse?.finalStageEnabled));
      setCompletedWithFinale(Boolean(standingsResponse?.completedWithFinale));
      setFinaleStandings(standingsResponse?.finaleStandings || []);
      setTournamentWinners(standingsResponse?.tournamentWinners || []);
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
    },
    []
  );

  const refreshGroupsTabData = useCallback(async () => {
    const [standingsResult, fallbackData] = await Promise.all([
      refetchStandings(),
      buildGroupFallbackFromScoresheetGames(),
    ]);

    const standingsResponse = standingsResult.data;

    if (!standingsResponse) {
      throw standingsResult.error || new Error('Unable to load group standings');
    }

    return applyStandingsResponse(standingsResponse, fallbackData);
  }, [applyStandingsResponse, buildGroupFallbackFromScoresheetGames, refetchStandings]);

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
    handicapEnabled,
    finalStageEnabled,
    completedWithFinale,
    finaleStandings,
    tournamentWinners,
    groupPlayerGameStatsById,
    isLoading,
    refreshGroupsTabData,
    loadGroupsTab,
    setGroupsTabItems,
    setGroupPlayerGameStatsById,
  };
}
