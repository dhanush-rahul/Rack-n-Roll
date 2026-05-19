const Tournament = require('../models/tournament.model');
const TournamentRegistration = require('../models/tournamentRegistration.model');
const Division = require('../models/division.model');
const Player = require('../models/player.model');
const Game = require('../models/game.model');
const Leaderboard = require('../models/leaderboard.model');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');

const normalizeLocation = (location) => {
  const formattedAddress = String(location?.formattedAddress || '').trim();
  const lng = Number(location?.lng);
  const lat = Number(location?.lat);
  const hasCoordinates = Number.isFinite(lng) && Number.isFinite(lat);
  const cityFromAddress = formattedAddress.split(',')[0]?.trim();

  if (hasCoordinates && (lng < -180 || lng > 180 || lat < -90 || lat > 90)) {
    throw new ApiError(400, 'INVALID_COORDINATES', 'location lng and lat are out of range');
  }

  return {
    type: 'Point',
    coordinates: hasCoordinates ? [lng, lat] : [0, 0],
    countryCode: String(location?.countryCode || 'ZZ').trim().toUpperCase(),
    provinceCode: String(location?.provinceCode || 'NA').trim().toUpperCase(),
    city: String(location?.city || cityFromAddress || 'TBD').trim(),
    formattedAddress,
  };
};

const parseStartsAt = (value) => {
  const parsedDate = value instanceof Date ? value : new Date(value);

  if (!(parsedDate instanceof Date) || Number.isNaN(parsedDate.getTime())) {
    throw new ApiError(400, 'INVALID_STARTS_AT', 'startsAt must be a valid date-time');
  }

  return parsedDate;
};

const normalizeTournamentInput = (input, hostUserId) => {
  if (!hostUserId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const registrationMode = input?.registrationMode === 'inviteOnly' ? 'inviteOnly' : 'public';

  return {
    name: String(input?.name || '').trim(),
    hostUserId,
    maxParticipants: Number(input?.maxParticipants),
    registrationMode,
    inviteCode:
      registrationMode === 'inviteOnly'
        ? String(input?.inviteCode || '')
            .trim()
            .toUpperCase()
        : undefined,
    registrationStatus: input?.registrationStatus === 'closed' ? 'closed' : 'open',
    location: normalizeLocation(input?.location),
    startsAt: parseStartsAt(input?.startsAt),
    status: 'draft',
  };
};

const createTournament = async (payload, hostUserId) => {
  const normalizedPayload = normalizeTournamentInput(payload, hostUserId);

  if (!normalizedPayload.name) {
    throw new ApiError(400, 'INVALID_NAME', 'Tournament name is required');
  }

  if (!Number.isFinite(normalizedPayload.maxParticipants) || normalizedPayload.maxParticipants < 1) {
    throw new ApiError(400, 'INVALID_MAX_PARTICIPANTS', 'maxParticipants must be at least 1');
  }

  const createdTournament = await Tournament.create(normalizedPayload);

  return {
    id: String(createdTournament._id),
    name: createdTournament.name,
    hostUserId: String(createdTournament.hostUserId),
    maxParticipants: createdTournament.maxParticipants,
    approvedParticipantsCount: createdTournament.approvedParticipantsCount,
    registrationMode: createdTournament.registrationMode,
    inviteCode: createdTournament.registrationMode === 'inviteOnly' ? createdTournament.inviteCode : null,
    registrationStatus: createdTournament.registrationStatus,
    location: {
      type: createdTournament.location.type,
      coordinates: createdTournament.location.coordinates,
      countryCode: createdTournament.location.countryCode,
      provinceCode: createdTournament.location.provinceCode,
      city: createdTournament.location.city,
      formattedAddress: createdTournament.location.formattedAddress,
    },
    status: createdTournament.status,
    startsAt: createdTournament.startsAt,
    scoreEditorUserIds: createdTournament.scoreEditorUserIds,
    createdAt: createdTournament.createdAt,
  };
};

const parsePositiveInteger = (value, fallbackValue) => {
  const parsedValue = Number.parseInt(value, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 1) {
    return fallbackValue;
  }

  return parsedValue;
};

const parseBestOf = (value, fallbackValue = 1) => {
  const parsedValue = Number.parseInt(value, 10);

  if ([1, 3, 5, 7].includes(parsedValue)) {
    return parsedValue;
  }

  return fallbackValue;
};

const shuffleArray = (items = []) => {
  const nextItems = [...items];

  for (let index = nextItems.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const temp = nextItems[index];
    nextItems[index] = nextItems[swapIndex];
    nextItems[swapIndex] = temp;
  }

  return nextItems;
};

const getMajorSequenceLabel = (index) => {
  let nextIndex = index;
  let label = '';

  do {
    label = String.fromCharCode(65 + (nextIndex % 26)) + label;
    nextIndex = Math.floor(nextIndex / 26) - 1;
  } while (nextIndex >= 0);

  return label;
};

const buildGroupName = (index) => `Group ${getMajorSequenceLabel(index)}`;

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const mapTournamentForDiscovery = (tournament, currentUserRegistrationStatus = null) => ({
  id: String(tournament._id),
  name: tournament.name,
  hostUserId: String(tournament.hostUserId),
  maxParticipants: tournament.maxParticipants,
  registrationMode: tournament.registrationMode,
  registrationStatus: tournament.registrationStatus,
  currentUserRegistrationStatus,
  location: {
    type: tournament.location?.type,
    coordinates: tournament.location?.coordinates,
    countryCode: tournament.location?.countryCode,
    provinceCode: tournament.location?.provinceCode,
    city: tournament.location?.city,
    formattedAddress: tournament.location?.formattedAddress,
  },
  status: tournament.status,
  startsAt: tournament.startsAt,
  createdAt: tournament.createdAt,
});

const mapHostTournamentDetail = (tournament, pendingParticipantsCount = 0) => ({
  id: String(tournament._id),
  name: tournament.name,
  hostUserId: String(tournament.hostUserId),
  maxParticipants: tournament.maxParticipants,
  approvedParticipantsCount: Number(tournament.approvedParticipantsCount || 0),
  pendingParticipantsCount,
  registrationMode: tournament.registrationMode,
  registrationStatus: tournament.registrationStatus,
  inviteCode:
    tournament.registrationMode === 'inviteOnly'
      ? String(tournament.inviteCode || '')
          .trim()
          .toUpperCase() || null
      : null,
  location: {
    type: tournament.location?.type,
    coordinates: tournament.location?.coordinates,
    countryCode: tournament.location?.countryCode,
    provinceCode: tournament.location?.provinceCode,
    city: tournament.location?.city,
    formattedAddress: tournament.location?.formattedAddress,
  },
  status: tournament.status,
  progressionState: tournament.progressionState || 'registration',
  scoreEditorUserIds: (tournament.scoreEditorUserIds || []).map((value) => String(value)),
  competitionConfig: {
    groupCount: tournament.competitionConfig?.groupCount || null,
    groupStageBestOf: tournament.competitionConfig?.groupStageBestOf || 1,
    finalStageEnabled: Boolean(tournament.competitionConfig?.finalStageEnabled),
    finalStageBestOf: tournament.competitionConfig?.finalStageBestOf || 3,
    finalStageTopPerGroup: tournament.competitionConfig?.finalStageTopPerGroup || 2,
  },
  createdAt: tournament.createdAt,
  updatedAt: tournament.updatedAt,
});

const buildDiscoverFilter = (query = {}) => {
  const filter = {};
  const searchTerm = String(query.q || query.search || '').trim();

  if (searchTerm.length > 0) {
    filter.name = { $regex: escapeRegex(searchTerm), $options: 'i' };
  }

  return filter;
};

const buildDiscoverSort = (sort) => {
  switch (sort) {
    case 'oldest':
      return { createdAt: 1 };
    case 'startsSoon':
      return { startsAt: 1, createdAt: -1 };
    case 'startsLatest':
      return { startsAt: -1, createdAt: -1 };
    case 'newest':
    default:
      return { createdAt: -1 };
  }
};

const listDiscoverTournaments = async (query = {}, userId) => {
  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, 20);
  const pageSize = Math.min(requestedPageSize, 50);
  const discoverFilter = buildDiscoverFilter(query);
  const discoverSort = buildDiscoverSort(query.sort);

  const [items, total] = await Promise.all([
    Tournament.find(discoverFilter)
      .sort(discoverSort)
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Tournament.countDocuments(discoverFilter),
  ]);

  const tournamentIds = items.map((item) => item._id);

  const existingRegistrations = userId && tournamentIds.length > 0
    ? await TournamentRegistration.find({
        tournamentId: {
          $in: tournamentIds,
        },
        userId,
      })
        .select({ tournamentId: 1, status: 1 })
        .lean()
    : [];

  const currentUserRegistrationByTournamentId = existingRegistrations.reduce((accumulator, registration) => {
    accumulator.set(String(registration.tournamentId), registration.status);
    return accumulator;
  }, new Map());

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    items: items.map((item) =>
      mapTournamentForDiscovery(
        item,
        currentUserRegistrationByTournamentId.get(String(item._id)) || null
      )
    ),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
};

const getHostTournamentDetail = async (tournamentId, hostUserId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);

  const pendingParticipantsCount = await TournamentRegistration.countDocuments({
    tournamentId,
    status: 'underReview',
  });

  return mapHostTournamentDetail(tournament, pendingParticipantsCount);
};

const validateInviteCodeForTournament = async (tournamentId, inviteCodeInput) => {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const isRegistrationOpen = tournament.registrationStatus === 'open';

  if (tournament.registrationMode !== 'inviteOnly') {
    return {
      tournamentId: String(tournament._id),
      registrationMode: tournament.registrationMode,
      registrationStatus: tournament.registrationStatus,
      valid: true,
      requestEnabled: isRegistrationOpen,
      reason: isRegistrationOpen ? 'PUBLIC_REGISTRATION_AVAILABLE' : 'REGISTRATION_CLOSED',
    };
  }

  const normalizedInputCode = String(inviteCodeInput || '')
    .trim()
    .toUpperCase();

  if (!normalizedInputCode) {
    throw new ApiError(400, 'INVITE_CODE_REQUIRED', 'Invite code is required for invite-only tournaments');
  }

  const valid = normalizedInputCode === String(tournament.inviteCode || '').trim().toUpperCase();

  return {
    tournamentId: String(tournament._id),
    registrationMode: tournament.registrationMode,
    registrationStatus: tournament.registrationStatus,
    valid,
    requestEnabled: isRegistrationOpen && valid,
    reason: valid
      ? isRegistrationOpen
        ? 'INVITE_CODE_VALID'
        : 'REGISTRATION_CLOSED'
      : 'INVITE_CODE_INVALID',
  };
};

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

  const normalizedInviteCode = String(payload?.inviteCode || '')
    .trim()
    .toUpperCase();

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

const assertHostAccess = async (tournamentId, hostUserId) => {
  if (!hostUserId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  if (String(tournament.hostUserId) !== String(hostUserId)) {
    throw new ApiError(403, 'FORBIDDEN', 'Only the tournament host can review registration requests');
  }

  return tournament;
};

const mapRegistrationSummary = (registration) => ({
  id: String(registration._id),
  tournamentId: String(registration.tournamentId),
  userId: String(registration.userId),
  status: registration.status,
  inviteCodeUsed: registration.inviteCodeUsed,
  reviewedByUserId: registration.reviewedByUserId ? String(registration.reviewedByUserId) : null,
  reviewedAt: registration.reviewedAt,
  createdAt: registration.createdAt,
  updatedAt: registration.updatedAt,
});

const mapUserSummary = (user) =>
  user
    ? {
        id: String(user._id),
        name: user.name,
        email: user.email,
      }
    : null;

const buildUserSummaryById = async (userIds = []) => {
  const normalizedUniqueUserIds = [...new Set(userIds.map((value) => String(value)).filter(Boolean))];

  if (normalizedUniqueUserIds.length === 0) {
    return new Map();
  }

  const users = await User.find({ _id: { $in: normalizedUniqueUserIds } })
    .select({ _id: 1, name: 1, email: 1 })
    .lean();

  return users.reduce((accumulator, user) => {
    accumulator.set(String(user._id), mapUserSummary(user));
    return accumulator;
  }, new Map());
};

const buildPlayerSummaryById = async (playerIds = []) => {
  const normalizedUniquePlayerIds = [...new Set(playerIds.map((value) => String(value)).filter(Boolean))];

  if (normalizedUniquePlayerIds.length === 0) {
    return new Map();
  }

  const players = await Player.find({ _id: { $in: normalizedUniquePlayerIds } })
    .select({ _id: 1, userId: 1, displayName: 1 })
    .lean();

  return players.reduce((accumulator, player) => {
    accumulator.set(String(player._id), {
      id: String(player._id),
      userId: player.userId ? String(player.userId) : null,
      displayName: player.displayName,
    });
    return accumulator;
  }, new Map());
};

const mapRegistrationSummaryWithUser = (registration, userSummaryById) => {
  const summary = mapRegistrationSummary(registration);

  return {
    ...summary,
    user: userSummaryById.get(summary.userId) || null,
  };
};

const ensureApprovedParticipantsCountInitialized = async (tournamentId) => {
  const approvedCount = await TournamentRegistration.countDocuments({
    tournamentId,
    status: 'approved',
  });

  await Tournament.updateOne(
    {
      _id: tournamentId,
      $or: [{ approvedParticipantsCount: { $exists: false } }, { approvedParticipantsCount: null }],
    },
    {
      $set: {
        approvedParticipantsCount: approvedCount,
      },
    }
  );
};

const reserveApprovalCapacitySlot = async (tournamentId) => {
  await ensureApprovedParticipantsCountInitialized(tournamentId);

  const reservedCapacity = await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
    },
    {
      $inc: {
        approvedParticipantsCount: 1,
      },
    },
    {
      new: false,
    }
  ).lean();

  if (!reservedCapacity) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }
};

const releaseApprovalCapacitySlot = async (tournamentId) => {
  await Tournament.updateOne(
    {
      _id: tournamentId,
      approvedParticipantsCount: { $gt: 0 },
    },
    {
      $inc: {
        approvedParticipantsCount: -1,
      },
    }
  );
};

const listPendingRegistrationRequests = async (tournamentId, hostUserId, query = {}) => {
  await assertHostAccess(tournamentId, hostUserId);

  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, 20);
  const pageSize = Math.min(requestedPageSize, 50);

  const findFilter = {
    tournamentId,
    status: 'underReview',
  };

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
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
};

const listHostRegistrations = async (tournamentId, hostUserId, query = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);

  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, 50);
  const pageSize = Math.min(requestedPageSize, 100);

  const findFilter = {
    tournamentId: tournament._id,
    status: {
      $in: ['underReview', 'approved'],
    },
  };

  const [items, total] = await Promise.all([
    TournamentRegistration.aggregate([
      {
        $match: findFilter,
      },
      {
        $addFields: {
          statusOrder: {
            $cond: [{ $eq: ['$status', 'underReview'] }, 0, 1],
          },
        },
      },
      {
        $sort: {
          statusOrder: 1,
          createdAt: -1,
          _id: -1,
        },
      },
      {
        $skip: (page - 1) * pageSize,
      },
      {
        $limit: pageSize,
      },
      {
        $project: {
          statusOrder: 0,
        },
      },
    ]),
    TournamentRegistration.countDocuments(findFilter),
  ]);

  const userSummaryById = await buildUserSummaryById(items.map((item) => item.userId));
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    items: items.map((item) => mapRegistrationSummaryWithUser(item, userSummaryById)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
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
    $or: [{ name: searchRegex }, { email: searchRegex }],
    _id: { $ne: tournament.hostUserId },
  })
    .sort({ name: 1, email: 1, _id: 1 })
    .limit(limit)
    .select({ _id: 1, name: 1, email: 1 })
    .lean();

  const userIds = matchingUsers.map((user) => user._id);

  const existingRegistrations = userIds.length
    ? await TournamentRegistration.find({
        tournamentId,
        userId: { $in: userIds },
      })
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

const rotateRoundRobinParticipants = (participants) => {
  if (!Array.isArray(participants) || participants.length <= 2) {
    return participants;
  }

  const fixedParticipant = participants[0];
  const rotatingParticipants = participants.slice(1);
  const movedParticipant = rotatingParticipants.pop();

  return [fixedParticipant, movedParticipant, ...rotatingParticipants];
};

const buildRoundRobinRounds = (participants = [], legs = 1) => {
  if (!Array.isArray(participants) || participants.length < 2) {
    return [];
  }

  const normalizedParticipants = [...participants];

  if (normalizedParticipants.length % 2 === 1) {
    normalizedParticipants.push(null);
  }

  const totalRounds = normalizedParticipants.length - 1;
  let rotatingState = normalizedParticipants;

  const baseRounds = [];

  for (let roundIndex = 0; roundIndex < totalRounds; roundIndex += 1) {
    const roundMatches = [];
    const halfSize = rotatingState.length / 2;

    for (let matchIndex = 0; matchIndex < halfSize; matchIndex += 1) {
      const playerA = rotatingState[matchIndex];
      const playerB = rotatingState[rotatingState.length - 1 - matchIndex];

      if (!playerA || !playerB) {
        continue;
      }

      roundMatches.push({
        matchNumber: matchIndex + 1,
        playerA,
        playerB,
      });
    }

    baseRounds.push({
      roundNumber: roundIndex + 1,
      matches: roundMatches,
    });

    rotatingState = rotateRoundRobinParticipants(rotatingState);
  }

  if (!Number.isInteger(legs) || legs < 1) {
    legs = 1;
  }

  if (legs === 1) {
    return baseRounds;
  }

  const rounds = [...baseRounds];

  for (let legIndex = 1; legIndex < legs; legIndex += 1) {
    baseRounds.forEach((round) => {
      rounds.push({
        roundNumber: rounds.length + 1,
        matches: round.matches.map((match) => ({
          matchNumber: match.matchNumber,
          playerA: match.playerB,
          playerB: match.playerA,
        })),
      });
    });
  }

  return rounds;
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
  const reviewUpdate = {
    status: nextStatus,
    reviewedByUserId: hostUserId,
    reviewedAt,
  };

  if (nextStatus === 'approved') {
    await reserveApprovalCapacitySlot(tournamentId);

    const approvedRegistration = await TournamentRegistration.findOneAndUpdate(
      {
        _id: registrationId,
        tournamentId,
        status: 'underReview',
      },
      {
        $set: reviewUpdate,
      },
      {
        new: true,
      }
    ).lean();

    if (!approvedRegistration) {
      await releaseApprovalCapacitySlot(tournamentId);

      throw new ApiError(
        409,
        'INVALID_REGISTRATION_TRANSITION',
        'Only underReview requests can be reviewed. The request may have already been processed.'
      );
    }

    const groupSync = await syncApprovedPlayerToGroups(tournamentId, approvedRegistration.userId);

    return {
      ...mapRegistrationSummary(approvedRegistration),
      groupSync,
    };
  }

  const reviewedRegistration = await TournamentRegistration.findOneAndUpdate(
    {
      _id: registrationId,
      tournamentId,
      status: 'underReview',
    },
    {
      $set: reviewUpdate,
    },
    {
      new: true,
    }
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

const manuallyAddParticipant = async (tournamentId, hostUserId, targetUserId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const normalizedTargetUserId = String(targetUserId || '').trim();

  if (!normalizedTargetUserId) {
    throw new ApiError(400, 'TARGET_USER_REQUIRED', 'Target userId is required for manual add');
  }

  if (String(tournament.hostUserId) === normalizedTargetUserId) {
    throw new ApiError(400, 'HOST_CANNOT_REGISTER', 'Host cannot be added as a participant');
  }

  const existingRegistration = await TournamentRegistration.findOne({
    tournamentId,
    userId: normalizedTargetUserId,
  }).lean();

  if (existingRegistration?.status === 'approved') {
    throw new ApiError(409, 'PARTICIPANT_ALREADY_APPROVED', 'Participant is already approved for this tournament');
  }

  await reserveApprovalCapacitySlot(tournamentId);

  const reviewedAt = new Date();

  try {
    if (existingRegistration) {
      const updatedRegistration = await TournamentRegistration.findOneAndUpdate(
        {
          _id: existingRegistration._id,
          tournamentId,
          status: { $ne: 'approved' },
        },
        {
          $set: {
            status: 'approved',
            reviewedByUserId: hostUserId,
            reviewedAt,
          },
        },
        {
          new: true,
        }
      ).lean();

      if (!updatedRegistration) {
        throw new ApiError(
          409,
          'PARTICIPANT_ALREADY_APPROVED',
          'Participant is already approved for this tournament'
        );
      }

      const groupSync = await syncApprovedPlayerToGroups(tournamentId, normalizedTargetUserId);

      return {
        ...mapRegistrationSummary(updatedRegistration),
        groupSync,
      };
    }

    const createdRegistration = await TournamentRegistration.create({
      tournamentId,
      userId: normalizedTargetUserId,
      status: 'approved',
      reviewedByUserId: hostUserId,
      reviewedAt,
    });

    const groupSync = await syncApprovedPlayerToGroups(tournamentId, normalizedTargetUserId);

    return {
      ...mapRegistrationSummary(createdRegistration.toObject()),
      groupSync,
    };
  } catch (error) {
    await releaseApprovalCapacitySlot(tournamentId);

    if (error?.code === 11000) {
      throw new ApiError(409, 'REGISTRATION_ALREADY_EXISTS', 'Registration already exists for this user');
    }

    throw error;
  }
};

const manuallyRemoveParticipant = async (tournamentId, hostUserId, targetUserId) => {
  await assertHostAccess(tournamentId, hostUserId);

  const normalizedTargetUserId = String(targetUserId || '').trim();

  if (!normalizedTargetUserId) {
    throw new ApiError(400, 'TARGET_USER_REQUIRED', 'Target userId is required for manual remove');
  }

  await ensureApprovedParticipantsCountInitialized(tournamentId);

  const reservedRemovalCapacity = await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      approvedParticipantsCount: { $gt: 0 },
    },
    {
      $inc: {
        approvedParticipantsCount: -1,
      },
    },
    {
      new: false,
    }
  ).lean();

  if (!reservedRemovalCapacity) {
    throw new ApiError(404, 'APPROVED_PARTICIPANT_NOT_FOUND', 'Approved participant not found for removal');
  }

  const reviewedAt = new Date();

  const removedRegistration = await TournamentRegistration.findOneAndUpdate(
    {
      tournamentId,
      userId: normalizedTargetUserId,
      status: 'approved',
    },
    {
      $set: {
        status: 'removed',
        reviewedByUserId: hostUserId,
        reviewedAt,
      },
    },
    {
      new: true,
    }
  ).lean();

  if (!removedRegistration) {
    await Tournament.updateOne(
      {
        _id: tournamentId,
      },
      {
        $inc: {
          approvedParticipantsCount: 1,
        },
      }
    );

    throw new ApiError(404, 'APPROVED_PARTICIPANT_NOT_FOUND', 'Approved participant not found for removal');
  }

  return mapRegistrationSummary(removedRegistration);
};

const approveRegistrationRequest = async (tournamentId, registrationId, hostUserId) =>
  reviewRegistrationRequest(tournamentId, registrationId, hostUserId, 'approved');

const rejectRegistrationRequest = async (tournamentId, registrationId, hostUserId) =>
  reviewRegistrationRequest(tournamentId, registrationId, hostUserId, 'rejected');

const mapScoreEditorResponse = (tournament) => ({
  tournamentId: String(tournament._id),
  hostUserId: String(tournament.hostUserId),
  scoreEditorUserIds: (tournament.scoreEditorUserIds || []).map((userId) => String(userId)),
});

const assignScoreEditor = async (tournamentId, hostUserId, editorUserId) => {
  const normalizedEditorUserId = String(editorUserId || '').trim();

  if (!normalizedEditorUserId) {
    throw new ApiError(400, 'SCORE_EDITOR_USER_REQUIRED', 'editorUserId is required');
  }

  const tournament = await assertHostAccess(tournamentId, hostUserId);

  if (String(tournament.hostUserId) === normalizedEditorUserId) {
    throw new ApiError(400, 'HOST_ALREADY_HAS_ACCESS', 'Host already has score edit access');
  }

  const currentEditors = (tournament.scoreEditorUserIds || []).map((value) => String(value));

  if (currentEditors.includes(normalizedEditorUserId)) {
    throw new ApiError(409, 'SCORE_EDITOR_ALREADY_ASSIGNED', 'User is already a score editor');
  }

  if (currentEditors.length >= 2) {
    throw new ApiError(409, 'SCORE_EDITOR_LIMIT_REACHED', 'A tournament can have at most 2 score editors');
  }

  const updatedTournament = await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      hostUserId,
      scoreEditorUserIds: { $ne: normalizedEditorUserId },
      $expr: {
        $lt: [{ $size: { $ifNull: ['$scoreEditorUserIds', []] } }, 2],
      },
    },
    {
      $addToSet: {
        scoreEditorUserIds: normalizedEditorUserId,
      },
    },
    {
      new: true,
    }
  ).lean();

  if (!updatedTournament) {
    throw new ApiError(
      409,
      'SCORE_EDITOR_ASSIGNMENT_CONFLICT',
      'Unable to assign score editor due to concurrent update or limit reached'
    );
  }

  return mapScoreEditorResponse(updatedTournament);
};

const removeScoreEditor = async (tournamentId, hostUserId, editorUserId) => {
  const normalizedEditorUserId = String(editorUserId || '').trim();

  if (!normalizedEditorUserId) {
    throw new ApiError(400, 'SCORE_EDITOR_USER_REQUIRED', 'editorUserId is required');
  }

  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const currentEditors = (tournament.scoreEditorUserIds || []).map((value) => String(value));

  if (!currentEditors.includes(normalizedEditorUserId)) {
    throw new ApiError(404, 'SCORE_EDITOR_NOT_FOUND', 'User is not assigned as a score editor');
  }

  const updatedTournament = await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      hostUserId,
    },
    {
      $pull: {
        scoreEditorUserIds: normalizedEditorUserId,
      },
    },
    {
      new: true,
    }
  ).lean();

  if (!updatedTournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  return mapScoreEditorResponse(updatedTournament);
};

const canUserEditTournamentScores = async (tournamentId, userId) => {
  if (!userId) {
    return false;
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const normalizedUserId = String(userId);
  const isHost = String(tournament.hostUserId) === normalizedUserId;
  const isAssignedEditor = (tournament.scoreEditorUserIds || []).some(
    (editorUserId) => String(editorUserId) === normalizedUserId
  );

  return isHost || isAssignedEditor;
};

const assertCanEditTournamentScores = async (tournamentId, userId) => {
  if (!userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const allowed = await canUserEditTournamentScores(tournamentId, userId);

  if (!allowed) {
    throw new ApiError(403, 'FORBIDDEN_SCORE_EDIT', 'Only host or assigned score editors can edit scores');
  }
};

const mapGameForScoresheet = (game, playerSummaryById = new Map(), divisionNameById = new Map()) => ({
  id: String(game._id),
  tournamentId: String(game.tournamentId),
  divisionId: game.divisionId ? String(game.divisionId) : null,
  divisionName: game.divisionId ? divisionNameById.get(String(game.divisionId)) || null : null,
  stage: game.stage || 'groupStage',
  roundNumber: Number(game.roundNumber || 1),
  bestOf: parseBestOf(game.bestOf, 1),
  playerAId: String(game.playerAId),
  playerBId: String(game.playerBId),
  playerA: playerSummaryById.get(String(game.playerAId)) || null,
  playerB: playerSummaryById.get(String(game.playerBId)) || null,
  playerASeriesWins: Number(game.playerASeriesWins || 0),
  playerBSeriesWins: Number(game.playerBSeriesWins || 0),
  winnerPlayerId: game.winnerPlayerId ? String(game.winnerPlayerId) : null,
  status: game.status,
  scoreEntries: (game.scoreEntries || []).map((entry) => ({
    gameNumber: entry.gameNumber,
    playerAScore: entry.playerAScore,
    playerBScore: entry.playerBScore,
  })),
  updatedAt: game.updatedAt,
});

const normalizeDivisionScopeValue = (divisionId) => {
  if (divisionId === undefined || divisionId === null || divisionId === '') {
    return null;
  }

  return String(divisionId);
};

const buildScopeFilter = (tournamentId, divisionId) => ({
  tournamentId,
  divisionId: normalizeDivisionScopeValue(divisionId),
});

const normalizeScoreEntries = (scoreEntries) => {
  if (!Array.isArray(scoreEntries) || scoreEntries.length === 0) {
    throw new ApiError(400, 'INVALID_SCORE_ENTRIES', 'scoreEntries must be a non-empty array');
  }

  const normalizedEntries = scoreEntries.map((entry, index) => {
    const gameNumber = Number(entry?.gameNumber);
    const playerAScore = Number(entry?.playerAScore);
    const playerBScore = Number(entry?.playerBScore);

    if (!Number.isInteger(gameNumber) || gameNumber < 1) {
      throw new ApiError(400, 'INVALID_GAME_NUMBER', `scoreEntries[${index}].gameNumber must be an integer >= 1`);
    }

    if (!Number.isFinite(playerAScore) || playerAScore < 0) {
      throw new ApiError(400, 'INVALID_PLAYER_A_SCORE', `scoreEntries[${index}].playerAScore must be >= 0`);
    }

    if (!Number.isFinite(playerBScore) || playerBScore < 0) {
      throw new ApiError(400, 'INVALID_PLAYER_B_SCORE', `scoreEntries[${index}].playerBScore must be >= 0`);
    }

    return {
      gameNumber,
      playerAScore,
      playerBScore,
    };
  });

  const uniqueGameNumbers = new Set(normalizedEntries.map((entry) => entry.gameNumber));

  if (uniqueGameNumbers.size !== normalizedEntries.length) {
    throw new ApiError(400, 'DUPLICATE_GAME_NUMBER', 'scoreEntries must not contain duplicate gameNumber values');
  }

  return normalizedEntries.sort((a, b) => a.gameNumber - b.gameNumber);
};

const computeSeriesOutcome = (game, scoreEntries = []) => {
  const bestOf = parseBestOf(game?.bestOf, 1);
  const winsRequired = Math.floor(bestOf / 2) + 1;

  let playerASeriesWins = 0;
  let playerBSeriesWins = 0;

  let scoreForA = 0;
  let scoreForB = 0;

  scoreEntries.forEach((entry) => {
    const playerAScore = Number(entry?.playerAScore || 0);
    const playerBScore = Number(entry?.playerBScore || 0);

    scoreForA += playerAScore;
    scoreForB += playerBScore;

    if (playerAScore > playerBScore) {
      playerASeriesWins += 1;
      return;
    }

    if (playerBScore > playerAScore) {
      playerBSeriesWins += 1;
    }
  });

  const winnerPlayerId =
    playerASeriesWins >= winsRequired
      ? game.playerAId
      : playerBSeriesWins >= winsRequired
        ? game.playerBId
        : null;

  return {
    bestOf,
    winsRequired,
    playerASeriesWins,
    playerBSeriesWins,
    winnerPlayerId,
    scoreForA,
    scoreForB,
  };
};

const listTournamentScoresheet = async (tournamentId, userId, query = {}) => {
  if (!userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const canEdit = await canUserEditTournamentScores(tournamentId, userId);

  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, 25);
  const pageSize = Math.min(requestedPageSize, 100);
  const stage = query.stage === 'finalStage' ? 'finalStage' : query.stage === 'groupStage' ? 'groupStage' : null;
  const status = ['scheduled', 'inProgress', 'completed'].includes(query.status) ? query.status : null;
  const divisionId = normalizeDivisionScopeValue(query.divisionId);
  const normalizedPlayerQuery = String(query.playerQuery || '').trim();
  const normalizedPlayerTwoQuery = String(query.player2Query || '').trim();

  const resolveTournamentPlayerIdsByQuery = async (searchQuery) => {
    const normalizedSearchQuery = String(searchQuery || '').trim();

    if (!normalizedSearchQuery) {
      return null;
    }

    const searchRegex = new RegExp(escapeRegex(normalizedSearchQuery), 'i');

    const users = await User.find({
      $or: [{ name: searchRegex }, { email: searchRegex }],
    })
      .select({ _id: 1 })
      .lean();

    const matchingUserIds = users.map((user) => user._id);

    const playerFilter = {
      tournamentId,
      status: 'active',
      $or: [{ displayName: searchRegex }],
    };

    if (matchingUserIds.length > 0) {
      playerFilter.$or.push({ userId: { $in: matchingUserIds } });
    }

    const players = await Player.find(playerFilter)
      .select({ _id: 1 })
      .lean();

    return players.map((player) => player._id);
  };

  const findFilter = {
    tournamentId,
  };

  if (stage) {
    findFilter.stage = stage;
  }

  if (status) {
    findFilter.status = status;
  }

  if (query.divisionId !== undefined) {
    findFilter.divisionId = divisionId;
  }

  if (normalizedPlayerQuery || normalizedPlayerTwoQuery) {
    const [playerIds, playerTwoIds] = await Promise.all([
      resolveTournamentPlayerIdsByQuery(normalizedPlayerQuery),
      resolveTournamentPlayerIdsByQuery(normalizedPlayerTwoQuery),
    ]);

    if (normalizedPlayerQuery && (!playerIds || playerIds.length === 0)) {
      findFilter._id = { $in: [] };
    }

    if (normalizedPlayerTwoQuery && (!playerTwoIds || playerTwoIds.length === 0)) {
      findFilter._id = { $in: [] };
    }

    if (!findFilter._id) {
      if (normalizedPlayerQuery && normalizedPlayerTwoQuery) {
        findFilter.$or = [
          {
            playerAId: { $in: playerIds },
            playerBId: { $in: playerTwoIds },
          },
          {
            playerAId: { $in: playerTwoIds },
            playerBId: { $in: playerIds },
          },
        ];
      } else if (normalizedPlayerQuery) {
        findFilter.$or = [{ playerAId: { $in: playerIds } }, { playerBId: { $in: playerIds } }];
      } else if (normalizedPlayerTwoQuery) {
        findFilter.$or = [{ playerAId: { $in: playerTwoIds } }, { playerBId: { $in: playerTwoIds } }];
      }
    }
  }

  const [games, total, divisions] = await Promise.all([
    Game.find(findFilter)
      .sort({ stage: 1, roundNumber: 1, createdAt: 1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    Game.countDocuments(findFilter),
    Division.find({ tournamentId })
      .select({ _id: 1, name: 1 })
      .lean(),
  ]);

  const divisionNameById = new Map(
    divisions.map((division) => [String(division._id), division.name])
  );

  const playerSummaryById = await buildPlayerSummaryById(
    games.flatMap((game) => [game.playerAId, game.playerBId])
  );

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  return {
    tournamentId: String(tournamentId),
    canEdit,
    items: games.map((game) => mapGameForScoresheet(game, playerSummaryById, divisionNameById)),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
};

const recomputeLeaderboardForScope = async (tournamentId, divisionId) => {
  const scopeFilter = buildScopeFilter(tournamentId, divisionId);

  const completedGames = await Game.find({
    ...scopeFilter,
    status: 'completed',
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const statsByPlayerId = new Map();
  const headToHeadPoints = new Map();

  const getPairKey = (playerAId, playerBId) => {
    const left = String(playerAId);
    const right = String(playerBId);

    return left < right ? `${left}::${right}` : `${right}::${left}`;
  };

  const recordHeadToHeadPoints = (playerAId, playerBId, playerAPoints, playerBPoints) => {
    const pairKey = getPairKey(playerAId, playerBId);

    if (!headToHeadPoints.has(pairKey)) {
      headToHeadPoints.set(pairKey, new Map());
    }

    const pairMap = headToHeadPoints.get(pairKey);
    const normalizedPlayerAId = String(playerAId);
    const normalizedPlayerBId = String(playerBId);

    pairMap.set(normalizedPlayerAId, Number(pairMap.get(normalizedPlayerAId) || 0) + playerAPoints);
    pairMap.set(normalizedPlayerBId, Number(pairMap.get(normalizedPlayerBId) || 0) + playerBPoints);
  };

  const ensurePlayerStats = (playerId) => {
    const normalizedPlayerId = String(playerId);

    if (!statsByPlayerId.has(normalizedPlayerId)) {
      statsByPlayerId.set(normalizedPlayerId, {
        playerId: normalizedPlayerId,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifferential: 0,
      });
    }

    return statsByPlayerId.get(normalizedPlayerId);
  };

  completedGames.forEach((game) => {
    const scoreEntries = Array.isArray(game.scoreEntries) ? game.scoreEntries : [];

    if (scoreEntries.length === 0) {
      return;
    }

    const seriesOutcome = computeSeriesOutcome(game, scoreEntries);
    const totals = {
      playerA: seriesOutcome.scoreForA,
      playerB: seriesOutcome.scoreForB,
    };

    const playerAStats = ensurePlayerStats(game.playerAId);
    const playerBStats = ensurePlayerStats(game.playerBId);

    playerAStats.scoreFor += totals.playerA;
    playerAStats.scoreAgainst += totals.playerB;
    playerAStats.scoreDifferential = playerAStats.scoreFor - playerAStats.scoreAgainst;

    playerBStats.scoreFor += totals.playerB;
    playerBStats.scoreAgainst += totals.playerA;
    playerBStats.scoreDifferential = playerBStats.scoreFor - playerBStats.scoreAgainst;

    if (seriesOutcome.playerASeriesWins > seriesOutcome.playerBSeriesWins) {
      playerAStats.wins += 1;
      playerAStats.points += 2;
      playerBStats.losses += 1;
      recordHeadToHeadPoints(game.playerAId, game.playerBId, 2, 0);
      return;
    }

    if (seriesOutcome.playerBSeriesWins > seriesOutcome.playerASeriesWins) {
      playerBStats.wins += 1;
      playerBStats.points += 2;
      playerAStats.losses += 1;
      recordHeadToHeadPoints(game.playerAId, game.playerBId, 0, 2);
      return;
    }

    playerAStats.draws += 1;
    playerBStats.draws += 1;
    playerAStats.points += 1;
    playerBStats.points += 1;
    recordHeadToHeadPoints(game.playerAId, game.playerBId, 1, 1);
  });

  const compareHeadToHead = (left, right) => {
    const pairKey = getPairKey(left.playerId, right.playerId);
    const pairMap = headToHeadPoints.get(pairKey);

    if (!pairMap) {
      return 0;
    }

    const leftPoints = Number(pairMap.get(left.playerId) || 0);
    const rightPoints = Number(pairMap.get(right.playerId) || 0);

    if (leftPoints === rightPoints) {
      return 0;
    }

    return rightPoints - leftPoints;
  };

  const orderedEntries = [...statsByPlayerId.values()].sort((left, right) => {
    if (right.points !== left.points) {
      return right.points - left.points;
    }

    const headToHeadComparison = compareHeadToHead(left, right);

    if (headToHeadComparison !== 0) {
      return headToHeadComparison;
    }

    if (right.scoreDifferential !== left.scoreDifferential) {
      return right.scoreDifferential - left.scoreDifferential;
    }

    if (right.scoreFor !== left.scoreFor) {
      return right.scoreFor - left.scoreFor;
    }

    if (right.wins !== left.wins) {
      return right.wins - left.wins;
    }

    if (left.losses !== right.losses) {
      return left.losses - right.losses;
    }

    return left.playerId.localeCompare(right.playerId);
  });

  await Leaderboard.deleteMany(scopeFilter);

  if (orderedEntries.length > 0) {
    await Leaderboard.insertMany(
      orderedEntries.map((entry, index) => ({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        playerId: entry.playerId,
        rank: index + 1,
        points: entry.points,
        wins: entry.wins,
        draws: entry.draws,
        losses: entry.losses,
        scoreFor: entry.scoreFor,
        scoreAgainst: entry.scoreAgainst,
        scoreDifferential: entry.scoreDifferential,
      }))
    );
  }

  const refreshedEntries = await Leaderboard.find(scopeFilter).sort({ rank: 1, playerId: 1 }).lean();

  return {
    tournamentId: String(tournamentId),
    divisionId: normalizeDivisionScopeValue(divisionId),
    items: refreshedEntries.map((entry) => ({
      id: String(entry._id),
      playerId: String(entry.playerId),
      rank: entry.rank,
      points: entry.points,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
      scoreDifferential: entry.scoreDifferential,
    })),
  };
};

const listTournamentLeaderboard = async (tournamentId, divisionId) => {
  const scopeFilter = buildScopeFilter(tournamentId, divisionId);

  const entries = await Leaderboard.find(scopeFilter).sort({ rank: 1, playerId: 1 }).lean();
  const playerSummaryById = await buildPlayerSummaryById(entries.map((entry) => entry.playerId));

  return {
    tournamentId: String(tournamentId),
    divisionId: normalizeDivisionScopeValue(divisionId),
    items: entries.map((entry) => ({
      id: String(entry._id),
      playerId: String(entry.playerId),
      player: playerSummaryById.get(String(entry.playerId)) || null,
      rank: entry.rank,
      points: entry.points,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
      scoreDifferential: entry.scoreDifferential,
    })),
  };
};

const updateGameScores = async (tournamentId, gameId, userId, payload = {}) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  const existingGame = await Game.findOne({
    _id: gameId,
    tournamentId,
  }).lean();

  if (!existingGame) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found for this tournament');
  }

  let effectiveBestOf = parseBestOf(existingGame.bestOf, 1);

  if (existingGame.stage === 'groupStage') {
    const tournament = await Tournament.findById(tournamentId)
      .select({ competitionConfig: 1 })
      .lean();

    if (!tournament) {
      throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
    }

    const configuredGroupStageBestOf = parseBestOf(tournament.competitionConfig?.groupStageBestOf, effectiveBestOf);
    effectiveBestOf = Math.max(effectiveBestOf, configuredGroupStageBestOf);
  }

  if (payload.bestOf !== undefined) {
    effectiveBestOf = Math.max(effectiveBestOf, parseBestOf(payload.bestOf, effectiveBestOf));
  }

  const normalizedScoreEntries = normalizeScoreEntries(payload.scoreEntries);
  effectiveBestOf = Math.max(effectiveBestOf, normalizedScoreEntries.length);
  const seriesOutcome = computeSeriesOutcome(
    {
      ...existingGame,
      bestOf: effectiveBestOf,
    },
    normalizedScoreEntries
  );
  const isSeriesComplete = Boolean(seriesOutcome.winnerPlayerId);
  const nextStatus =
    payload.status === 'scheduled'
      ? 'scheduled'
      : payload.status === 'completed' || isSeriesComplete
        ? 'completed'
        : 'inProgress';

  const updatedGame = await Game.findOneAndUpdate(
    {
      _id: gameId,
      tournamentId,
    },
    {
      $set: {
        bestOf: effectiveBestOf,
        scoreEntries: normalizedScoreEntries,
        status: nextStatus,
        playerASeriesWins: seriesOutcome.playerASeriesWins,
        playerBSeriesWins: seriesOutcome.playerBSeriesWins,
        winnerPlayerId: seriesOutcome.winnerPlayerId,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  ).lean();

  await recomputeLeaderboardForScope(tournamentId, updatedGame.divisionId);

  const playerSummaryById = await buildPlayerSummaryById([updatedGame.playerAId, updatedGame.playerBId]);

  return mapGameForScoresheet(updatedGame, playerSummaryById);
};

const upsertAndScoreGroupStageGame = async (tournamentId, userId, payload = {}) => {
  await assertCanEditTournamentScores(tournamentId, userId);

  const tournament = await Tournament.findById(tournamentId)
    .select({ competitionConfig: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const roundNumber = parsePositiveInteger(payload.roundNumber, 0);
  if (roundNumber < 1) {
    throw new ApiError(400, 'INVALID_ROUND_NUMBER', 'roundNumber must be an integer >= 1');
  }

  const playerAUserId = String(payload.playerAUserId || '').trim();
  const playerBUserId = String(payload.playerBUserId || '').trim();
  const playerAIdInput = String(payload.playerAId || '').trim();
  const playerBIdInput = String(payload.playerBId || '').trim();

  if ((!playerAUserId && !playerAIdInput) || (!playerBUserId && !playerBIdInput)) {
    throw new ApiError(
      400,
      'PLAYER_IDS_REQUIRED',
      'Provide playerA/playerB identifiers using userId or playerId'
    );
  }

  if (
    (playerAUserId && playerBUserId && playerAUserId === playerBUserId) ||
    (playerAIdInput && playerBIdInput && playerAIdInput === playerBIdInput)
  ) {
    throw new ApiError(400, 'INVALID_MATCHUP', 'A match requires two different players');
  }

  const playerLookupFilter = {
    tournamentId,
    status: 'active',
    $or: [],
  };

  if (playerAUserId || playerBUserId) {
    const userIds = [playerAUserId, playerBUserId].filter(Boolean);
    playerLookupFilter.$or.push({ userId: { $in: userIds } });
  }

  if (playerAIdInput || playerBIdInput) {
    const playerIds = [playerAIdInput, playerBIdInput].filter(Boolean);
    playerLookupFilter.$or.push({ _id: { $in: playerIds } });
  }

  const tournamentPlayers = await Player.find(playerLookupFilter)
    .select({ _id: 1, userId: 1 })
    .lean();

  const playerByUserId = new Map();
  const playerByPlayerId = new Map();
  tournamentPlayers.forEach((player) => {
    const normalizedPlayerId = String(player._id);
    playerByPlayerId.set(normalizedPlayerId, player);

    if (player.userId) {
      playerByUserId.set(String(player.userId), player);
    }
  });

  const playerA = playerByUserId.get(playerAUserId) || playerByPlayerId.get(playerAIdInput);
  const playerB = playerByUserId.get(playerBUserId) || playerByPlayerId.get(playerBIdInput);

  if (!playerA || !playerB) {
    throw new ApiError(
      409,
      'MATCH_PLAYERS_NOT_AVAILABLE',
      'Both players must be active tournament participants before scoring this match'
    );
  }

  const playerAId = String(playerA._id);
  const playerBId = String(playerB._id);

  let game = await Game.findOne({
    tournamentId,
    stage: 'groupStage',
    roundNumber,
    $or: [
      { playerAId, playerBId },
      { playerAId: playerBId, playerBId: playerAId },
    ],
  }).lean();

  const normalizedScoreEntries = normalizeScoreEntries(payload.scoreEntries);

  if (!game) {
    const division = await Division.findOne({
      tournamentId,
      playerIds: { $all: [playerAId, playerBId] },
    })
      .select({ _id: 1 })
      .lean();

    const configuredGroupStageBestOf = parseBestOf(tournament.competitionConfig?.groupStageBestOf, 1);
    const bestOf = parseBestOf(payload.bestOf, configuredGroupStageBestOf);
    const seriesOutcome = computeSeriesOutcome(
      {
        bestOf,
        playerAId,
        playerBId,
      },
      normalizedScoreEntries
    );
    const isSeriesComplete = Boolean(seriesOutcome.winnerPlayerId);
    const nextStatus =
      payload.status === 'scheduled'
        ? 'scheduled'
        : payload.status === 'completed' || isSeriesComplete
          ? 'completed'
          : 'inProgress';

    const createdGame = await Game.create({
      tournamentId,
      divisionId: normalizeDivisionScopeValue(division?._id),
      stage: 'groupStage',
      roundNumber,
      bestOf,
      playerAId,
      playerBId,
      scoreEntries: normalizedScoreEntries,
      playerASeriesWins: seriesOutcome.playerASeriesWins,
      playerBSeriesWins: seriesOutcome.playerBSeriesWins,
      winnerPlayerId: seriesOutcome.winnerPlayerId,
      status: nextStatus,
    });

    game = createdGame.toObject();
  } else {
    const seriesOutcome = computeSeriesOutcome(game, normalizedScoreEntries);
    const isSeriesComplete = Boolean(seriesOutcome.winnerPlayerId);
    const nextStatus =
      payload.status === 'scheduled'
        ? 'scheduled'
        : payload.status === 'completed' || isSeriesComplete
          ? 'completed'
          : 'inProgress';

    game = await Game.findOneAndUpdate(
      {
        _id: game._id,
        tournamentId,
      },
      {
        $set: {
          scoreEntries: normalizedScoreEntries,
          status: nextStatus,
          playerASeriesWins: seriesOutcome.playerASeriesWins,
          playerBSeriesWins: seriesOutcome.playerBSeriesWins,
          winnerPlayerId: seriesOutcome.winnerPlayerId,
        },
      },
      {
        new: true,
        runValidators: true,
      }
    ).lean();
  }

  await recomputeLeaderboardForScope(tournamentId, game.divisionId);
  const playerSummaryById = await buildPlayerSummaryById([game.playerAId, game.playerBId]);

  return mapGameForScoresheet(game, playerSummaryById);
};

const pickDivisionForNewPlayer = (inputDivisions = []) => {
  const divisions = inputDivisions.filter((division) => String(division.name || '') !== 'Final Stage');

  if (divisions.length === 0) {
    return null;
  }

  const minCount = Math.min(...divisions.map((division) => (division.playerIds || []).length));
  const candidates = divisions.filter((division) => (division.playerIds || []).length === minCount);

  return shuffleArray(candidates)[0] || null;
};

const countPairGames = (games, playerAId, playerBId) => {
  const normalizedPair = [String(playerAId), String(playerBId)].sort().join(':');

  return games.filter((game) => {
    const pair = [String(game.playerAId), String(game.playerBId)].sort().join(':');
    return pair === normalizedPair;
  }).length;
};

const createIncrementalGroupStageGamesForPlayer = async ({
  tournamentId,
  divisionId,
  newPlayerId,
  opponentIds,
  bestOf,
  existingGames,
}) => {
  const groupStageLegs = 2;
  let maxRoundNumber = existingGames.reduce(
    (max, game) => Math.max(max, Number(game.roundNumber || 0)),
    0
  );
  const gameDocuments = [];

  opponentIds.forEach((opponentId) => {
    let playedLegs = countPairGames(existingGames, newPlayerId, opponentId);

    while (playedLegs < groupStageLegs) {
      maxRoundNumber += 1;
      const swapSides = playedLegs === 1;

      gameDocuments.push({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        stage: 'groupStage',
        roundNumber: maxRoundNumber,
        bestOf: parseBestOf(bestOf, 1),
        playerAId: swapSides ? opponentId : newPlayerId,
        playerBId: swapSides ? newPlayerId : opponentId,
        scoreEntries: [],
        playerASeriesWins: 0,
        playerBSeriesWins: 0,
        winnerPlayerId: null,
        status: 'scheduled',
      });

      playedLegs += 1;
    }
  });

  if (gameDocuments.length === 0) {
    return [];
  }

  return Game.insertMany(gameDocuments);
};

const syncApprovedPlayerToGroups = async (tournamentId, userId) => {
  const divisions = await Division.find({
    tournamentId,
    name: { $ne: 'Final Stage' },
  })
    .sort({ name: 1, _id: 1 })
    .lean();

  if (divisions.length === 0) {
    return null;
  }

  const players = await ensurePlayersFromApprovedRegistrations(tournamentId);
  const normalizedUserId = String(userId || '').trim();
  const player = players.find((entry) => String(entry.userId) === normalizedUserId);

  if (!player) {
    return null;
  }

  const playerId = String(player.id);
  const existingAssignment = divisions.find((division) =>
    (division.playerIds || []).map((value) => String(value)).includes(playerId)
  );

  if (existingAssignment) {
    return {
      alreadyAssigned: true,
      divisionId: String(existingAssignment._id),
      divisionName: existingAssignment.name,
      gamesCreated: 0,
    };
  }

  const targetDivision = pickDivisionForNewPlayer(divisions);

  if (!targetDivision) {
    return null;
  }

  const opponentIds = (targetDivision.playerIds || []).map((value) => String(value)).filter((value) => value !== playerId);

  await Division.updateOne(
    {
      _id: targetDivision._id,
    },
    {
      $addToSet: {
        playerIds: playerId,
      },
    }
  );

  const existingGames = await Game.find({
    tournamentId,
    divisionId: targetDivision._id,
    stage: 'groupStage',
  }).lean();

  const tournament = await Tournament.findById(tournamentId).lean();
  const bestOf = parseBestOf(tournament?.competitionConfig?.groupStageBestOf, 1);
  const createdGames = await createIncrementalGroupStageGamesForPlayer({
    tournamentId,
    divisionId: String(targetDivision._id),
    newPlayerId: playerId,
    opponentIds,
    bestOf,
    existingGames,
  });

  if (createdGames.length > 0) {
    await recomputeLeaderboardForScope(tournamentId, targetDivision._id);
  }

  return {
    divisionId: String(targetDivision._id),
    divisionName: targetDivision.name,
    gamesCreated: createdGames.length,
    alreadyAssigned: false,
  };
};

const updateHostTournamentSettings = async (tournamentId, hostUserId, payload = {}) => {
  await assertHostAccess(tournamentId, hostUserId);

  const updates = {};

  if (payload.maxParticipants !== undefined) {
    const maxParticipants = parsePositiveInteger(payload.maxParticipants, null);

    if (!maxParticipants || maxParticipants < 1) {
      throw new ApiError(400, 'INVALID_MAX_PARTICIPANTS', 'maxParticipants must be at least 1');
    }

    updates.maxParticipants = maxParticipants;
  }

  if (Object.keys(updates).length === 0) {
    throw new ApiError(400, 'NO_SETTINGS_TO_UPDATE', 'No supported settings were provided');
  }

  const updatedTournament = await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      hostUserId,
    },
    {
      $set: updates,
    },
    {
      new: true,
    }
  ).lean();

  if (!updatedTournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const pendingParticipantsCount = await TournamentRegistration.countDocuments({
    tournamentId,
    status: 'underReview',
  });

  return mapHostTournamentDetail(updatedTournament, pendingParticipantsCount);
};

const closeTournamentRegistration = async (tournamentId, hostUserId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);

  const approvedCount = await TournamentRegistration.countDocuments({
    tournamentId,
    status: 'approved',
  });

  if (approvedCount < 2) {
    throw new ApiError(
      409,
      'INSUFFICIENT_APPROVED_PARTICIPANTS',
      'At least 2 approved players are required before closing registration'
    );
  }

  if (tournament.registrationStatus === 'closed') {
    return mapHostTournamentDetail(tournament, await TournamentRegistration.countDocuments({
      tournamentId,
      status: 'underReview',
    }));
  }

  const updatedTournament = await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      hostUserId,
      registrationStatus: 'open',
    },
    {
      $set: {
        registrationStatus: 'closed',
        progressionState: 'groupSetup',
      },
    },
    {
      new: true,
    }
  ).lean();

  if (!updatedTournament) {
    throw new ApiError(409, 'REGISTRATION_ALREADY_CLOSED', 'Registration is already closed');
  }

  const pendingParticipantsCount = await TournamentRegistration.countDocuments({
    tournamentId,
    status: 'underReview',
  });

  return mapHostTournamentDetail(updatedTournament, pendingParticipantsCount);
};

const ensurePlayersFromApprovedRegistrations = async (tournamentId) => {
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
      'At least 2 approved participants are required'
    );
  }

  const usersById = await buildUserSummaryById(approvedRegistrations.map((registration) => registration.userId));
  const existingPlayers = await Player.find({
    tournamentId,
    status: 'active',
    userId: {
      $in: approvedRegistrations.map((registration) => registration.userId),
    },
  })
    .select({ _id: 1, userId: 1, displayName: 1 })
    .lean();

  const playerByUserId = existingPlayers.reduce((accumulator, player) => {
    accumulator.set(String(player.userId), player);
    return accumulator;
  }, new Map());

  const players = [];

  for (const registration of approvedRegistrations) {
    const normalizedUserId = String(registration.userId);
    const existingPlayer = playerByUserId.get(normalizedUserId);

    if (existingPlayer) {
      players.push(existingPlayer);
      continue;
    }

    const user = usersById.get(normalizedUserId);
    const createdPlayer = await Player.create({
      tournamentId,
      userId: registration.userId,
      displayName: user?.name || user?.email || `Player ${normalizedUserId.slice(-6)}`,
      handicapEnabled: false,
      handicapValue: 0,
      status: 'active',
    });

    players.push(createdPlayer.toObject());
  }

  return players.map((player) => ({
    id: String(player._id),
    userId: player.userId ? String(player.userId) : null,
    displayName: player.displayName,
  }));
};

const createRoundRobinGamesForStage = async ({ tournamentId, divisionId, stage, playerIds, bestOf }) => {
  const participantIds = [...playerIds];

  if (participantIds.length < 2) {
    return [];
  }

  const rounds = buildRoundRobinRounds(
    participantIds.map((playerId) => ({ id: playerId })),
    stage === 'groupStage' ? 2 : 1
  );

  const gameDocuments = [];

  rounds.forEach((round) => {
    round.matches.forEach((match) => {
      gameDocuments.push({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        stage,
        roundNumber: round.roundNumber,
        bestOf: parseBestOf(bestOf, 1),
        playerAId: match.playerA.id,
        playerBId: match.playerB.id,
        scoreEntries: [],
        playerASeriesWins: 0,
        playerBSeriesWins: 0,
        winnerPlayerId: null,
        status: 'scheduled',
      });
    });
  });

  if (gameDocuments.length === 0) {
    return [];
  }

  const createdGames = await Game.insertMany(gameDocuments);

  const playerSummaryById = await buildPlayerSummaryById(
    createdGames.flatMap((game) => [game.playerAId, game.playerBId])
  );

  return createdGames.map((game) => mapGameForScoresheet(game.toObject(), playerSummaryById));
};

const buildGroupStandingsList = async (tournamentId, query = {}) => {
  const defaultTopPerGroup = Math.min(parsePositiveInteger(query.topPerGroup, 2), 8);
  const divisions = await Division.find({
    tournamentId,
    name: { $ne: 'Final Stage' },
  })
    .sort({ name: 1, _id: 1 })
    .lean();

  const groups = [];

  for (const division of divisions) {
    const standings = await listTournamentLeaderboard(tournamentId, division._id);
    const divisionPlayerIds = (division.playerIds || []).map((value) => String(value));
    const divisionPlayerSummaryById = await buildPlayerSummaryById(divisionPlayerIds);
    const standingByPlayerId = new Map(
      (standings.items || []).map((entry) => [String(entry.playerId), entry])
    );
    const rankedStandings = (standings.items || []).filter((entry) =>
      divisionPlayerIds.includes(String(entry.playerId))
    );
    const rankedPlayerIdSet = new Set(rankedStandings.map((entry) => String(entry.playerId)));
    const unrankedPlayerIds = divisionPlayerIds.filter((playerId) => !rankedPlayerIdSet.has(playerId));

    const mergedStandings = [
      ...rankedStandings,
      ...unrankedPlayerIds.map((playerId, index) => ({
        id: `group-${String(division._id)}-${playerId}`,
        playerId,
        player: divisionPlayerSummaryById.get(playerId) || null,
        rank: Number(rankedStandings.length + index + 1),
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifferential: 0,
      })),
    ];

    groups.push({
      divisionId: String(division._id),
      divisionName: division.name,
      suggestedFinalists: mergedStandings.slice(0, defaultTopPerGroup).map((entry) => entry.playerId),
      standings: mergedStandings,
    });
  }

  return {
    tournamentId: String(tournamentId),
    topPerGroup: defaultTopPerGroup,
    groups,
  };
};

const listGroupStandings = async (tournamentId, userId, query = {}) => {
  if (!userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  return buildGroupStandingsList(tournamentId, query);
};

const listGroupStandingsForHost = async (tournamentId, hostUserId, query = {}) => {
  await assertHostAccess(tournamentId, hostUserId);
  return buildGroupStandingsList(tournamentId, query);
};

const assignRandomGroups = async (tournamentId, hostUserId, payload = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);

  if (tournament.registrationStatus !== 'closed') {
    throw new ApiError(409, 'REGISTRATION_MUST_BE_CLOSED', 'Close registration before assigning groups');
  }

  if (!['registration', 'groupSetup'].includes(tournament.progressionState || 'registration')) {
    throw new ApiError(
      409,
      'GROUP_PATTERN_LOCKED',
      'Group pattern is locked after fixtures are generated'
    );
  }

  const players = await ensurePlayersFromApprovedRegistrations(tournamentId);
  const normalizedGroupCount = parsePositiveInteger(payload.groupCount, 2);

  if (normalizedGroupCount > 8) {
    throw new ApiError(400, 'GROUP_COUNT_OUT_OF_RANGE', 'groupCount must be between 1 and 8');
  }

  const groupCount = Math.min(normalizedGroupCount, Math.max(players.length, 1));
  const groupStageBestOf = parseBestOf(payload.groupStageBestOf, 1);
  const randomPlayers = shuffleArray(players);

  await Division.deleteMany({ tournamentId });
  await Game.deleteMany({ tournamentId, stage: 'groupStage' });
  await Leaderboard.deleteMany({ tournamentId });

  const groups = Array.from({ length: groupCount }, (_, groupIndex) => ({
    name: buildGroupName(groupIndex),
    playerIds: [],
  }));

  randomPlayers.forEach((player, index) => {
    const targetGroupIndex = index % groupCount;
    groups[targetGroupIndex].playerIds.push(player.id);
  });

  const insertedDivisions = await Division.insertMany(
    groups.map((group) => ({
      tournamentId,
      name: group.name,
      playerIds: group.playerIds,
      status: 'open',
    }))
  );

  const createdGamesByDivision = [];

  for (const division of insertedDivisions) {
    const divisionPlayerIds = (division.playerIds || []).map((playerId) => String(playerId));
    const createdGames = await createRoundRobinGamesForStage({
      tournamentId,
      divisionId: String(division._id),
      stage: 'groupStage',
      playerIds: divisionPlayerIds,
      bestOf: groupStageBestOf,
    });

    await recomputeLeaderboardForScope(tournamentId, division._id);

    createdGamesByDivision.push({
      divisionId: String(division._id),
      divisionName: division.name,
      gameCount: createdGames.length,
    });
  }

  await Tournament.updateOne(
    {
      _id: tournamentId,
    },
    {
      $set: {
        progressionState: 'groupStage',
        'competitionConfig.groupCount': groupCount,
        'competitionConfig.groupStageBestOf': groupStageBestOf,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    groupCount,
    groupStageBestOf,
    groups: insertedDivisions.map((division) => ({
      divisionId: String(division._id),
      name: division.name,
      playerCount: (division.playerIds || []).length,
      playerIds: (division.playerIds || []).map((value) => String(value)),
    })),
    gameSummary: createdGamesByDivision,
  };
};

const regenerateGroupStageFixtures = async (tournamentId, hostUserId) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const divisions = await Division.find({
    tournamentId,
    name: { $ne: 'Final Stage' },
  })
    .sort({ name: 1, _id: 1 })
    .lean();

  if (divisions.length === 0) {
    throw new ApiError(
      409,
      'GROUPS_NOT_CONFIGURED',
      'Groups must be configured before regenerating group-stage fixtures'
    );
  }

  const groupStageBestOf = parseBestOf(tournament.competitionConfig?.groupStageBestOf, 1);

  await Game.deleteMany({ tournamentId, stage: 'groupStage' });
  await Leaderboard.deleteMany({ tournamentId });

  const createdGamesByDivision = [];

  for (const division of divisions) {
    const divisionPlayerIds = (division.playerIds || []).map((playerId) => String(playerId));

    if (divisionPlayerIds.length < 2) {
      createdGamesByDivision.push({
        divisionId: String(division._id),
        divisionName: division.name,
        gameCount: 0,
      });
      continue;
    }

    const createdGames = await createRoundRobinGamesForStage({
      tournamentId,
      divisionId: String(division._id),
      stage: 'groupStage',
      playerIds: divisionPlayerIds,
      bestOf: groupStageBestOf,
    });

    await recomputeLeaderboardForScope(tournamentId, division._id);

    createdGamesByDivision.push({
      divisionId: String(division._id),
      divisionName: division.name,
      gameCount: createdGames.length,
    });
  }

  await Tournament.updateOne(
    {
      _id: tournamentId,
    },
    {
      $set: {
        progressionState: 'groupStage',
        'competitionConfig.groupStageBestOf': groupStageBestOf,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    groupStageBestOf,
    groups: divisions.map((division) => ({
      divisionId: String(division._id),
      name: division.name,
      playerCount: (division.playerIds || []).length,
      playerIds: (division.playerIds || []).map((value) => String(value)),
    })),
    gameSummary: createdGamesByDivision,
  };
};

const startFinalStageFromGroups = async (tournamentId, hostUserId, payload = {}) => {
  await assertHostAccess(tournamentId, hostUserId);

  const topPerGroup = Math.min(parsePositiveInteger(payload.topPerGroup, 2), 8);
  const finalStageBestOf = parseBestOf(payload.finalStageBestOf, 3);

  const divisions = await Division.find({ tournamentId }).sort({ name: 1, _id: 1 }).lean();

  if (divisions.length === 0) {
    throw new ApiError(409, 'GROUPS_NOT_CONFIGURED', 'Groups must be configured before starting finals');
  }

  const finalistPlayerIds = [];
  const selectedPlayerIds = Array.isArray(payload.selectedPlayerIds)
    ? [...new Set(payload.selectedPlayerIds.map((value) => String(value)).filter(Boolean))]
    : [];

  if (selectedPlayerIds.length > 0) {
    const selectedPlayers = await Player.find({
      tournamentId,
      _id: { $in: selectedPlayerIds },
      status: 'active',
    })
      .select({ _id: 1 })
      .lean();

    if (selectedPlayers.length !== selectedPlayerIds.length) {
      throw new ApiError(400, 'INVALID_FINALIST_SELECTION', 'One or more selected finalists are invalid');
    }
  }

  if (selectedPlayerIds.length > 0) {
    finalistPlayerIds.push(...selectedPlayerIds);
  }

  if (selectedPlayerIds.length === 0) {
    for (const division of divisions) {
      const leaderboard = await recomputeLeaderboardForScope(tournamentId, division._id);
      const topItems = (leaderboard.items || []).slice(0, topPerGroup);

      if (topItems.length > 0) {
        finalistPlayerIds.push(...topItems.map((entry) => entry.playerId));
        continue;
      }

      finalistPlayerIds.push(...(division.playerIds || []).slice(0, topPerGroup).map((value) => String(value)));
    }
  }

  const uniqueFinalistPlayerIds = [...new Set(finalistPlayerIds)];

  if (uniqueFinalistPlayerIds.length < 2) {
    throw new ApiError(409, 'INSUFFICIENT_FINALISTS', 'Need at least 2 finalists to start final stage');
  }

  let finalDivision = await Division.findOne({
    tournamentId,
    name: 'Final Stage',
  }).lean();

  if (!finalDivision) {
    finalDivision = (
      await Division.create({
        tournamentId,
        name: 'Final Stage',
        playerIds: uniqueFinalistPlayerIds,
        status: 'open',
      })
    ).toObject();
  } else {
    await Division.updateOne(
      {
        _id: finalDivision._id,
      },
      {
        $set: {
          playerIds: uniqueFinalistPlayerIds,
          status: 'open',
        },
      }
    );
  }

  await Game.deleteMany({
    tournamentId,
    stage: 'finalStage',
  });

  const createdFinalGames = await createRoundRobinGamesForStage({
    tournamentId,
    divisionId: String(finalDivision._id),
    stage: 'finalStage',
    playerIds: uniqueFinalistPlayerIds,
    bestOf: finalStageBestOf,
  });

  await recomputeLeaderboardForScope(tournamentId, finalDivision._id);

  await Tournament.updateOne(
    {
      _id: tournamentId,
    },
    {
      $set: {
        progressionState: 'finalStage',
        'competitionConfig.finalStageEnabled': true,
        'competitionConfig.finalStageBestOf': finalStageBestOf,
        'competitionConfig.finalStageTopPerGroup': topPerGroup,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    finalDivisionId: String(finalDivision._id),
    finalistCount: uniqueFinalistPlayerIds.length,
    finalistPlayerIds: uniqueFinalistPlayerIds,
    finalStageBestOf,
    gameCount: createdFinalGames.length,
  };
};

const finalizeTournamentWithoutFinalStage = async (tournamentId, hostUserId, payload = {}) => {
  await assertHostAccess(tournamentId, hostUserId);

  const winnersPerGroup = Math.min(parsePositiveInteger(payload.winnersPerGroup, 3), 5);
  const divisions = await Division.find({ tournamentId, name: { $ne: 'Final Stage' } }).sort({ name: 1 }).lean();

  if (divisions.length === 0) {
    throw new ApiError(409, 'GROUPS_NOT_CONFIGURED', 'Groups must be configured before finalizing winners');
  }

  const winners = [];

  for (const division of divisions) {
    const leaderboard = await recomputeLeaderboardForScope(tournamentId, division._id);
    winners.push({
      divisionId: String(division._id),
      divisionName: division.name,
      winners: (leaderboard.items || []).slice(0, winnersPerGroup),
    });
  }

  await Tournament.updateOne(
    {
      _id: tournamentId,
    },
    {
      $set: {
        status: 'completed',
        progressionState: 'completed',
        'competitionConfig.finalStageEnabled': false,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    status: 'completed',
    progressionState: 'completed',
    winners,
  };
};

const finalizeTournamentWithFinalStage = async (tournamentId, hostUserId) => {
  await assertHostAccess(tournamentId, hostUserId);

  const finalDivision = await Division.findOne({
    tournamentId,
    name: 'Final Stage',
  }).lean();

  if (!finalDivision) {
    throw new ApiError(409, 'FINALE_NOT_STARTED', 'Finale has not been started for this tournament');
  }

  const incompleteFinalGamesCount = await Game.countDocuments({
    tournamentId,
    stage: 'finalStage',
    status: { $ne: 'completed' },
  });

  if (incompleteFinalGamesCount > 0) {
    throw new ApiError(
      409,
      'FINALE_GAMES_INCOMPLETE',
      'Complete all finale games before ending the tournament'
    );
  }

  const finaleLeaderboard = await recomputeLeaderboardForScope(tournamentId, finalDivision._id);

  await Tournament.updateOne(
    {
      _id: tournamentId,
    },
    {
      $set: {
        status: 'completed',
        progressionState: 'completed',
        'competitionConfig.finalStageEnabled': true,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    status: 'completed',
    progressionState: 'completed',
    finalDivisionId: String(finalDivision._id),
    winners: finaleLeaderboard.items || [],
  };
};

module.exports = {
  createTournament,
  listDiscoverTournaments,
  getHostTournamentDetail,
  validateInviteCodeForTournament,
  submitRegistrationRequest,
  listPendingRegistrationRequests,
  listHostRegistrations,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  searchManualAddUsers,
  manuallyAddParticipant,
  manuallyRemoveParticipant,
  assignScoreEditor,
  removeScoreEditor,
  canUserEditTournamentScores,
  assertCanEditTournamentScores,
  listTournamentScoresheet,
  updateGameScores,
  upsertAndScoreGroupStageGame,
  getRoundRobinPlayingPattern,
  recomputeLeaderboardForScope,
  listTournamentLeaderboard,
  listGroupStandings,
  listGroupStandingsForHost,
  closeTournamentRegistration,
  updateHostTournamentSettings,
  assignRandomGroups,
  regenerateGroupStageFixtures,
  startFinalStageFromGroups,
  finalizeTournamentWithoutFinalStage,
  finalizeTournamentWithFinalStage,
};
