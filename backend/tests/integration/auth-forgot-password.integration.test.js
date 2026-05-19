const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');

describe('forgot password integration', () => {
  let app;

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    process.env.MAIL_DELIVERY_MODE = 'log';
    const dbName = `rack-n-roll-auth-reset-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

  test('happy path: user resets password and can login with new password', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Reset User',
      email: 'reset.user@example.com',
      password: 'Password123!',
    });

    const requestResetResponse = await request(app).post('/api/auth/forgot-password/request').send({
      email: 'reset.user@example.com',
    });

    expect(requestResetResponse.status).toBe(200);
    expect(requestResetResponse.body.success).toBe(true);
    expect(requestResetResponse.body.data.devResetPin).toMatch(/^\d{6}$/);

    const validatePinResponse = await request(app).post('/api/auth/forgot-password/validate-pin').send({
      email: 'reset.user@example.com',
      pin: requestResetResponse.body.data.devResetPin,
    });

    expect(validatePinResponse.status).toBe(200);
    expect(validatePinResponse.body.success).toBe(true);
    expect(validatePinResponse.body.data.resetToken).toEqual(expect.any(String));

    const forgotPasswordResponse = await request(app).post('/api/auth/forgot-password').send({
      email: 'reset.user@example.com',
      resetToken: validatePinResponse.body.data.resetToken,
      newPassword: 'NewPassword123!',
    });

    expect(forgotPasswordResponse.status).toBe(200);
    expect(forgotPasswordResponse.body.success).toBe(true);

    const loginWithOldPasswordResponse = await request(app).post('/api/auth/login').send({
      email: 'reset.user@example.com',
      password: 'Password123!',
    });

    expect(loginWithOldPasswordResponse.status).toBe(401);
    expect(loginWithOldPasswordResponse.body.success).toBe(false);

    const loginWithNewPasswordResponse = await request(app).post('/api/auth/login').send({
      email: 'reset.user@example.com',
      password: 'NewPassword123!',
    });

    expect(loginWithNewPasswordResponse.status).toBe(200);
    expect(loginWithNewPasswordResponse.body.success).toBe(true);
    expect(loginWithNewPasswordResponse.body.data.user.email).toBe('reset.user@example.com');
  });

  test('request path: forgot password does not reveal unknown email', async () => {
    const response = await request(app).post('/api/auth/forgot-password/request').send({
      email: 'unknown.user@example.com',
    });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data.message).toMatch(/If an account exists/i);
  });

  test('failure path: forgot password rejects weak new password', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Weak Password User',
      email: 'weak.password@example.com',
      password: 'Password123!',
    });

    const requestResetResponse = await request(app).post('/api/auth/forgot-password/request').send({
      email: 'weak.password@example.com',
    });

    const validatePinResponse = await request(app).post('/api/auth/forgot-password/validate-pin').send({
      email: 'weak.password@example.com',
      pin: requestResetResponse.body.data.devResetPin,
    });

    const response = await request(app).post('/api/auth/forgot-password').send({
      email: 'weak.password@example.com',
      resetToken: validatePinResponse.body.data.resetToken,
      newPassword: 'weak',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('WEAK_PASSWORD');
  });

  test('failure path: forgot password rejects invalid pin', async () => {
    await request(app).post('/api/auth/signup').send({
      name: 'Invalid Pin User',
      email: 'invalid.pin@example.com',
      password: 'Password123!',
    });

    await request(app).post('/api/auth/forgot-password/request').send({
      email: 'invalid.pin@example.com',
    });

    const response = await request(app).post('/api/auth/forgot-password/validate-pin').send({
      email: 'invalid.pin@example.com',
      pin: '999999',
    });

    expect(response.status).toBe(400);
    expect(response.body.success).toBe(false);
    expect(response.body.error.code).toBe('INVALID_RESET_PIN');
  });
});
