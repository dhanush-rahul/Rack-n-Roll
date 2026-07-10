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

const ensureUserIndexes = async () => {
  const User = require('../models/user.model');
  const { backfillUsersMissingUsername } = require('../services/username.service');

  const backfilledCount = await backfillUsersMissingUsername();

  if (backfilledCount > 0) {
    console.log(`[startup] assigned usernames to ${backfilledCount} legacy user(s)`);
  }

  const nullEmailCleanup = await User.updateMany(
    { $or: [{ email: null }, { email: '' }] },
    { $unset: { email: '' } }
  );

  if (nullEmailCleanup.modifiedCount > 0) {
    console.log(`[startup] removed empty email field from ${nullEmailCleanup.modifiedCount} user(s)`);
  }

  try {
    const indexes = await User.collection.indexes();
    const emailIndex = indexes.find((index) => index.name === 'email_1');

    if (emailIndex && !emailIndex.sparse) {
      await User.collection.dropIndex('email_1');
      console.log('[startup] dropped non-sparse users.email index');
    }
  } catch (error) {
    if (error?.codeName !== 'IndexNotFound' && error?.code !== 27) {
      console.warn('[startup] user email index cleanup skipped:', error.message);
    }
  }

  await User.syncIndexes();
  console.log('[startup] user indexes verified');
};

const connectToDatabase = async (mongoUri) => {
  await mongoose.connect(mongoUri);
  await ensureLeaderboardIndexes();
  await ensureUserIndexes();
  console.log('[startup] connected to MongoDB');
};

module.exports = { connectToDatabase, ensureLeaderboardIndexes, ensureUserIndexes, ensureUserEmailIndex: ensureUserIndexes };
