const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../src/app');
const { loadAndValidateEnv } = require('../src/config/env');
const { connectToDatabase } = require('../src/config/db');
const Tournament = require('../src/models/tournament.model');

const HOST_EMAIL = 'test@gmail.com';
const HOST_PASSWORD = 'test@123';
const PLAYER_QUERY = process.argv[2] || 'test05';
const PLAYER2_QUERY = process.argv[3] || '';

const normalize = (value) => String(value || '').toLowerCase();
const normalizeLoose = (value) => String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const includesLoose = (source, query) => {
  const strictSource = normalize(source);
  const strictQuery = normalize(query).trim();

  if (!strictQuery) return false;

  if (strictSource.includes(strictQuery)) {
    return true;
  }

  const looseSource = normalizeLoose(source);
  const looseQuery = normalizeLoose(query);

  if (looseSource.includes(looseQuery)) {
    return true;
  }

  let sourceIndex = 0;
  let queryIndex = 0;

  while (sourceIndex < looseSource.length && queryIndex < looseQuery.length) {
    if (looseSource[sourceIndex] === looseQuery[queryIndex]) {
      queryIndex += 1;
    }

    sourceIndex += 1;
  }

  return queryIndex === looseQuery.length;
};

const matchHasPlayer = (match, query) => {
  const q = String(query || '').trim();
  if (!q) return true;

  const a = `${match.playerA?.displayName || ''} ${match.playerA?.userId || ''} ${match.playerAId || ''}`;
  const b = `${match.playerB?.displayName || ''} ${match.playerB?.userId || ''} ${match.playerBId || ''}`;
  return includesLoose(a, q) || includesLoose(b, q);
};

const matchHasPair = (match, queryA, queryB) => {
  const qa = String(queryA || '').trim();
  const qb = String(queryB || '').trim();
  if (!qa || !qb) return true;

  const a = `${match.playerA?.displayName || ''} ${match.playerA?.userId || ''} ${match.playerAId || ''}`;
  const b = `${match.playerB?.displayName || ''} ${match.playerB?.userId || ''} ${match.playerBId || ''}`;

  return (includesLoose(a, qa) && includesLoose(b, qb)) || (includesLoose(a, qb) && includesLoose(b, qa));
};

const run = async () => {
  const env = loadAndValidateEnv();
  await connectToDatabase(env.mongoUri);
  const app = createApp(env);

  const latestTournament = await Tournament.findOne({
    name: { $regex: /^Load Tournament/i },
  })
    .sort({ createdAt: -1 })
    .lean();

  if (!latestTournament) {
    throw new Error('No seeded Load Tournament found. Run npm run seed:large:scored first.');
  }

  const loginRes = await request(app).post('/api/auth/login').send({
    email: HOST_EMAIL,
    password: HOST_PASSWORD,
  });

  if (loginRes.status !== 200 || !loginRes.body?.data?.token) {
    throw new Error(`Login failed: ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
  }

  const token = loginRes.body.data.token;
  const auth = { Authorization: `Bearer ${token}` };
  const tournamentId = String(latestTournament._id);

  const allRes = await request(app)
    .get(`/api/tournaments/${tournamentId}/scoresheet`)
    .query({ stage: 'groupStage', page: 1, pageSize: 200 })
    .set(auth);

  const filteredRes = await request(app)
    .get(`/api/tournaments/${tournamentId}/scoresheet`)
    .query({
      stage: 'groupStage',
      page: 1,
      pageSize: 200,
      playerQuery: PLAYER_QUERY,
      ...(PLAYER2_QUERY ? { player2Query: PLAYER2_QUERY } : {}),
    })
    .set(auth);

  if (allRes.status !== 200) {
    throw new Error(`Unfiltered scoresheet failed: ${allRes.status} ${JSON.stringify(allRes.body)}`);
  }

  if (filteredRes.status !== 200) {
    throw new Error(`Filtered scoresheet failed: ${filteredRes.status} ${JSON.stringify(filteredRes.body)}`);
  }

  const allItems = allRes.body?.data?.items || [];
  const filteredItems = filteredRes.body?.data?.items || [];

  const invalidByPlayer = filteredItems.filter((match) => !matchHasPlayer(match, PLAYER_QUERY));
  const invalidByPair = PLAYER2_QUERY
    ? filteredItems.filter((match) => !matchHasPair(match, PLAYER_QUERY, PLAYER2_QUERY))
    : [];

  console.log('[check:scoresheet-filter]');
  console.log(`tournamentId=${tournamentId}`);
  console.log(`tournamentName=${latestTournament.name}`);
  console.log(`allGroupStageMatches=${allItems.length}`);
  console.log(`playerQuery=${PLAYER_QUERY}`);
  if (PLAYER2_QUERY) {
    console.log(`player2Query=${PLAYER2_QUERY}`);
  }
  console.log(`filteredMatches=${filteredItems.length}`);
  console.log(`invalidByPlayer=${invalidByPlayer.length}`);
  console.log(`invalidByPair=${invalidByPair.length}`);

  if (filteredItems.length > 0) {
    console.log('sampleFilteredMatches=');
    filteredItems.slice(0, 8).forEach((match) => {
      console.log(`- R${match.roundNumber}: ${match.playerA?.displayName || match.playerAId} vs ${match.playerB?.displayName || match.playerBId}`);
    });
  }
};

run()
  .catch((error) => {
    console.error('[check:scoresheet-filter] failed', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
