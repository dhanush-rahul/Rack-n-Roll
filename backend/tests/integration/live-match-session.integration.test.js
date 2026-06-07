const mongoose = require('mongoose');
const request = require('supertest');
const { createApp } = require('../../src/app');
const Game = require('../../src/models/game.model');

const buildTournamentPayload = (overrides = {}) => ({
  name: 'Live Match Integration Open',
  maxParticipants: 16,
  registrationMode: 'public',
  registrationStatus: 'open',
  startsAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
  location: {
    formattedAddress: 'Vancouver Community Centre, Vancouver, BC, Canada',
  },
  competitionConfig: {
    groupStageProctored: true,
  },
  ...overrides,
});

const extractTournamentId = (responseBody) =>
  responseBody?.data?.id || responseBody?.data?.tournamentId || responseBody?.data?._id || null;

const STALE_CONTROLLER_MS = 6 * 60 * 1000;

describe('Phase 5 integration: live match session', () => {
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

  const assignProctor = async (tournamentId, hostToken, editorUserId) => {
    const response = await request(app)
      .post(`/api/tournaments/${tournamentId}/score-editors`)
      .set(authHeader(hostToken))
      .send({ editorUserId });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    return response.body.data;
  };

  const setupBo3GroupMatch = async (unique) => {
    const host = await signup('Live Host', `live.host.${unique}@example.com`);
    const playerOne = await signup('Live Player One', `live.p1.${unique}@example.com`);
    const playerTwo = await signup('Live Player Two', `live.p2.${unique}@example.com`);
    const proctorOne = await signup('Live Proctor One', `live.proctor1.${unique}@example.com`);
    const proctorTwo = await signup('Live Proctor Two', `live.proctor2.${unique}@example.com`);
    const proctorThree = await signup('Live Proctor Three', `live.proctor3.${unique}@example.com`);
    const viewer = await signup('Live Viewer', `live.viewer.${unique}@example.com`);

    const createResponse = await request(app)
      .post('/api/tournaments')
      .set(authHeader(host.token))
      .send(buildTournamentPayload({ name: `Live Bo3 ${unique}` }));

    expect(createResponse.status).toBe(201);
    const tournamentId = extractTournamentId(createResponse.body);

    await Promise.all(
      [playerOne, playerTwo].map((player) =>
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
      .send({ groupCount: 1, groupStageBestOf: 3 });

    expect(assignGroupsResponse.status).toBe(200);

    const game = await Game.findOne({ tournamentId, stage: 'groupStage' }).lean();
    expect(game).toBeTruthy();
    expect(game.bestOf).toBe(3);

    return {
      tournamentId,
      gameId: String(game._id),
      playerAId: String(game.playerAId),
      playerBId: String(game.playerBId),
      host,
      proctorOne,
      proctorTwo,
      proctorThree,
      viewer,
    };
  };

  beforeAll(async () => {
    process.env.JWT_SECRET = process.env.JWT_SECRET || 'integration-test-secret';
    const dbName = `rack-n-roll-live-match-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
    const mongoUri = process.env.TEST_MONGODB_URI || `mongodb://127.0.0.1:27017/${dbName}`;

    await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 8000,
    });
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

  test('host can assign more than two proctors', async () => {
    const unique = Date.now();
    const { tournamentId, host, proctorOne, proctorTwo, proctorThree } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);
    await assignProctor(tournamentId, host.token, proctorTwo.userId);
    const thirdAssignment = await assignProctor(tournamentId, host.token, proctorThree.userId);

    expect(thirdAssignment.scoreEditorUserIds).toHaveLength(3);
    expect(thirdAssignment.scoreEditorUserIds).toEqual(
      expect.arrayContaining([
        String(proctorOne.userId),
        String(proctorTwo.userId),
        String(proctorThree.userId),
      ])
    );
  });

  test('Bo3 live session: leg turns and two game wins complete the series', async () => {
    const unique = Date.now();
    const { tournamentId, gameId, playerAId, playerBId, host, proctorOne } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);

    const startResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorOne.token));

    expect(startResponse.status).toBe(200);
    expect(startResponse.body.data.status).toBe('inProgress');
    expect(startResponse.body.data.bestOf).toBe(3);
    expect(startResponse.body.data.winsRequired).toBe(2);
    expect(startResponse.body.data.isSessionController).toBe(true);
    expect(startResponse.body.data.canMarkSession).toBe(true);

    const legResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ legWinnerPlayerId: playerAId });

    expect(legResponse.status).toBe(200);
    expect(legResponse.body.data.activeGame.turns.length).toBeGreaterThanOrEqual(1);
    expect(
      legResponse.body.data.activeGame.turns.some((turn) => turn.legWinnerPlayerId === playerAId)
    ).toBe(true);

    const endGameOne = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/end-series-game`)
      .set(authHeader(proctorOne.token))
      .send({ winnerPlayerId: playerAId, endReason: 'potted8' });

    expect(endGameOne.status).toBe(200);
    expect(endGameOne.body.data.seriesComplete).toBe(false);
    expect(endGameOne.body.data.playerASeriesWins).toBe(1);
    expect(endGameOne.body.data.activeGameNumber).toBe(2);
    expect(endGameOne.body.data.legRequiredForActiveGame).toBe(false);
    expect(endGameOne.body.data.legSatisfied).toBe(true);
    expect(endGameOne.body.data.canMarkLegWon).toBe(false);
    expect(endGameOne.body.data.canMarkVisit).toBe(true);
    expect(endGameOne.body.data.previousGameBreakerPlayerId).toBe(playerAId);
    expect(endGameOne.body.data.currentTurnPlayerId).toBe(playerAId);

    const passGameTwo = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ nextPlayerId: playerBId });

    expect(passGameTwo.status).toBe(200);
    expect(passGameTwo.body.data.activeGameNumber).toBe(2);
    expect(passGameTwo.body.data.currentTurnPlayerId).toBe(playerBId);

    const endGameTwo = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/end-series-game`)
      .set(authHeader(proctorOne.token))
      .send({ winnerPlayerId: playerAId, endReason: 'potted8' });

    expect(endGameTwo.status).toBe(200);
    expect(endGameTwo.body.data.seriesComplete).toBe(true);
    expect(endGameTwo.body.data.status).toBe('completed');
    expect(endGameTwo.body.data.playerASeriesWins).toBe(2);
    expect(endGameTwo.body.data.winnerPlayerId).toBe(playerAId);

    const completedGame = await Game.findById(gameId).lean();
    expect(completedGame.status).toBe('completed');
    expect(completedGame.scoreEntries).toHaveLength(2);

    const scoresheet = await request(app)
      .get(`/api/tournaments/${tournamentId}/scoresheet`)
      .query({ stage: 'groupStage', page: 1, pageSize: 100 })
      .set(authHeader(proctorOne.token));

    expect(scoresheet.status).toBe(200);
    const sheetGame = scoresheet.body.data.items.find((item) => String(item.id) === String(gameId));
    expect(sheetGame).toBeTruthy();
    expect(sheetGame.status).toBe('completed');
    expect(sheetGame.playerASeriesWins).toBe(2);
  });

  test('proctor takeover request and handoff transfer scoring control', async () => {
    const unique = Date.now();
    const { tournamentId, gameId, playerAId, host, proctorOne, proctorTwo } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);
    await assignProctor(tournamentId, host.token, proctorTwo.userId);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorOne.token));

    const requestTakeover = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/live/takeover-request`)
      .set(authHeader(proctorTwo.token));

    expect(requestTakeover.status).toBe(200);
    expect(requestTakeover.body.data.takeoverRequest.userId).toBe(String(proctorTwo.userId));
    expect(requestTakeover.body.data.canCancelTakeoverRequest).toBe(true);

    const controllerView = await request(app)
      .get(`/api/tournaments/${tournamentId}/games/${gameId}/live`)
      .set(authHeader(proctorOne.token));

    expect(controllerView.body.data.canHandOffScoring).toBe(true);

    const handoff = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/live/handoff`)
      .set(authHeader(proctorOne.token));

    expect(handoff.status).toBe(200);
    expect(handoff.body.data.sessionController.userId).toBe(String(proctorTwo.userId));
    expect(handoff.body.data.isSessionController).toBe(false);

    const newControllerView = await request(app)
      .get(`/api/tournaments/${tournamentId}/games/${gameId}/live`)
      .set(authHeader(proctorTwo.token));

    expect(newControllerView.body.data.isSessionController).toBe(true);
    expect(newControllerView.body.data.canMarkSession).toBe(true);

    const markAsNewController = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorTwo.token))
      .send({ legWinnerPlayerId: playerAId });

    expect(markAsNewController.status).toBe(200);

    const markAsOldController = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ nextPlayerId: playerAId });

    expect(markAsOldController.status).toBe(403);
    expect(markAsOldController.body.error.code).toBe('NOT_SESSION_CONTROLLER');
  });

  test('host can force takeover without handoff approval', async () => {
    const unique = Date.now();
    const { tournamentId, gameId, playerAId, host, proctorOne } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorOne.token));

    const forceTakeover = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/live/takeover-force`)
      .set(authHeader(host.token));

    expect(forceTakeover.status).toBe(200);
    expect(forceTakeover.body.data.isHost).toBe(true);
    expect(forceTakeover.body.data.canForceTakeover).toBe(false);
    expect(forceTakeover.body.data.isSessionController).toBe(true);
    expect(forceTakeover.body.data.canMarkSession).toBe(true);
    expect(forceTakeover.body.data.sessionController.userId).toBe(String(host.userId));
    expect(forceTakeover.body.data.takeoverRequest).toBeNull();

    const hostCanMark = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(host.token))
      .send({ legWinnerPlayerId: playerAId });

    expect(hostCanMark.status).toBe(200);

    const proctorBlocked = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ nextPlayerId: playerAId });

    expect(proctorBlocked.status).toBe(403);
    expect(proctorBlocked.body.error.code).toBe('NOT_SESSION_CONTROLLER');
  });

  test('host waiting on another scorer has both force takeover and request takeover', async () => {
    const unique = Date.now();
    const { tournamentId, gameId, host, proctorOne } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorOne.token));

    const hostView = await request(app)
      .get(`/api/tournaments/${tournamentId}/games/${gameId}/live`)
      .set(authHeader(host.token));

    expect(hostView.status).toBe(200);
    expect(hostView.body.data.canForceTakeover).toBe(true);
    expect(hostView.body.data.canRequestTakeover).toBe(true);
    expect(hostView.body.data.isHost).toBe(true);
  });

  test('stale session controller auto-releases after five minutes of inactivity', async () => {
    const unique = Date.now();
    const { tournamentId, gameId, host, proctorOne, proctorTwo } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);
    await assignProctor(tournamentId, host.token, proctorTwo.userId);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorOne.token));

    await Game.updateOne(
      { _id: gameId },
      {
        $set: {
          'seriesState.controllerLastActiveAt': new Date(Date.now() - STALE_CONTROLLER_MS),
        },
      }
    );

    const releasedState = await request(app)
      .get(`/api/tournaments/${tournamentId}/games/${gameId}/live`)
      .set(authHeader(proctorTwo.token));

    expect(releasedState.status).toBe(200);
    expect(releasedState.body.data.sessionController).toBeNull();
    expect(releasedState.body.data.canClaimScoring).toBe(true);
    expect(releasedState.body.data.scoringReleasedDueToInactivity).toBe(true);
    expect(releasedState.body.data.canMarkSession).toBe(false);

    const claimResponse = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorTwo.token));

    expect(claimResponse.status).toBe(200);
    expect(claimResponse.body.data.sessionController.userId).toBe(String(proctorTwo.userId));
    expect(claimResponse.body.data.isSessionController).toBe(true);
    expect(claimResponse.body.data.canMarkSession).toBe(true);
  });

  test('cannot mark a second leg winner in the same game', async () => {
    const unique = Date.now();
    const { tournamentId, gameId, playerAId, playerBId, host, proctorOne } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorOne.token));

    const firstLeg = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ legWinnerPlayerId: playerAId });

    expect(firstLeg.status).toBe(200);
    expect(firstLeg.body.data.activeLegWinnerPlayerId).toBe(playerAId);
    expect(firstLeg.body.data.canMarkLegWon).toBe(false);
    expect(firstLeg.body.data.canMarkVisit).toBe(true);
    expect(firstLeg.body.data.currentTurnPlayerId).toBe(playerAId);

    const secondLeg = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ legWinnerPlayerId: playerBId });

    expect(secondLeg.status).toBe(409);
    expect(secondLeg.body.error.code).toBe('LEG_ALREADY_WON');
  });

  test('pass table without leg is rejected', async () => {
    const unique = Date.now();
    const { tournamentId, gameId, playerBId, host, proctorOne } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorOne.token));

    const passBeforeLeg = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ nextPlayerId: playerBId });

    expect(passBeforeLeg.status).toBe(409);
    expect(passBeforeLeg.body.error.code).toBe('LEG_REQUIRED');
  });

  test('pass-table visits advance innings after leg is marked', async () => {
    const unique = Date.now();
    const { tournamentId, gameId, playerAId, playerBId, host, proctorOne } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorOne.token));

    const leg = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ legWinnerPlayerId: playerAId });

    expect(leg.status).toBe(200);
    expect(leg.body.data.canMarkVisit).toBe(true);
    expect(leg.body.data.currentTurnPlayerId).toBe(playerAId);

    const passToB = await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ nextPlayerId: playerBId });

    expect(passToB.status).toBe(200);
    expect(passToB.body.data.activeGame.innings.visitsA).toBe(1);
    expect(passToB.body.data.activeGame.innings.visitsB).toBe(1);
    expect(passToB.body.data.activeGame.innings.inningsCompleted).toBe(1);
    expect(passToB.body.data.activeGame.innings.currentInning).toBe(2);
    expect(passToB.body.data.currentTurnPlayerId).toBe(playerBId);
  });

  test('turn log visibility is limited to host and proctors', async () => {
    const unique = Date.now();
    const { tournamentId, gameId, playerAId, host, proctorOne, viewer } = await setupBo3GroupMatch(unique);

    await assignProctor(tournamentId, host.token, proctorOne.userId);

    await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/start`)
      .set(authHeader(proctorOne.token));

    await request(app)
      .post(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`)
      .set(authHeader(proctorOne.token))
      .send({ legWinnerPlayerId: playerAId });

    const proctorLive = await request(app)
      .get(`/api/tournaments/${tournamentId}/games/${gameId}/live`)
      .set(authHeader(proctorOne.token));

    expect(proctorLive.body.data.canViewTurnLog).toBe(true);
    expect(proctorLive.body.data.activeGame.turns.length).toBeGreaterThan(0);

    const viewerLive = await request(app)
      .get(`/api/tournaments/${tournamentId}/games/${gameId}/live`)
      .set(authHeader(viewer.token));

    expect(viewerLive.body.data.canViewTurnLog).toBe(false);
    expect(viewerLive.body.data.canEdit).toBe(false);
    expect(viewerLive.body.data.activeGame.turns).toEqual([]);
  });
});
