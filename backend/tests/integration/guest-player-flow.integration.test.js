const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const Player = require('../../src/models/player.model');
const TournamentRegistration = require('../../src/models/tournamentRegistration.model');
const Game = require('../../src/models/game.model');
const Division = require('../../src/models/division.model');

const buildTournamentPayload = (overrides = {}) => ({
  name: 'Guest Flow Tournament',
  maxParticipants: 16,
  registrationMode: 'public',
  registrationStatus: 'open',
  startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  location: {
    formattedAddress: 'Vancouver Community Centre, Vancouver, BC, Canada',
  },
  ...overrides,
});

const extractTournamentId = (responseBody) =>
  responseBody?.data?.id || responseBody?.data?.tournamentId || responseBody?.data?._id || null;

describe('Guest player add and username linking', () => {
  let app;

  const signup = async (name, email) => {
    const response = await request(app).post('/api/auth/signup').send({
      name,
      email,
      password: 'Password123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    return {
      userId: response.body.data.user.id,
      token: response.body.data.token,
      username: response.body.data.user.username,
    };
  };

  const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

  const createTournamentAsHost = async (hostToken, overrides = {}) => {
    const createResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(hostToken))
      .send(buildTournamentPayload(overrides));

    expect(createResponse.status).toBe(201);
    return extractTournamentId(createResponse.body);
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.MAIL_DELIVERY_MODE = 'log';
    const dbName = `rack-n-roll-guest-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const mongoUri = process.env.TEST_MONGODB_URI || `mongodb://127.0.0.1:27017/${dbName}`;

    await mongoose.connect(mongoUri);
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

  test('host guest-add creates unlinked player and shows on host roster', async () => {
    const unique = Date.now();
    const host = await signup('Guest Host', `guest.host.${unique}@example.com`);
    const tournamentId = await createTournamentAsHost(host.token);
    const guestUsername = `walkin${String(unique).slice(-6)}`;

    const guestAddResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/guest-add`)
      .set(authHeader(host.token))
      .send({
        name: 'Walk-in Player',
        username: guestUsername,
      });

    expect(guestAddResponse.status).toBe(201);
    expect(guestAddResponse.body.success).toBe(true);
    expect(guestAddResponse.body.data.isGuest).toBe(true);
    expect(guestAddResponse.body.data.linkedImmediately).toBe(false);
    expect(guestAddResponse.body.data.inviteEmailSent).toBe(false);

    const player = await Player.findOne({ tournamentId, pendingLinkUsername: guestUsername }).lean();
    expect(player).toBeTruthy();
    expect(player.userId).toBeNull();
    expect(player.displayName).toBe('Walk-in Player');

    const hostListResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/host-list`)
      .set(authHeader(host.token));

    expect(hostListResponse.status).toBe(200);
    const guestItem = hostListResponse.body.data.items.find((item) => item.isGuest);
    expect(guestItem).toMatchObject({
      isGuest: true,
      guestUsername,
      status: 'approved',
      user: {
        name: 'Walk-in Player',
        username: guestUsername,
      },
    });
  });

  test('guest-add with existing registered username returns 409', async () => {
    const unique = Date.now();
    const host = await signup('Auto Host', `auto.host.${unique}@example.com`);
    const existingPlayer = await signup('Existing Player', `existing.${unique}@example.com`);
    const tournamentId = await createTournamentAsHost(host.token);

    const guestAddResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/guest-add`)
      .set(authHeader(host.token))
      .send({
        name: 'Should Not Matter',
        username: existingPlayer.username,
      });

    expect(guestAddResponse.status).toBe(409);
    expect(guestAddResponse.body.error.code).toBe('USERNAME_ALREADY_REGISTERED');
  });

  test('duplicate guest username in same tournament returns 409', async () => {
    const unique = Date.now();
    const host = await signup('Dup Host', `dup.host.${unique}@example.com`);
    const tournamentId = await createTournamentAsHost(host.token);
    const guestUsername = `dupguest${String(unique).slice(-6)}`;

    const firstAdd = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/guest-add`)
      .set(authHeader(host.token))
      .send({ name: 'Guest One', username: guestUsername });

    expect(firstAdd.status).toBe(201);

    const duplicateAdd = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/guest-add`)
      .set(authHeader(host.token))
      .send({ name: 'Guest Two', username: guestUsername });

    expect(duplicateAdd.status).toBe(409);
    expect(duplicateAdd.body.error.code).toBe('GUEST_ALREADY_ON_ROSTER');
  });

  test('guest signup with matching username links player and shows approved registration on discover', async () => {
    const unique = Date.now();
    const host = await signup('Link Host', `link.host.${unique}@example.com`);
    const tournamentId = await createTournamentAsHost(host.token);
    const guestUsername = `linked${String(unique).slice(-6)}`;

    const guestAddResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/guest-add`)
      .set(authHeader(host.token))
      .send({ name: 'Future App User', username: guestUsername });

    expect(guestAddResponse.status).toBe(201);
    const guestPlayerId = guestAddResponse.body.data.playerId;

    const guestSignup = await request(app).post('/api/auth/signup').send({
      firstName: 'Future',
      lastName: 'App User',
      username: guestUsername,
      password: 'Password123!',
    });

    expect(guestSignup.status).toBe(201);

    const linkedPlayer = await Player.findById(guestPlayerId).lean();
    expect(String(linkedPlayer.userId)).toBe(guestSignup.body.data.user.id);
    expect(linkedPlayer.pendingLinkUsername).toBeNull();

    const registration = await TournamentRegistration.findOne({
      tournamentId,
      userId: guestSignup.body.data.user.id,
      status: 'approved',
    }).lean();

    expect(registration).toBeTruthy();

    const discoverResponse = await request(app)
      .get('/api/tournaments/discover?page=1&pageSize=20')
      .set(authHeader(guestSignup.body.data.token));

    expect(discoverResponse.status).toBe(200);
    const tournamentItem = discoverResponse.body.data.items.find((item) => item.id === tournamentId);
    expect(tournamentItem?.currentUserRegistrationStatus).toBe('approved');
  });

  test('guest added after groups exist is placed into a group with incremental fixtures', async () => {
    const unique = Date.now();
    const host = await signup('Group Guest Host', `groupguest.host.${unique}@example.com`);
    const players = await Promise.all([
      signup('Seed Player 1', `seed1.${unique}@example.com`),
      signup('Seed Player 2', `seed2.${unique}@example.com`),
      signup('Seed Player 3', `seed3.${unique}@example.com`),
      signup('Seed Player 4', `seed4.${unique}@example.com`),
    ]);
    const tournamentId = await createTournamentAsHost(host.token);

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

    await request(app)
      .post(`/api/tournaments/${tournamentId}/groups/assign-random`)
      .set(authHeader(host.token))
      .send({ groupCount: 2, groupStageBestOf: 1 });

    const gamesBeforeGuestAdd = await Game.countDocuments({ tournamentId, stageId: 'groupStage' });

    const guestUsername = `lateguest${String(unique).slice(-6)}`;

    const guestAddResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/guest-add`)
      .set(authHeader(host.token))
      .send({
        name: 'Late Guest',
        username: guestUsername,
      });

    expect(guestAddResponse.status).toBe(201);
    expect(guestAddResponse.body.data.groupSync).toBeTruthy();
    expect(guestAddResponse.body.data.groupSync.gamesCreated).toBeGreaterThan(0);

    const gamesAfterGuestAdd = await Game.countDocuments({ tournamentId, stageId: 'groupStage' });
    expect(gamesAfterGuestAdd).toBeGreaterThan(gamesBeforeGuestAdd);

    const guestPlayer = await Player.findOne({
      tournamentId,
      pendingLinkUsername: guestUsername,
    }).lean();

    const divisions = await Division.find({ tournamentId, name: { $ne: 'Final Stage' } }).lean();
    const assignedDivision = divisions.find((division) =>
      (division.playerIds || []).map(String).includes(String(guestPlayer._id))
    );

    expect(assignedDivision).toBeTruthy();
  });
});
