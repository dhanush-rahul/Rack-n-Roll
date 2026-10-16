const bcrypt = require('bcryptjs');
const User = require('../models/user.model');
const Tournament = require('../models/tournament.model');
const TournamentRegistration = require('../models/tournamentRegistration.model');
const Player = require('../models/player.model');
const Game = require('../models/game.model');
const ApiError = require('../utils/ApiError');
const { logger } = require('../utils/logger');
const { revokeAppleRefreshToken } = require('./appleAuth.service');
const { normalizeUsername } = require('./username.service');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_MAX_LENGTH = 254;

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const validateEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!normalizedEmail || normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    throw new ApiError(400, 'INVALID_EMAIL', 'A valid email address is required');
  }

  return normalizedEmail;
};

const getUserProfile = async (userId) => {
  const user = await User.findById(userId).select('+passwordHash').lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const playerRecords = await Player.find({ userId, status: 'active' }).select('_id').lean();
  const playerIds = playerRecords.map((record) => record._id);

  const matchFilter =
    playerIds.length === 0
      ? null
      : {
          status: 'completed',
          $or: [{ playerAId: { $in: playerIds } }, { playerBId: { $in: playerIds } }],
        };

  const [tournamentsHosted, tournamentsJoined, registrationsPending, matchesPlayed, matchesWon] =
    await Promise.all([
      Tournament.countDocuments({ hostUserId: userId }),
      TournamentRegistration.countDocuments({ userId, status: 'approved' }),
      TournamentRegistration.countDocuments({ userId, status: 'underReview' }),
      matchFilter ? Game.countDocuments(matchFilter) : Promise.resolve(0),
      playerIds.length === 0
        ? Promise.resolve(0)
        : Game.countDocuments({
            status: 'completed',
            winnerPlayerId: { $in: playerIds },
          }),
    ]);

  const matchesLost = Math.max(matchesPlayed - matchesWon, 0);

  return {
    user: {
      id: String(user._id),
      username: user.username,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      name: user.name,
      email: user.email || null,
      memberSince: user.createdAt,
      handicap: Number(user.handicap ?? 0),
      authProvider: user.authProvider || 'local',
      hasPassword: Boolean(user.passwordHash),
      usernameChangesRemaining: Math.max(2 - Number(user.usernameChangeCount || 0), 0),
    },
    stats: {
      tournamentsHosted,
      tournamentsJoined,
      registrationsPending,
      matchesPlayed,
      matchesWon,
      matchesLost,
      winRate: matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : null,
    },
  };
};

const updateUserHandicap = async (userId, handicap) => {
  const parsedHandicap = Number.parseInt(handicap, 10);

  if (!Number.isFinite(parsedHandicap) || parsedHandicap < 0 || parsedHandicap > 300) {
    throw new ApiError(400, 'INVALID_HANDICAP', 'handicap must be an integer between 0 and 300');
  }

  const user = await User.findByIdAndUpdate(
    userId,
    { handicap: parsedHandicap },
    { new: true }
  ).lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  return getUserProfile(userId);
};

const updateUserEmail = async (userId, email) => {
  const user = await User.findById(userId).lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (user.email) {
    throw new ApiError(409, 'EMAIL_ALREADY_SET', 'Email is already set on this account');
  }

  const normalizedEmail = validateEmail(email);
  const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: userId } }).select({ _id: 1 }).lean();

  if (existingUser) {
    throw new ApiError(409, 'EMAIL_TAKEN', 'This email is already linked to another account');
  }

  await User.updateOne({ _id: userId }, { $set: { email: normalizedEmail } });

  const { linkPendingGuestPlayersForUser } = require('./tournament/participants.service');
  await linkPendingGuestPlayersForUser(userId);

  return getUserProfile(userId);
};

const getPublicUserProfile = async (usernameInput) => {
  const username = String(usernameInput || '').trim().toLowerCase();

  if (!username) {
    throw new ApiError(400, 'INVALID_USERNAME', 'Username is required');
  }

  const user = await User.findOne({ username }).lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'Player not found');
  }

  const playerRecords = await Player.find({ userId: user._id, status: 'active' }).select('_id').lean();
  const playerIds = playerRecords.map((record) => record._id);

  const matchFilter =
    playerIds.length === 0
      ? null
      : {
          status: 'completed',
          $or: [{ playerAId: { $in: playerIds } }, { playerBId: { $in: playerIds } }],
        };

  const [tournamentsHosted, tournamentsJoined, matchesPlayed, matchesWon] = await Promise.all([
    Tournament.countDocuments({ hostUserId: user._id }),
    TournamentRegistration.countDocuments({ userId: user._id, status: 'approved' }),
    matchFilter ? Game.countDocuments(matchFilter) : Promise.resolve(0),
    playerIds.length === 0
      ? Promise.resolve(0)
      : Game.countDocuments({
          status: 'completed',
          winnerPlayerId: { $in: playerIds },
        }),
  ]);

  const matchesLost = Math.max(matchesPlayed - matchesWon, 0);

  return {
    user: {
      username: user.username,
      name: user.name,
      memberSince: user.createdAt,
      handicap: Number(user.handicap ?? 0),
    },
    stats: {
      tournamentsHosted,
      tournamentsJoined,
      matchesPlayed,
      matchesWon,
      matchesLost,
      winRate: matchesPlayed > 0 ? Math.round((matchesWon / matchesPlayed) * 100) : null,
    },
  };
};

const DELETED_PLAYER_NAME = 'Deleted player';

const getAccountDeletionPreview = async (userId) => {
  const user = await User.findById(userId).select('+passwordHash').lean();

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const tournaments = await Tournament.find({ hostUserId: userId }).select({ name: 1, status: 1 }).sort({ name: 1 }).lean();
  const tournamentIds = tournaments.map((tournament) => tournament._id);
  const rosterPlayers = tournamentIds.length
    ? await Player.find({
        tournamentId: { $in: tournamentIds },
        status: 'active',
        userId: { $ne: null },
      })
        .select({ tournamentId: 1, userId: 1, displayName: 1 })
        .lean()
    : [];
  const candidateUserIds = [
    ...new Set(
      rosterPlayers
        .map((player) => String(player.userId || ''))
        .filter((candidateId) => candidateId && candidateId !== String(userId))
    ),
  ];
  const candidateUsers = candidateUserIds.length
    ? await User.find({ _id: { $in: candidateUserIds } }).select({ username: 1, name: 1 }).lean()
    : [];
  const candidateUserById = new Map(candidateUsers.map((candidate) => [String(candidate._id), candidate]));

  return {
    requiresPassword: Boolean(user.passwordHash),
    username: user.username,
    hostedTournaments: tournaments.map((tournament) => {
      const candidates = rosterPlayers
        .filter((player) => String(player.tournamentId) === String(tournament._id))
        .map((player) => {
          const candidate = candidateUserById.get(String(player.userId));

          if (!candidate) {
            return null;
          }

          return {
            userId: String(candidate._id),
            username: candidate.username,
            name: player.displayName || candidate.name,
          };
        })
        .filter(Boolean);

      const uniqueCandidates = [...new Map(candidates.map((candidate) => [candidate.userId, candidate])).values()];

      return {
        id: String(tournament._id),
        name: tournament.name,
        status: tournament.status,
        candidates: uniqueCandidates,
      };
    }),
  };
};

const resolveReplacementHost = async ({ newHostUserId, newHostUsername, currentUserId }) => {
  const userId = String(newHostUserId || '').trim();
  const username = normalizeUsername(newHostUsername);
  let host = null;

  if (userId) {
    host = await User.findById(userId).select({ username: 1, name: 1 }).lean();
  } else if (username) {
    host = await User.findOne({ username }).select({ username: 1, name: 1 }).lean();
  }

  if (!host) {
    throw new ApiError(404, 'NEW_HOST_NOT_FOUND', 'Choose a registered player to take over as host');
  }

  if (String(host._id) === String(currentUserId)) {
    throw new ApiError(400, 'NEW_HOST_INVALID', 'Choose a different player to take over as host');
  }

  return host;
};

const ensureReplacementIsPlayer = async (tournamentId, host, addedByHostUserId) => {
  const existingPlayer = await Player.findOne({
    tournamentId,
    userId: host._id,
    status: 'active',
  })
    .select({ _id: 1 })
    .lean();

  if (existingPlayer) {
    return existingPlayer;
  }

  const displayName = String(host.name || host.username || '').trim();

  return Player.create({
    tournamentId,
    userId: host._id,
    displayName: displayName.length >= 2 ? displayName.slice(0, 120) : host.username,
    addedByHostUserId,
    status: 'active',
  });
};

const deleteMyAccount = async (userId, payload = {}) => {
  const user = await User.findById(userId).select('+passwordHash +appleRefreshToken');

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (user.passwordHash) {
    const password = String(payload.password || '');

    if (!password) {
      throw new ApiError(400, 'CURRENT_PASSWORD_REQUIRED', 'Current password is required');
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new ApiError(401, 'INVALID_CURRENT_PASSWORD', 'Current password is incorrect');
    }
  } else {
    const confirmation = normalizeUsername(payload.usernameConfirmation);

    if (!confirmation || confirmation !== user.username) {
      throw new ApiError(400, 'USERNAME_CONFIRMATION_REQUIRED', 'Type your username to confirm account deletion');
    }
  }

  const hostedTournaments = await Tournament.find({ hostUserId: userId }).select({ _id: 1, name: 1 }).lean();
  const transfers = Array.isArray(payload.hostTransfers) ? payload.hostTransfers : [];
  const transferByTournamentId = new Map(
    transfers.map((transfer) => [String(transfer?.tournamentId || ''), transfer])
  );

  for (const tournament of hostedTournaments) {
    const transfer = transferByTournamentId.get(String(tournament._id));

    if (!transfer) {
      throw new ApiError(
        400,
        'HOST_TRANSFER_REQUIRED',
        `Assign a new host for ${tournament.name} before deleting your account`
      );
    }

    const nextHost = await resolveReplacementHost({
      newHostUserId: transfer.newHostUserId,
      newHostUsername: transfer.newHostUsername,
      currentUserId: userId,
    });

    await ensureReplacementIsPlayer(tournament._id, nextHost, userId);
    await Tournament.updateOne(
      { _id: tournament._id, hostUserId: userId },
      {
        $set: { hostUserId: nextHost._id },
        $pull: { scoreEditorUserIds: user._id },
      }
    );
  }

  const stillHosting = await Tournament.countDocuments({ hostUserId: userId });

  if (stillHosting > 0) {
    throw new ApiError(409, 'HOST_TRANSFER_REQUIRED', 'Assign a new host for every tournament you host');
  }

  await Tournament.updateMany({ scoreEditorUserIds: user._id }, { $pull: { scoreEditorUserIds: user._id } });
  await Tournament.updateMany(
    {
      $or: [
        { 'proctorTransferRequest.fromUserId': user._id },
        { 'proctorTransferRequest.toUserId': user._id },
      ],
    },
    {
      $set: {
        'proctorTransferRequest.fromUserId': null,
        'proctorTransferRequest.toUserId': null,
        'proctorTransferRequest.requestedAt': null,
      },
    }
  );
  await Player.updateMany(
    { userId: user._id },
    {
      $set: {
        displayName: DELETED_PLAYER_NAME,
        pendingLinkEmail: null,
        pendingLinkUsername: null,
        userId: null,
      },
    }
  );
  await TournamentRegistration.deleteMany({ userId: user._id });
  await TournamentRegistration.updateMany({ reviewedByUserId: user._id }, { $set: { reviewedByUserId: null } });

  if (user.appleRefreshToken) {
    try {
      await revokeAppleRefreshToken(user.appleRefreshToken);
    } catch (error) {
      logger.warn({ err: error }, 'Apple token revocation failed during account deletion');
    }
  }

  await User.deleteOne({ _id: user._id });

  return { deleted: true };
};

module.exports = {
  getUserProfile,
  getPublicUserProfile,
  updateUserHandicap,
  updateUserEmail,
  getAccountDeletionPreview,
  deleteMyAccount,
};
