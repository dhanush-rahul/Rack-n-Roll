const Tournament = require('../../models/tournament.model');
const TournamentRegistration = require('../../models/tournamentRegistration.model');
const ApiError = require('../../utils/ApiError');
const cache = require('../../utils/cache');
const { materializeApprovedPlayerForUser } = require('./roster.service');
const { syncApprovedPlayerToGroups } = require('./fixtures.service');
const {
  assertHostAccess,
  parsePositiveInteger,
  mapRegistrationSummary,
  mapUserSummary,
  buildUserSummaryById,
  mapRegistrationSummaryWithUser,
  mapGuestPlayerRosterItem,
  reserveApprovalCapacitySlot,
  releaseApprovalCapacitySlot,
  buildRoundRobinRounds,
  escapeRegex,
} = require('./shared');
const Player = require('../../models/player.model');
const User = require('../../models/user.model');

const submitRegistrationRequest = async (tournamentId, userId, payload = {}) => {
  if (!userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const isHostRequest = String(tournament.hostUserId) === String(userId);

  if (tournament.registrationStatus !== 'open') {
    throw new ApiError(409, 'REGISTRATION_CLOSED', 'Registration is closed for this tournament');
  }

  const normalizedInviteCode = String(payload?.inviteCode || '').trim().toUpperCase();

  if (!isHostRequest && tournament.registrationMode === 'inviteOnly') {
    if (!normalizedInviteCode) {
      throw new ApiError(400, 'INVITE_CODE_REQUIRED', 'Invite code is required for invite-only tournaments');
    }

    const validInviteCode = normalizedInviteCode === String(tournament.inviteCode || '').trim().toUpperCase();

    if (!validInviteCode) {
      throw new ApiError(400, 'INVITE_CODE_INVALID', 'Invite code is invalid');
    }
  }

  const existingRegistration = await TournamentRegistration.findOne({
    tournamentId: tournament._id,
    userId,
  }).lean();

  if (existingRegistration) {
    throw new ApiError(409, 'REGISTRATION_ALREADY_EXISTS', 'Registration request already exists for this user');
  }

  if (isHostRequest) {
    await reserveApprovalCapacitySlot(tournament._id);
    const reviewedAt = new Date();

    try {
      const createdHostRegistration = await TournamentRegistration.create({
        tournamentId: tournament._id,
        userId,
        status: 'approved',
        inviteCodeUsed: null,
        reviewedByUserId: userId,
        reviewedAt,
      });

      return {
        id: String(createdHostRegistration._id),
        tournamentId: String(createdHostRegistration.tournamentId),
        userId: String(createdHostRegistration.userId),
        status: createdHostRegistration.status,
        inviteCodeUsed: createdHostRegistration.inviteCodeUsed,
        reviewedByUserId: String(createdHostRegistration.reviewedByUserId),
        reviewedAt: createdHostRegistration.reviewedAt,
        createdAt: createdHostRegistration.createdAt,
      };
    } catch (error) {
      await releaseApprovalCapacitySlot(tournament._id);

      if (error?.code === 11000) {
        throw new ApiError(409, 'REGISTRATION_ALREADY_EXISTS', 'Registration request already exists for this user');
      }

      throw error;
    }
  }

  const createdRegistration = await TournamentRegistration.create({
    tournamentId: tournament._id,
    userId,
    status: 'underReview',
    inviteCodeUsed: tournament.registrationMode === 'inviteOnly' ? normalizedInviteCode : null,
  });

  return {
    id: String(createdRegistration._id),
    tournamentId: String(createdRegistration.tournamentId),
    userId: String(createdRegistration.userId),
    status: createdRegistration.status,
    inviteCodeUsed: createdRegistration.inviteCodeUsed,
    createdAt: createdRegistration.createdAt,
  };
};

const reviewRegistrationRequest = async (tournamentId, registrationId, hostUserId, nextStatus) => {
  await assertHostAccess(tournamentId, hostUserId);

  const existingRegistration = await TournamentRegistration.findOne({
    _id: registrationId,
    tournamentId,
  }).lean();

  if (!existingRegistration) {
    throw new ApiError(404, 'REGISTRATION_NOT_FOUND', 'Registration request not found');
  }

  if (existingRegistration.status !== 'underReview') {
    throw new ApiError(
      409,
      'INVALID_REGISTRATION_TRANSITION',
      `Only underReview requests can be reviewed. Current status: ${existingRegistration.status}`
    );
  }

  const reviewedAt = new Date();
  const reviewUpdate = { status: nextStatus, reviewedByUserId: hostUserId, reviewedAt };

  if (nextStatus === 'approved') {
    await reserveApprovalCapacitySlot(tournamentId);

    const approvedRegistration = await TournamentRegistration.findOneAndUpdate(
      { _id: registrationId, tournamentId, status: 'underReview' },
      { $set: reviewUpdate },
      { new: true }
    ).lean();

    if (!approvedRegistration) {
      await releaseApprovalCapacitySlot(tournamentId);

      throw new ApiError(
        409,
        'INVALID_REGISTRATION_TRANSITION',
        'Only underReview requests can be reviewed. The request may have already been processed.'
      );
    }

    // Approving consumes a capacity slot, which changes discover spots remaining.
    cache.delByPrefix('discover:');

    await materializeApprovedPlayerForUser(tournamentId, approvedRegistration.userId);
    const groupSync = await syncApprovedPlayerToGroups(tournamentId, approvedRegistration.userId);

    return { ...mapRegistrationSummary(approvedRegistration), groupSync };
  }

  const reviewedRegistration = await TournamentRegistration.findOneAndUpdate(
    { _id: registrationId, tournamentId, status: 'underReview' },
    { $set: reviewUpdate },
    { new: true }
  ).lean();

  if (!reviewedRegistration) {
    throw new ApiError(
      409,
      'INVALID_REGISTRATION_TRANSITION',
      'Only underReview requests can be reviewed. The request may have already been processed.'
    );
  }

  return mapRegistrationSummary(reviewedRegistration);
};

const approveRegistrationRequest = async (tournamentId, registrationId, hostUserId) =>
  reviewRegistrationRequest(tournamentId, registrationId, hostUserId, 'approved');

const rejectRegistrationRequest = async (tournamentId, registrationId, hostUserId) =>
  reviewRegistrationRequest(tournamentId, registrationId, hostUserId, 'rejected');

const listPendingRegistrationRequests = async (tournamentId, hostUserId, query = {}) => {
  await assertHostAccess(tournamentId, hostUserId);

  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, 20);
  const pageSize = Math.min(requestedPageSize, 50);

  const findFilter = { tournamentId, status: 'underReview' };

  const [items, total] = await Promise.all([
    TournamentRegistration.find(findFilter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    TournamentRegistration.countDocuments(findFilter),
  ]);

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    items: items.map(mapRegistrationSummary),
    pagination: { page, pageSize, total, totalPages },
  };
};

const listHostRegistrations = async (tournamentId, hostUserId, query = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);

  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, 50);
  const pageSize = Math.min(requestedPageSize, 100);

  const findFilter = {
    tournamentId: tournament._id,
    status: { $in: ['underReview', 'approved'] },
  };

  const [items, total] = await Promise.all([
    TournamentRegistration.aggregate([
      { $match: findFilter },
      { $addFields: { statusOrder: { $cond: [{ $eq: ['$status', 'underReview'] }, 0, 1] } } },
      { $sort: { statusOrder: 1, createdAt: -1, _id: -1 } },
      { $skip: (page - 1) * pageSize },
      { $limit: pageSize },
      { $project: { statusOrder: 0 } },
    ]),
    TournamentRegistration.countDocuments(findFilter),
  ]);

  const userSummaryById = await buildUserSummaryById(items.map((item) => item.userId));
  const guestPlayers = await Player.find({
    tournamentId: tournament._id,
    status: 'active',
    userId: null,
    $or: [
      { pendingLinkEmail: { $type: 'string', $ne: null } },
      { pendingLinkUsername: { $type: 'string', $ne: null } },
    ],
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  const guestItems = guestPlayers.map(mapGuestPlayerRosterItem);
  const combinedTotal = total + guestItems.length;
  const totalPages = combinedTotal === 0 ? 0 : Math.ceil(combinedTotal / pageSize);

  return {
    items: [...items.map((item) => mapRegistrationSummaryWithUser(item, userSummaryById)), ...guestItems],
    pagination: { page, pageSize, total: combinedTotal, totalPages },
  };
};

const searchManualAddUsers = async (tournamentId, hostUserId, query = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const searchTerm = String(query.q || '').trim();

  if (searchTerm.length < 2) {
    throw new ApiError(400, 'INVALID_SEARCH_QUERY', 'Search query must be at least 2 characters');
  }

  const requestedLimit = parsePositiveInteger(query.limit, 10);
  const limit = Math.min(requestedLimit, 20);
  const searchRegex = new RegExp(escapeRegex(searchTerm), 'i');

  const matchingUsers = await User.find({
    $or: [{ name: searchRegex }, { email: searchRegex }, { username: searchRegex }],
    _id: { $ne: tournament.hostUserId },
  })
    .sort({ name: 1, username: 1, _id: 1 })
    .limit(limit)
    .select({ _id: 1, name: 1, email: 1, username: 1 })
    .lean();

  const userIds = matchingUsers.map((user) => user._id);

  const existingRegistrations = userIds.length
    ? await TournamentRegistration.find({ tournamentId, userId: { $in: userIds } })
        .select({ userId: 1, status: 1 })
        .lean()
    : [];

  const registrationStatusByUserId = existingRegistrations.reduce((accumulator, registration) => {
    accumulator.set(String(registration.userId), registration.status);
    return accumulator;
  }, new Map());

  return {
    tournamentId: String(tournament._id),
    query: searchTerm,
    items: matchingUsers.map((user) => ({
      ...mapUserSummary(user),
      registrationStatus: registrationStatusByUserId.get(String(user._id)) || null,
    })),
  };
};

const getRoundRobinPlayingPattern = async (tournamentId, hostUserId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);

  const approvedRegistrations = await TournamentRegistration.find({
    tournamentId,
    status: 'approved',
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  if (approvedRegistrations.length < 2) {
    throw new ApiError(
      409,
      'INSUFFICIENT_APPROVED_PARTICIPANTS',
      'At least 2 approved participants are required to generate a round-robin pattern'
    );
  }

  const userSummaryById = await buildUserSummaryById(approvedRegistrations.map((registration) => registration.userId));

  const participants = approvedRegistrations.map((registration) => {
    const normalizedUserId = String(registration.userId);
    const userSummary = userSummaryById.get(normalizedUserId);

    return {
      id: normalizedUserId,
      name: userSummary?.name || `User ${normalizedUserId.slice(-6)}`,
      email: userSummary?.email || null,
    };
  });

  const rounds = buildRoundRobinRounds(participants);

  return {
    tournamentId: String(tournament._id),
    participantCount: participants.length,
    participants,
    rounds,
  };
};

module.exports = {
  submitRegistrationRequest,
  reviewRegistrationRequest,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  listPendingRegistrationRequests,
  listHostRegistrations,
  searchManualAddUsers,
  getRoundRobinPlayingPattern,
};
