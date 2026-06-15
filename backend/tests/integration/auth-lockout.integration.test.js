const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const User = require('../../src/models/user.model');

describe('Login lockout integration', () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.LOGIN_LOCKOUT_MAX_ATTEMPTS = '5';
    process.env.LOGIN_LOCKOUT_DURATION_MINUTES = '15';

    const dbName = `rack-n-roll-auth-lockout-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

  const signup = async (email) => {
    const response = await request(app).post('/api/auth/signup').send({
      name: 'Lockout User',
      email,
      password: 'Password123!',
    });

    expect(response.status).toBe(201);
    return response.body.data;
  };

  test('locks account after repeated failed password attempts', async () => {
    const unique = Date.now();
    const email = `lockout.user.${unique}@example.com`;
    await signup(email);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const failedResponse = await request(app).post('/api/auth/login').send({
        email,
        password: 'WrongPassword123!',
      });

      expect(failedResponse.status).toBe(401);
      expect(failedResponse.body.error.code).toBe('INVALID_CREDENTIALS');
    }

    const lockedResponse = await request(app).post('/api/auth/login').send({
      email,
      password: 'WrongPassword123!',
    });

    expect(lockedResponse.status).toBe(429);
    expect(lockedResponse.body.error.code).toBe('ACCOUNT_LOCKED');
    expect(lockedResponse.body.error.details.retryAfterSeconds).toBeGreaterThan(0);

    const correctWhileLocked = await request(app).post('/api/auth/login').send({
      email,
      password: 'Password123!',
    });

    expect(correctWhileLocked.status).toBe(429);
    expect(correctWhileLocked.body.error.code).toBe('ACCOUNT_LOCKED');
  });

  test('successful login clears failed attempt counter', async () => {
    const unique = Date.now();
    const email = `lockout.clear.${unique}@example.com`;
    await signup(email);

    await request(app).post('/api/auth/login').send({
      email,
      password: 'WrongPassword123!',
    });

    const successResponse = await request(app).post('/api/auth/login').send({
      email,
      password: 'Password123!',
    });

    expect(successResponse.status).toBe(200);

    const storedUser = await User.findOne({ email }).select('+failedLoginAttempts +lockoutUntil').lean();
    expect(storedUser.failedLoginAttempts).toBe(0);
    expect(storedUser.lockoutUntil).toBeNull();
  });

  test('duplicate signup returns a generic failure without email enumeration', async () => {
    const unique = Date.now();
    const email = `signup.generic.${unique}@example.com`;
    await signup(email);

    const duplicateResponse = await request(app).post('/api/auth/signup').send({
      name: 'Another User',
      email,
      password: 'Password123!',
    });

    expect(duplicateResponse.status).toBe(409);
    expect(duplicateResponse.body.error.code).toBe('SIGNUP_FAILED');
    expect(duplicateResponse.body.error.message).not.toMatch(/already registered/i);
  });
});
