/**
 * Handicap: lower value = stronger player (higher competition level).
 * When handicap is enabled, weaker winners (higher handicap) earn bonus standing points.
 */
const getHandicapBonusPoints = (winnerHandicap, loserHandicap) =>
  Math.max(0, Math.round((Number(winnerHandicap) - Number(loserHandicap)) / 10));

/**
 * APA-style derived stats from match records (scoreFor = match points earned, scoreAgainst = allowed).
 * - Matches played: wins + losses + draws (each completed fixture counts once).
 * - Win%: wins / matches played.
 * - PPM (points per match): total match points scored / matches played.
 * - PAA (points against average): total match points allowed / matches played.
 */
const computePoolStats = (entry) => {
  const wins = Number(entry.wins || 0);
  const losses = Number(entry.losses || 0);
  const draws = Number(entry.draws || 0);
  const matchesPlayed = wins + losses + draws;
  const scoreFor = Number(entry.scoreFor || 0);
  const scoreAgainst = Number(entry.scoreAgainst || 0);

  return {
    matchesPlayed,
    matchesWon: wins,
    winPct: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
    ppm: matchesPlayed > 0 ? Number((scoreFor / matchesPlayed).toFixed(2)) : 0,
    paa: matchesPlayed > 0 ? Number((scoreAgainst / matchesPlayed).toFixed(2)) : 0,
  };
};

module.exports = {
  getHandicapBonusPoints,
  computePoolStats,
};
