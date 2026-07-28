import React, { forwardRef, memo, useCallback, useEffect, useImperativeHandle, useReducer, useRef } from 'react';
import { formatApiError } from '../../hooks/useScreenFeedback';
import { useGroupStageFixtures } from '../../hooks/useGroupStageFixtures';
import { useScoreInputs } from '../../hooks/useScoreInputs';
import { GamesTab } from '../../screens/tournamentDetail/GamesTab';

const initialLoadingState = { games: false };

function loadingReducer(state, action) {
  if (action.type === 'set') {
    return { ...state, [action.key]: action.value };
  }

  return state;
}

export const HostGamesTab = memo(
  forwardRef(function HostGamesTab(
    {
      tournamentId,
      groupsTabItems,
      groupStageBestOf,
      finalStageBestOf,
      scoringStyle,
      onScheduleStandingsRefresh,
      onFixturesMetaChange,
      clearError,
      clearSuccess,
      showError,
      expandedSectionId,
      onToggleSection,
      expandedRoundKey,
      onToggleRound,
      ...gamesTabProps
    },
    ref
  ) {
    const groupFixtures = useGroupStageFixtures(tournamentId, groupsTabItems, groupStageBestOf);
    const { applySavedGame } = groupFixtures;
    const [loading, dispatchLoading] = useReducer(loadingReducer, initialLoadingState);
    const initialLoadStartedRef = useRef(false);
    const displaySectionsRef = useRef(groupFixtures.displaySections);
    displaySectionsRef.current = groupFixtures.displaySections;

    const scoreInputs = useScoreInputs({
      groupStageBestOf,
      finalStageBestOf,
      scoringStyle,
    });

    useEffect(() => {
      onFixturesMetaChange?.({
        fixtureTotal: groupFixtures.fixtureTotal,
        hasLoadedGames: groupFixtures.games.length > 0 || groupFixtures.hasActiveGamesFilter,
        isLoading: groupFixtures.isLoading || loading.games,
      });
    }, [
      groupFixtures.fixtureTotal,
      groupFixtures.games.length,
      groupFixtures.hasActiveGamesFilter,
      groupFixtures.isLoading,
      loading.games,
      onFixturesMetaChange,
    ]);

    useImperativeHandle(
      ref,
      () => ({
        hydrateScoreInputState: scoreInputs.hydrateScoreInputState,
        loadAll: groupFixtures.loadAll,
        applyFilter: groupFixtures.applyFilter,
        refresh: groupFixtures.refresh,
        patchGame: groupFixtures.patchGame,
        getDisplaySections: () => displaySectionsRef.current,
        getGamesRef: () => groupFixtures.gamesRef,
        hasLoadedGames: () =>
          groupFixtures.games.length > 0 ||
          (Array.isArray(groupFixtures.filterMatchedGames) && groupFixtures.filterMatchedGames.length > 0),
      }),
      [
        groupFixtures.applyFilter,
        groupFixtures.filterMatchedGames,
        groupFixtures.games.length,
        groupFixtures.gamesRef,
        groupFixtures.loadAll,
        groupFixtures.patchGame,
        groupFixtures.refresh,
        scoreInputs.hydrateScoreInputState,
      ]
    );

    const onSaveMatchScores = useCallback(
      async (payload) => {
        try {
          clearError?.();
          clearSuccess?.();

          const gamesRef = groupFixtures.gamesRef;
          const lookupGames = groupFixtures.hasActiveGamesFilter
            ? groupFixtures.filterMatchedGames || []
            : gamesRef?.current || [];

          await scoreInputs.saveMatchScores({
            tournamentId,
            ...payload,
            groupStageGames: lookupGames,
            finalStageGames: [],
            stageGames: [],
            onSuccess: async ({ updatedGame, normalizedStatus }) => {
              if (updatedGame) {
                applySavedGame(updatedGame);
              }

              if (normalizedStatus === 'completed') {
                onScheduleStandingsRefresh?.();
              }
            },
          });
        } catch (error) {
          if (error?.code === 'LEADERBOARD_INDEX_CONFLICT') {
            showError?.(
              'Standings indexes need a one-time fix. In backend folder run: npm run fix:leaderboard-indexes — then restart the backend and try again.'
            );
            return;
          }

          showError?.(formatApiError(error, 'Unable to save match scores'));
        }
      },
      [
        clearError,
        clearSuccess,
        applySavedGame,
        groupFixtures.filterMatchedGames,
        groupFixtures.gamesRef,
        groupFixtures.hasActiveGamesFilter,
        onScheduleStandingsRefresh,
        scoreInputs.saveMatchScores,
        showError,
        tournamentId,
      ]
    );

    const onRefreshGames = useCallback(async () => {
      try {
        clearError?.();
        clearSuccess?.();
        dispatchLoading({ type: 'set', key: 'games', value: true });
        const items = await groupFixtures.loadAll();
        scoreInputs.hydrateScoreInputState(items);
      } catch (error) {
        showError?.(formatApiError(error, 'Unable to load group fixtures'));
      } finally {
        dispatchLoading({ type: 'set', key: 'games', value: false });
      }
    }, [clearError, clearSuccess, groupFixtures.loadAll, scoreInputs.hydrateScoreInputState, showError]);

    useEffect(() => {
      if (initialLoadStartedRef.current) {
        return;
      }

      initialLoadStartedRef.current = true;
      onRefreshGames();
    }, [onRefreshGames]);

    const onApplyGamesFilter = useCallback(async () => {
      try {
        clearError?.();
        dispatchLoading({ type: 'set', key: 'games', value: true });
        const matches = await groupFixtures.applyFilter();
        scoreInputs.hydrateScoreInputState(matches, { merge: true });
      } catch (error) {
        showError?.(formatApiError(error, 'Unable to filter matches'));
      } finally {
        dispatchLoading({ type: 'set', key: 'games', value: false });
      }
    }, [clearError, groupFixtures.applyFilter, scoreInputs.hydrateScoreInputState, showError]);

    return (
      <GamesTab
        {...gamesTabProps}
        isLoadingGames={loading.games || groupFixtures.isLoading}
        isGamesFilterExpanded={groupFixtures.isFilterExpanded}
        onToggleGamesFilter={groupFixtures.toggleFilterExpanded}
        onRefreshGames={onRefreshGames}
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
        canEditGamesScores={groupFixtures.canEdit}
        activeRoundKey={groupFixtures.activeRoundKey}
        defaultSeriesMaxGames={Math.max(Number(groupStageBestOf || 1), 1)}
        scoreInputsByGameId={scoreInputs.scoreInputsByGameId}
        hydrateEpoch={scoreInputs.hydrateEpoch}
        onChangeScoreInput={scoreInputs.onChangeScoreInput}
        savingGameId={scoreInputs.savingGameId}
        onSaveMatchScores={onSaveMatchScores}
        onAddSeriesGame={scoreInputs.onAddSeriesGame}
        scoringStyle={scoringStyle}
      />
    );
  })
);
