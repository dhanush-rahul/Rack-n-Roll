const Tournament = require('../../models/tournament.model');
const TournamentRegistration = require('../../models/tournamentRegistration.model');
const Player = require('../../models/player.model');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { validateUsernameFormat, normalizeUsername } = require('../username.service');

// ── Parse / normalize helpers ──────────────────────────────────────────────

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

  const groupCount = parsePositiveInteger(
    input?.competitionConfig?.groupCount ?? input?.groupCount,
    null
  );

  const progressionPlan = input?.progressionPlan
    ? require('./progressionPlan.utils').normalizeProgressionPlanInput(input.progressionPlan)
    : { stages: [] };

  if (progressionPlan.stages.length > 0) {
    const validation = require('./progressionPlan.utils').validateProgressionPlan(progressionPlan, { groupCount });
    if (!validation.valid) {
      throw new ApiError(400, 'INVALID_PROGRESSION_PLAN', validation.errors.join(' '));
    }
  }

  return {
    name: String(input?.name || '').trim(),
    hostUserId,
    maxParticipants: Number(input?.maxParticipants),
    registrationMode,
    inviteCode:
      registrationMode === 'inviteOnly'
        ? String(input?.inviteCode || '').trim().toUpperCase()
        : undefined,
    registrationStatus: input?.registrationStatus === 'closed' ? 'closed' : 'open',
    location: normalizeLocation(input?.location),
    startsAt: parseStartsAt(input?.startsAt),
    status: 'draft',
    progressionPlan,
    competitionConfig: {
      format,
      pairFormationMode,
      groupStageBestOf,
      groupCount,
      handicapEnabled: format === 'doubles' ? false : Boolean(input?.competitionConfig?.handicapEnabled ?? input?.handicapEnabled),
      groupStageProctored:
        format === 'doubles'
          ? false
          : Boolean(input?.competitionConfig?.groupStageProctored ?? input?.groupStageProctored ?? false),
      finalStageEnabled: progressionPlan.stages.length > 0,
    },
  };
};

// ── Guest participant helpers ──────────────────────────────────────────────

const guestEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GUEST_NAME_MIN_LENGTH = 2;
const GUEST_NAME_MAX_LENGTH = 120;
const GUEST_EMAIL_MAX_LENGTH = 254;

const normalizeGuestEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeGuestName = (name) => String(name || '').trim().replace(/\s+/g, ' ');

const validateGuestParticipantInput = ({ name, rosterName, username }) => {
  const normalizedName = normalizeGuestName(name || rosterName);

  if (!normalizedName || normalizedName.length < GUEST_NAME_MIN_LENGTH) {
    throw new ApiError(400, 'INVALID_NAME', 'Roster name must be at least 2 characters long');
  }

  if (normalizedName.length > GUEST_NAME_MAX_LENGTH) {
    throw new ApiError(400, 'INVALID_NAME', 'Roster name must be at most 120 characters long');
  }

  const normalizedUsername = validateUsernameFormat(username);

  return { normalizedName, normalizedUsername };
};

// ── Mappers ────────────────────────────────────────────────────────────────

const mapGuestPlayerRosterItem = (player) => ({
  id: String(player._id),
  playerId: String(player._id),
  tournamentId: String(player.tournamentId),
  userId: null,
  status: 'approved',
  isGuest: true,
  guestUsername: player.pendingLinkUsername || null,
  inviteCodeUsed: null,
  reviewedByUserId: player.addedByHostUserId ? String(player.addedByHostUserId) : null,
  reviewedAt: player.createdAt || null,
  createdAt: player.createdAt,
  updatedAt: player.updatedAt,
  user: {
    name: player.displayName,
    username: player.pendingLinkUsername || null,
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
      ? String(tournament.inviteCode || '').trim().toUpperCase() || null
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
  activeStageId: tournament.activeStageId || null,
  progressionPlan: {
    deferred: Boolean(tournament.progressionPlan?.deferred),
    stages: (tournament.progressionPlan?.stages || []).map((stage) => ({
      stageId: String(stage.stageId),
      name: stage.name,
      order: stage.order,
      format: stage.format,
      bestOf: stage.bestOf,
      proctored: Boolean(stage.proctored),
      advancement: {
        source: stage.advancement?.source || 'groups',
        sourceStageId: stage.advancement?.sourceStageId || null,
        topPerGroup: stage.advancement?.topPerGroup ?? null,
        advanceCount: stage.advancement?.advanceCount ?? null,
        selectionMode: stage.advancement?.selectionMode || 'autoStandings',
        poolMode: stage.advancement?.poolMode || 'combined',
        directPromotePerGroup: stage.advancement?.directPromotePerGroup ?? 0,
        bypassTargetStageName: stage.advancement?.bypassTargetStageName || null,
        advancePerGroupPair: stage.advancement?.advancePerGroupPair ?? 1,
      },
      status: stage.status || 'pending',
    })),
  },
  progressionBypass: (tournament.progressionBypass || []).map((entry) => ({
    targetStageName: entry.targetStageName,
    participantIds: (entry.participantIds || []).map(String),
    sourceStageId: entry.sourceStageId || null,
  })),
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
        username: user.username,
        name: user.name,
        email: user.email,
      }
    : null;

const mapRegistrationSummaryWithUser = (registration, userSummaryById) => {
  const summary = mapRegistrationSummary(registration);

  return {
    ...summary,
    user: userSummaryById.get(summary.userId) || null,
  };
};

const mapScoreEditorResponse = (tournament) => ({
  tournamentId: String(tournament._id),
  hostUserId: String(tournament.hostUserId),
  scoreEditorUserIds: (tournament.scoreEditorUserIds || []).map((userId) => String(userId)),
});

// ── Summary builders ───────────────────────────────────────────────────────

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

  const userIds = players.map((player) => player.userId).filter(Boolean);
  const users = userIds.length
    ? await User.find({ _id: { $in: userIds } })
        .select({ _id: 1, username: 1, name: 1 })
        .lean()
    : [];
  const userSummaryById = users.reduce((accumulator, user) => {
    accumulator.set(String(user._id), user);
    return accumulator;
  }, new Map());

  return players.reduce((accumulator, player) => {
    const linkedUser = player.userId ? userSummaryById.get(String(player.userId)) : null;
    const displayName =
      String(player.displayName || '').trim() ||
      String(linkedUser?.username || '').trim() ||
      String(linkedUser?.name || '').trim() ||
      null;

    accumulator.set(String(player._id), {
      id: String(player._id),
      userId: player.userId ? String(player.userId) : null,
      displayName,
      username: linkedUser?.username ? String(linkedUser.username) : null,
      handicapEnabled: Boolean(player.handicapEnabled),
      handicapValue: Number(player.handicapValue || 0),
    });
    return accumulator;
  }, new Map());
};

// ── Discover filter/sort ───────────────────────────────────────────────────

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

// ── Capacity helpers ───────────────────────────────────────────────────────

const ensureApprovedParticipantsCountInitialized = async (tournamentId) => {
  const [approvedRegistrationCount, guestPlayerCount] = await Promise.all([
    TournamentRegistration.countDocuments({ tournamentId, status: 'approved' }),
    Player.countDocuments({
      tournamentId,
      status: 'active',
      userId: null,
      $or: [
        { pendingLinkEmail: { $type: 'string', $ne: null } },
        { pendingLinkUsername: { $type: 'string', $ne: null } },
      ],
    }),
  ]);

  const approvedCount = approvedRegistrationCount + guestPlayerCount;

  await Tournament.updateOne(
    {
      _id: tournamentId,
      $or: [{ approvedParticipantsCount: { $exists: false } }, { approvedParticipantsCount: null }],
    },
    { $set: { approvedParticipantsCount: approvedCount } }
  );
};

const reserveApprovalCapacitySlot = async (tournamentId) => {
  await ensureApprovedParticipantsCountInitialized(tournamentId);

  const reservedCapacity = await Tournament.findOneAndUpdate(
    { _id: tournamentId },
    { $inc: { approvedParticipantsCount: 1 } },
    { new: false }
  ).lean();

  if (!reservedCapacity) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }
};

const releaseApprovalCapacitySlot = async (tournamentId) => {
  await Tournament.updateOne(
    { _id: tournamentId, approvedParticipantsCount: { $gt: 0 } },
    { $inc: { approvedParticipantsCount: -1 } }
  );
};

// ── Access control ─────────────────────────────────────────────────────────

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

// ── Stage / proctoring helpers ─────────────────────────────────────────────

const isStageProctored = (competitionConfig = {}, stageId = 'groupStage', tournament = null) => {
  if (stageId === 'groupStage') {
    return Boolean(competitionConfig.groupStageProctored);
  }

  const stage = (tournament?.progressionPlan?.stages || []).find(
    (entry) => String(entry.stageId) === String(stageId)
  );

  if (stage) {
    return Boolean(stage.proctored);
  }

  if (stageId === 'finalStage') {
    return Boolean(competitionConfig.finalStageProctored);
  }

  return false;
};

const isActiveTournamentParticipant = async (tournamentId, userId) => {
  if (!userId) {
    return false;
  }

  const player = await Player.findOne({ tournamentId, userId, status: 'active' })
    .select({ _id: 1 })
    .lean();

  return Boolean(player);
};

// ── Round-robin algorithm ──────────────────────────────────────────────────

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

      roundMatches.push({ matchNumber: matchIndex + 1, playerA, playerB });
    }

    baseRounds.push({ roundNumber: roundIndex + 1, matches: roundMatches });
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

// ── Division scope helpers ─────────────────────────────────────────────────

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

// ── Score computation ──────────────────────────────────────────────────────

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

    return { gameNumber, playerAScore, playerBScore };
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

// ── Fixture division helpers ───────────────────────────────────────────────

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

module.exports = {
  normalizeLocation,
  parseStartsAt,
  parseBestOf,
  parsePositiveInteger,
  shuffleArray,
  getMajorSequenceLabel,
  buildGroupName,
  escapeRegex,
  normalizeTournamentInput,
  guestEmailRegex,
  GUEST_NAME_MIN_LENGTH,
  GUEST_NAME_MAX_LENGTH,
  GUEST_EMAIL_MAX_LENGTH,
  normalizeGuestEmail,
  normalizeGuestName,
  validateGuestParticipantInput,
  mapGuestPlayerRosterItem,
  mapTournamentForDiscovery,
  mapHostTournamentDetail,
  mapRegistrationSummary,
  mapUserSummary,
  mapRegistrationSummaryWithUser,
  mapScoreEditorResponse,
  buildUserSummaryById,
  buildPlayerSummaryById,
  buildDiscoverFilter,
  buildDiscoverSort,
  ensureApprovedParticipantsCountInitialized,
  reserveApprovalCapacitySlot,
  releaseApprovalCapacitySlot,
  assertHostAccess,
  isStageProctored,
  isActiveTournamentParticipant,
  rotateRoundRobinParticipants,
  buildRoundRobinRounds,
  normalizeDivisionScopeValue,
  buildScopeFilter,
  normalizeScoreEntries,
  computeSeriesOutcome,
  pickDivisionForNewPlayer,
  countPairGames,
  countPairTeamGames,
  pickDivisionForNewTeam,
};
