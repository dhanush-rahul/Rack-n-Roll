const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');

const buildTournamentPayload = (overrides = {}) => ({
  name: 'Export Test Open',
  maxParticipants: 16,
  registrationMode: 'public',
  registrationStatus: 'open',
  startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  location: {
    formattedAddress: 'Vancouver Community Centre, Vancouver, BC, Canada',
  },
  ...overrides,
});

describe('Tournament Excel export', () => {
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
    const dbName = `rack-n-roll-export-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

  test('host can download xlsx export; non-host receives 403', async () => {
    const unique = Date.now();
    const host = await signup('Export Host', `export.host.${unique}@example.com`);
    const guest = await signup('Export Guest', `export.guest.${unique}@example.com`);

    const createResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ name: 'Spring Export Cup' }));

    expect(createResponse.status).toBe(201);
    const tournamentId = createResponse.body.data.id;

    const forbiddenResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/export/xlsx`)
      .set(authHeader(guest.token));

    expect(forbiddenResponse.status).toBe(403);

    const exportResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/export/xlsx`)
      .set(authHeader(host.token))
      .buffer(true)
      .parse((response, callback) => {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('end', () => callback(null, Buffer.concat(chunks)));
      });

    expect(exportResponse.status).toBe(200);
    expect(exportResponse.headers['content-type']).toContain(
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    expect(String(exportResponse.headers['content-disposition'] || '')).toContain('.xlsx');
    expect(Buffer.isBuffer(exportResponse.body)).toBe(true);
    expect(exportResponse.body.length).toBeGreaterThan(1000);
    expect(exportResponse.body.slice(0, 2).toString()).toBe('PK');
  });

  test('host export email requires SMTP configuration', async () => {
    const unique = Date.now();
    const host = await signup('Email Export Host', `email.export.host.${unique}@example.com`);

    const createResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ name: 'Email Export Cup' }));

    expect(createResponse.status).toBe(201);
    const tournamentId = createResponse.body.data.id;

    const emailResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/export/email`)
      .set(authHeader(host.token));

    expect(emailResponse.status).toBe(503);
    expect(emailResponse.body.success).toBe(false);
    expect(emailResponse.body.error.code).toBe('EMAIL_NOT_CONFIGURED');
  });
});
