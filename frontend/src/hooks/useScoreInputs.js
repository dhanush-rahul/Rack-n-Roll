import { useCallback, useState } from 'react';
import {
  updateTournamentGameScores,
  upsertAndScoreTournamentGroupGame,
} from '../services/tournamentService';
import { MAX_SERIES_SCORE_ROWS } from '../utils/seriesScoring';

const isPlayedScoreEntry = (entry) => {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return false;
  }

  return !(playerAScore === 0 && playerBScore === 0);
};

export function useScoreInputs({ groupStageBestOf = 1, finalStageBestOf = 3 } = {}) {
  const [scoreInputsByGameId, setScoreInputsByGameId] = useState({});
  const [savingGameId, setSavingGameId] = useState(null);

  const configuredGroupStageBestOf = Math.max(Number(groupStageBestOf || 1), 1);
  const configuredFinalStageBestOf = Math.max(Number(finalStageBestOf || 3), 1);

  const hydrateScoreInputState = useCallback(
    (games) => {
      const nextState = {};

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

        const seriesMaxGames = Math.max(
          Number(game.bestOf || 1),
          game.stage === 'groupStage' ? configuredGroupStageBestOf : configuredFinalStageBestOf,
          savedEntries.length,
          1
        );

        const entries = Array.from({ length: seriesMaxGames }, (_, index) => {
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
          entries,
          seriesMaxGames,
        };
      });

      setScoreInputsByGameId(nextState);
    },
    [configuredFinalStageBestOf, configuredGroupStageBestOf]
  );

  const onChangeScoreInput = useCallback((gameId, entryIndex, field, value) => {
    setScoreInputsByGameId((previousState) => {
      const existing = previousState[gameId] || {
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

      return {
        ...previousState,
        [gameId]: {
          ...existing,
          entries: nextEntries,
        },
      };
    });
  }, []);

  const onAddSeriesGame = useCallback(({ scoreStateKey, scoreInput, seriesMaxGames }) => {
    setScoreInputsByGameId((previousState) => {
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
        return previousState;
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

      return {
        ...previousState,
        [scoreStateKey]: {
          ...existingState,
          seriesMaxGames: nextSeriesMaxGames,
          entries: nextEntries,
        },
      };
    });
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
      groupStageGames = [],
      finalStageGames = [],
      onSuccess,
    }) => {
      try {
        setSavingGameId(gameId || scoreStateKey);

        const inputStateKey = gameId || scoreStateKey;
        const scoreInputs = scoreInputsByGameId[inputStateKey] || { entries: [], seriesMaxGames: 1 };
        const savedGame =
          groupStageGames.find((game) => String(game.id) === String(gameId)) ||
          finalStageGames.find((game) => String(game.id) === String(gameId));
        const isFinalStageGame = savedGame?.stage === 'finalStage';
        const configuredSeriesBestOf = isFinalStageGame
          ? configuredFinalStageBestOf
          : configuredGroupStageBestOf;
        const seriesMaxGames = Math.max(
          Number(scoreInputs.seriesMaxGames || 0),
          Number(bestOf || 1),
          configuredSeriesBestOf,
          1
        );
        let playerASeriesWins = 0;
        let playerBSeriesWins = 0;
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

        const effectiveBestOf = Math.max(seriesMaxGames, normalizedEntries.length);
        const winsRequired = Math.floor(effectiveBestOf / 2) + 1;

        normalizedEntries.forEach((entry) => {
          if (entry.playerAScore > entry.playerBScore) {
            playerASeriesWins += 1;
            return;
          }

          if (entry.playerBScore > entry.playerAScore) {
            playerBSeriesWins += 1;
          }
        });

        const normalizedStatus =
          playerASeriesWins >= winsRequired || playerBSeriesWins >= winsRequired
            ? 'completed'
            : normalizedEntries.length > 0
              ? 'inProgress'
              : 'scheduled';

        if (normalizedEntries.length === 0) {
          const validationError = new Error('Enter at least one game score before saving.');
          validationError.code = 'VALIDATION';
          throw validationError;
        }

        if (gameId) {
          await updateTournamentGameScores(tournamentId, gameId, {
            status: normalizedStatus,
            scoreEntries: normalizedEntries,
            bestOf: effectiveBestOf,
          });
        } else {
          await upsertAndScoreTournamentGroupGame(tournamentId, {
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

        if (onSuccess) {
          await onSuccess({ isFinalStageGame });
        }

        return { isFinalStageGame };
      } finally {
        setSavingGameId(null);
      }
    },
    [configuredFinalStageBestOf, configuredGroupStageBestOf, scoreInputsByGameId]
  );

  return {
    scoreInputsByGameId,
    savingGameId,
    hydrateScoreInputState,
    onChangeScoreInput,
    onAddSeriesGame,
    saveMatchScores,
    configuredGroupStageBestOf,
    configuredFinalStageBestOf,
  };
}
