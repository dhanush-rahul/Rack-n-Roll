const mongoose = require('mongoose');

const ensureLeaderboardIndexes = async () => {
  const Leaderboard = require('../models/leaderboard.model');
  const staleIndexNames = new Set([
    'tournamentId_1_divisionId_1_playerId_1',
    'tournamentId_1_divisionId_1_teamId_1',
  ]);

  try {
    const indexes = await Leaderboard.collection.indexes();

    for (const index of indexes) {
      if (!staleIndexNames.has(index.name)) {
        continue;
      }

      await Leaderboard.collection.dropIndex(index.name);
      console.log(`[startup] dropped stale leaderboard index: ${index.name}`);
    }
  } catch (error) {
    if (error?.codeName === 'IndexNotFound' || error?.codeName === 'NamespaceNotFound' || error?.code === 26) {
      await Leaderboard.syncIndexes();
      return;
    }

    console.warn('[startup] leaderboard index cleanup skipped:', error.message);
  }

  await Leaderboard.syncIndexes();
  console.log('[startup] leaderboard indexes verified');
};

const connectToDatabase = async (mongoUri) => {
  await mongoose.connect(mongoUri);
  await ensureLeaderboardIndexes();
  console.log('[startup] connected to MongoDB');
};

module.exports = { connectToDatabase, ensureLeaderboardIndexes };
