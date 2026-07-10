const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const TournamentRegistration = require('../../src/models/tournamentRegistration.model');
const Game = require('../../src/models/game.model');

const buildTournamentPayload = (overrides = {}) => ({
  name: 'Spring Invitational',
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

describe('M6-S2 integration pack: discover -> register -> host approve', () => {
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
    };
  };

  const authHeader = (token) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    const dbName = `rack-n-roll-integration-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
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

  test('create tournament: venue-only location or optional numeric lng/lat', async () => {
    const unique = Date.now();
    const host = await signup('Geo Host', `geo.host.${unique}@example.com`);

    const venueOnlyResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(
        buildTournamentPayload({
          name: 'Venue Only Open',
          location: { formattedAddress: 'Queen Elizabeth Olympic Park, London, UK' },
        })
      );

    expect(venueOnlyResponse.status).toBe(201);

    const withCoordsResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(
        buildTournamentPayload({
          name: 'Coords Open',
          location: {
            formattedAddress: 'Bristol, UK',
            lng: -2.5879,
            lat: 51.4545,
          },
        })
      );

    expect(withCoordsResponse.status).toBe(201);
    expect(withCoordsResponse.body.data.location.coordinates).toEqual([-2.5879, 51.4545]);

    const invalidCoordsResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(
        buildTournamentPayload({
          name: 'Bad Coords Open',
          location: {
            formattedAddress: 'Nowhere',
            lng: 200,
            lat: 51,
          },
        })
      );

    expect(invalidCoordsResponse.status).toBe(400);
    expect(invalidCoordsResponse.body.error.code).toBe('INVALID_COORDINATES');
  });

  test('non-host can read group standings for scoresheet', async () => {
    const unique = Date.now();
    const host = await signup('Standings Host', `standings.host.${unique}@example.com`);
    const viewer = await signup('Standings Viewer', `standings.viewer.${unique}@example.com`);

    const createResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ name: 'Standings Visibility Open' }));

    expect(createResponse.status).toBe(201);
    const tournamentId = extractTournamentId(createResponse.body);

    const standingsResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/groups/standings`)
      .set(authHeader(viewer.token));

    expect(standingsResponse.status).toBe(200);
    expect(standingsResponse.body.success).toBe(true);
    expect(Array.isArray(standingsResponse.body.data.groups)).toBe(true);
  });

  test('public read path: discover, scoresheet, and standings work without authentication', async () => {
    const unique = Date.now();
    const host = await signup('Public Read Host', `public.read.host.${unique}@example.com`);

    const createResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ name: 'Public Read Open' }));

    expect(createResponse.status).toBe(201);
    const tournamentId = extractTournamentId(createResponse.body);

    const discoverResponse = await request(app).get('/api/tournaments/discover');
    expect(discoverResponse.status).toBe(200);
    expect(discoverResponse.body.success).toBe(true);
    expect(discoverResponse.body.data.items.some((item) => item.id === tournamentId)).toBe(true);

    const scoresheetResponse = await request(app).get(
      `/api/tournaments/${tournamentId}/scoresheet?page=1&pageSize=5`
    );
    expect(scoresheetResponse.status).toBe(200);
    expect(scoresheetResponse.body.success).toBe(true);
    expect(scoresheetResponse.body.data.canEdit).toBe(false);

    const standingsResponse = await request(app).get(
      `/api/tournaments/${tournamentId}/groups/standings`
    );
    expect(standingsResponse.status).toBe(200);
    expect(standingsResponse.body.success).toBe(true);

    const inviteValidationResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/validate-invite-code`)
      .send({});
    expect(inviteValidationResponse.status).toBe(200);
    expect(inviteValidationResponse.body.success).toBe(true);

    const registrationWithoutAuth = await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .send({});
    expect(registrationWithoutAuth.status).toBe(401);
    expect(registrationWithoutAuth.body.error.code).toBe('UNAUTHORIZED');
  });

  test('discover supports name search and startsSoon sort', async () => {
    const unique = Date.now();
    const host = await signup('Discover Host', `discover.host.${unique}@example.com`);

    const soonStart = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
    const laterStart = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

    await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(
        buildTournamentPayload({
          name: 'Autumn Classic Open',
          startsAt: laterStart,
        })
      );

    await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(
        buildTournamentPayload({
          name: 'Spring Classic Open',
          startsAt: soonStart,
        })
      );

    const searchResponse = await request(app)
      .get('/api/tournaments/discover')
      .set(authHeader(host.token))
      .query({ q: 'Spring', sort: 'startsSoon', pageSize: 20 });

    expect(searchResponse.status).toBe(200);
    expect(searchResponse.body.success).toBe(true);
    expect(searchResponse.body.data.items.length).toBe(1);
    expect(searchResponse.body.data.items[0].name).toBe('Spring Classic Open');

    const sortResponse = await request(app)
      .get('/api/tournaments/discover')
      .set(authHeader(host.token))
      .query({ sort: 'startsSoon', pageSize: 20 });

    expect(sortResponse.status).toBe(200);
    expect(sortResponse.body.data.items.length).toBeGreaterThanOrEqual(2);
    expect(sortResponse.body.data.items[0].name).toBe('Spring Classic Open');
  });

  test('happy path: player discovers tournament, registers, host approves, registration becomes approved', async () => {
    const host = await signup('Host User', 'host.happy@example.com');
    const player = await signup('Player User', 'player.happy@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload());

    expect(createTournamentResponse.status).toBe(201);
    expect(createTournamentResponse.body.success).toBe(true);
    expect(createTournamentResponse.body.data.startsAt).toBeTruthy();

    const tournamentId = extractTournamentId(createTournamentResponse.body);
    expect(tournamentId).toMatch(/^[a-f\d]{24}$/i);

    const discoverResponse = await request(app)
      .get('/api/tournaments/discover')
      .set(authHeader(player.token));

    expect(discoverResponse.status).toBe(200);
    expect(discoverResponse.body.success).toBe(true);
    expect(discoverResponse.body.data.items.some((item) => item.id === tournamentId)).toBe(true);

    const submitResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(player.token))
      .send({});

    expect(submitResponse.status).toBe(201);
    expect(submitResponse.body.success).toBe(true);
    expect(submitResponse.body.data.status).toBe('underReview');

    const pendingResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/pending`)
      .set(authHeader(host.token));

    expect(pendingResponse.status).toBe(200);
    expect(pendingResponse.body.success).toBe(true);
    expect(pendingResponse.body.data.items).toHaveLength(1);

    const registrationId = pendingResponse.body.data.items[0].id;

    const approveResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations/${registrationId}/approve`)
      .set(authHeader(host.token));

    expect(approveResponse.status).toBe(200);
    expect(approveResponse.body.success).toBe(true);
    expect(approveResponse.body.data.status).toBe('approved');

    const approvedRegistration = await TournamentRegistration.findOne({
      _id: registrationId,
      tournamentId,
      userId: player.userId,
    }).lean();

    expect(approvedRegistration).toBeTruthy();
    expect(approvedRegistration.status).toBe('approved');

    const registeredDiscoverResponse = await request(app)
      .get('/api/tournaments/discover/registered')
      .set(authHeader(player.token));

    expect(registeredDiscoverResponse.status).toBe(200);
    expect(registeredDiscoverResponse.body.success).toBe(true);
    expect(registeredDiscoverResponse.body.data.items).toHaveLength(1);
    expect(registeredDiscoverResponse.body.data.items[0].id).toBe(tournamentId);
    expect(registeredDiscoverResponse.body.data.items[0].currentUserRegistrationStatus).toBe('approved');
  });

  test('discover registered requires authentication', async () => {
    const response = await request(app).get('/api/tournaments/discover/registered');
    expect(response.status).toBe(401);
  });

  test('failure path: invite-only registration rejects invalid invite code', async () => {
    const host = await signup('Host Invite', 'host.invite@example.com');
    const player = await signup('Player Invite', 'player.invite@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(
        buildTournamentPayload({
          registrationMode: 'inviteOnly',
          inviteCode: 'SECRET1',
        })
      );

    const tournamentId = extractTournamentId(createTournamentResponse.body);
    expect(tournamentId).toMatch(/^[a-f\d]{24}$/i);

    const hostDetailResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/host-detail`)
      .set(authHeader(host.token));

    expect(hostDetailResponse.status).toBe(200);
    expect(hostDetailResponse.body.data.registrationMode).toBe('inviteOnly');
    expect(hostDetailResponse.body.data.inviteCode).toBe('SECRET1');

    const submitResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(player.token))
      .send({ inviteCode: 'WRONG' });

    expect(submitResponse.status).toBe(400);
    expect(submitResponse.body.success).toBe(false);
    expect(submitResponse.body.error.code).toBe('INVITE_CODE_INVALID');
  });

  test('failure path: duplicate registration request is blocked', async () => {
    const host = await signup('Host Duplicate', 'host.duplicate@example.com');
    const player = await signup('Player Duplicate', 'player.duplicate@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload());

    const tournamentId = extractTournamentId(createTournamentResponse.body);
    expect(tournamentId).toMatch(/^[a-f\d]{24}$/i);

    const firstSubmit = await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(player.token))
      .send({});

    expect(firstSubmit.status).toBe(201);

    const duplicateSubmit = await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(player.token))
      .send({});

    expect(duplicateSubmit.status).toBe(409);
    expect(duplicateSubmit.body.success).toBe(false);
    expect(duplicateSubmit.body.error.code).toBe('REGISTRATION_ALREADY_EXISTS');
  });

  test('auth/permission path: host review endpoint requires authentication', async () => {
    const host = await signup('Host Auth', 'host.auth@example.com');
    const player = await signup('Player Auth', 'player.auth@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload());

    const tournamentId = extractTournamentId(createTournamentResponse.body);
    expect(tournamentId).toMatch(/^[a-f\d]{24}$/i);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(player.token))
      .send({});

    const pendingWithoutAuth = await request(app).get(
      `/api/tournaments/${tournamentId}/registrations/pending`
    );

    expect(pendingWithoutAuth.status).toBe(401);
    expect(pendingWithoutAuth.body.success).toBe(false);
    expect(pendingWithoutAuth.body.error.code).toBe('UNAUTHORIZED');
  });

  test('happy path: host can join own tournament and is auto-approved', async () => {
    const host = await signup('Host Self Join', 'host.self.join@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(
        buildTournamentPayload({
          registrationMode: 'inviteOnly',
          inviteCode: 'HOSTJOIN',
        })
      );

    const tournamentId = extractTournamentId(createTournamentResponse.body);
    expect(tournamentId).toMatch(/^[a-f\d]{24}$/i);

    const hostJoinResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(host.token))
      .send({});

    expect(hostJoinResponse.status).toBe(201);
    expect(hostJoinResponse.body.success).toBe(true);
    expect(hostJoinResponse.body.data.status).toBe('approved');
    expect(hostJoinResponse.body.data.userId).toBe(host.userId);

    const hostDetailResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/host-detail`)
      .set(authHeader(host.token));

    expect(hostDetailResponse.status).toBe(200);
    expect(hostDetailResponse.body.data.approvedParticipantsCount).toBe(1);
    expect(hostDetailResponse.body.data.pendingParticipantsCount).toBe(0);
  });

  test('happy path: host detail shows approved and pending participant counts', async () => {
    const host = await signup('Host Detail', 'host.detail@example.com');
    const pendingPlayer = await signup('Pending Player', 'player.pending@example.com');
    const approvedPlayer = await signup('Approved Player', 'player.approved@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload());

    const tournamentId = extractTournamentId(createTournamentResponse.body);
    expect(tournamentId).toMatch(/^[a-f\d]{24}$/i);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(pendingPlayer.token))
      .send({});

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(approvedPlayer.token))
      .send({});

    const pendingResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/pending`)
      .set(authHeader(host.token));

    const approvalTargetRegistrationId = pendingResponse.body.data.items.find(
      (item) => item.userId === approvedPlayer.userId
    )?.id;

    expect(approvalTargetRegistrationId).toBeTruthy();

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations/${approvalTargetRegistrationId}/approve`)
      .set(authHeader(host.token));

    const hostDetailResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/host-detail`)
      .set(authHeader(host.token));

    expect(hostDetailResponse.status).toBe(200);
    expect(hostDetailResponse.body.success).toBe(true);
    expect(hostDetailResponse.body.data.id).toBe(tournamentId);
    expect(hostDetailResponse.body.data.approvedParticipantsCount).toBe(1);
    expect(hostDetailResponse.body.data.pendingParticipantsCount).toBe(1);
  });

  test('happy path: host list returns pending first, then approved with user summaries', async () => {
    const host = await signup('Host HostList', 'host.hostlist@example.com');
    const firstPendingPlayer = await signup('First Pending', 'player.first.pending@example.com');
    const approvedPlayer = await signup('List Approved', 'player.list.approved@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload());

    const tournamentId = extractTournamentId(createTournamentResponse.body);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(firstPendingPlayer.token))
      .send({});

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(approvedPlayer.token))
      .send({});

    const pendingResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/pending`)
      .set(authHeader(host.token));

    const approvalTargetRegistrationId = pendingResponse.body.data.items.find(
      (item) => item.userId === approvedPlayer.userId
    )?.id;

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations/${approvalTargetRegistrationId}/approve`)
      .set(authHeader(host.token));

    const hostListResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/host-list`)
      .set(authHeader(host.token));

    expect(hostListResponse.status).toBe(200);
    expect(hostListResponse.body.success).toBe(true);
    expect(hostListResponse.body.data.items).toHaveLength(2);
    expect(hostListResponse.body.data.items[0].status).toBe('underReview');
    expect(hostListResponse.body.data.items[1].status).toBe('approved');
    expect(hostListResponse.body.data.items[0].user).toMatchObject({
      id: firstPendingPlayer.userId,
      email: 'player.first.pending@example.com',
    });
  });

  test('failure/auth path: manual-add search enforces query length and host-only access', async () => {
    const host = await signup('Host Search', 'host.search@example.com');
    const nonHost = await signup('Non Host Search', 'nonhost.search@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload());

    const tournamentId = extractTournamentId(createTournamentResponse.body);

    const shortQueryResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/participants/search?q=a`)
      .set(authHeader(host.token));

    expect(shortQueryResponse.status).toBe(400);
    expect(shortQueryResponse.body.success).toBe(false);
    expect(shortQueryResponse.body.error.code).toBe('INVALID_SEARCH_QUERY');

    const nonHostResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/participants/search?q=host`)
      .set(authHeader(nonHost.token));

    expect(nonHostResponse.status).toBe(403);
    expect(nonHostResponse.body.success).toBe(false);
    expect(nonHostResponse.body.error.code).toBe('FORBIDDEN');
  });

  test('happy/failure path: round-robin pattern uses approved participants and blocks insufficient count', async () => {
    const host = await signup('Host Pattern', 'host.pattern@example.com');
    const approvedPlayerA = await signup('Pattern Player A', 'player.pattern.a@example.com');
    const approvedPlayerB = await signup('Pattern Player B', 'player.pattern.b@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload());

    const tournamentId = extractTournamentId(createTournamentResponse.body);

    const insufficientPatternResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/playing-pattern/round-robin`)
      .set(authHeader(host.token));

    expect(insufficientPatternResponse.status).toBe(409);
    expect(insufficientPatternResponse.body.success).toBe(false);
    expect(insufficientPatternResponse.body.error.code).toBe('INSUFFICIENT_APPROVED_PARTICIPANTS');

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(approvedPlayerA.token))
      .send({});

    await request(app)
      .post(`/api/tournaments/${tournamentId}/registrations`)
      .set(authHeader(approvedPlayerB.token))
      .send({});

    const pendingResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/registrations/pending`)
      .set(authHeader(host.token));

    const registrationIds = pendingResponse.body.data.items.map((item) => item.id);

    await Promise.all(
      registrationIds.map((registrationId) =>
        request(app)
          .post(`/api/tournaments/${tournamentId}/registrations/${registrationId}/approve`)
          .set(authHeader(host.token))
      )
    );

    const patternResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/playing-pattern/round-robin`)
      .set(authHeader(host.token));

    expect(patternResponse.status).toBe(200);
    expect(patternResponse.body.success).toBe(true);
    expect(patternResponse.body.data.participantCount).toBe(2);
    expect(patternResponse.body.data.rounds.length).toBeGreaterThan(0);

    const firstMatch = patternResponse.body.data.rounds[0].matches[0];
    const pairedIds = [firstMatch.playerA.id, firstMatch.playerB.id].sort();
    expect(pairedIds).toEqual([approvedPlayerA.userId, approvedPlayerB.userId].sort());
  });

  test('sprint9 flow: host closes registration and assigns random groups with generated fixtures', async () => {
    const host = await signup('Host Sprint9 Group', 'host.sprint9.group@example.com');
    const players = await Promise.all([
      signup('Group Player 1', 'group.player.1@example.com'),
      signup('Group Player 2', 'group.player.2@example.com'),
      signup('Group Player 3', 'group.player.3@example.com'),
      signup('Group Player 4', 'group.player.4@example.com'),
    ]);

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ maxParticipants: 8 }));

    const tournamentId = extractTournamentId(createTournamentResponse.body);

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

    const closeResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/registration/close`)
      .set(authHeader(host.token));

    expect(closeResponse.status).toBe(200);
    expect(closeResponse.body.success).toBe(true);
    expect(closeResponse.body.data.registrationStatus).toBe('closed');

    const assignGroupsResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/groups/assign-random`)
      .set(authHeader(host.token))
      .send({ groupCount: 2, groupStageBestOf: 3 });

    expect(assignGroupsResponse.status).toBe(200);
    expect(assignGroupsResponse.body.success).toBe(true);
    expect(assignGroupsResponse.body.data.groupCount).toBe(2);
    expect(assignGroupsResponse.body.data.groups).toHaveLength(2);

    const scoresheetResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/scoresheet?page=1&pageSize=10&stage=groupStage`)
      .set(authHeader(host.token));

    expect(scoresheetResponse.status).toBe(200);
    expect(scoresheetResponse.body.success).toBe(true);
    expect(Array.isArray(scoresheetResponse.body.data.items)).toBe(true);
    expect(scoresheetResponse.body.data.pagination.page).toBe(1);
    expect(scoresheetResponse.body.data.items.every((item) => item.bestOf === 3)).toBe(true);
  });

  test('group stage round robin with 8 players and 2 groups generates 12 games', async () => {
    const host = await signup('Host Single Leg', 'host.single.leg@example.com');
    const players = await Promise.all([
      signup('Player A', 'player.a@example.com'),
      signup('Player B', 'player.b@example.com'),
      signup('Player C', 'player.c@example.com'),
      signup('Player D', 'player.d@example.com'),
      signup('Player E', 'player.e@example.com'),
      signup('Player F', 'player.f@example.com'),
      signup('Player G', 'player.g@example.com'),
      signup('Player H', 'player.h@example.com'),
    ]);

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ maxParticipants: 8 }));

    const tournamentId = extractTournamentId(createTournamentResponse.body);

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

    const assignGroupsResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/groups/assign-random`)
      .set(authHeader(host.token))
      .send({ groupCount: 2, groupStageBestOf: 1 });

    expect(assignGroupsResponse.status).toBe(200);
    expect(assignGroupsResponse.body.success).toBe(true);
    expect(assignGroupsResponse.body.data.groupCount).toBe(2);
    expect(assignGroupsResponse.body.data.groups).toHaveLength(2);

    const scoresheetResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/scoresheet?page=1&pageSize=100&stage=groupStage`)
      .set(authHeader(host.token));

    expect(scoresheetResponse.status).toBe(200);
    expect(scoresheetResponse.body.success).toBe(true);
    expect(scoresheetResponse.body.data.pagination.total).toBe(12);
    expect(scoresheetResponse.body.data.items).toHaveLength(12);
  });

  test('host can regenerate group stage fixtures after fixtures are removed', async () => {
    const host = await signup('Host Regenerate', 'host.regenerate@example.com');
    const players = await Promise.all([
      signup('Regenerate Player 1', 'regenerate.player.1@example.com'),
      signup('Regenerate Player 2', 'regenerate.player.2@example.com'),
      signup('Regenerate Player 3', 'regenerate.player.3@example.com'),
      signup('Regenerate Player 4', 'regenerate.player.4@example.com'),
      signup('Regenerate Player 5', 'regenerate.player.5@example.com'),
      signup('Regenerate Player 6', 'regenerate.player.6@example.com'),
      signup('Regenerate Player 7', 'regenerate.player.7@example.com'),
      signup('Regenerate Player 8', 'regenerate.player.8@example.com'),
    ]);

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ maxParticipants: 8 }));

    const tournamentId = extractTournamentId(createTournamentResponse.body);

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

    const assignGroupsResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/groups/assign-random`)
      .set(authHeader(host.token))
      .send({ groupCount: 2, groupStageBestOf: 1 });

    expect(assignGroupsResponse.status).toBe(200);
    expect(assignGroupsResponse.body.success).toBe(true);

    await Game.deleteMany({ tournamentId, stage: 'groupStage' });
    expect(await Game.countDocuments({ tournamentId, stage: 'groupStage' })).toBe(0);

    const regenerateResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/groups/regenerate`)
      .set(authHeader(host.token));

    expect(regenerateResponse.status).toBe(200);
    expect(regenerateResponse.body.success).toBe(true);
    expect(regenerateResponse.body.data.groups).toHaveLength(2);

    const regeneratedScoresheetResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/scoresheet?page=1&pageSize=100&stage=groupStage`)
      .set(authHeader(host.token));

    expect(regeneratedScoresheetResponse.status).toBe(200);
    expect(regeneratedScoresheetResponse.body.success).toBe(true);
    expect(regeneratedScoresheetResponse.body.data.pagination.total).toBe(12);
    expect(regeneratedScoresheetResponse.body.data.items).toHaveLength(12);
  });

  test('sprint9 flow: host starts final stage from group standings and can skip finals to complete', async () => {
    const host = await signup('Host Sprint9 Final', 'host.sprint9.final@example.com');
    const players = await Promise.all([
      signup('Final Player 1', 'final.player.1@example.com'),
      signup('Final Player 2', 'final.player.2@example.com'),
      signup('Final Player 3', 'final.player.3@example.com'),
      signup('Final Player 4', 'final.player.4@example.com'),
    ]);

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ maxParticipants: 8 }));

    const tournamentId = extractTournamentId(createTournamentResponse.body);

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

    const groupStandingsResponse = await request(app)
      .get(`/api/tournaments/${tournamentId}/groups/standings?topPerGroup=1`)
      .set(authHeader(host.token));

    expect(groupStandingsResponse.status).toBe(200);
    expect(groupStandingsResponse.body.success).toBe(true);

    const selectedPlayerIds = groupStandingsResponse.body.data.groups.flatMap((group) =>
      (group.suggestedFinalists || []).slice(0, 1)
    );

    const startFinalResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/final-stage/start`)
      .set(authHeader(host.token))
      .send({ topPerGroup: 1, finalStageBestOf: 5, selectedPlayerIds });

    expect(startFinalResponse.status).toBe(200);
    expect(startFinalResponse.body.success).toBe(true);
    expect(startFinalResponse.body.data.finalStageBestOf).toBe(5);

    const completeWithoutFinalsResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/final-stage/skip-and-complete`)
      .set(authHeader(host.token))
      .send({ winnersPerGroup: 2 });

    expect(completeWithoutFinalsResponse.status).toBe(200);
    expect(completeWithoutFinalsResponse.body.success).toBe(true);
    expect(completeWithoutFinalsResponse.body.data.status).toBe('completed');
    expect(Array.isArray(completeWithoutFinalsResponse.body.data.winners)).toBe(true);
  });

  test('host can update target roster size, close with 2+ players, and late manual add creates incremental fixtures', async () => {
    const host = await signup('Host Late Add', 'host.late.add@example.com');
    const starterPlayers = await Promise.all([
      signup('Starter 1', 'starter.1@example.com'),
      signup('Starter 2', 'starter.2@example.com'),
      signup('Starter 3', 'starter.3@example.com'),
    ]);
    const latePlayer = await signup('Late Joiner', 'late.joiner@example.com');

    const createTournamentResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ maxParticipants: 2 }));

    const tournamentId = extractTournamentId(createTournamentResponse.body);

    await Promise.all(
      starterPlayers.map((player) =>
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

    const updateSettingsResponse = await request(app)
      .patch(`/api/tournaments/${tournamentId}/settings`)
      .set(authHeader(host.token))
      .send({ maxParticipants: 12 });

    expect(updateSettingsResponse.status).toBe(200);
    expect(updateSettingsResponse.body.data.maxParticipants).toBe(12);

    const closeResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/registration/close`)
      .set(authHeader(host.token));

    expect(closeResponse.status).toBe(200);

    const assignGroupsResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/groups/assign-random`)
      .set(authHeader(host.token))
      .send({ groupCount: 2, groupStageBestOf: 1 });

    expect(assignGroupsResponse.status).toBe(200);

    const gamesBeforeLateAdd = await Game.countDocuments({ tournamentId, stage: 'groupStage' });

    const manualAddResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/participants/manual-add`)
      .set(authHeader(host.token))
      .send({ userId: latePlayer.userId });

    expect(manualAddResponse.status).toBe(201);
    expect(manualAddResponse.body.data.groupSync).toBeTruthy();
    expect(manualAddResponse.body.data.groupSync.gamesCreated).toBeGreaterThan(0);

    const gamesAfterLateAdd = await Game.countDocuments({ tournamentId, stage: 'groupStage' });
    expect(gamesAfterLateAdd).toBeGreaterThan(gamesBeforeLateAdd);
  });
});
