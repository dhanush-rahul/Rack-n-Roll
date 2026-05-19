const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');
const { loadAndValidateEnv } = require('../src/config/env');
const { connectToDatabase } = require('../src/config/db');
const User = require('../src/models/user.model');
const Tournament = require('../src/models/tournament.model');
const TournamentRegistration = require('../src/models/tournamentRegistration.model');

const SALT_ROUNDS = 10;

const SEED_USERS = {
  host: {
    name: 'Release Host',
    email: 'release.host@racknroll.local',
    password: 'ReleaseHost123!',
  },
  player: {
    name: 'Release Player',
    email: 'release.player@racknroll.local',
    password: 'ReleasePlayer123!',
  },
  scoreEditor: {
    name: 'Release Editor',
    email: 'release.editor@racknroll.local',
    password: 'ReleaseEditor123!',
  },
};

const PUBLIC_TOURNAMENT_NAME = 'Release Public Open';
const INVITE_TOURNAMENT_NAME = 'Release Invite Open';

const createOrUpdateUser = async ({ name, email, password }) => {
  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  return User.findOneAndUpdate(
    { email },
    {
      $set: {
        name,
        email,
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

const upsertTournament = async ({ name, hostUserId, registrationMode, inviteCode, location, maxParticipants }) => {
  return Tournament.findOneAndUpdate(
    {
      name,
      hostUserId,
    },
    {
      $set: {
        name,
        hostUserId,
        maxParticipants,
        registrationMode,
        inviteCode: registrationMode === 'inviteOnly' ? inviteCode : undefined,
        registrationStatus: 'open',
        location,
        status: 'active',
        scoreEditorUserIds: [],
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

const ensureRegistration = async ({ tournamentId, userId, status, reviewedByUserId = null, inviteCodeUsed = null }) => {
  const update = {
    status,
    inviteCodeUsed,
  };

  if (status === 'approved' || status === 'rejected' || status === 'removed') {
    update.reviewedByUserId = reviewedByUserId;
    update.reviewedAt = new Date();
  }

  return TournamentRegistration.findOneAndUpdate(
    {
      tournamentId,
      userId,
    },
    {
      $set: update,
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );
};

const run = async () => {
  const env = loadAndValidateEnv();
  await connectToDatabase(env.mongoUri);

  const host = await createOrUpdateUser(SEED_USERS.host);
  const player = await createOrUpdateUser(SEED_USERS.player);
  const scoreEditor = await createOrUpdateUser(SEED_USERS.scoreEditor);

  const location = {
    type: 'Point',
    coordinates: [-123.1207, 49.2827],
    countryCode: 'CA',
    provinceCode: 'BC',
    city: 'Vancouver',
    formattedAddress: 'Vancouver, BC, Canada',
  };

  const publicTournament = await upsertTournament({
    name: PUBLIC_TOURNAMENT_NAME,
    hostUserId: host._id,
    registrationMode: 'public',
    maxParticipants: 24,
    location,
  });

  const inviteTournament = await upsertTournament({
    name: INVITE_TOURNAMENT_NAME,
    hostUserId: host._id,
    registrationMode: 'inviteOnly',
    inviteCode: 'REL2026',
    maxParticipants: 16,
    location,
  });

  publicTournament.scoreEditorUserIds = [scoreEditor._id];
  await publicTournament.save();

  await ensureRegistration({
    tournamentId: publicTournament._id,
    userId: player._id,
    status: 'approved',
    reviewedByUserId: host._id,
  });

  await ensureRegistration({
    tournamentId: inviteTournament._id,
    userId: player._id,
    status: 'underReview',
    inviteCodeUsed: 'REL2026',
  });

  const approvedCountPublic = await TournamentRegistration.countDocuments({
    tournamentId: publicTournament._id,
    status: 'approved',
  });

  const approvedCountInvite = await TournamentRegistration.countDocuments({
    tournamentId: inviteTournament._id,
    status: 'approved',
  });

  await Tournament.updateOne(
    { _id: publicTournament._id },
    {
      $set: {
        approvedParticipantsCount: approvedCountPublic,
      },
    }
  );

  await Tournament.updateOne(
    { _id: inviteTournament._id },
    {
      $set: {
        approvedParticipantsCount: approvedCountInvite,
      },
    }
  );

  console.log('[seed:release] done');
  console.log(`host=${SEED_USERS.host.email}`);
  console.log(`player=${SEED_USERS.player.email}`);
  console.log(`scoreEditor=${SEED_USERS.scoreEditor.email}`);
  console.log(`publicTournament=${publicTournament._id}`);
  console.log(`inviteTournament=${inviteTournament._id}`);
  console.log('inviteCode=REL2026');
};

run()
  .catch((error) => {
    console.error('[seed:release] failed', error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
