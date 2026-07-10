const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const Player = require('../../src/models/player.model');
const TournamentRegistration = require('../../src/models/tournamentRegistration.model');

const buildTournamentPayload = () => ({
  name: 'Username Flow Tournament',
  maxParticipants: 16,
  registrationMode: 'public',
  registrationStatus: 'open',
  startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  location: {
    formattedAddress: 'Vancouver Community Centre, Vancouver, BC, Canada',
  },
});

const extractTournamentId = (responseBody) =>
  responseBody?.data?.id || responseBody?.data?.tournamentId || responseBody?.data?._id || null;

describe('Username auth and guest linking', () => {
  let app;

  const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    const dbName = `rack-n-roll-username-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

  test('username check distinguishes signup and guest purpose', async () => {
    const signupResponse = await request(app).post('/api/auth/signup').send({
      firstName: 'Rahul',
      lastName: 'Kumar',
      username: 'rahul',
      password: 'Password123!',
    });

    expect(signupResponse.status).toBe(201);

    const guestCheck = await request(app).get('/api/auth/username/check?username=rahul&purpose=guest');
    expect(guestCheck.status).toBe(200);
    expect(guestCheck.body.data.available).toBe(false);
    expect(guestCheck.body.data.reason).toBe('taken');

    const signupCheck = await request(app).get('/api/auth/username/check?username=rahul&purpose=signup');
    expect(signupCheck.status).toBe(200);
    expect(signupCheck.body.data.available).toBe(false);
    expect(signupCheck.body.data.reason).toBe('taken');

    const availableCheck = await request(app).get('/api/auth/username/check?username=suresh&purpose=signup');
    expect(availableCheck.status).toBe(200);
    expect(availableCheck.body.data.available).toBe(true);
  });

  test('signup with reserved guest username links guest entries', async () => {
    const hostSignup = await request(app).post('/api/auth/signup').send({
      name: 'Tournament Host',
      email: 'host.username.flow@example.com',
      password: 'Password123!',
    });

    expect(hostSignup.status).toBe(201);
    const hostToken = hostSignup.body.data.token;

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(hostToken))
      .send(buildTournamentPayload());

    expect(createTournamentResponse.status).toBe(201);
    const tournamentId = extractTournamentId(createTournamentResponse.body);

    await Player.create({
      tournamentId,
      displayName: 'Guest Rahul',
      pendingLinkUsername: 'guestrahul',
      status: 'active',
      userId: null,
    });

    const guestSignup = await request(app).post('/api/auth/signup').send({
      firstName: 'Real',
      lastName: 'Guest',
      username: 'guestrahul',
      password: 'Password123!',
    });

    expect(guestSignup.status).toBe(201);

    const linkedPlayer = await Player.findOne({
      tournamentId,
      userId: guestSignup.body.data.user.id,
      status: 'active',
    }).lean();

    expect(linkedPlayer).toBeTruthy();
    expect(linkedPlayer?.pendingLinkUsername).toBeNull();
  });

  test('username change links pending guest entries', async () => {
    const hostSignup = await request(app).post('/api/auth/signup').send({
      name: 'Change Host',
      email: 'change.host@example.com',
      password: 'Password123!',
    });

    expect(hostSignup.status).toBe(201);
    const hostToken = hostSignup.body.data.token;

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(hostToken))
      .send(buildTournamentPayload());

    const tournamentId = extractTournamentId(createTournamentResponse.body);

    await Player.create({
      tournamentId,
      displayName: 'Reserved Guest',
      pendingLinkUsername: 'claimedname',
      status: 'active',
      userId: null,
    });

    const playerSignup = await request(app).post('/api/auth/signup').send({
      firstName: 'Player',
      lastName: 'One',
      username: 'playerone',
      password: 'Password123!',
    });

    expect(playerSignup.status).toBe(201);
    const playerToken = playerSignup.body.data.token;

    const changeUsernameResponse = await request(app)
      .patch('/api/users/me/username')
      .set(authHeader(playerToken))
      .send({ username: 'claimedname' });

    expect(changeUsernameResponse.status).toBe(200);
    expect(changeUsernameResponse.body.data.username).toBe('claimedname');
    expect(changeUsernameResponse.body.data.usernameChangesRemaining).toBe(1);

    const linkedPlayer = await Player.findOne({
      tournamentId,
      userId: playerSignup.body.data.user.id,
      status: 'active',
    }).lean();

    expect(linkedPlayer).toBeTruthy();
    expect(linkedPlayer?.pendingLinkUsername).toBeNull();
  });

  test('login works with username and legacy email alias', async () => {
    const signupResponse = await request(app).post('/api/auth/signup').send({
      firstName: 'Legacy',
      lastName: 'User',
      username: 'legacyuser',
      password: 'Password123!',
      email: 'legacy.user@example.com',
    });

    expect(signupResponse.status).toBe(201);

    const usernameLogin = await request(app).post('/api/auth/login').send({
      username: 'legacyuser',
      password: 'Password123!',
    });

    expect(usernameLogin.status).toBe(200);
    expect(usernameLogin.body.data.user.username).toBe('legacyuser');

    const emailLogin = await request(app).post('/api/auth/login').send({
      username: 'legacy.user@example.com',
      password: 'Password123!',
    });

    expect(emailLogin.status).toBe(200);
    expect(emailLogin.body.data.user.username).toBe('legacyuser');
  });
});
