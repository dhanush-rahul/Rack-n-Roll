import { useCallback, useRef, useState } from 'react';
import {
  updateTournamentGameScores,
  upsertAndScoreTournamentGroupGame,
} from '../services/tournamentService';
import { resolveMatchStatusFromScoreEntries } from '../utils/seriesScoring';

const isPlayedScoreEntry = (entry) => {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return false;
  }

  return !(playerAScore === 0 && playerBScore === 0);
};

export function useScoreInputs({
  groupStageBestOf = 1,
  finalStageBestOf = 3,
  scoringStyle = 'individualGames',
} = {}) {
  const [scoreInputsByGameId, setScoreInputsByGameId] = useState({});
  const [savingGameId, setSavingGameId] = useState(null);
  const [hydrateEpoch, setHydrateEpoch] = useState(0);
  const scoreInputsRef = useRef({});

  const configuredGroupStageBestOf = Math.max(Number(groupStageBestOf || 1), 1);
  const configuredFinalStageBestOf = Math.max(Number(finalStageBestOf || 3), 1);
  const isTotalPoints = scoringStyle === 'totalPoints';

  const hydrateScoreInputState = useCallback(
    (games, { merge = false } = {}) => {
      setScoreInputsByGameId((previousState) => {
        const nextState = merge ? { ...previousState } : {};

        (games || []).forEach((game) => {
          const existingEntriesByGameNumber = new Map(
            (game.scoreEntries || []).map((entry) => [
              Number(entry.gameNumber),
              {
                gameNumber: Number(entry.gameNumber),
                playerAScore: String(entry.playerAScore ?? 0),
                playerBScore: String(entry.playerBScore ?? 0),
              },
            ])
          );

          const savedEntries = [...existingEntriesByGameNumber.values()].sort(
            (left, right) => left.gameNumber - right.gameNumber
          );

          const stageKey = String(game.stageId || game.stage || 'groupStage');
          const isGroupStage = stageKey === 'groupStage';
          const isFinalStage = stageKey === 'finalStage';
          const configuredBestOf = isGroupStage
            ? configuredGroupStageBestOf
            : isFinalStage
              ? configuredFinalStageBestOf
              : Math.max(Number(game.bestOf || 1), 1);

          const seriesMaxGames = isTotalPoints
            ? 1
            : Math.max(Number(game.bestOf || 1), configuredBestOf, savedEntries.length, 1);

          let entries;
          if (isTotalPoints) {
            const totals = savedEntries.reduce(
              (accumulator, entry) => {
                accumulator.playerAScore += Number(entry?.playerAScore || 0);
                accumulator.playerBScore += Number(entry?.playerBScore || 0);
                return accumulator;
              },
              { playerAScore: 0, playerBScore: 0 }
            );
            const hasTotals = savedEntries.length > 0;
            entries = [
              {
                gameNumber: 1,
                playerAScore: hasTotals ? String(totals.playerAScore) : '',
                playerBScore: hasTotals ? String(totals.playerBScore) : '',
              },
            ];
          } else {
            entries = Array.from({ length: seriesMaxGames }, (_, index) => {
              const gameNumber = index + 1;
              return (
                existingEntriesByGameNumber.get(gameNumber) || {
                  gameNumber,
                  playerAScore: '',
                  playerBScore: '',
                }
              );
            });
          }

          nextState[String(game.id)] = {
            status: game.status || 'scheduled',
            entries,
            seriesMaxGames,
          };
        });

        scoreInputsRef.current = nextState;
        return nextState;
      });
      setHydrateEpoch((epoch) => epoch + 1);
    },
    [configuredFinalStageBestOf, configuredGroupStageBestOf, isTotalPoints]
  );

  const onChangeScoreInput = useCallback((gameId, entryIndex, field, value) => {
    const stateKey = String(gameId || '');
    const previousState = scoreInputsRef.current;
    const existing = previousState[stateKey] || {
      status: 'scheduled',
      entries: [{ gameNumber: 1, playerAScore: '', playerBScore: '' }],
      seriesMaxGames: 1,
    };
    const nextEntries = [...(existing.entries || [])];

    while (nextEntries.length <= entryIndex) {
      nextEntries.push({
        gameNumber: nextEntries.length + 1,
        playerAScore: '',
        playerBScore: '',
      });
    }

    nextEntries[entryIndex] = {
      ...(nextEntries[entryIndex] || {
        gameNumber: entryIndex + 1,
        playerAScore: '',
        playerBScore: '',
      }),
      [field]: value,
    };

    scoreInputsRef.current = {
      ...previousState,
      [stateKey]: {
        ...existing,
        entries: nextEntries,
      },
    };
  }, []);

  const onAddSeriesGame = useCallback(({ scoreStateKey, scoreInput, seriesMaxGames }) => {
    const previousState = scoreInputsRef.current;
    const existingState = previousState[scoreStateKey] || scoreInput || {
      status: 'scheduled',
      entries: [{ gameNumber: 1, playerAScore: '', playerBScore: '' }],
      seriesMaxGames: Math.max(Number(seriesMaxGames || 1), 1),
    };
    const nextEntries = (existingState.entries || []).map((entry) => ({
      gameNumber: Number(entry.gameNumber),
      playerAScore: String(entry.playerAScore ?? ''),
      playerBScore: String(entry.playerBScore ?? ''),
    }));

    if (nextEntries.length >= MAX_SERIES_SCORE_ROWS) {
      return;
    }

    nextEntries.push({
      gameNumber: nextEntries.length + 1,
      playerAScore: '',
      playerBScore: '',
    });

    const nextSeriesMaxGames = Math.max(
      Number(existingState.seriesMaxGames || seriesMaxGames || 1),
      nextEntries.length
    );

    const nextState = {
      ...previousState,
      [scoreStateKey]: {
        ...existingState,
        seriesMaxGames: nextSeriesMaxGames,
        entries: nextEntries,
      },
    };

    scoreInputsRef.current = nextState;
    setScoreInputsByGameId(nextState);
    setHydrateEpoch((epoch) => epoch + 1);
  }, []);

  const saveMatchScores = useCallback(
    async ({
      tournamentId,
      gameId,
      roundNumber,
      playerAId,
      playerBId,
      scoreStateKey,
      bestOf,
      scoreInput,
      groupStageGames = [],
      finalStageGames = [],
      stageGames = [],
      onSuccess,
    }) => {
      const inputStateKey = String(gameId || scoreStateKey || '');
      const scoreInputs =
        scoreInput ||
        scoreInputsRef.current[inputStateKey] ||
        { entries: [], seriesMaxGames: 1 };

      const normalizedEntries = (scoreInputs.entries || [])
        .filter((entry) => {
          if (!entry) {
            return false;
          }

          const rawPlayerAScore = String(entry.playerAScore ?? '').trim();
          const rawPlayerBScore = String(entry.playerBScore ?? '').trim();

          return rawPlayerAScore !== '' && rawPlayerBScore !== '';
        })
        .map((entry, index) => ({
          gameNumber: Number(entry.gameNumber || index + 1),
          playerAScore: Number(entry.playerAScore),
          playerBScore: Number(entry.playerBScore),
        }))
        .filter((entry) => isPlayedScoreEntry(entry));

      if (normalizedEntries.length === 0) {
        return null;
      }

      try {
        setSavingGameId(gameId || scoreStateKey);

        const savedGame =
          groupStageGames.find((game) => String(game.id) === String(gameId)) ||
          finalStageGames.find((game) => String(game.id) === String(gameId)) ||
          stageGames.find((game) => String(game.id) === String(gameId));
        const stageKey = String(savedGame?.stageId || savedGame?.stage || 'groupStage');
        const isFinalStageGame = stageKey === 'finalStage';
        const isGroupStageGame = stageKey === 'groupStage';
        const configuredSeriesBestOf = isFinalStageGame
          ? configuredFinalStageBestOf
          : isGroupStageGame
            ? configuredGroupStageBestOf
            : Math.max(Number(savedGame?.bestOf || bestOf || 1), 1);
        const progressionStageId =
          !isFinalStageGame && !isGroupStageGame && savedGame?.stageId
            ? String(savedGame.stageId)
            : !isFinalStageGame && !isGroupStageGame && savedGame?.stage
              ? String(savedGame.stage)
              : null;
        const seriesMaxGames = isTotalPoints
          ? 1
          : Math.max(Number(scoreInputs.seriesMaxGames || 0), Number(bestOf || 1), configuredSeriesBestOf, 1);
        const effectiveBestOf = isTotalPoints
          ? 1
          : Math.max(seriesMaxGames, normalizedEntries.length);

        const normalizedStatus = resolveMatchStatusFromScoreEntries({
          entries: normalizedEntries,
          bestOf: effectiveBestOf,
          scoringStyle: isTotalPoints ? 'totalPoints' : 'individualGames',
        });

        let updatedGame = null;

        if (gameId) {
          updatedGame = await updateTournamentGameScores(tournamentId, gameId, {
            status: normalizedStatus,
            scoreEntries: normalizedEntries,
            bestOf: effectiveBestOf,
          });
        } else {
          updatedGame = await upsertAndScoreTournamentGroupGame(tournamentId, {
            roundNumber,
            playerAUserId: playerAId,
            playerBUserId: playerBId,
            playerAId,
            playerBId,
            bestOf: effectiveBestOf,
            status: normalizedStatus,
            scoreEntries: normalizedEntries,
          });
        }

        const result = {
          updatedGame,
          isFinalStageGame,
          stageId: progressionStageId,
          normalizedStatus,
        };

        if (onSuccess) {
          await onSuccess(result);
        }

        return result;
      } finally {
        setSavingGameId(null);
      }
    },
    [configuredFinalStageBestOf, configuredGroupStageBestOf, isTotalPoints]
  );

  return {
    scoreInputsByGameId,
    savingGameId,
    hydrateEpoch,
    hydrateScoreInputState,
    onChangeScoreInput,
    onAddSeriesGame,
    saveMatchScores,
    configuredGroupStageBestOf,
    configuredFinalStageBestOf,
  };
}
