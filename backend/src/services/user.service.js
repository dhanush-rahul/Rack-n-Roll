const User = require('../models/user.model');
const Tournament = require('../models/tournament.model');
const TournamentRegistration = require('../models/tournamentRegistration.model');
const Player = require('../models/player.model');
const Game = require('../models/game.model');
const ApiError = require('../utils/ApiError');

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
      name: user.name,
      email: user.email,
      memberSince: user.createdAt,
      handicap: Number(user.handicap ?? 0),
      authProvider: user.authProvider || 'local',
      hasPassword: Boolean(user.passwordHash),
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

module.exports = {
  getUserProfile,
  updateUserHandicap,
};
