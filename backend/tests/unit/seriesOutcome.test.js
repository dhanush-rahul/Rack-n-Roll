const { computeSeriesOutcome, isSeriesDecided } = require('../../src/services/tournament/shared');

describe('computeSeriesOutcome draws', () => {
  const game = { bestOf: 1, playerAId: 'a', playerBId: 'b' };

  test('marks a single tied game as a draw', () => {
    const outcome = computeSeriesOutcome(game, [{ gameNumber: 1, playerAScore: 1, playerBScore: 1 }]);

    expect(outcome.isDraw).toBe(true);
    expect(outcome.winnerPlayerId).toBeNull();
    expect(isSeriesDecided(outcome)).toBe(true);
  });

  test('marks equal total points as a draw', () => {
    const outcome = computeSeriesOutcome(
      game,
      [{ gameNumber: 1, playerAScore: 5, playerBScore: 5 }],
      'totalPoints'
    );

    expect(outcome.isDraw).toBe(true);
    expect(isSeriesDecided(outcome)).toBe(true);
  });

  test('marks a best-of-3 series with all drawn games as a draw', () => {
    const bo3Game = { ...game, bestOf: 3 };
    const outcome = computeSeriesOutcome(bo3Game, [
      { gameNumber: 1, playerAScore: 1, playerBScore: 1 },
      { gameNumber: 2, playerAScore: 1, playerBScore: 1 },
      { gameNumber: 3, playerAScore: 1, playerBScore: 1 },
    ]);

    expect(outcome.isDraw).toBe(true);
    expect(outcome.playerASeriesWins).toBe(3);
    expect(outcome.playerBSeriesWins).toBe(3);
    expect(isSeriesDecided(outcome)).toBe(true);
  });

  test('completes a best-of-3 series by aggregate points', () => {
    const bo3Game = { ...game, bestOf: 3 };
    const outcome = computeSeriesOutcome(bo3Game, [
      { gameNumber: 1, playerAScore: 1, playerBScore: 1 },
      { gameNumber: 2, playerAScore: 0, playerBScore: 1 },
      { gameNumber: 3, playerAScore: 1, playerBScore: 1 },
    ]);

    expect(outcome.isDraw).toBe(false);
    expect(outcome.playerASeriesWins).toBe(2);
    expect(outcome.playerBSeriesWins).toBe(3);
    expect(outcome.winnerPlayerId).toBe('b');
    expect(isSeriesDecided(outcome)).toBe(true);
  });

  test('keeps an unfinished series in progress when no winner emerges', () => {
    const bo3Game = { ...game, bestOf: 3 };
    const outcome = computeSeriesOutcome(bo3Game, [
      { gameNumber: 1, playerAScore: 1, playerBScore: 1 },
      { gameNumber: 2, playerAScore: 0, playerBScore: 1 },
    ]);

    expect(outcome.isDraw).toBe(false);
    expect(isSeriesDecided(outcome)).toBe(false);
  });
});
