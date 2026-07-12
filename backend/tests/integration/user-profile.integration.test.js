const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const Tournament = require('../../src/models/tournament.model');
const TournamentRegistration = require('../../src/models/tournamentRegistration.model');
const Player = require('../../src/models/player.model');
const Game = require('../../src/models/game.model');

describe('User profile integration', () => {
  let app;

  const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

  const signup = async (name, email) => {
    const response = await request(app).post('/api/auth/signup').send({
      name,
      email,
      password: 'Password123!',
    });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);

    return {
      token: response.body.data.token,
      user: response.body.data.user,
    };
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    const dbName = `rack-n-roll-profile-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

  test('GET /api/users/me/profile returns user info and stats', async () => {
    const unique = Date.now();
    const host = await signup('Profile Host', `profile.host.${unique}@example.com`);
    const player = await signup('Profile Player', `profile.player.${unique}@example.com`);

    const tournament = await Tournament.create({
      name: 'Profile Stats Open',
      hostUserId: host.user.id,
      maxParticipants: 16,
      registrationMode: 'public',
      registrationStatus: 'open',
      status: 'active',
      progressionState: 'registration',
      approvedParticipantsCount: 1,
      startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      location: {
        type: 'Point',
        coordinates: [-79.3832, 43.6532],
        countryCode: 'CA',
        provinceCode: 'ON',
        city: 'Toronto',
        formattedAddress: 'Toronto, ON, Canada',
      },
    });

    await TournamentRegistration.create({
      tournamentId: tournament._id,
      userId: player.user.id,
      status: 'approved',
    });

    const hostPlayer = await Player.create({
      tournamentId: tournament._id,
      userId: host.user.id,
      displayName: host.user.name,
      status: 'active',
    });

    const guestPlayer = await Player.create({
      tournamentId: tournament._id,
      userId: player.user.id,
      displayName: player.user.name,
      status: 'active',
    });

    await Game.create({
      tournamentId: tournament._id,
      playerAId: hostPlayer._id,
      playerBId: guestPlayer._id,
      stageId: 'groupStage',
      status: 'completed',
      winnerPlayerId: guestPlayer._id,
      playerASeriesWins: 0,
      playerBSeriesWins: 1,
    });

    const response = await request(app)
      .get('/api/users/me/profile')
      .set(authHeader(player.token));

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.user.email).toBe(player.user.email);
    expect(response.body.data.stats.tournamentsJoined).toBeGreaterThanOrEqual(1);
    expect(response.body.data.stats.matchesPlayed).toBe(1);
    expect(response.body.data.stats.matchesWon).toBe(1);
    expect(response.body.data.stats.winRate).toBe(100);

    const hostResponse = await request(app)
      .get('/api/users/me/profile')
      .set(authHeader(host.token));

    expect(hostResponse.status).toBe(200);
    expect(hostResponse.body.data.stats.tournamentsHosted).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/users/me/profile requires authentication', async () => {
    const response = await request(app).get('/api/users/me/profile');
    expect(response.status).toBe(401);
  });

  test('PATCH /api/users/me/email sets recovery email for accounts without one', async () => {
    const unique = Date.now();
    const signupResponse = await request(app).post('/api/auth/signup').send({
      firstName: 'No',
      lastName: 'Email',
      username: `noemail${String(unique).slice(-6)}`,
      password: 'Password123!',
    });

    expect(signupResponse.status).toBe(201);
    const token = signupResponse.body.data.token;
    const recoveryEmail = `recovery.${unique}@example.com`;

    const updateResponse = await request(app)
      .patch('/api/users/me/email')
      .set(authHeader(token))
      .send({ email: recoveryEmail });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.user.email).toBe(recoveryEmail);

    const duplicateResponse = await request(app)
      .patch('/api/users/me/email')
      .set(authHeader(token))
      .send({ email: `other.${unique}@example.com` });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.error.code).toBe('EMAIL_ALREADY_SET');
  });
});
