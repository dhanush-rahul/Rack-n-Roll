const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const { ensureLeaderboardIndexes } = require('../../src/config/db');
const Leaderboard = require('../../src/models/leaderboard.model');

const buildDoublesPayload = (overrides = {}) => ({
  name: 'Doubles Resave Cup',
  maxParticipants: 8,
  registrationMode: 'public',
  registrationStatus: 'open',
  startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  location: { formattedAddress: 'Vancouver Community Centre, Vancouver, BC, Canada' },
  competitionConfig: {
    format: 'doubles',
    pairFormationMode: 'hostAssigns',
    groupCount: 1,
    groupStageBestOf: 1,
    finalStageEnabled: false,
  },
  ...overrides,
});

describe('Doubles score resave', () => {
  let app;

  const signup = async (name, email) => {
    const response = await request(app).post('/api/auth/signup').send({
      name,
      email,
      password: 'Password123!',
    });

    expect(response.status).toBe(201);

    return {
      userId: response.body.data.user.id,
      token: response.body.data.token,
    };
  };

  const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    const dbName = `rack-n-roll-doubles-resave-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const mongoUri = process.env.TEST_MONGODB_URI || `mongodb://127.0.0.1:27017/${dbName}`;

    await mongoose.connect(mongoUri);
    await ensureLeaderboardIndexes();
    app = createApp({ jwtSecret: process.env.JWT_SECRET });
  });

  afterEach(async () => {
    const collections = mongoose.connection.collections;
    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test('host can save and update the same doubles match score', async () => {
    const unique = Date.now();
    const host = await signup('Doubles Host', `doubles.host.${unique}@example.com`);
    const players = await Promise.all(
      [1, 2, 3, 4].map((index) => signup(`Player ${index}`, `doubles.p${index}.${unique}@example.com`))
    );

    const createResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildDoublesPayload());

    expect(createResponse.status).toBe(201);
    const tournamentId = createResponse.body.data.id;

    await Promise.all(
      players.map((player) =>
        request(app)
          .post(`/api/tournaments/${tournamentId}/registrations`)
          .set(authHeader(player.token))
          .send({})
      )
    );

    const pendingResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/pending`)
      .set(authHeader(host.token));

    await Promise.all(
      pendingResponse.body.data.items.map((item) =>
        request(app)
          .post(`/api/tournaments/${tournamentId}/registrations/${item.id}/approve`)
          .set(authHeader(host.token))
      )
    );

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registration/close`)
      .set(authHeader(host.token));

    const pairResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/teams/random-pair`)
      .set(authHeader(host.token));

    expect(pairResponse.status).toBe(200);

    const assignGroupsResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/groups/assign-random`)
      .set(authHeader(host.token))
      .send({ groupCount: 1, groupStageBestOf: 1 });

    expect(assignGroupsResponse.status).toBe(200);

    const scoresheetResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/scoresheet?page=1&pageSize=10&stage=groupStage`)
      .set(authHeader(host.token));

    expect(scoresheetResponse.status).toBe(200);
    const game = scoresheetResponse.body.data.items[0];
    expect(game?.id).toBeTruthy();

    const firstSaveResponse = await request(app)
      .put(`/api/tournaments/${tournamentId}/games/${game.id}/scores`)
      .set(authHeader(host.token))
      .send({
        scoreEntries: [{ gameNumber: 1, playerAScore: 5, playerBScore: 3 }],
        status: 'completed',
      });

    expect(firstSaveResponse.status).toBe(200);

    const secondSaveResponse = await request(app)
      .put(`/api/tournaments/${tournamentId}/games/${game.id}/scores`)
      .set(authHeader(host.token))
      .send({
        scoreEntries: [{ gameNumber: 1, playerAScore: 5, playerBScore: 4 }],
        status: 'completed',
      });

    expect(secondSaveResponse.status).toBe(200);
    expect(secondSaveResponse.body.data.scoreEntries[0].playerBScore).toBe(4);

    const teamLeaderboardCount = await Leaderboard.countDocuments({
      tournamentId,
      standingsType: 'team',
    });

    expect(teamLeaderboardCount).toBeGreaterThan(1);
  });
});
