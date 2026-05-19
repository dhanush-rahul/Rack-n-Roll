const mongoose = require('mongoose');

const Tournament = require('../src/models/tournament.model');
const Division = require('../src/models/division.model');
const Player = require('../src/models/player.model');
const Game = require('../src/models/game.model');
const Leaderboard = require('../src/models/leaderboard.model');
const TournamentRegistration = require('../src/models/tournamentRegistration.model');

const log = (message) => console.log(`[schema-check] ${message}`);

const assertValidationError = (modelName, error) => {
  if (!error || error.name !== 'ValidationError') {
    throw new Error(`${modelName} should fail with ValidationError`);
  }
};

const buildValidLocation = () => ({
  type: 'Point',
  coordinates: [-79.3832, 43.6532],
  countryCode: 'CA',
  provinceCode: 'ON',
  city: 'Toronto',
  formattedAddress: 'Toronto, ON, Canada',
});

const run = () => {
  const hostUserId = new mongoose.Types.ObjectId();
  const playerUserId = new mongoose.Types.ObjectId();
  const tournamentId = new mongoose.Types.ObjectId();
  const divisionId = new mongoose.Types.ObjectId();
  const playerAId = new mongoose.Types.ObjectId();
  const playerBId = new mongoose.Types.ObjectId();

  const invalidTournament = new Tournament({
    name: 'Weekend Open',
    hostUserId,
    maxParticipants: 32,
    registrationMode: 'public',
    registrationStatus: 'open',
    location: buildValidLocation(),
    status: 'invalid-status',
  });

  assertValidationError('Tournament', invalidTournament.validateSync());
  log('Invalid tournament enum is rejected');

  const validTournament = new Tournament({
    _id: tournamentId,
    name: 'Weekend Open',
    hostUserId,
    maxParticipants: 32,
    registrationMode: 'public',
    registrationStatus: 'open',
    location: buildValidLocation(),
    status: 'draft',
  });
  if (validTournament.validateSync()) {
    throw new Error('Valid tournament should pass validation');
  }

  const invalidInviteOnlyTournament = new Tournament({
    name: 'Invite Masters',
    hostUserId,
    maxParticipants: 16,
    registrationMode: 'inviteOnly',
    registrationStatus: 'open',
    location: buildValidLocation(),
    status: 'draft',
  });
  assertValidationError('TournamentInviteCode', invalidInviteOnlyTournament.validateSync());
  log('Invite-only tournament without inviteCode is rejected');

  const invalidCoordinateTournament = new Tournament({
    name: 'Coordinate Test',
    hostUserId,
    maxParticipants: 16,
    registrationMode: 'public',
    registrationStatus: 'open',
    location: {
      ...buildValidLocation(),
      coordinates: [200, 120],
    },
    status: 'draft',
  });
  assertValidationError('TournamentCoordinates', invalidCoordinateTournament.validateSync());
  log('Out-of-range coordinates are rejected');

  const validDivision = new Division({
    tournamentId,
    name: 'Division A',
    status: 'open',
  });
  if (validDivision.validateSync()) {
    throw new Error('Valid division should pass validation');
  }

  const validPlayerA = new Player({
    _id: playerAId,
    tournamentId,
    userId: playerUserId,
    displayName: 'Player A',
    handicapEnabled: true,
    handicapValue: 10,
  });
  if (validPlayerA.validateSync()) {
    throw new Error('Valid player should pass validation');
  }

  const validPlayerB = new Player({
    _id: playerBId,
    tournamentId,
    displayName: 'Player B',
  });
  if (validPlayerB.validateSync()) {
    throw new Error('Valid player should pass validation');
  }

  const validGame = new Game({
    tournamentId,
    divisionId,
    playerAId,
    playerBId,
    status: 'scheduled',
    scoreEntries: [
      {
        gameNumber: 1,
        playerAScore: 145,
        playerBScore: 132,
      },
    ],
  });
  if (validGame.validateSync()) {
    throw new Error('Valid game should pass validation');
  }

  const validLeaderboard = new Leaderboard({
    tournamentId,
    divisionId,
    playerId: playerAId,
    rank: 1,
    points: 3,
    wins: 1,
    losses: 0,
  });
  if (validLeaderboard.validateSync()) {
    throw new Error('Valid leaderboard entry should pass validation');
  }

  const validRegistration = new TournamentRegistration({
    tournamentId,
    userId: playerUserId,
    status: 'underReview',
  });
  if (validRegistration.validateSync()) {
    throw new Error('Valid tournament registration should pass validation');
  }

  const invalidRegistration = new TournamentRegistration({
    tournamentId,
    userId: playerUserId,
    status: 'pending',
  });
  assertValidationError('TournamentRegistration', invalidRegistration.validateSync());
  log('Invalid registration enum is rejected');

  log('Valid linked core documents pass schema validation');
  log('M2-S1 and M2-S2 schema checks completed successfully');
};

run();
