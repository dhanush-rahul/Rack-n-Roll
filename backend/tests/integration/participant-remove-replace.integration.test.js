const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const Player = require('../../src/models/player.model');
const Division = require('../../src/models/division.model');
const Game = require('../../src/models/game.model');

const buildTournamentPayload = (overrides = {}) => ({
  name: 'Remove Replace Tournament',
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

describe('Participant remove and replace flows', () => {
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

  const approveAllPending = async (tournamentId, hostToken) => {
    const pendingResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/pending`)
      .set(authHeader(hostToken));

    expect(pendingResponse.status).toBe(200);

    await Promise.all(
      pendingResponse.body.data.items.map((item) =>
        request(app)
          .post(`/api/tournaments/${tournamentId}/registrations/${item.id}/approve`)
          .set(authHeader(hostToken))
      )
    );
  };

  const setupGroupedTournament = async (unique) => {
    const host = await signup('Remove Host', `remove.host.${unique}@example.com`);
    const players = await Promise.all([
      signup('Player Alpha', `alpha.${unique}@example.com`),
      signup('Player Beta', `beta.${unique}@example.com`),
      signup('Player Gamma', `gamma.${unique}@example.com`),
      signup('Player Delta', `delta.${unique}@example.com`),
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

    await approveAllPending(tournamentId, host.token);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registration/close`)
      .set(authHeader(host.token));

    await request(app)
      .post(`/api/tournaments/${tournamentId}/groups/assign-random`)
      .set(authHeader(host.token))
      .send({ groupCount: 2, groupStageBestOf: 1 });

    const playerRecords = await Player.find({ tournamentId, status: 'active' }).lean();
    const divisions = await Division.find({ tournamentId, name: { $ne: 'Final Stage' } }).lean();
    const games = await Game.find({ tournamentId, stage: 'groupStage' }).lean();

    return { host, players, tournamentId, playerRecords, divisions, games };
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.MAIL_DELIVERY_MODE = 'log';
    const dbName = `rack-n-roll-remove-replace-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

  test('guest remove releases username and drops from host roster', async () => {
    const unique = Date.now();
    const host = await signup('Guest Remove Host', `guestremove.host.${unique}@example.com`);
    const tournamentId = await createTournamentAsHost(host.token);
    const guestUsername = `remguest${String(unique).slice(-6)}`;

    const guestAddResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/guest-add`)
      .set(authHeader(host.token))
      .send({ name: 'Walk-in Remove', username: guestUsername });

    expect(guestAddResponse.status).toBe(201);
    const guestPlayerId = guestAddResponse.body.data.playerId || guestAddResponse.body.data.id;

    const removeResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/guest/${guestPlayerId}/remove`)
      .set(authHeader(host.token));

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.success).toBe(true);

    const removedPlayer = await Player.findById(guestPlayerId).lean();
    expect(removedPlayer.status).toBe('removed');
    expect(removedPlayer.pendingLinkUsername).toBeNull();

    const hostListResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/host-list`)
      .set(authHeader(host.token));

    expect(hostListResponse.status).toBe(200);
    expect(hostListResponse.body.data.items.some((item) => item.isGuest && item.guestUsername === guestUsername)).toBe(
      false
    );

    const reAddResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/guest-add`)
      .set(authHeader(host.token))
      .send({ name: 'Walk-in Again', username: guestUsername });

    expect(reAddResponse.status).toBe(201);
  });

  test('registered remove pulls from division and deletes scheduled group games', async () => {
    const unique = Date.now();
    const { host, players, tournamentId, playerRecords } = await setupGroupedTournament(unique);

    const outgoingUser = players[0];
    const outgoingPlayer = playerRecords.find((player) => String(player.userId) === String(outgoingUser.userId));
    expect(outgoingPlayer).toBeTruthy();

    const gamesBeforeRemove = await Game.find({
      tournamentId,
      stage: 'groupStage',
      status: { $in: ['scheduled', 'inProgress'] },
      $or: [{ playerAId: outgoingPlayer._id }, { playerBId: outgoingPlayer._id }],
    }).lean();

    expect(gamesBeforeRemove.length).toBeGreaterThan(0);

    const divisionBefore = await Division.findOne({
      tournamentId,
      playerIds: outgoingPlayer._id,
      name: { $ne: 'Final Stage' },
    }).lean();

    expect(divisionBefore).toBeTruthy();

    const removeResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/${outgoingUser.userId}/remove`)
      .set(authHeader(host.token));

    expect(removeResponse.status).toBe(200);
    expect(removeResponse.body.data.status).toBe('removed');

    const divisionAfter = await Division.findById(divisionBefore._id).lean();
    expect((divisionAfter.playerIds || []).map(String)).not.toContain(String(outgoingPlayer._id));

    const gamesAfterRemove = await Game.find({
      tournamentId,
      stage: 'groupStage',
      status: { $in: ['scheduled', 'inProgress'] },
      $or: [{ playerAId: outgoingPlayer._id }, { playerBId: outgoingPlayer._id }],
    }).lean();

    expect(gamesAfterRemove).toHaveLength(0);

    const removedPlayer = await Player.findById(outgoingPlayer._id).lean();
    expect(removedPlayer.status).toBe('removed');
  });

  test('replace swaps player in scheduled games but leaves completed games unchanged', async () => {
    const unique = Date.now();
    const { host, players, tournamentId, playerRecords } = await setupGroupedTournament(unique);

    const outgoingUser = players[0];
    const replacementUser = await signup('Replacement User', `replacement.${unique}@example.com`);
    const outgoingPlayer = playerRecords.find((player) => String(player.userId) === String(outgoingUser.userId));
    expect(outgoingPlayer).toBeTruthy();

    const divisionBefore = await Division.findOne({
      tournamentId,
      playerIds: outgoingPlayer._id,
      name: { $ne: 'Final Stage' },
    }).lean();

    const slotIndex = (divisionBefore.playerIds || []).map(String).indexOf(String(outgoingPlayer._id));
    expect(slotIndex).toBeGreaterThanOrEqual(0);

    const scheduledGame = await Game.findOne({
      tournamentId,
      stage: 'groupStage',
      status: 'scheduled',
      $or: [{ playerAId: outgoingPlayer._id }, { playerBId: outgoingPlayer._id }],
    }).lean();

    expect(scheduledGame).toBeTruthy();

    const anotherScheduledGame = await Game.create({
      tournamentId,
      divisionId: scheduledGame.divisionId,
      stage: 'groupStage',
      status: 'scheduled',
      bestOf: scheduledGame.bestOf || 1,
      roundNumber: scheduledGame.roundNumber || 1,
      playerAId: outgoingPlayer._id,
      playerBId:
        String(scheduledGame.playerAId) === String(outgoingPlayer._id)
          ? scheduledGame.playerBId
          : scheduledGame.playerAId,
    });

    const completedGame = await Game.findByIdAndUpdate(
      scheduledGame._id,
      {
        $set: {
          status: 'completed',
          winnerPlayerId: outgoingPlayer._id,
          playerASeriesWins: 1,
          playerBSeriesWins: 0,
          scoreEntries: [{ gameNumber: 1, playerAScore: 1, playerBScore: 0 }],
        },
      },
      { new: true }
    ).lean();

    const replaceResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/replace`)
      .set(authHeader(host.token))
      .send({
        outgoingPlayerId: String(outgoingPlayer._id),
        replacement: { type: 'user', userId: replacementUser.userId },
      });

    expect(replaceResponse.status).toBe(200);
    expect(replaceResponse.body.success).toBe(true);
    expect(replaceResponse.body.data.gamesUpdated).toBeGreaterThan(0);

    const incomingPlayer = await Player.findOne({
      tournamentId,
      userId: replacementUser.userId,
      status: 'active',
    }).lean();

    expect(incomingPlayer).toBeTruthy();

    const divisionAfter = await Division.findById(divisionBefore._id).lean();
    expect((divisionAfter.playerIds || []).map(String)).not.toContain(String(outgoingPlayer._id));
    expect((divisionAfter.playerIds || []).map(String)).toContain(String(incomingPlayer._id));
    expect((divisionAfter.playerIds || []).map(String)[slotIndex]).toBe(String(incomingPlayer._id));

    const updatedScheduledGame = await Game.findById(anotherScheduledGame._id).lean();
    const scheduledPlayerIds = [String(updatedScheduledGame.playerAId), String(updatedScheduledGame.playerBId)];
    expect(scheduledPlayerIds).toContain(String(incomingPlayer._id));
    expect(scheduledPlayerIds).not.toContain(String(outgoingPlayer._id));

    const unchangedCompletedGame = await Game.findById(completedGame._id).lean();
    const completedPlayerIds = [String(unchangedCompletedGame.playerAId), String(unchangedCompletedGame.playerBId)];
    expect(completedPlayerIds).toContain(String(outgoingPlayer._id));
    expect(completedPlayerIds).not.toContain(String(incomingPlayer._id));
  });

  test('replace with guest creates new player and swaps scheduled fixtures', async () => {
    const unique = Date.now();
    const { host, players, tournamentId, playerRecords } = await setupGroupedTournament(unique);

    const outgoingUser = players[1];
    const outgoingPlayer = playerRecords.find((player) => String(player.userId) === String(outgoingUser.userId));
    const guestUsername = `replguest${String(unique).slice(-6)}`;

    const scheduledGamesBefore = await Game.countDocuments({
      tournamentId,
      stage: 'groupStage',
      status: 'scheduled',
      $or: [{ playerAId: outgoingPlayer._id }, { playerBId: outgoingPlayer._id }],
    });

    expect(scheduledGamesBefore).toBeGreaterThan(0);

    const replaceResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/replace`)
      .set(authHeader(host.token))
      .send({
        outgoingPlayerId: String(outgoingPlayer._id),
        replacement: { type: 'guest', rosterName: 'Replacement Guest', username: guestUsername },
      });

    expect(replaceResponse.status).toBe(200);
    expect(replaceResponse.body.data.gamesUpdated).toBeGreaterThan(0);

    const incomingPlayer = await Player.findOne({
      tournamentId,
      pendingLinkUsername: guestUsername,
      status: 'active',
    }).lean();

    expect(incomingPlayer).toBeTruthy();
    expect(incomingPlayer.displayName).toBe('Replacement Guest');

    const scheduledGamesAfter = await Game.find({
      tournamentId,
      stage: 'groupStage',
      status: 'scheduled',
      $or: [{ playerAId: incomingPlayer._id }, { playerBId: incomingPlayer._id }],
    }).lean();

    expect(scheduledGamesAfter.length).toBe(scheduledGamesBefore);

    const hostListResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/host-list`)
      .set(authHeader(host.token));

    const guestItem = hostListResponse.body.data.items.find((item) => item.isGuest && item.guestUsername === guestUsername);
    expect(guestItem).toBeTruthy();
    expect(guestItem.user.name).toBe('Replacement Guest');
  });
});
