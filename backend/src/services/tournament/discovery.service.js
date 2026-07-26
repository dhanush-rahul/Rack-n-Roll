const mongoose = require('mongoose');
const Tournament = require('../../models/tournament.model');
const TournamentRegistration = require('../../models/tournamentRegistration.model');
const Player = require('../../models/player.model');
const Game = require('../../models/game.model');
const ApiError = require('../../utils/ApiError');
const cache = require('../../utils/cache');
const { materializeApprovedPlayers } = require('./roster.service');

const invalidateDiscoverCache = () => {
  cache.delByPrefix('discover:');
};
const {
  assertHostAccess,
  parsePositiveInteger,
  normalizeTournamentInput,
  mapTournamentForDiscovery,
  mapHostTournamentDetail,
  buildDiscoverFilter,
  buildDiscoverSort,
} = require('./shared');

const createTournament = async (payload, hostUserId) => {
  const normalizedPayload = normalizeTournamentInput(payload, hostUserId);

  if (!normalizedPayload.name) {
    throw new ApiError(400, 'INVALID_NAME', 'Tournament name is required');
  }

  if (!Number.isFinite(normalizedPayload.maxParticipants) || normalizedPayload.maxParticipants < 1) {
    throw new ApiError(400, 'INVALID_MAX_PARTICIPANTS', 'maxParticipants must be at least 1');
  }

  const createdTournament = await Tournament.create(normalizedPayload);

  invalidateDiscoverCache();

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

const listMyRegisteredDiscoverTournaments = async (userId) => {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return { items: [] };
  }

  const registrations = await TournamentRegistration.find({
    userId: normalizedUserId,
    status: { $in: ['underReview', 'approved'] },
  })
    .select({ tournamentId: 1, status: 1 })
    .lean();

  if (registrations.length === 0) {
    return { items: [] };
  }

  const registrationStatusByTournamentId = registrations.reduce((accumulator, registration) => {
    accumulator.set(String(registration.tournamentId), registration.status);
    return accumulator;
  }, new Map());

  const tournamentIds = [...registrationStatusByTournamentId.keys()];
  const tournaments = await Tournament.find({ _id: { $in: tournamentIds } }).lean();

  const items = tournaments
    .sort((left, right) => {
      const leftTime = left.startsAt ? new Date(left.startsAt).getTime() : Number.NEGATIVE_INFINITY;
      const rightTime = right.startsAt ? new Date(right.startsAt).getTime() : Number.NEGATIVE_INFINITY;

      if (leftTime !== rightTime) {
        return rightTime - leftTime;
      }

      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    })
    .map((tournament) =>
      mapTournamentForDiscovery(
        tournament,
        registrationStatusByTournamentId.get(String(tournament._id)) || null
      )
    );

  return { items };
};

const parseMyEventsFilterIds = (filterValue) => {
  const rawParts = String(filterValue || 'all')
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawParts.length === 0 || rawParts.includes('all')) {
    return [];
  }

  return [...new Set(rawParts.filter((part) => ['hosting', 'playing', 'pending'].includes(part)))];
};

const matchesMyEventsRoleFilters = (item, filterIds) => {
  if (!filterIds.length) {
    return true;
  }

  const isHost = (item.roles || []).includes('host');
  const isPending = item.currentUserRegistrationStatus === 'underReview';

  return filterIds.some((filterId) => {
    if (filterId === 'hosting') {
      return isHost;
    }

    if (filterId === 'playing') {
      return !isHost && !isPending;
    }

    if (filterId === 'pending') {
      return isPending;
    }

    return false;
  });
};

const listMyTournaments = async (userId, query = {}) => {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return {
      items: [],
      pagination: { page: 1, pageSize: 20, total: 0, totalPages: 0 },
      stats: { total: 0, hostingCount: 0, playingCount: 0 },
    };
  }

  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, 20);
  const pageSize = Math.min(requestedPageSize, 50);
  const sortId = String(query.sort || 'activity').trim();
  const filterIds = parseMyEventsFilterIds(query.filter);
  const searchTerm = String(query.q || query.search || '').trim().toLowerCase();

  const [hostedTournaments, registrations, players] = await Promise.all([
    Tournament.find({ hostUserId: normalizedUserId }).select({ _id: 1 }).lean(),
    TournamentRegistration.find({
      userId: normalizedUserId,
      status: { $in: ['underReview', 'approved'] },
    })
      .select({ tournamentId: 1, status: 1 })
      .lean(),
    Player.find({ userId: normalizedUserId, status: 'active' }).select({ _id: 1, tournamentId: 1 }).lean(),
  ]);

  const registrationStatusByTournamentId = registrations.reduce((accumulator, registration) => {
    accumulator.set(String(registration.tournamentId), registration.status);
    return accumulator;
  }, new Map());

  const rolesByTournamentId = new Map();

  hostedTournaments.forEach((tournament) => {
    const tournamentId = String(tournament._id);
    const roles = rolesByTournamentId.get(tournamentId) || [];
    if (!roles.includes('host')) {
      roles.push('host');
    }
    rolesByTournamentId.set(tournamentId, roles);
  });

  registrations.forEach((registration) => {
    const tournamentId = String(registration.tournamentId);
    const roles = rolesByTournamentId.get(tournamentId) || [];
    if (!roles.includes('registered')) {
      roles.push('registered');
    }
    rolesByTournamentId.set(tournamentId, roles);
  });

  players.forEach((player) => {
    const tournamentId = String(player.tournamentId);
    const roles = rolesByTournamentId.get(tournamentId) || [];
    if (!roles.includes('player')) {
      roles.push('player');
    }
    rolesByTournamentId.set(tournamentId, roles);
  });

  const tournamentIds = [...rolesByTournamentId.keys()];

  if (tournamentIds.length === 0) {
    return {
      items: [],
      pagination: { page, pageSize, total: 0, totalPages: 0 },
      stats: { total: 0, hostingCount: 0, playingCount: 0 },
    };
  }

  const playerIds = players.map((player) => player._id);
  const lastActivityByTournamentId = new Map();

  if (playerIds.length > 0) {
    const tournamentObjectIds = tournamentIds.map((id) => new mongoose.Types.ObjectId(id));
    const activityRows = await Game.aggregate([
      {
        $match: {
          tournamentId: { $in: tournamentObjectIds },
          $or: [{ playerAId: { $in: playerIds } }, { playerBId: { $in: playerIds } }],
        },
      },
      {
        $group: {
          _id: '$tournamentId',
          lastMatchActivityAt: { $max: '$updatedAt' },
        },
      },
    ]);

    activityRows.forEach((row) => {
      lastActivityByTournamentId.set(String(row._id), row.lastMatchActivityAt);
    });
  }

  const tournaments = await Tournament.find({ _id: { $in: tournamentIds } }).lean();

  const allItems = tournaments
    .map((tournament) => {
      const tournamentId = String(tournament._id);
      const lastMatchActivityAt =
        lastActivityByTournamentId.get(tournamentId) ||
        tournament.updatedAt ||
        tournament.startsAt ||
        tournament.createdAt;

      return {
        ...mapTournamentForDiscovery(
          tournament,
          registrationStatusByTournamentId.get(tournamentId) || null
        ),
        roles: rolesByTournamentId.get(tournamentId) || [],
        lastMatchActivityAt,
      };
    })
    .sort(
      (left, right) =>
        new Date(right.lastMatchActivityAt).getTime() - new Date(left.lastMatchActivityAt).getTime()
    );

  const stats = {
    total: allItems.length,
    hostingCount: allItems.filter((item) => (item.roles || []).includes('host')).length,
    playingCount: allItems.filter((item) => {
      const isHost = (item.roles || []).includes('host');
      const isPending = item.currentUserRegistrationStatus === 'underReview';
      return !isHost && !isPending;
    }).length,
  };

  let filteredItems = allItems.filter((item) => {
    if (!matchesMyEventsRoleFilters(item, filterIds)) {
      return false;
    }

    if (searchTerm && !String(item.name || '').toLowerCase().includes(searchTerm)) {
      return false;
    }

    return true;
  });

  filteredItems = [...filteredItems].sort((left, right) => {
    if (sortId === 'startsSoon') {
      return new Date(left.startsAt || 0).getTime() - new Date(right.startsAt || 0).getTime();
    }

    if (sortId === 'name') {
      return String(left.name || '').localeCompare(String(right.name || ''));
    }

    if (sortId === 'newest') {
      return new Date(right.createdAt || 0).getTime() - new Date(left.createdAt || 0).getTime();
    }

    return new Date(right.lastMatchActivityAt || 0).getTime() - new Date(left.lastMatchActivityAt || 0).getTime();
  });

  const total = filteredItems.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / pageSize);
  const items = filteredItems.slice((page - 1) * pageSize, page * pageSize);

  return {
    items,
    pagination: { page, pageSize, total, totalPages },
    stats,
  };
};

const listDiscoverTournaments = async (query = {}, userId) => {
  const page = parsePositiveInteger(query.page, 1);
  const requestedPageSize = parsePositiveInteger(query.pageSize, 20);
  const pageSize = Math.min(requestedPageSize, 50);
  const discoverFilter = buildDiscoverFilter(query);
  const discoverSort = buildDiscoverSort(query.sort);

  // Cache only the viewer-independent base list. Per-user registration status is
  // merged in below and intentionally stays uncached.
  const { items, total } = await cache.getOrSet(
    `discover:${cache.stableStringify({ filter: discoverFilter, sort: discoverSort, page, pageSize })}`,
    cache.ttls().discover,
    async () => {
      const [foundItems, foundTotal] = await Promise.all([
        Tournament.find(discoverFilter)
          .sort(discoverSort)
          .skip((page - 1) * pageSize)
          .limit(pageSize)
          .lean(),
        Tournament.countDocuments(discoverFilter),
      ]);

      return { items: foundItems, total: foundTotal };
    }
  );

  const tournamentIds = items.map((item) => item._id);

  const existingRegistrations = userId && tournamentIds.length > 0
    ? await TournamentRegistration.find({ tournamentId: { $in: tournamentIds }, userId })
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
    pagination: { page, pageSize, total, totalPages },
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

  const normalizedInputCode = String(inviteCodeInput || '').trim().toUpperCase();

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
    { _id: tournamentId, hostUserId },
    { $set: updates },
    { new: true }
  ).lean();

  if (!updatedTournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  invalidateDiscoverCache();

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
    { _id: tournamentId, hostUserId, registrationStatus: 'open' },
    { $set: { registrationStatus: 'closed', progressionState: 'groupSetup' } },
    { new: true }
  ).lean();

  if (!updatedTournament) {
    throw new ApiError(409, 'REGISTRATION_ALREADY_CLOSED', 'Registration is already closed');
  }

  invalidateDiscoverCache();

  await materializeApprovedPlayers(tournamentId);

  const pendingParticipantsCount = await TournamentRegistration.countDocuments({
    tournamentId,
    status: 'underReview',
  });

  return mapHostTournamentDetail(updatedTournament, pendingParticipantsCount);
};

module.exports = {
  createTournament,
  listDiscoverTournaments,
  listMyRegisteredDiscoverTournaments,
  listMyTournaments,
  getHostTournamentDetail,
  validateInviteCodeForTournament,
  updateHostTournamentSettings,
  closeTournamentRegistration,
};
