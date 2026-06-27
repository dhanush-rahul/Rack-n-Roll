const Tournament = require('../../models/tournament.model');
const TournamentRegistration = require('../../models/tournamentRegistration.model');
const Player = require('../../models/player.model');
const ApiError = require('../../utils/ApiError');
const { buildUserSummaryById } = require('./shared');

const dedupeActivePlayersForTournament = async (tournamentId) => {
  const activePlayers = await Player.find({ tournamentId, status: 'active' })
    .sort({ createdAt: 1, _id: 1 })
    .select({ _id: 1, userId: 1 })
    .lean();

  const keeperByUserId = new Map();
  const duplicatePlayerIds = [];

  activePlayers.forEach((player) => {
    const userKey = String(player.userId || '').trim();

    if (!userKey) {
      return;
    }

    if (keeperByUserId.has(userKey)) {
      duplicatePlayerIds.push(player._id);
      return;
    }

    keeperByUserId.set(userKey, player._id);
  });

  if (duplicatePlayerIds.length === 0) {
    return 0;
  }

  await Player.updateMany(
    { _id: { $in: duplicatePlayerIds }, tournamentId, status: 'active' },
    { $set: { status: 'removed' } }
  );

  return duplicatePlayerIds.length;
};

const upsertActivePlayerForRegistration = async (
  tournamentId,
  registration,
  { useHandicap, usersById }
) => {
  const normalizedUserId = String(registration.userId);
  const user = usersById.get(normalizedUserId);
  const displayName = user?.name || user?.email || `Player ${normalizedUserId.slice(-6)}`;

  const player = await Player.findOneAndUpdate(
    {
      tournamentId,
      userId: registration.userId,
      status: 'active',
    },
    {
      $setOnInsert: {
        tournamentId,
        userId: registration.userId,
        displayName,
        handicapEnabled: useHandicap,
        handicapValue: useHandicap ? Number(user?.handicap ?? 0) : 0,
        status: 'active',
        teamId: null,
        awaitingPartner: false,
      },
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  ).lean();

  return player;
};

const materializeApprovedPlayers = async (tournamentId, { minimumCount = 0 } = {}) => {
  await dedupeActivePlayersForTournament(tournamentId);

  const tournament = await Tournament.findById(tournamentId)
    .select({ competitionConfig: 1 })
    .lean();
  const useHandicap = Boolean(tournament?.competitionConfig?.handicapEnabled);

  const approvedRegistrations = await TournamentRegistration.find({
    tournamentId,
    status: 'approved',
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (approvedRegistrations.length < minimumCount) {
    throw new ApiError(
      409,
      'INSUFFICIENT_APPROVED_PARTICIPANTS',
      `At least ${minimumCount} approved participants are required`
    );
  }

  if (approvedRegistrations.length === 0) {
    return [];
  }

  const usersById = await buildUserSummaryById(approvedRegistrations.map((registration) => registration.userId));
  const players = [];

  for (const registration of approvedRegistrations) {
    const player = await upsertActivePlayerForRegistration(tournamentId, registration, {
      useHandicap,
      usersById,
    });
    players.push(player);
  }

  await dedupeActivePlayersForTournament(tournamentId);

  return players.map((player) => ({
    id: String(player._id),
    userId: player.userId ? String(player.userId) : null,
    displayName: player.displayName,
    teamId: player.teamId ? String(player.teamId) : null,
    awaitingPartner: Boolean(player.awaitingPartner),
  }));
};

const materializeApprovedPlayerForUser = async (tournamentId, userId) => {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return null;
  }

  await dedupeActivePlayersForTournament(tournamentId);

  const registration = await TournamentRegistration.findOne({
    tournamentId,
    userId: normalizedUserId,
    status: 'approved',
  }).lean();

  if (!registration) {
    return null;
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ competitionConfig: 1 })
    .lean();
  const useHandicap = Boolean(tournament?.competitionConfig?.handicapEnabled);
  const usersById = await buildUserSummaryById([normalizedUserId]);

  const player = await upsertActivePlayerForRegistration(tournamentId, registration, {
    useHandicap,
    usersById,
  });

  return {
    id: String(player._id),
    userId: String(player.userId),
    displayName: player.displayName,
    teamId: player.teamId ? String(player.teamId) : null,
    awaitingPartner: Boolean(player.awaitingPartner),
  };
};

const ensurePlayersFromApprovedRegistrations = async (tournamentId) =>
  materializeApprovedPlayers(tournamentId, { minimumCount: 2 });

module.exports = {
  dedupeActivePlayersForTournament,
  upsertActivePlayerForRegistration,
  materializeApprovedPlayers,
  materializeApprovedPlayerForUser,
  ensurePlayersFromApprovedRegistrations,
};
