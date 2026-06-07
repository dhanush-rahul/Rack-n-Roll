const { computePoolStats, getHandicapBonusPoints } = require('../../src/utils/handicapScoring');

describe('computePoolStats (APA-style)', () => {
  it('derives win%, PPM, and PAA from match record totals', () => {
    const stats = computePoolStats({
      wins: 2,
      losses: 1,
      draws: 0,
      scoreFor: 450,
      scoreAgainst: 390,
    });

    expect(stats.matchesPlayed).toBe(3);
    expect(stats.matchesWon).toBe(2);
    expect(stats.winPct).toBe(67);
    expect(stats.ppm).toBe(150);
    expect(stats.paa).toBe(130);
  });

  it('returns zeros when no matches played', () => {
    const stats = computePoolStats({ wins: 0, losses: 0, draws: 0, scoreFor: 0, scoreAgainst: 0 });

    expect(stats.matchesPlayed).toBe(0);
    expect(stats.winPct).toBe(0);
    expect(stats.ppm).toBe(0);
    expect(stats.paa).toBe(0);
  });
});

describe('getHandicapBonusPoints', () => {
  it('awards bonus when weaker player (higher handicap) wins', () => {
    expect(getHandicapBonusPoints(120, 80)).toBe(4);
  });

  it('returns zero when stronger player wins', () => {
    expect(getHandicapBonusPoints(80, 120)).toBe(0);
  });
});
