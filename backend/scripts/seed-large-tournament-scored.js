const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { loadAndValidateEnv } = require('../src/config/env');
const { connectToDatabase } = require('../src/config/db');
const User = require('../src/models/user.model');
const TournamentRegistration = require('../src/models/tournamentRegistration.model');
const Game = require('../src/models/game.model');
const Leaderboard = require('../src/models/leaderboard.model');
const {
  createTournament,
  submitRegistrationRequest,
  listPendingRegistrationRequests,
  approveRegistrationRequest,
  closeTournamentRegistration,
  assignRandomGroups,
  updateGameScores,
} = require('../src/services/tournament');

const SALT_ROUNDS = 10;
const HOST_EMAIL = 'test@gmail.com';
const HOST_NAME = 'Test Host';
const PLAYER_COUNT = 15;
const PLAYER_PASSWORD = 'test@123';
const GROUP_COUNT = 3;
const GROUP_STAGE_BEST_OF = 5;
const SCORE_TARGET_GAMES = 24;

const buildPlayerEmail = (index) => `test${String(index).padStart(2, '0')}@gmail.com`;

const createOrUpdateUser = async ({ name, email, password }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return User.findOneAndUpdate(
    {
      email: String(email).toLowerCase(),
    },
    {
      $set: {
        name,
        email: String(email).toLowerCase(),
        passwordHash,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

const approveAllPendingRegistrations = async (tournamentId, hostUserId) => {
  let approvedCount = 0;

  while (true) {
    const pending = await listPendingRegistrationRequests(tournamentId, hostUserId, {
      page: 1,
      pageSize: 50,
    });

    const items = pending?.items || [];
    if (items.length === 0) {
      break;
    }

    for (const item of items) {
      await approveRegistrationRequest(tournamentId, item.id, hostUserId);
      approvedCount += 1;
    }
  }

  return approvedCount;
};

const buildCompletedScoreEntries = (winnerSide) => {
  if (winnerSide === 'A') {
    return [
      { gameNumber: 1, playerAScore: 21, playerBScore: 14 },
      { gameNumber: 2, playerAScore: 21, playerBScore: 16 },
      { gameNumber: 3, playerAScore: 21, playerBScore: 18 },
    ];
  }

  return [
    { gameNumber: 1, playerAScore: 15, playerBScore: 21 },
    { gameNumber: 2, playerAScore: 18, playerBScore: 21 },
    { gameNumber: 3, playerAScore: 19, playerBScore: 21 },
  ];
};

const run = async () => {
  const env = loadAndValidateEnv();
  await connectToDatabase(env.mongoUri);

  const host = await createOrUpdateUser({
    name: HOST_NAME,
    email: HOST_EMAIL,
    password: PLAYER_PASSWORD,
  });

  const players = [];
  for (let index = 1; index <= PLAYER_COUNT; index += 1) {
    const player = await createOrUpdateUser({
      name: `Test Player ${String(index).padStart(2, '0')}`,
      email: buildPlayerEmail(index),
      password: PLAYER_PASSWORD,
    });
    players.push(player);
  }

  const timestamp = new Date();
  const tournamentName = `Load Tournament Scored ${timestamp.toISOString().slice(0, 19).replace(/[:T]/g, '-')}`;

  const tournament = await createTournament(
    {
      name: tournamentName,
      maxParticipants: PLAYER_COUNT + 1,
      registrationMode: 'public',
      registrationStatus: 'open',
      startsAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      location: {
        formattedAddress: 'Vancouver Community Centre, Vancouver, BC, Canada',
      },
    },
    host._id
  );

  const tournamentId = tournament.id;

  await submitRegistrationRequest(tournamentId, host._id, {});
  for (const player of players) {
    await submitRegistrationRequest(tournamentId, player._id, {});
  }

  const approvedFromPending = await approveAllPendingRegistrations(tournamentId, host._id);

  await closeTournamentRegistration(tournamentId, host._id);

  const groupResult = await assignRandomGroups(tournamentId, host._id, {
    groupCount: GROUP_COUNT,
    groupStageBestOf: GROUP_STAGE_BEST_OF,
  });

  const games = await Game.find({ tournamentId, stage: 'groupStage' })
    .sort({ roundNumber: 1, _id: 1 })
    .lean();

  const gamesToScore = games.slice(0, Math.min(SCORE_TARGET_GAMES, games.length));

  for (let index = 0; index < gamesToScore.length; index += 1) {
    const game = gamesToScore[index];
    const winnerSide = index % 2 === 0 ? 'A' : 'B';

    await updateGameScores(tournamentId, String(game._id), host._id, {
      status: 'completed',
      scoreEntries: buildCompletedScoreEntries(winnerSide),
    });
  }

  const [underReviewCount, approvedCount, totalGames, completedGames, leaderboardRows] = await Promise.all([
    TournamentRegistration.countDocuments({ tournamentId, status: 'underReview' }),
    TournamentRegistration.countDocuments({ tournamentId, status: 'approved' }),
    Game.countDocuments({ tournamentId }),
    Game.countDocuments({ tournamentId, status: 'completed' }),
    Leaderboard.countDocuments({ tournamentId }),
  ]);

  console.log('[seed:large-tournament:scored] done');
  console.log(`hostEmail=${HOST_EMAIL}`);
  console.log(`password=${PLAYER_PASSWORD}`);
  console.log(`createdPlayers=${PLAYER_COUNT}`);
  console.log(`tournamentId=${tournamentId}`);
  console.log(`tournamentName=${tournamentName}`);
  console.log(`approvedFromPending=${approvedFromPending}`);
  console.log(`approvedParticipants=${approvedCount}`);
  console.log(`pendingParticipants=${underReviewCount}`);
  console.log(`groupCount=${groupResult.groupCount}`);
  console.log(`groupStageBestOf=${groupResult.groupStageBestOf}`);
  console.log(`totalGames=${totalGames}`);
  console.log(`completedGames=${completedGames}`);
  console.log(`leaderboardRows=${leaderboardRows}`);
};

run()
  .catch((error) => {
    console.error('[seed:large-tournament:scored] failed', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
