const {
  buildLiveMatchInningsStats,
  groupTurnsByInning,
} = require('../../src/utils/liveMatchInnings');

// ObjectIds are only used as opaque string ids in these helpers.

describe('liveMatchInnings', () => {
  const playerAId = 'aaaaaaaaaaaaaaaaaaaaaaaa';
  const playerBId = 'bbbbbbbbbbbbbbbbbbbbbbbb';

  test('one inning completes after both players visit', () => {
    const turns = [
      { turnNumber: 1, playerId: playerAId },
      { turnNumber: 2, playerId: playerBId },
    ];

    const stats = buildLiveMatchInningsStats(turns, playerAId, playerBId);
    expect(stats.visitsA).toBe(1);
    expect(stats.visitsB).toBe(1);
    expect(stats.inningsCompleted).toBe(1);
    expect(stats.currentInning).toBe(2);
    expect(stats.inningInProgress).toBe(false);
  });

  test('groups visits under inning headings', () => {
    const turns = [
      { turnNumber: 1, playerId: playerAId },
      { turnNumber: 2, playerId: playerBId },
      { turnNumber: 3, playerId: playerAId },
    ];

    const groups = groupTurnsByInning(turns, playerAId, playerBId);
    expect(groups).toHaveLength(2);
    expect(groups[0].inningNumber).toBe(1);
    expect(groups[0].turns).toHaveLength(2);
    expect(groups[1].inProgress).toBe(true);
    expect(groups[1].turns).toHaveLength(1);
  });
});
