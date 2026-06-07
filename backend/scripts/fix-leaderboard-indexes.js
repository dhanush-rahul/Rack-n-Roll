require('dotenv').config();
const mongoose = require('mongoose');
const { loadAndValidateEnv } = require('../src/config/env');
const { ensureLeaderboardIndexes } = require('../src/config/db');
const Leaderboard = require('../src/models/leaderboard.model');

const main = async () => {
  const env = loadAndValidateEnv();
  await mongoose.connect(env.mongoUri);
  await ensureLeaderboardIndexes();

  const indexes = await Leaderboard.collection.indexes();
  const stale = indexes.some((index) => index.name === 'tournamentId_1_divisionId_1_playerId_1');

  if (stale) {
    console.error('Stale leaderboard index still present. Manual intervention may be required.');
    process.exitCode = 1;
  } else {
    console.log('Leaderboard indexes are up to date.');
    console.log(indexes.map((index) => index.name).join(', '));
  }

  await mongoose.disconnect();
};

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
