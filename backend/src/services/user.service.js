const User = require('../models/user.model');
const Tournament = require('../models/tournament.model');
const TournamentRegistration = require('../models/tournamentRegistration.model');
const Player = require('../models/player.model');
const Game = require('../models/game.model');
const ApiError = require('../utils/ApiError');

const getUserProfile = async (userId) => {
  const user = await User.findById(userId).lean();

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

module.exports = {
  getUserProfile,
};
