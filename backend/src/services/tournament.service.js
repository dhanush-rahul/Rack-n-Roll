const Tournament = require('../models/tournament.model');
const TournamentRegistration = require('../models/tournamentRegistration.model');
const Division = require('../models/division.model');
const Player = require('../models/player.model');
const Game = require('../models/game.model');
const Leaderboard = require('../models/leaderboard.model');
const Team = require('../models/team.model');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { sendGuestTournamentInviteEmail } = require('./email.service');
const { computePoolStats, getHandicapBonusPoints } = require('../utils/handicapScoring');
const {
  isDoublesTournament,
  resolveDoublesPairingForGroupAssign,
  randomPairSolos,
  pairByeWithPlayer,
  buildTeamSummaryById,
  listTournamentTeams,
  listSoloPlayers,
} = require('./team.service');

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

const parseBestOf = (value, fallbackValue = 1) => {
  const parsedValue = Number.parseInt(value, 10);

  if ([1, 3, 5, 7].includes(parsedValue)) {
    return parsedValue;
  }

  return fallbackValue;
};

const normalizeTournamentInput = (input, hostUserId) => {
  if (!hostUserId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const registrationMode = input?.registrationMode === 'inviteOnly' ? 'inviteOnly' : 'public';

  const groupStageBestOf = parseBestOf(
    input?.competitionConfig?.groupStageBestOf ?? input?.groupStageBestOf,
    1
  );
  const format = input?.competitionConfig?.format === 'doubles' ? 'doubles' : 'singles';
  const pairFormationMode =
    input?.competitionConfig?.pairFormationMode === 'hostAssigns' ? 'hostAssigns' : 'playerPicksPartner';

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
    competitionConfig: {
      format,
      pairFormationMode,
      groupStageBestOf,
      handicapEnabled: format === 'doubles' ? false : Boolean(input?.competitionConfig?.handicapEnabled ?? input?.handicapEnabled),
      groupStageProctored:
        format === 'doubles'
          ? false
          : Boolean(input?.competitionConfig?.groupStageProctored ?? input?.groupStageProctored ?? false),
    },
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
const guestEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GUEST_NAME_MIN_LENGTH = 2;
const GUEST_NAME_MAX_LENGTH = 120;
const GUEST_EMAIL_MAX_LENGTH = 254;

const normalizeGuestEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeGuestName = (name) => String(name || '').trim().replace(/\s+/g, ' ');

const validateGuestParticipantInput = ({ name, email }) => {
  const normalizedName = normalizeGuestName(name);

  if (!normalizedName || normalizedName.length < GUEST_NAME_MIN_LENGTH) {
    throw new ApiError(400, 'INVALID_NAME', 'Name must be at least 2 characters long');
  }

  if (normalizedName.length > GUEST_NAME_MAX_LENGTH) {
    throw new ApiError(400, 'INVALID_NAME', 'Name must be at most 120 characters long');
  }

  const normalizedEmail = normalizeGuestEmail(email);

  if (!guestEmailRegex.test(normalizedEmail) || normalizedEmail.length > GUEST_EMAIL_MAX_LENGTH) {
    throw new ApiError(400, 'INVALID_EMAIL', 'A valid email address is required');
  }

  return { normalizedName, normalizedEmail };
};

const mapGuestPlayerRosterItem = (player) => ({
  id: String(player._id),
  playerId: String(player._id),
  tournamentId: String(player.tournamentId),
  userId: null,
  status: 'approved',
  isGuest: true,
  guestEmail: player.pendingLinkEmail,
  inviteCodeUsed: null,
  reviewedByUserId: player.addedByHostUserId ? String(player.addedByHostUserId) : null,
  reviewedAt: player.createdAt || null,
  createdAt: player.createdAt,
  updatedAt: player.updatedAt,
  user: {
    name: player.displayName,
    email: player.pendingLinkEmail,
  },
});

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
  proctorTransferRequest: tournament.proctorTransferRequest?.toUserId
    ? {
        fromUserId: String(tournament.proctorTransferRequest.fromUserId || ''),
        toUserId: String(tournament.proctorTransferRequest.toUserId || ''),
        requestedAt: tournament.proctorTransferRequest.requestedAt || null,
      }
    : null,
  competitionConfig: {
    format: tournament.competitionConfig?.format || 'singles',
    pairFormationMode: tournament.competitionConfig?.pairFormationMode || 'playerPicksPartner',
    groupCount: tournament.competitionConfig?.groupCount || null,
    groupStageBestOf: tournament.competitionConfig?.groupStageBestOf || 1,
    finalStageEnabled: Boolean(tournament.competitionConfig?.finalStageEnabled),
    finalStageBestOf: tournament.competitionConfig?.finalStageBestOf || 3,
    finalStageTopPerGroup: tournament.competitionConfig?.finalStageTopPerGroup || 2,
    handicapEnabled: Boolean(tournament.competitionConfig?.handicapEnabled),
    groupStageProctored: Boolean(tournament.competitionConfig?.groupStageProctored),
    finalStageProctored: Boolean(tournament.competitionConfig?.finalStageProctored),
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
    .select({ _id: 1, name: 1, email: 1, handicap: 1 })
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
    .select({ _id: 1, userId: 1, displayName: 1, handicapEnabled: 1, handicapValue: 1 })
    .lean();

  return players.reduce((accumulator, player) => {
    accumulator.set(String(player._id), {
      id: String(player._id),
      userId: player.userId ? String(player.userId) : null,
      displayName: player.displayName,
      handicapEnabled: Boolean(player.handicapEnabled),
      handicapValue: Number(player.handicapValue || 0),
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
  const [approvedRegistrationCount, guestPlayerCount] = await Promise.all([
    TournamentRegistration.countDocuments({
      tournamentId,
      status: 'approved',
    }),
    Player.countDocuments({
      tournamentId,
      status: 'active',
      userId: null,
      pendingLinkEmail: { $type: 'string', $ne: null },
    }),
  ]);

  const approvedCount = approvedRegistrationCount + guestPlayerCount;

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
  const guestPlayers = await Player.find({
    tournamentId: tournament._id,
    status: 'active',
    userId: null,
    pendingLinkEmail: { $type: 'string', $ne: null },
  })
    .sort({ createdAt: -1, _id: -1 })
    .lean();
  const guestItems = guestPlayers.map(mapGuestPlayerRosterItem);
  const combinedTotal = total + guestItems.length;
  const totalPages = combinedTotal === 0 ? 0 : Math.ceil(combinedTotal / pageSize);

  return {
    items: [...items.map((item) => mapRegistrationSummaryWithUser(item, userSummaryById)), ...guestItems],
    pagination: {
      page,
      pageSize,
      total: combinedTotal,
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

    await materializeApprovedPlayerForUser(tournamentId, approvedRegistration.userId);

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

      await materializeApprovedPlayerForUser(tournamentId, normalizedTargetUserId);

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

    await materializeApprovedPlayerForUser(tournamentId, normalizedTargetUserId);

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

const addGuestParticipant = async (tournamentId, hostUserId, payload = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const { normalizedName, normalizedEmail } = validateGuestParticipantInput(payload);
  const hostUser = await User.findById(tournament.hostUserId).select({ name: 1, email: 1 }).lean();

  if (hostUser && normalizeGuestEmail(hostUser.email) === normalizedEmail) {
    throw new ApiError(400, 'HOST_CANNOT_REGISTER', 'Host cannot be added as a participant');
  }

  const existingUser = await User.findOne({ email: normalizedEmail }).select({ _id: 1 }).lean();

  if (existingUser) {
    const manualAddResult = await manuallyAddParticipant(tournamentId, hostUserId, String(existingUser._id));

    return {
      ...manualAddResult,
      isGuest: false,
      linkedImmediately: true,
      inviteEmailSent: false,
    };
  }

  const existingGuest = await Player.findOne({
    tournamentId,
    status: 'active',
    pendingLinkEmail: normalizedEmail,
  }).lean();

  if (existingGuest) {
    throw new ApiError(
      409,
      'GUEST_ALREADY_ON_ROSTER',
      'A guest player with this email is already on the roster for this tournament'
    );
  }

  await reserveApprovalCapacitySlot(tournamentId);

  const tournamentMeta = await Tournament.findById(tournamentId).select({ name: 1, competitionConfig: 1 }).lean();
  const useHandicap = Boolean(tournamentMeta?.competitionConfig?.handicapEnabled);

  let createdPlayer;

  try {
    createdPlayer = await Player.create({
      tournamentId,
      userId: null,
      displayName: normalizedName,
      pendingLinkEmail: normalizedEmail,
      addedByHostUserId: hostUserId,
      handicapEnabled: useHandicap,
      handicapValue: 0,
      status: 'active',
    });
  } catch (error) {
    await releaseApprovalCapacitySlot(tournamentId);

    if (error?.code === 11000) {
      throw new ApiError(
        409,
        'GUEST_ALREADY_ON_ROSTER',
        'A guest player with this email is already on the roster for this tournament'
      );
    }

    throw error;
  }

  const groupSync = await syncApprovedPlayerToGroupsByPlayerId(tournamentId, String(createdPlayer._id));

  let inviteEmailSent = false;

  try {
    await sendGuestTournamentInviteEmail({
      toEmail: normalizedEmail,
      toName: normalizedName,
      tournamentName: tournamentMeta?.name || 'Tournament',
      hostName: hostUser?.name || 'the tournament host',
    });
    inviteEmailSent = true;
  } catch (error) {
    console.error('[guest-add] invite email failed:', error?.message || error);
  }

  return {
    ...mapGuestPlayerRosterItem(createdPlayer.toObject()),
    groupSync,
    isGuest: true,
    linkedImmediately: false,
    inviteEmailSent,
  };
};

const linkPendingGuestPlayersForUser = async (userId, email) => {
  const normalizedEmail = normalizeGuestEmail(email);
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedEmail || !normalizedUserId) {
    return { linkedTournamentIds: [] };
  }

  const user = await User.findById(normalizedUserId).select({ name: 1, email: 1 }).lean();

  if (!user) {
    return { linkedTournamentIds: [] };
  }

  const pendingPlayers = await Player.find({
    pendingLinkEmail: normalizedEmail,
    userId: null,
    status: 'active',
  }).lean();

  if (pendingPlayers.length === 0) {
    return { linkedTournamentIds: [] };
  }

  const linkedTournamentIds = [];
  const reviewedAt = new Date();

  for (const player of pendingPlayers) {
    await Player.updateOne(
      { _id: player._id },
      {
        $set: {
          userId: normalizedUserId,
          displayName: user.name || player.displayName,
          pendingLinkEmail: null,
        },
      }
    );

    const existingRegistration = await TournamentRegistration.findOne({
      tournamentId: player.tournamentId,
      userId: normalizedUserId,
    }).lean();

    if (!existingRegistration) {
      await TournamentRegistration.create({
        tournamentId: player.tournamentId,
        userId: normalizedUserId,
        status: 'approved',
        reviewedAt,
      });
    } else if (existingRegistration.status !== 'approved') {
      await TournamentRegistration.findOneAndUpdate(
        {
          _id: existingRegistration._id,
          status: { $ne: 'approved' },
        },
        {
          $set: {
            status: 'approved',
            reviewedAt,
          },
        }
      );
    }

    linkedTournamentIds.push(String(player.tournamentId));
  }

  return { linkedTournamentIds };
};

const removeGuestParticipant = async (tournamentId, hostUserId, playerId) => {
  await assertHostAccess(tournamentId, hostUserId);

  const normalizedPlayerId = String(playerId || '').trim();

  if (!normalizedPlayerId) {
    throw new ApiError(400, 'PLAYER_ID_REQUIRED', 'playerId is required for guest remove');
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

  const removedPlayer = await Player.findOneAndUpdate(
    {
      _id: normalizedPlayerId,
      tournamentId,
      status: 'active',
      userId: null,
      pendingLinkEmail: { $type: 'string', $ne: null },
    },
    {
      $set: {
        status: 'removed',
        pendingLinkEmail: null,
      },
    },
    {
      new: true,
    }
  ).lean();

  if (!removedPlayer) {
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

    throw new ApiError(404, 'GUEST_PARTICIPANT_NOT_FOUND', 'Guest participant not found for removal');
  }

  return mapGuestPlayerRosterItem(removedPlayer);
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

  const updatedTournament = await Tournament.findOneAndUpdate(
    {
      _id: tournamentId,
      hostUserId,
      scoreEditorUserIds: { $ne: normalizedEditorUserId },
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
      'Unable to assign score editor due to concurrent update'
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

const requestProctorTransfer = async (tournamentId, actorUserId, targetUserId) => {
  const normalizedTargetUserId = String(targetUserId || '').trim();

  if (!normalizedTargetUserId) {
    throw new ApiError(400, 'PROCTOR_TRANSFER_TARGET_REQUIRED', 'targetUserId is required');
  }

  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const normalizedActorUserId = String(actorUserId);
  const isHost = String(tournament.hostUserId) === normalizedActorUserId;
  const currentEditors = (tournament.scoreEditorUserIds || []).map((value) => String(value));
  const isProctor = currentEditors.includes(normalizedActorUserId);

  if (!isHost && !isProctor) {
    throw new ApiError(403, 'FORBIDDEN_PROCTOR', 'Only the host or an assigned proctor can request a transfer');
  }

  if (String(tournament.hostUserId) === normalizedTargetUserId) {
    throw new ApiError(400, 'INVALID_TRANSFER_TARGET', 'Cannot transfer proctor role to the host');
  }

  if (currentEditors.includes(normalizedTargetUserId)) {
    throw new ApiError(409, 'PROCTOR_ALREADY_ASSIGNED', 'Target user is already a proctor');
  }

  if (!isHost && !currentEditors.includes(normalizedActorUserId)) {
    throw new ApiError(403, 'FORBIDDEN_PROCTOR', 'Only current proctors can initiate a handoff');
  }

  const fromUserId = isHost && !isProctor ? normalizedActorUserId : normalizedActorUserId;

  const updatedTournament = await Tournament.findByIdAndUpdate(
    tournamentId,
    {
      proctorTransferRequest: {
        fromUserId,
        toUserId: normalizedTargetUserId,
        requestedAt: new Date(),
      },
    },
    { new: true }
  ).lean();

  return {
    ...mapScoreEditorResponse(updatedTournament),
    proctorTransferRequest: mapHostTournamentDetail(updatedTournament).proctorTransferRequest,
  };
};

const acceptProctorTransfer = async (tournamentId, actorUserId) => {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const transfer = tournament.proctorTransferRequest;

  if (!transfer?.toUserId) {
    throw new ApiError(404, 'PROCTOR_TRANSFER_NOT_FOUND', 'No pending proctor transfer request');
  }

  if (String(transfer.toUserId) !== String(actorUserId)) {
    throw new ApiError(403, 'FORBIDDEN_PROCTOR_ACCEPT', 'Only the requested user can accept the transfer');
  }

  const fromUserId = String(transfer.fromUserId || '');
  const toUserId = String(transfer.toUserId);
  const currentEditors = (tournament.scoreEditorUserIds || []).map((value) => String(value));
  const nextEditors = currentEditors.filter((id) => id !== fromUserId);

  if (!nextEditors.includes(toUserId)) {
    nextEditors.push(toUserId);
  }

  const updatedTournament = await Tournament.findByIdAndUpdate(
    tournamentId,
    {
      scoreEditorUserIds: nextEditors,
      proctorTransferRequest: {
        fromUserId: null,
        toUserId: null,
        requestedAt: null,
      },
    },
    { new: true }
  ).lean();

  return {
    ...mapScoreEditorResponse(updatedTournament),
    proctorTransferRequest: null,
  };
};

const declineProctorTransfer = async (tournamentId, actorUserId) => {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament?.proctorTransferRequest?.toUserId) {
    throw new ApiError(404, 'PROCTOR_TRANSFER_NOT_FOUND', 'No pending proctor transfer request');
  }

  const normalizedActorUserId = String(actorUserId);
  const isHost = String(tournament.hostUserId) === normalizedActorUserId;
  const isTarget = String(tournament.proctorTransferRequest.toUserId) === normalizedActorUserId;

  if (!isHost && !isTarget) {
    throw new ApiError(403, 'FORBIDDEN_PROCTOR_DECLINE', 'Only the host or target user can decline the transfer');
  }

  const updatedTournament = await Tournament.findByIdAndUpdate(
    tournamentId,
    {
      proctorTransferRequest: {
        fromUserId: null,
        toUserId: null,
        requestedAt: null,
      },
    },
    { new: true }
  ).lean();

  return {
    ...mapScoreEditorResponse(updatedTournament),
    proctorTransferRequest: null,
  };
};

const isStageProctored = (competitionConfig = {}, stage = 'groupStage') => {
  if (stage === 'finalStage') {
    return Boolean(competitionConfig.finalStageProctored);
  }
  return Boolean(competitionConfig.groupStageProctored);
};

const isActiveTournamentParticipant = async (tournamentId, userId) => {
  if (!userId) {
    return false;
  }

  const player = await Player.findOne({
    tournamentId,
    userId,
    status: 'active',
  })
    .select({ _id: 1 })
    .lean();

  return Boolean(player);
};

const canUserEditGameScores = (tournament, userId, game, playerSummaryById = new Map(), teamSummaryById = new Map()) => {
  if (!userId || !tournament || !game) {
    return false;
  }

  const normalizedUserId = String(userId);
  const isHost = String(tournament.hostUserId) === normalizedUserId;
  const isAssignedEditor = (tournament.scoreEditorUserIds || []).some(
    (editorUserId) => String(editorUserId) === normalizedUserId
  );
  const stage = game.stage || 'groupStage';
  const proctored = isStageProctored(tournament.competitionConfig || {}, stage);

  if (proctored) {
    return isHost || isAssignedEditor;
  }

  if (isHost) {
    return true;
  }

  if (game.teamAId && game.teamBId) {
    const teamA = teamSummaryById?.get?.(String(game.teamAId));
    const teamB = teamSummaryById?.get?.(String(game.teamBId));
    const memberUserIds = [
      teamA?.player1?.userId,
      teamA?.player2?.userId,
      teamB?.player1?.userId,
      teamB?.player2?.userId,
    ];
    return memberUserIds.some((matchUserId) => matchUserId && String(matchUserId) === normalizedUserId);
  }

  const playerA = playerSummaryById.get(String(game.playerAId));
  const playerB = playerSummaryById.get(String(game.playerBId));
  return [playerA?.userId, playerB?.userId].some(
    (matchUserId) => matchUserId && String(matchUserId) === normalizedUserId
  );
};

const isUserInMatch = (userId, game, playerSummaryById, teamSummaryById) => {
  const normalizedUserId = String(userId);

  if (game.teamAId && game.teamBId) {
    const teamA = teamSummaryById?.get?.(String(game.teamAId));
    const teamB = teamSummaryById?.get?.(String(game.teamBId));
    const memberUserIds = [
      teamA?.player1?.userId,
      teamA?.player2?.userId,
      teamB?.player1?.userId,
      teamB?.player2?.userId,
    ];

    return memberUserIds.some((matchUserId) => matchUserId && String(matchUserId) === normalizedUserId);
  }

  const playerA = playerSummaryById.get(String(game.playerAId));
  const playerB = playerSummaryById.get(String(game.playerBId));

  return [playerA?.userId, playerB?.userId].some(
    (matchUserId) => matchUserId && String(matchUserId) === normalizedUserId
  );
};

const canUserScheduleMatch = (tournament, userId, game, playerSummaryById, teamSummaryById) => {
  if (!userId) {
    return false;
  }

  if (String(tournament.hostUserId) === String(userId)) {
    return true;
  }

  return isUserInMatch(userId, game, playerSummaryById, teamSummaryById);
};

const assertUserCanScheduleMatch = async (tournamentId, userId, game) => {
  if (!userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const playerSummaryById = await buildPlayerSummaryById(
    [game.playerAId, game.playerBId].filter(Boolean)
  );
  const teamSummaryById = await buildTeamSummaryById(
    [game.teamAId, game.teamBId].filter(Boolean)
  );
  const allowed = canUserScheduleMatch(tournament, userId, game, playerSummaryById, teamSummaryById);

  if (!allowed) {
    throw new ApiError(
      403,
      'FORBIDDEN_SCHEDULE_EDIT',
      'Only the host or players in this match can schedule it'
    );
  }
};

const assertCanEditGameScores = async (tournamentId, userId, game) => {
  if (!userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1, competitionConfig: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const playerSummaryById = await buildPlayerSummaryById(
    [game.playerAId, game.playerBId].filter(Boolean)
  );
  const teamSummaryById = await buildTeamSummaryById(
    [game.teamAId, game.teamBId].filter(Boolean)
  );
  const allowed = canUserEditGameScores(tournament, userId, game, playerSummaryById, teamSummaryById);

  if (!allowed) {
    throw new ApiError(
      403,
      'FORBIDDEN_SCORE_EDIT',
      'Only the host, assigned proctors, or players in this match can edit scores'
    );
  }
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

const resolveGameDisplayStatus = (game) => {
  const scoreEntries = game.scoreEntries || [];
  const seriesOutcome = computeSeriesOutcome(game, scoreEntries);
  const storedStatus = game.status || 'scheduled';

  if (seriesOutcome.winnerPlayerId || storedStatus === 'completed') {
    return 'completed';
  }

  if (storedStatus === 'inProgress') {
    return 'inProgress';
  }

  return storedStatus;
};

const mapGameForScoresheet = (
  game,
  playerSummaryById = new Map(),
  divisionNameById = new Map(),
  {
    canEditMatch = false,
    canScheduleMatch = false,
    teamSummaryById = new Map(),
    tournamentMeta = null,
    viewerUserId = null,
  } = {}
) => {
  const seriesOutcome = computeSeriesOutcome(game, game.scoreEntries || []);
  const resolvedCanScheduleMatch =
    canScheduleMatch ||
    (tournamentMeta && viewerUserId
      ? canUserScheduleMatch(
          tournamentMeta,
          viewerUserId,
          game,
          playerSummaryById,
          teamSummaryById
        )
      : false);

  return {
  id: String(game._id),
  tournamentId: String(game.tournamentId),
  divisionId: game.divisionId ? String(game.divisionId) : null,
  divisionName: game.divisionId ? divisionNameById.get(String(game.divisionId)) || null : null,
  stage: game.stage || 'groupStage',
  roundNumber: Number(game.roundNumber || 1),
  bestOf: parseBestOf(game.bestOf, 1),
  playerAId: game.playerAId ? String(game.playerAId) : null,
  playerBId: game.playerBId ? String(game.playerBId) : null,
  teamAId: game.teamAId ? String(game.teamAId) : null,
  teamBId: game.teamBId ? String(game.teamBId) : null,
  playerA: game.playerAId ? playerSummaryById.get(String(game.playerAId)) || null : null,
  playerB: game.playerBId ? playerSummaryById.get(String(game.playerBId)) || null : null,
  teamA: game.teamAId ? teamSummaryById.get(String(game.teamAId)) || null : null,
  teamB: game.teamBId ? teamSummaryById.get(String(game.teamBId)) || null : null,
  playerASeriesWins: seriesOutcome.playerASeriesWins,
  playerBSeriesWins: seriesOutcome.playerBSeriesWins,
  winnerPlayerId: seriesOutcome.winnerPlayerId
    ? String(seriesOutcome.winnerPlayerId)
    : game.winnerPlayerId
      ? String(game.winnerPlayerId)
      : null,
  winnerTeamId: seriesOutcome.winnerTeamId
    ? String(seriesOutcome.winnerTeamId)
    : game.winnerTeamId
      ? String(game.winnerTeamId)
      : null,
  status: resolveGameDisplayStatus(game),
  canEditMatch,
  canScheduleMatch: resolvedCanScheduleMatch,
  scheduledStartAt: game.scheduledStartAt ? new Date(game.scheduledStartAt).toISOString() : null,
  scoreEntries: (game.scoreEntries || []).map((entry) => ({
    gameNumber: entry.gameNumber,
    playerAScore: entry.playerAScore,
    playerBScore: entry.playerBScore,
  })),
  updatedAt: game.updatedAt,
};
};

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
    !game?.teamAId && playerASeriesWins >= winsRequired
      ? game.playerAId
      : !game?.teamAId && playerBSeriesWins >= winsRequired
        ? game.playerBId
        : null;

  const winnerTeamId =
    game?.teamAId && playerASeriesWins >= winsRequired
      ? game.teamAId
      : game?.teamAId && playerBSeriesWins >= winsRequired
        ? game.teamBId
        : null;

  return {
    bestOf,
    winsRequired,
    playerASeriesWins,
    playerBSeriesWins,
    winnerPlayerId,
    winnerTeamId,
    scoreForA,
    scoreForB,
  };
};

const listTournamentScoresheet = async (tournamentId, userId, query = {}) => {
  const canEdit = userId ? await canUserEditTournamentScores(tournamentId, userId) : false;
  const tournamentMeta = await Tournament.findById(tournamentId)
    .select({ proctorTransferRequest: 1, scoreEditorUserIds: 1, hostUserId: 1, competitionConfig: 1, progressionState: 1 })
    .lean();

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
    games.flatMap((game) => [game.playerAId, game.playerBId].filter(Boolean))
  );
  const teamSummaryById = await buildTeamSummaryById(
    games.flatMap((game) => [game.teamAId, game.teamBId].filter(Boolean))
  );

  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);

  const editorUserIds = (tournamentMeta?.scoreEditorUserIds || []).map((value) => String(value));
  const editorSummaryById = await buildUserSummaryById(editorUserIds);

  return {
    tournamentId: String(tournamentId),
    canEdit,
    format: tournamentMeta?.competitionConfig?.format || 'singles',
    pairFormationMode: tournamentMeta?.competitionConfig?.pairFormationMode || 'playerPicksPartner',
    progressionState: tournamentMeta?.progressionState || 'registration',
    groupStageProctored: Boolean(tournamentMeta?.competitionConfig?.groupStageProctored),
    finalStageProctored: Boolean(tournamentMeta?.competitionConfig?.finalStageProctored),
    hostUserId: tournamentMeta?.hostUserId ? String(tournamentMeta.hostUserId) : null,
    proctors: editorUserIds.map((userId) => ({
      userId,
      displayName: editorSummaryById.get(userId)?.name || 'Proctor',
      email: editorSummaryById.get(userId)?.email || null,
    })),
    proctorTransferRequest: tournamentMeta?.proctorTransferRequest?.toUserId
      ? {
          fromUserId: String(tournamentMeta.proctorTransferRequest.fromUserId || ''),
          toUserId: String(tournamentMeta.proctorTransferRequest.toUserId || ''),
          requestedAt: tournamentMeta.proctorTransferRequest.requestedAt || null,
        }
      : null,
    items: games.map((game) =>
      mapGameForScoresheet(game, playerSummaryById, divisionNameById, {
        canEditMatch: canUserEditGameScores(tournamentMeta, userId, game, playerSummaryById, teamSummaryById),
        teamSummaryById,
        tournamentMeta,
        viewerUserId: userId,
      })
    ),
    pagination: {
      page,
      pageSize,
      total,
      totalPages,
    },
  };
};

const recomputeDoublesLeaderboardForScope = async (tournamentId, divisionId, scopeFilter) => {
  const completedGames = await Game.find({
    ...scopeFilter,
    status: 'completed',
    teamAId: { $ne: null },
    teamBId: { $ne: null },
  })
    .sort({ createdAt: 1, _id: 1 })
    .lean();

  const teams = await Team.find({
    tournamentId,
    status: 'active',
    ...(divisionId ? { divisionId: normalizeDivisionScopeValue(divisionId) } : {}),
  }).lean();

  const teamMembersByTeamId = new Map(
    teams.map((team) => [String(team._id), [String(team.player1Id), String(team.player2Id)]])
  );

  const statsByTeamId = new Map();
  const statsByPlayerId = new Map();

  const ensureTeamStats = (teamId) => {
    const normalizedTeamId = String(teamId);
    if (!statsByTeamId.has(normalizedTeamId)) {
      statsByTeamId.set(normalizedTeamId, {
        teamId: normalizedTeamId,
        points: 0,
        wins: 0,
        draws: 0,
        losses: 0,
        scoreFor: 0,
        scoreAgainst: 0,
        scoreDifferential: 0,
      });
    }
    return statsByTeamId.get(normalizedTeamId);
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

  const applyOutcomeToMembers = (teamId, scoreFor, scoreAgainst, outcome) => {
    const members = teamMembersByTeamId.get(String(teamId)) || [];
    members.forEach((playerId) => {
      const playerStats = ensurePlayerStats(playerId);
      playerStats.scoreFor += scoreFor;
      playerStats.scoreAgainst += scoreAgainst;
      playerStats.scoreDifferential = playerStats.scoreFor - playerStats.scoreAgainst;
      if (outcome === 'win') {
        playerStats.wins += 1;
        playerStats.points += 2;
      } else if (outcome === 'loss') {
        playerStats.losses += 1;
      } else {
        playerStats.draws += 1;
        playerStats.points += 1;
      }
    });
  };

  completedGames.forEach((game) => {
    const scoreEntries = Array.isArray(game.scoreEntries) ? game.scoreEntries : [];
    if (scoreEntries.length === 0) {
      return;
    }

    const seriesOutcome = computeSeriesOutcome(game, scoreEntries);
    const teamAStats = ensureTeamStats(game.teamAId);
    const teamBStats = ensureTeamStats(game.teamBId);

    teamAStats.scoreFor += seriesOutcome.scoreForA;
    teamAStats.scoreAgainst += seriesOutcome.scoreForB;
    teamAStats.scoreDifferential = teamAStats.scoreFor - teamAStats.scoreAgainst;
    teamBStats.scoreFor += seriesOutcome.scoreForB;
    teamBStats.scoreAgainst += seriesOutcome.scoreForA;
    teamBStats.scoreDifferential = teamBStats.scoreFor - teamBStats.scoreAgainst;

    if (seriesOutcome.playerASeriesWins > seriesOutcome.playerBSeriesWins) {
      teamAStats.wins += 1;
      teamAStats.points += 2;
      teamBStats.losses += 1;
      applyOutcomeToMembers(game.teamAId, seriesOutcome.scoreForA, seriesOutcome.scoreForB, 'win');
      applyOutcomeToMembers(game.teamBId, seriesOutcome.scoreForB, seriesOutcome.scoreForA, 'loss');
      return;
    }

    if (seriesOutcome.playerBSeriesWins > seriesOutcome.playerASeriesWins) {
      teamBStats.wins += 1;
      teamBStats.points += 2;
      teamAStats.losses += 1;
      applyOutcomeToMembers(game.teamBId, seriesOutcome.scoreForB, seriesOutcome.scoreForA, 'win');
      applyOutcomeToMembers(game.teamAId, seriesOutcome.scoreForA, seriesOutcome.scoreForB, 'loss');
      return;
    }

    teamAStats.draws += 1;
    teamBStats.draws += 1;
    teamAStats.points += 1;
    teamBStats.points += 1;
    applyOutcomeToMembers(game.teamAId, seriesOutcome.scoreForA, seriesOutcome.scoreForB, 'draw');
    applyOutcomeToMembers(game.teamBId, seriesOutcome.scoreForB, seriesOutcome.scoreForA, 'draw');
  });

  const sortEntries = (entries) =>
    [...entries].sort((left, right) => {
      if (right.points !== left.points) return right.points - left.points;
      if (right.scoreDifferential !== left.scoreDifferential) return right.scoreDifferential - left.scoreDifferential;
      if (right.scoreFor !== left.scoreFor) return right.scoreFor - left.scoreFor;
      if (right.wins !== left.wins) return right.wins - left.wins;
      return String(left.teamId || left.playerId).localeCompare(String(right.teamId || right.playerId));
    });

  const orderedTeams = sortEntries([...statsByTeamId.values()]);
  const orderedPlayers = sortEntries([...statsByPlayerId.values()]);

  await Leaderboard.deleteMany({
    ...scopeFilter,
    standingsType: { $in: ['team', 'player'] },
  });

  const leaderboardRows = [
    ...orderedTeams.map((entry, index) => ({
      tournamentId,
      divisionId: normalizeDivisionScopeValue(divisionId),
      standingsType: 'team',
      teamId: entry.teamId,
      rank: index + 1,
      points: entry.points,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
      scoreDifferential: entry.scoreDifferential,
    })),
    ...orderedPlayers.map((entry, index) => ({
      tournamentId,
      divisionId: normalizeDivisionScopeValue(divisionId),
      standingsType: 'player',
      playerId: entry.playerId,
      rank: index + 1,
      points: entry.points,
      wins: entry.wins,
      draws: entry.draws,
      losses: entry.losses,
      scoreFor: entry.scoreFor,
      scoreAgainst: entry.scoreAgainst,
      scoreDifferential: entry.scoreDifferential,
    })),
  ];

  if (leaderboardRows.length > 0) {
    try {
      await Leaderboard.insertMany(leaderboardRows);
    } catch (error) {
      if (error?.code === 11000) {
        throw new ApiError(
          409,
          'LEADERBOARD_INDEX_CONFLICT',
          'Leaderboard database indexes are out of date. Restart the backend or run: npm run fix:leaderboard-indexes'
        );
      }

      throw error;
    }
  }

  return {
    tournamentId: String(tournamentId),
    divisionId: normalizeDivisionScopeValue(divisionId),
    items: orderedPlayers.map((entry, index) => ({
      id: `player-${entry.playerId}`,
      playerId: entry.playerId,
      rank: index + 1,
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

const recomputeLeaderboardForScope = async (tournamentId, divisionId) => {
  const scopeFilter = buildScopeFilter(tournamentId, divisionId);
  const tournament = await Tournament.findById(tournamentId)
    .select({ competitionConfig: 1 })
    .lean();

  if (isDoublesTournament(tournament)) {
    return recomputeDoublesLeaderboardForScope(tournamentId, divisionId, scopeFilter);
  }

  const handicapEnabled = Boolean(tournament?.competitionConfig?.handicapEnabled);
  const playerHandicapById = new Map();

  if (handicapEnabled) {
    const tournamentPlayers = await Player.find({ tournamentId })
      .select({ _id: 1, handicapEnabled: 1, handicapValue: 1 })
      .lean();

    tournamentPlayers.forEach((player) => {
      playerHandicapById.set(
        String(player._id),
        player.handicapEnabled ? Number(player.handicapValue || 0) : 0
      );
    });
  }

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
      const handicapBonus = handicapEnabled
        ? getHandicapBonusPoints(
            playerHandicapById.get(String(game.playerAId)) || 0,
            playerHandicapById.get(String(game.playerBId)) || 0
          )
        : 0;
      playerAStats.wins += 1;
      playerAStats.points += 2 + handicapBonus;
      playerBStats.losses += 1;
      recordHeadToHeadPoints(game.playerAId, game.playerBId, 2 + handicapBonus, 0);
      return;
    }

    if (seriesOutcome.playerBSeriesWins > seriesOutcome.playerASeriesWins) {
      const handicapBonus = handicapEnabled
        ? getHandicapBonusPoints(
            playerHandicapById.get(String(game.playerBId)) || 0,
            playerHandicapById.get(String(game.playerAId)) || 0
          )
        : 0;
      playerBStats.wins += 1;
      playerBStats.points += 2 + handicapBonus;
      playerAStats.losses += 1;
      recordHeadToHeadPoints(game.playerAId, game.playerBId, 0, 2 + handicapBonus);
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

  await Leaderboard.deleteMany({ ...scopeFilter, standingsType: 'player' });

  if (orderedEntries.length > 0) {
    await Leaderboard.insertMany(
      orderedEntries.map((entry, index) => ({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        standingsType: 'player',
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

  const refreshedEntries = await Leaderboard.find({ ...scopeFilter, standingsType: 'player' })
    .sort({ rank: 1, playerId: 1 })
    .lean();

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

const listTournamentLeaderboard = async (tournamentId, divisionId, standingsType = 'player') => {
  const scopeFilter = {
    ...buildScopeFilter(tournamentId, divisionId),
    standingsType,
  };

  const entries = await Leaderboard.find(scopeFilter).sort({ rank: 1, playerId: 1, teamId: 1 }).lean();

  if (standingsType === 'team') {
    const teamSummaryById = await buildTeamSummaryById(entries.map((entry) => entry.teamId));
    return {
      tournamentId: String(tournamentId),
      divisionId: normalizeDivisionScopeValue(divisionId),
      standingsType,
      items: entries.map((entry) => ({
        id: String(entry._id),
        teamId: String(entry.teamId),
        team: teamSummaryById.get(String(entry.teamId)) || null,
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
  }

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
  const existingGame = await Game.findOne({
    _id: gameId,
    tournamentId,
  }).lean();

  if (!existingGame) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found for this tournament');
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1, competitionConfig: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const gameStage = existingGame.stage || 'groupStage';

  if (isStageProctored(tournament.competitionConfig || {}, gameStage)) {
    throw new ApiError(
      403,
      'MANUAL_SCORING_DISABLED',
      'This stage uses proctored live scoring. Enter scores from the live match session.'
    );
  }

  await assertCanEditGameScores(tournamentId, userId, existingGame);

  let effectiveBestOf = parseBestOf(existingGame.bestOf, 1);

  if (gameStage === 'groupStage') {
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
  const isSeriesComplete = Boolean(seriesOutcome.winnerPlayerId || seriesOutcome.winnerTeamId);
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
        winnerTeamId: seriesOutcome.winnerTeamId,
      },
    },
    {
      new: true,
      runValidators: true,
    }
  ).lean();

  await recomputeLeaderboardForScope(tournamentId, updatedGame.divisionId);

  const playerSummaryById = await buildPlayerSummaryById(
    [updatedGame.playerAId, updatedGame.playerBId].filter(Boolean)
  );
  const teamSummaryById = await buildTeamSummaryById(
    [updatedGame.teamAId, updatedGame.teamBId].filter(Boolean)
  );

  return mapGameForScoresheet(updatedGame, playerSummaryById, new Map(), {
    canEditMatch: canUserEditGameScores(tournament, userId, updatedGame, playerSummaryById, teamSummaryById),
    teamSummaryById,
    tournamentMeta: tournament,
    viewerUserId: userId,
  });
};

const updateGameSchedule = async (tournamentId, gameId, userId, payload = {}) => {
  const existingGame = await Game.findOne({
    _id: gameId,
    tournamentId,
  }).lean();

  if (!existingGame) {
    throw new ApiError(404, 'GAME_NOT_FOUND', 'Game not found for this tournament');
  }

  await assertUserCanScheduleMatch(tournamentId, userId, existingGame);

  let scheduledStartAt = null;

  if (payload.scheduledStartAt !== undefined && payload.scheduledStartAt !== null && payload.scheduledStartAt !== '') {
    const parsedDate = new Date(payload.scheduledStartAt);

    if (Number.isNaN(parsedDate.getTime())) {
      throw new ApiError(400, 'INVALID_SCHEDULE', 'scheduledStartAt must be a valid date/time');
    }

    scheduledStartAt = parsedDate;
  }

  const updatedGame = await Game.findOneAndUpdate(
    {
      _id: gameId,
      tournamentId,
    },
    {
      $set: {
        scheduledStartAt,
        scheduledByUserId: scheduledStartAt ? userId : null,
      },
    },
    {
      new: true,
    }
  ).lean();

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1, competitionConfig: 1 })
    .lean();

  const playerSummaryById = await buildPlayerSummaryById(
    [updatedGame.playerAId, updatedGame.playerBId].filter(Boolean)
  );
  const teamSummaryById = await buildTeamSummaryById(
    [updatedGame.teamAId, updatedGame.teamBId].filter(Boolean)
  );

  return mapGameForScoresheet(updatedGame, playerSummaryById, new Map(), {
    canEditMatch: canUserEditGameScores(tournament, userId, updatedGame, playerSummaryById, teamSummaryById),
    teamSummaryById,
    tournamentMeta: tournament,
    viewerUserId: userId,
  });
};

const upsertAndScoreGroupStageGame = async (tournamentId, userId, payload = {}) => {
  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1, competitionConfig: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  if (Boolean(tournament.competitionConfig?.groupStageProctored)) {
    throw new ApiError(
      403,
      'MANUAL_SCORING_DISABLED',
      'Group stage uses proctored live scoring. Enter scores from the live match session.'
    );
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

  await assertCanEditGameScores(tournamentId, userId, {
    stage: 'groupStage',
    playerAId,
    playerBId,
  });

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

  return mapGameForScoresheet(game, playerSummaryById, new Map(), {
    canEditMatch: canUserEditGameScores(tournament, userId, game, playerSummaryById),
  });
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

const countPairTeamGames = (games, teamAId, teamBId) => {
  const normalizedPair = [String(teamAId), String(teamBId)].sort().join(':');

  return games.filter((game) => {
    const pair = [String(game.teamAId), String(game.teamBId)].sort().join(':');
    return pair === normalizedPair;
  }).length;
};

const pickDivisionForNewTeam = (inputDivisions = []) => {
  const divisions = inputDivisions.filter((division) => String(division.name || '') !== 'Final Stage');

  if (divisions.length === 0) {
    return null;
  }

  const minCount = Math.min(...divisions.map((division) => (division.teamIds || []).length));
  const candidates = divisions.filter((division) => (division.teamIds || []).length === minCount);

  return shuffleArray(candidates)[0] || null;
};

const createIncrementalGroupStageGamesForTeam = async ({
  tournamentId,
  divisionId,
  newTeamId,
  opponentTeamIds,
  bestOf,
  existingGames,
}) => {
  const groupStageLegs = 2;
  let maxRoundNumber = existingGames.reduce(
    (max, game) => Math.max(max, Number(game.roundNumber || 0)),
    0
  );
  const gameDocuments = [];

  opponentTeamIds.forEach((opponentTeamId) => {
    let playedLegs = countPairTeamGames(existingGames, newTeamId, opponentTeamId);

    while (playedLegs < groupStageLegs) {
      maxRoundNumber += 1;
      const swapSides = playedLegs === 1;

      gameDocuments.push({
        tournamentId,
        divisionId: normalizeDivisionScopeValue(divisionId),
        stage: 'groupStage',
        roundNumber: maxRoundNumber,
        bestOf: parseBestOf(bestOf, 1),
        teamAId: swapSides ? opponentTeamId : newTeamId,
        teamBId: swapSides ? newTeamId : opponentTeamId,
        scoreEntries: [],
        playerASeriesWins: 0,
        playerBSeriesWins: 0,
        winnerTeamId: null,
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

const syncDoublesApprovedPlayerToGroupsByPlayerId = async (tournamentId, playerId, divisions, tournament) => {
  const normalizedPlayerId = String(playerId || '').trim();

  if (!normalizedPlayerId) {
    return null;
  }

  const existingAssignment = divisions.find((division) =>
    (division.playerIds || []).map((value) => String(value)).includes(normalizedPlayerId)
  );

  if (existingAssignment) {
    return {
      alreadyAssigned: true,
      divisionId: String(existingAssignment._id),
      divisionName: existingAssignment.name,
      gamesCreated: 0,
    };
  }

  const hostUserId = String(tournament.hostUserId);
  let team = null;
  let targetDivision = null;

  const byePlayer = await Player.findOne({
    tournamentId,
    status: 'active',
    teamId: null,
    awaitingPartner: true,
  }).lean();

  if (byePlayer && String(byePlayer._id) !== normalizedPlayerId) {
    team = await pairByeWithPlayer(tournamentId, hostUserId, normalizedPlayerId);
    targetDivision =
      divisions.find((division) =>
        (division.playerIds || []).map((value) => String(value)).includes(String(byePlayer._id))
      ) || pickDivisionForNewTeam(divisions);
  } else {
    targetDivision = pickDivisionForNewPlayer(divisions);
  }

  if (!targetDivision) {
    return null;
  }

  if (!team) {
    await Division.updateOne(
      { _id: targetDivision._id },
      {
        $addToSet: {
          playerIds: normalizedPlayerId,
        },
      }
    );

    await Player.updateOne({ _id: normalizedPlayerId }, { $set: { awaitingPartner: true, teamId: null } });

    return {
      divisionId: String(targetDivision._id),
      divisionName: targetDivision.name,
      gamesCreated: 0,
      awaitingPartner: true,
      alreadyAssigned: false,
    };
  }

  const teamId = String(team.id);
  const opponentTeamIds = (targetDivision.teamIds || [])
    .map((value) => String(value))
    .filter((value) => value !== teamId);

  await Division.updateOne(
    { _id: targetDivision._id },
    {
      $addToSet: {
        playerIds: { $each: [String(team.player1Id), String(team.player2Id)] },
        teamIds: teamId,
      },
    }
  );

  await Team.updateOne({ _id: teamId }, { $set: { divisionId: targetDivision._id } });

  const existingGames = await Game.find({
    tournamentId,
    divisionId: targetDivision._id,
    stage: 'groupStage',
  }).lean();

  const bestOf = parseBestOf(tournament?.competitionConfig?.groupStageBestOf, 1);
  const createdGames = await createIncrementalGroupStageGamesForTeam({
    tournamentId,
    divisionId: String(targetDivision._id),
    newTeamId: teamId,
    opponentTeamIds,
    bestOf,
    existingGames,
  });

  if (createdGames.length > 0) {
    await recomputeLeaderboardForScope(tournamentId, targetDivision._id);
  }

  return {
    divisionId: String(targetDivision._id),
    divisionName: targetDivision.name,
    teamId,
    gamesCreated: createdGames.length,
    alreadyAssigned: false,
  };
};

const syncDoublesApprovedPlayerToGroups = async (tournamentId, userId, divisions, tournament) => {
  const players = await ensurePlayersFromApprovedRegistrations(tournamentId);
  const normalizedUserId = String(userId || '').trim();
  const player = players.find((entry) => String(entry.userId) === normalizedUserId);

  if (!player) {
    return null;
  }

  return syncDoublesApprovedPlayerToGroupsByPlayerId(tournamentId, String(player.id), divisions, tournament);
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

const syncSinglesApprovedPlayerToGroupsByPlayerId = async (tournamentId, playerId, divisions, tournament) => {
  const normalizedPlayerId = String(playerId || '').trim();

  if (!normalizedPlayerId) {
    return null;
  }

  const existingAssignment = divisions.find((division) =>
    (division.playerIds || []).map((value) => String(value)).includes(normalizedPlayerId)
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

  const opponentIds = (targetDivision.playerIds || [])
    .map((value) => String(value))
    .filter((value) => value !== normalizedPlayerId);

  await Division.updateOne(
    {
      _id: targetDivision._id,
    },
    {
      $addToSet: {
        playerIds: normalizedPlayerId,
      },
    }
  );

  const existingGames = await Game.find({
    tournamentId,
    divisionId: targetDivision._id,
    stage: 'groupStage',
  }).lean();

  const bestOf = parseBestOf(tournament?.competitionConfig?.groupStageBestOf, 1);
  const createdGames = await createIncrementalGroupStageGamesForPlayer({
    tournamentId,
    divisionId: String(targetDivision._id),
    newPlayerId: normalizedPlayerId,
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

const syncApprovedPlayerToGroupsByPlayerId = async (tournamentId, playerId) => {
  const divisions = await Division.find({
    tournamentId,
    name: { $ne: 'Final Stage' },
  })
    .sort({ name: 1, _id: 1 })
    .lean();

  if (divisions.length === 0) {
    return null;
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ competitionConfig: 1, hostUserId: 1 })
    .lean();

  if (isDoublesTournament(tournament)) {
    return syncDoublesApprovedPlayerToGroupsByPlayerId(tournamentId, playerId, divisions, tournament);
  }

  return syncSinglesApprovedPlayerToGroupsByPlayerId(tournamentId, playerId, divisions, tournament);
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

  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return null;
  }

  let playerDoc = await Player.findOne({
    tournamentId,
    userId: normalizedUserId,
    status: 'active',
  }).lean();

  if (!playerDoc) {
    await materializeApprovedPlayerForUser(tournamentId, normalizedUserId);
    playerDoc = await Player.findOne({
      tournamentId,
      userId: normalizedUserId,
      status: 'active',
    }).lean();
  }

  if (!playerDoc) {
    return null;
  }

  return syncApprovedPlayerToGroupsByPlayerId(tournamentId, String(playerDoc._id));
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

  await materializeApprovedPlayers(tournamentId);

  const pendingParticipantsCount = await TournamentRegistration.countDocuments({
    tournamentId,
    status: 'underReview',
  });

  return mapHostTournamentDetail(updatedTournament, pendingParticipantsCount);
};

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

const createRoundRobinTeamGamesForStage = async ({ tournamentId, divisionId, stage, teamIds, bestOf }) => {
  const participantIds = [...teamIds];

  if (participantIds.length < 2) {
    return [];
  }

  const rounds = buildRoundRobinRounds(
    participantIds.map((teamId) => ({ id: teamId })),
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
        teamAId: match.playerA.id,
        teamBId: match.playerB.id,
        scoreEntries: [],
        playerASeriesWins: 0,
        playerBSeriesWins: 0,
        winnerTeamId: null,
        status: 'scheduled',
      });
    });
  });

  if (gameDocuments.length === 0) {
    return [];
  }

  const createdGames = await Game.insertMany(gameDocuments);
  const teamSummaryById = await buildTeamSummaryById(
    createdGames.flatMap((game) => [game.teamAId, game.teamBId])
  );

  return createdGames.map((game) =>
    mapGameForScoresheet(game.toObject(), new Map(), new Map(), { teamSummaryById })
  );
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
  const tournament = await Tournament.findById(tournamentId)
    .select({ competitionConfig: 1, progressionState: 1 })
    .lean();
  const handicapEnabled = Boolean(tournament?.competitionConfig?.handicapEnabled);
  const format = tournament?.competitionConfig?.format || 'singles';
  const pairFormationMode = tournament?.competitionConfig?.pairFormationMode || 'playerPicksPartner';
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

    const enrichStandingEntry = (entry) => ({
      ...entry,
      player: divisionPlayerSummaryById.get(String(entry.playerId)) || entry.player || null,
      stats: computePoolStats(entry),
    });

    const mergedStandings = [
      ...rankedStandings.map(enrichStandingEntry),
      ...unrankedPlayerIds.map((playerId, index) =>
        enrichStandingEntry({
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
        })
      ),
    ];

    let teamStandings = [];

    if (format === 'doubles') {
      const teamLeaderboard = await listTournamentLeaderboard(tournamentId, division._id, 'team');
      const divisionTeamIds = (division.teamIds || []).map((value) => String(value));
      const teamSummaryById = await buildTeamSummaryById(divisionTeamIds);
      const rankedTeamStandings = (teamLeaderboard.items || []).filter((entry) =>
        divisionTeamIds.includes(String(entry.teamId))
      );
      const rankedTeamIdSet = new Set(rankedTeamStandings.map((entry) => String(entry.teamId)));
      const unrankedTeamIds = divisionTeamIds.filter((teamId) => !rankedTeamIdSet.has(teamId));

      const enrichTeamStandingEntry = (entry) => ({
        ...entry,
        team: teamSummaryById.get(String(entry.teamId)) || entry.team || null,
        stats: computePoolStats(entry),
      });

      teamStandings = [
        ...rankedTeamStandings.map(enrichTeamStandingEntry),
        ...unrankedTeamIds.map((teamId, index) =>
          enrichTeamStandingEntry({
            id: `group-${String(division._id)}-team-${teamId}`,
            teamId,
            team: teamSummaryById.get(teamId) || null,
            rank: Number(rankedTeamStandings.length + index + 1),
            points: 0,
            wins: 0,
            draws: 0,
            losses: 0,
            scoreFor: 0,
            scoreAgainst: 0,
            scoreDifferential: 0,
          })
        ),
      ];
    }

    groups.push({
      divisionId: String(division._id),
      divisionName: division.name,
      suggestedFinalists:
        format === 'doubles'
          ? teamStandings.slice(0, defaultTopPerGroup).map((entry) => entry.teamId)
          : mergedStandings.slice(0, defaultTopPerGroup).map((entry) => entry.playerId),
      standings: mergedStandings,
      ...(format === 'doubles' ? { teamStandings, playerStandings: mergedStandings } : {}),
    });
  }

  const finalStageEnabled = Boolean(tournament?.competitionConfig?.finalStageEnabled);
  const completedWithFinale =
    tournament?.progressionState === 'completed' && finalStageEnabled;
  let finaleStandings = [];

  if (finalStageEnabled) {
    const finalDivision = await Division.findOne({
      tournamentId,
      name: 'Final Stage',
    }).lean();

    if (finalDivision) {
      if (format === 'doubles') {
        const divisionTeamIds = (finalDivision.teamIds || []).map((value) => String(value));
        const finaleLeaderboard = await listTournamentLeaderboard(tournamentId, finalDivision._id, 'team');
        const teamSummaryById = await buildTeamSummaryById(divisionTeamIds);
        const rankedStandings = (finaleLeaderboard.items || []).filter((entry) =>
          divisionTeamIds.includes(String(entry.teamId))
        );
        const rankedTeamIdSet = new Set(rankedStandings.map((entry) => String(entry.teamId)));
        const unrankedTeamIds = divisionTeamIds.filter((teamId) => !rankedTeamIdSet.has(teamId));

        const enrichFinaleTeamStandingEntry = (entry) => ({
          ...entry,
          team: teamSummaryById.get(String(entry.teamId)) || entry.team || null,
          stats: computePoolStats(entry),
        });

        finaleStandings = [
          ...rankedStandings.map(enrichFinaleTeamStandingEntry),
          ...unrankedTeamIds.map((teamId, index) =>
            enrichFinaleTeamStandingEntry({
              id: `final-${String(finalDivision._id)}-team-${teamId}`,
              teamId,
              team: teamSummaryById.get(teamId) || null,
              rank: Number(rankedStandings.length + index + 1),
              points: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              scoreFor: 0,
              scoreAgainst: 0,
              scoreDifferential: 0,
            })
          ),
        ];
      } else {
        const divisionPlayerIds = (finalDivision.playerIds || []).map((value) => String(value));
        const finaleLeaderboard = await listTournamentLeaderboard(tournamentId, finalDivision._id, 'player');
        const playerSummaryById = await buildPlayerSummaryById(divisionPlayerIds);
        const rankedStandings = (finaleLeaderboard.items || []).filter((entry) =>
          divisionPlayerIds.includes(String(entry.playerId))
        );
        const rankedPlayerIdSet = new Set(rankedStandings.map((entry) => String(entry.playerId)));
        const unrankedPlayerIds = divisionPlayerIds.filter((playerId) => !rankedPlayerIdSet.has(playerId));

        const enrichFinaleStandingEntry = (entry) => ({
          ...entry,
          player: playerSummaryById.get(String(entry.playerId)) || entry.player || null,
          stats: computePoolStats(entry),
        });

        finaleStandings = [
          ...rankedStandings.map(enrichFinaleStandingEntry),
          ...unrankedPlayerIds.map((playerId, index) =>
            enrichFinaleStandingEntry({
              id: `final-${String(finalDivision._id)}-${playerId}`,
              playerId,
              rank: Number(rankedStandings.length + index + 1),
              points: 0,
              wins: 0,
              draws: 0,
              losses: 0,
              scoreFor: 0,
              scoreAgainst: 0,
              scoreDifferential: 0,
            })
          ),
        ];
      }
    }
  }

  const tournamentWinners = completedWithFinale ? finaleStandings.slice(0, 3) : [];

  return {
    tournamentId: String(tournamentId),
    topPerGroup: defaultTopPerGroup,
    handicapEnabled,
    format,
    pairFormationMode,
    progressionState: tournament?.progressionState || 'registration',
    finalStageEnabled,
    completedWithFinale,
    finaleStandings,
    tournamentWinners,
    groups,
  };
};

const listGroupStandings = async (tournamentId, userId, query = {}) => {
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

const assignRandomGroupsDoubles = async (tournamentId, hostUserId, payload = {}, tournament) => {
  if (payload.pairTeamsRandom) {
    await randomPairSolos(tournamentId, hostUserId);
  } else {
    await resolveDoublesPairingForGroupAssign(tournamentId);
  }

  const teams = await Team.find({ tournamentId, status: 'active' }).sort({ createdAt: 1, _id: 1 }).lean();

  if (teams.length < 1) {
    throw new ApiError(409, 'NO_TEAMS', 'At least one team is required before assigning groups');
  }

  const normalizedGroupCount = parsePositiveInteger(payload.groupCount, 2);
  if (normalizedGroupCount > 8) {
    throw new ApiError(400, 'GROUP_COUNT_OUT_OF_RANGE', 'groupCount must be between 1 and 8');
  }

  const groupCount = Math.min(normalizedGroupCount, Math.max(teams.length, 1));
  const groupStageBestOf = parseBestOf(payload.groupStageBestOf, 1);
  const randomTeams = shuffleArray(teams);

  await Division.deleteMany({ tournamentId });
  await Game.deleteMany({ tournamentId, stage: 'groupStage' });
  await Leaderboard.deleteMany({ tournamentId });
  await Team.updateMany({ tournamentId, status: 'active' }, { $set: { divisionId: null } });

  const groups = Array.from({ length: groupCount }, (_, groupIndex) => ({
    name: buildGroupName(groupIndex),
    playerIds: [],
    teamIds: [],
  }));

  randomTeams.forEach((team, index) => {
    const targetGroupIndex = index % groupCount;
    groups[targetGroupIndex].teamIds.push(String(team._id));
    groups[targetGroupIndex].playerIds.push(String(team.player1Id), String(team.player2Id));
  });

  const insertedDivisions = await Division.insertMany(
    groups.map((group) => ({
      tournamentId,
      name: group.name,
      playerIds: group.playerIds,
      teamIds: group.teamIds,
      status: 'open',
    }))
  );

  const createdGamesByDivision = [];

  for (const division of insertedDivisions) {
    const divisionTeamIds = (division.teamIds || []).map((teamId) => String(teamId));

    await Team.updateMany(
      { _id: { $in: divisionTeamIds }, tournamentId, status: 'active' },
      { $set: { divisionId: division._id } }
    );

    const createdGames = await createRoundRobinTeamGamesForStage({
      tournamentId,
      divisionId: String(division._id),
      stage: 'groupStage',
      teamIds: divisionTeamIds,
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
    { _id: tournamentId },
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
    format: 'doubles',
    groups: insertedDivisions.map((division) => ({
      divisionId: String(division._id),
      name: division.name,
      teamCount: (division.teamIds || []).length,
      playerCount: (division.playerIds || []).length,
      teamIds: (division.teamIds || []).map((value) => String(value)),
      playerIds: (division.playerIds || []).map((value) => String(value)),
    })),
    gameSummary: createdGamesByDivision,
  };
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

  if (isDoublesTournament(tournament)) {
    return assignRandomGroupsDoubles(tournamentId, hostUserId, payload, tournament);
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
  const tournament = await assertHostAccess(tournamentId, hostUserId);

  const topPerGroup = Math.min(parsePositiveInteger(payload.topPerGroup, 2), 8);
  const finalStageBestOf = parseBestOf(payload.finalStageBestOf, 3);
  const isDoubles = isDoublesTournament(tournament);
  const finalStageProctored = isDoubles ? false : Boolean(payload.finalStageProctored);

  const divisions = await Division.find({ tournamentId }).sort({ name: 1, _id: 1 }).lean();

  if (divisions.length === 0) {
    throw new ApiError(409, 'GROUPS_NOT_CONFIGURED', 'Groups must be configured before starting finals');
  }

  if (isDoubles) {
    const finalistTeamIds = [];
    const selectedTeamIds = Array.isArray(payload.selectedTeamIds)
      ? [...new Set(payload.selectedTeamIds.map((value) => String(value)).filter(Boolean))]
      : [];

    if (selectedTeamIds.length > 0) {
      const selectedTeams = await Team.find({
        tournamentId,
        _id: { $in: selectedTeamIds },
        status: 'active',
      })
        .select({ _id: 1 })
        .lean();

      if (selectedTeams.length !== selectedTeamIds.length) {
        throw new ApiError(400, 'INVALID_FINALIST_SELECTION', 'One or more selected finalist teams are invalid');
      }

      finalistTeamIds.push(...selectedTeamIds);
    }

    if (selectedTeamIds.length === 0) {
      for (const division of divisions) {
        if (String(division.name || '') === 'Final Stage') {
          continue;
        }

        await recomputeLeaderboardForScope(tournamentId, division._id);
        const teamLeaderboard = await listTournamentLeaderboard(tournamentId, division._id, 'team');
        const topItems = (teamLeaderboard.items || []).slice(0, topPerGroup);

        if (topItems.length > 0) {
          finalistTeamIds.push(...topItems.map((entry) => String(entry.teamId)));
          continue;
        }

        finalistTeamIds.push(...(division.teamIds || []).slice(0, topPerGroup).map((value) => String(value)));
      }
    }

    const uniqueFinalistTeamIds = [...new Set(finalistTeamIds)];

    if (uniqueFinalistTeamIds.length < 2) {
      throw new ApiError(409, 'INSUFFICIENT_FINALISTS', 'Need at least 2 finalist teams to start final stage');
    }

    const finalistTeams = await Team.find({
      tournamentId,
      _id: { $in: uniqueFinalistTeamIds },
      status: 'active',
    }).lean();

    const uniqueFinalistPlayerIds = [
      ...new Set(finalistTeams.flatMap((team) => [String(team.player1Id), String(team.player2Id)])),
    ];

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
          teamIds: uniqueFinalistTeamIds,
          status: 'open',
        })
      ).toObject();
    } else {
      await Division.updateOne(
        { _id: finalDivision._id },
        {
          $set: {
            playerIds: uniqueFinalistPlayerIds,
            teamIds: uniqueFinalistTeamIds,
            status: 'open',
          },
        }
      );
    }

    await Game.deleteMany({
      tournamentId,
      stage: 'finalStage',
    });

    const createdFinalGames = await createRoundRobinTeamGamesForStage({
      tournamentId,
      divisionId: String(finalDivision._id),
      stage: 'finalStage',
      teamIds: uniqueFinalistTeamIds,
      bestOf: finalStageBestOf,
    });

    await recomputeLeaderboardForScope(tournamentId, finalDivision._id);

    await Tournament.updateOne(
      { _id: tournamentId },
      {
        $set: {
          progressionState: 'finalStage',
          'competitionConfig.finalStageEnabled': true,
          'competitionConfig.finalStageBestOf': finalStageBestOf,
          'competitionConfig.finalStageTopPerGroup': topPerGroup,
          'competitionConfig.finalStageProctored': finalStageProctored,
        },
      }
    );

    return {
      tournamentId: String(tournamentId),
      finalDivisionId: String(finalDivision._id),
      format: 'doubles',
      finalistCount: uniqueFinalistTeamIds.length,
      finalistTeamIds: uniqueFinalistTeamIds,
      finalistPlayerIds: uniqueFinalistPlayerIds,
      finalStageBestOf,
      finalStageProctored,
      gameCount: createdFinalGames.length,
    };
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
        'competitionConfig.finalStageProctored': finalStageProctored,
      },
    }
  );

  return {
    tournamentId: String(tournamentId),
    finalDivisionId: String(finalDivision._id),
    finalistCount: uniqueFinalistPlayerIds.length,
    finalistPlayerIds: uniqueFinalistPlayerIds,
    finalStageBestOf,
    finalStageProctored,
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
  addGuestParticipant,
  linkPendingGuestPlayersForUser,
  manuallyRemoveParticipant,
  removeGuestParticipant,
  assignScoreEditor,
  removeScoreEditor,
  requestProctorTransfer,
  acceptProctorTransfer,
  declineProctorTransfer,
  isStageProctored,
  canUserEditGameScores,
  canUserEditTournamentScores,
  assertCanEditTournamentScores,
  assertCanEditGameScores,
  assertUserCanScheduleMatch,
  listTournamentScoresheet,
  updateGameScores,
  updateGameSchedule,
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
  materializeApprovedPlayers,
  materializeApprovedPlayerForUser,
};
