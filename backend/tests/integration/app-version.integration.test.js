const request = require('supertest');
const { createApp } = require('../../src/app');

describe('GET /api/app/version', () => {
  let app;

  beforeAll(() => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    app = createApp({ jwtSecret: process.env.JWT_SECRET });
  });

  test('returns mobile and web version requirements', async () => {
    const response = await request(app).get('/api/app/version');

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      latestVersion: expect.any(String),
      minAndroidVersionCode: expect.any(Number),
      minIosBuildNumber: expect.any(Number),
      minWebVersion: expect.any(String),
      androidStoreUrl: expect.any(String),
      updateMessage: expect.any(String),
      mandatoryMessage: expect.any(String),
    });
  });
});
