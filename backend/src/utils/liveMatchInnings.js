const buildLiveMatchInningsStats = (turns = [], playerAId, playerBId) => {
  const normalizedA = String(playerAId);
  const normalizedB = String(playerBId);
  const visitsA = turns.filter((turn) => String(turn.playerId) === normalizedA).length;
  const visitsB = turns.filter((turn) => String(turn.playerId) === normalizedB).length;
  const inningsCompleted = Math.min(visitsA, visitsB);

  return {
    visitsA,
    visitsB,
    totalVisits: turns.length,
    inningsCompleted,
    currentInning: inningsCompleted + 1,
    inningInProgress: visitsA !== visitsB,
  };
};

const groupTurnsByInning = (turns = [], playerAId, playerBId) => {
  const groups = [];
  let buffer = [];

  turns.forEach((turn) => {
    buffer.push(turn);
    const stats = buildLiveMatchInningsStats(buffer, playerAId, playerBId);
    if (!stats.inningInProgress) {
      groups.push({
        inningNumber: groups.length + 1,
        turns: [...buffer],
        inProgress: false,
      });
      buffer = [];
    }
  });

  if (buffer.length > 0) {
    groups.push({
      inningNumber: groups.length + 1,
      turns: buffer,
      inProgress: true,
    });
  }

  return groups;
};

module.exports = {
  buildLiveMatchInningsStats,
  groupTurnsByInning,
};
