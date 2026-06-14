const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const User = require('../../src/models/user.model');
const { __setVerifyGoogleIdTokenOverride } = require('../../src/services/googleAuth.service');

const mockGooglePayload = {
  sub: 'google-user-123',
  email: 'google.user@example.com',
  email_verified: true,
  name: 'Google User',
};

describe('Google auth integration', () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-google-client-id';
    const dbName = `rack-n-roll-auth-google-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const mongoUri = process.env.TEST_MONGODB_URI || `mongodb://127.0.0.1:27017/${dbName}`;

    await mongoose.connect(mongoUri);
    app = createApp({ jwtSecret: process.env.JWT_SECRET });
  });

  beforeEach(() => {
    __setVerifyGoogleIdTokenOverride(async (idToken) => {
      if (idToken === 'valid-google-token') {
        return mockGooglePayload;
      }

      if (idToken === 'verified-local-link-token') {
        return {
          sub: 'google-linked-456',
          email: 'local.link@example.com',
          email_verified: true,
          name: 'Linked Local User',
        };
      }

      throw new Error('Invalid Google token');
    });
  });

  afterEach(async () => {
    __setVerifyGoogleIdTokenOverride(null);
    const collections = mongoose.connection.collections;
    await Promise.all(Object.values(collections).map((collection) => collection.deleteMany({})));
  });

  afterAll(async () => {
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  });

  test('happy path: creates a Google-only account and returns JWT', async () => {
    const response = await request(app).post('/api/auth/google').send({
      idToken: 'valid-google-token',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.token).toEqual(expect.any(String));
    expect(response.body.data.user).toMatchObject({
      email: 'google.user@example.com',
      name: 'Google User',
      authProvider: 'google',
      hasPassword: false,
    });

    const storedUser = await User.findOne({ email: 'google.user@example.com' }).select('+passwordHash').lean();
    expect(storedUser.authProvider).toBe('google');
    expect(storedUser.googleId).toBe('google-user-123');
    expect(storedUser.passwordHash).toBeNull();
  });

  test('happy path: existing Google user can sign in again', async () => {
    await request(app).post('/api/auth/google').send({ idToken: 'valid-google-token' });

    const secondResponse = await request(app).post('/api/auth/google').send({
      idToken: 'valid-google-token',
    });

    expect(secondResponse.status).toBe(200);
    expect(secondResponse.body.data.user.email).toBe('google.user@example.com');

    const count = await User.countDocuments({ email: 'google.user@example.com' });
    expect(count).toBe(1);
  });

  test('happy path: links Google sign-in to an existing local account with the same email', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Local Link User',
      email: 'local.link@example.com',
      password: 'Password123!',
    });

    const response = await request(app).post('/api/auth/google').send({
      idToken: 'verified-local-link-token',
    });

    expect(response.status).toBe(200);
    expect(response.body.data.user).toMatchObject({
      email: 'local.link@example.com',
      authProvider: 'local',
      hasPassword: true,
    });

    const storedUser = await User.findOne({ email: 'local.link@example.com' }).select('+passwordHash').lean();
    expect(storedUser.googleId).toBe('google-linked-456');
    expect(storedUser.passwordHash).toEqual(expect.any(String));
  });

  test('failure path: invalid Google token is rejected', async () => {
    const response = await request(app).post('/api/auth/google').send({
      idToken: 'invalid-google-token',
    });

    expect(response.status).toBe(401);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_GOOGLE_TOKEN');
  });

  test('auth path: Google-only account cannot use password login', async () => {
    await request(app).post('/api/auth/google').send({ idToken: 'valid-google-token' });

    const loginResponse = await request(app).post('/api/auth/login').send({
      email: 'google.user@example.com',
      password: 'Password123!',
    });

    expect(loginResponse.status).toBe(401);
    expect(loginResponse.body.error.code).toBe('GOOGLE_AUTH_REQUIRED');
  });
});
