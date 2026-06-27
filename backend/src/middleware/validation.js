const mongoose = require('mongoose');
const ApiError = require('../utils/ApiError');

const objectIdPattern = /^[a-f\d]{24}$/i;

const isObjectId = (value) => typeof value === 'string' && objectIdPattern.test(value);

const parseBody = (req) => (req.body && typeof req.body === 'object' ? req.body : {});

const parsePathParts = (req) => String(req.path || '').split('/').filter(Boolean);

const resolvePathParam = (req, key) => {
  const explicitParamValue = req.params?.[key];

  if (explicitParamValue !== undefined && explicitParamValue !== null && explicitParamValue !== '') {
    return explicitParamValue;
  }

  const pathParts = parsePathParts(req);

  if (pathParts[0] !== 'api' || pathParts[1] !== 'tournaments') {
    return undefined;
  }

  if (key === 'tournamentId') {
    return pathParts[2];
  }

  if (key === 'registrationId' && pathParts[3] === 'registrations') {
    return pathParts[4];
  }

  if (key === 'userId' && pathParts[3] === 'participants') {
    return pathParts[4];
  }

  if (key === 'editorUserId' && pathParts[3] === 'score-editors') {
    return pathParts[4];
  }

  if (key === 'gameId' && pathParts[3] === 'games') {
    return pathParts[4];
  }

  return undefined;
};

const ensureObjectIdValue = (value, key) => {
  if (!isObjectId(value) || !mongoose.Types.ObjectId.isValid(value)) {
    throw new ApiError(400, 'INVALID_ID', `${key} must be a valid ObjectId`);
  }
};

const ensureObjectIdParam = (req, key) => {
  const value = resolvePathParam(req, key);

  ensureObjectIdValue(value, key);

  req.params = {
    ...(req.params || {}),
    [key]: value,
  };
};

const ensureOptionalObjectIdParam = (source, key) => {
  const value = source?.[key];

  if (value === undefined || value === null || value === '') {
    return;
  }

  ensureObjectIdValue(value, key);
};

const ensureString = (value, minLength = 1) => typeof value === 'string' && value.trim().length >= minLength;

const ensurePositiveInteger = (value) => Number.isInteger(value) && value > 0;

const validateCreateTournament = (req) => {
  const body = parseBody(req);

  if (!ensureString(body.name, 3)) {
    throw new ApiError(400, 'INVALID_NAME', 'name must be at least 3 characters');
  }

  if (!ensurePositiveInteger(Number(body.maxParticipants))) {
    throw new ApiError(400, 'INVALID_MAX_PARTICIPANTS', 'maxParticipants must be an integer greater than 0');
  }

  if (!['public', 'inviteOnly', undefined].includes(body.registrationMode)) {
    throw new ApiError(400, 'INVALID_REGISTRATION_MODE', 'registrationMode must be public or inviteOnly');
  }

  if (!['open', 'closed', undefined].includes(body.registrationStatus)) {
    throw new ApiError(400, 'INVALID_REGISTRATION_STATUS', 'registrationStatus must be open or closed');
  }

  if (body.registrationMode === 'inviteOnly' && !ensureString(body.inviteCode, 4)) {
    throw new ApiError(400, 'INVITE_CODE_REQUIRED', 'inviteCode is required for invite-only tournaments');
  }

  const location = body.location;

  if (!location || typeof location !== 'object') {
    throw new ApiError(400, 'INVALID_LOCATION', 'location is required');
  }

  if (!ensureString(location.formattedAddress, 1)) {
    throw new ApiError(400, 'INVALID_FORMATTED_ADDRESS', 'location.formattedAddress is required');
  }

  const hasLng = location.lng !== undefined && location.lng !== null && location.lng !== '';
  const hasLat = location.lat !== undefined && location.lat !== null && location.lat !== '';

  if (hasLng !== hasLat) {
    throw new ApiError(400, 'INVALID_COORDINATES', 'location lng and lat must both be provided when either is set');
  }

  if (hasLng) {
    const lng = Number(location.lng);
    const lat = Number(location.lat);

    if (!Number.isFinite(lng) || !Number.isFinite(lat)) {
      throw new ApiError(400, 'INVALID_COORDINATES', 'location lng and lat must be numeric');
    }

    if (lng < -180 || lng > 180 || lat < -90 || lat > 90) {
      throw new ApiError(400, 'INVALID_COORDINATES', 'location lng and lat are out of range');
    }
  }

  const startsAtValue = body.startsAt;
  const parsedStartsAt = startsAtValue instanceof Date ? startsAtValue : new Date(startsAtValue);

  if (!parsedStartsAt || Number.isNaN(parsedStartsAt.getTime())) {
    throw new ApiError(400, 'INVALID_STARTS_AT', 'startsAt must be a valid date-time');
  }

  const groupStageBestOf =
    body.competitionConfig?.groupStageBestOf ?? body.groupStageBestOf;

  if (groupStageBestOf !== undefined && groupStageBestOf !== null && groupStageBestOf !== '') {
    const parsed = Number.parseInt(groupStageBestOf, 10);
    if (![1, 3, 5, 7].includes(parsed)) {
      throw new ApiError(400, 'INVALID_GROUP_STAGE_BEST_OF', 'groupStageBestOf must be 1, 3, 5, or 7');
    }
  }

  const handicapFlag =
    body.competitionConfig?.handicapEnabled ?? body.handicapEnabled;
  if (handicapFlag !== undefined && typeof handicapFlag !== 'boolean') {
    throw new ApiError(400, 'INVALID_HANDICAP_FLAG', 'handicapEnabled must be a boolean');
  }
};

const validateInviteCodePayload = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const body = parseBody(req);

  if (body.inviteCode !== undefined && typeof body.inviteCode !== 'string') {
    throw new ApiError(400, 'INVALID_INVITE_CODE', 'inviteCode must be a string when provided');
  }
};

const validateSubmitRegistration = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const body = parseBody(req);

  if (body.inviteCode !== undefined && typeof body.inviteCode !== 'string') {
    throw new ApiError(400, 'INVALID_INVITE_CODE', 'inviteCode must be a string when provided');
  }
};

const validatePendingListQuery = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const { page, pageSize } = req.query || {};

  if (page !== undefined && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    throw new ApiError(400, 'INVALID_PAGE', 'page must be a positive integer');
  }

  if (pageSize !== undefined && (!Number.isInteger(Number(pageSize)) || Number(pageSize) < 1)) {
    throw new ApiError(400, 'INVALID_PAGE_SIZE', 'pageSize must be a positive integer');
  }
};

const validateHostTournamentDetail = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
};

const validateHostRegistrationListQuery = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const { page, pageSize } = req.query || {};

  if (page !== undefined && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    throw new ApiError(400, 'INVALID_PAGE', 'page must be a positive integer');
  }

  if (pageSize !== undefined && (!Number.isInteger(Number(pageSize)) || Number(pageSize) < 1)) {
    throw new ApiError(400, 'INVALID_PAGE_SIZE', 'pageSize must be a positive integer');
  }
};

const validateManualAddSearchQuery = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const { q, limit } = req.query || {};

  if (!ensureString(q, 2)) {
    throw new ApiError(400, 'INVALID_SEARCH_QUERY', 'q must be at least 2 characters');
  }

  if (limit !== undefined && (!Number.isInteger(Number(limit)) || Number(limit) < 1)) {
    throw new ApiError(400, 'INVALID_LIMIT', 'limit must be a positive integer');
  }
};

const validateRegistrationReview = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  ensureObjectIdParam(req, 'registrationId');
};

const validateManualAddParticipant = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const userId = parseBody(req).userId;

  if (!isObjectId(userId) || !mongoose.Types.ObjectId.isValid(userId)) {
    throw new ApiError(400, 'INVALID_ID', 'userId must be a valid ObjectId');
  }
};

const validateGuestAddParticipant = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const body = parseBody(req);
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();

  if (name.length < 2) {
    throw new ApiError(400, 'INVALID_NAME', 'Name must be at least 2 characters long');
  }

  if (!email) {
    throw new ApiError(400, 'INVALID_EMAIL', 'A valid email address is required');
  }
};

const validateRemoveGuestParticipant = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  ensureObjectIdParam(req, 'playerId');
};

const validateUpdateHostTournamentSettings = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const body = parseBody(req);

  if (body.maxParticipants === undefined) {
    throw new ApiError(400, 'INVALID_MAX_PARTICIPANTS', 'maxParticipants is required');
  }

  if (!ensurePositiveInteger(Number(body.maxParticipants))) {
    throw new ApiError(400, 'INVALID_MAX_PARTICIPANTS', 'maxParticipants must be an integer greater than 0');
  }
};

const validateManualRemoveParticipant = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  ensureObjectIdParam(req, 'userId');
};

const validateAssignScoreEditor = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const editorUserId = parseBody(req).editorUserId;

  if (!isObjectId(editorUserId) || !mongoose.Types.ObjectId.isValid(editorUserId)) {
    throw new ApiError(400, 'INVALID_ID', 'editorUserId must be a valid ObjectId');
  }
};

const validateRemoveScoreEditor = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  ensureObjectIdParam(req, 'editorUserId');
};

const validateProctorTransferRequest = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  const targetUserId = parseBody(req).targetUserId;

  if (!isObjectId(targetUserId) || !mongoose.Types.ObjectId.isValid(targetUserId)) {
    throw new ApiError(400, 'INVALID_ID', 'targetUserId must be a valid ObjectId');
  }
};

const validateProctorTransferAction = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
};

const validateLiveMatchGameRoute = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  ensureObjectIdParam(req, 'gameId');
};

const validateEndSeriesGame = (req) => {
  validateLiveMatchGameRoute(req);
  const body = parseBody(req);
  if (!isObjectId(body.winnerPlayerId) || !mongoose.Types.ObjectId.isValid(body.winnerPlayerId)) {
    throw new ApiError(400, 'INVALID_ID', 'winnerPlayerId must be a valid ObjectId');
  }
  const allowed = ['potted8', 'scratchOn8', 'potted8NotCalled', 'potted8BeforeEnd'];
  if (!allowed.includes(body.endReason)) {
    throw new ApiError(400, 'INVALID_END_REASON', `endReason must be one of: ${allowed.join(', ')}`);
  }
};

const validateScoresheetList = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
};

const validateUpdateGameScores = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  ensureObjectIdParam(req, 'gameId');
  const body = parseBody(req);

  if (body.status !== undefined && !['scheduled', 'inProgress', 'completed'].includes(body.status)) {
    throw new ApiError(400, 'INVALID_GAME_STATUS', 'status must be scheduled, inProgress, or completed');
  }

  if (!Array.isArray(body.scoreEntries) || body.scoreEntries.length === 0) {
    throw new ApiError(400, 'INVALID_SCORE_ENTRIES', 'scoreEntries must be a non-empty array');
  }
};

const validateLeaderboardRead = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  ensureOptionalObjectIdParam(req.query, 'divisionId');
};

const validateLeaderboardRecompute = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
  ensureOptionalObjectIdParam(parseBody(req), 'divisionId');
};

const validateRoundRobinPatternRead = (req) => {
  ensureObjectIdParam(req, 'tournamentId');
};

const validateDiscoveryQuery = (req) => {
  const { page, pageSize, sort, q, search } = req.query || {};

  if (page !== undefined && (!Number.isInteger(Number(page)) || Number(page) < 1)) {
    throw new ApiError(400, 'INVALID_PAGE', 'page must be a positive integer');
  }

  if (pageSize !== undefined && (!Number.isInteger(Number(pageSize)) || Number(pageSize) < 1)) {
    throw new ApiError(400, 'INVALID_PAGE_SIZE', 'pageSize must be a positive integer');
  }

  if (sort !== undefined && !['newest', 'oldest', 'startsSoon', 'startsLatest'].includes(sort)) {
    throw new ApiError(
      400,
      'INVALID_SORT',
      'sort must be newest, oldest, startsSoon, or startsLatest'
    );
  }

  const searchTerm = typeof q === 'string' ? q : typeof search === 'string' ? search : '';

  if (searchTerm.length > 120) {
    throw new ApiError(400, 'INVALID_SEARCH', 'search query must be 120 characters or fewer');
  }
};

const routeValidators = [
  { method: 'GET', regex: /^\/api\/tournaments\/discover$/, validate: validateDiscoveryQuery },
  { method: 'POST', regex: /^\/api\/tournaments$/, validate: validateCreateTournament },
  {
    method: 'GET',
    regex: /^\/api\/tournaments\/[^/]+\/host-detail$/,
    validate: validateHostTournamentDetail,
  },
  {
    method: 'PATCH',
    regex: /^\/api\/tournaments\/[^/]+\/settings$/,
    validate: validateUpdateHostTournamentSettings,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/validate-invite-code$/,
    validate: validateInviteCodePayload,
  },
  { method: 'POST', regex: /^\/api\/tournaments\/[^/]+\/registrations$/, validate: validateSubmitRegistration },
  {
    method: 'GET',
    regex: /^\/api\/tournaments\/[^/]+\/registrations\/pending$/,
    validate: validatePendingListQuery,
  },
  {
    method: 'GET',
    regex: /^\/api\/tournaments\/[^/]+\/registrations\/host-list$/,
    validate: validateHostRegistrationListQuery,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/registrations\/[^/]+\/(approve|reject)$/,
    validate: validateRegistrationReview,
  },
  {
    method: 'GET',
    regex: /^\/api\/tournaments\/[^/]+\/participants\/search$/,
    validate: validateManualAddSearchQuery,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/participants\/manual-add$/,
    validate: validateManualAddParticipant,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/participants\/guest-add$/,
    validate: validateGuestAddParticipant,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/participants\/[^/]+\/remove$/,
    validate: validateManualRemoveParticipant,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/participants\/guest\/[^/]+\/remove$/,
    validate: validateRemoveGuestParticipant,
  },
  { method: 'POST', regex: /^\/api\/tournaments\/[^/]+\/score-editors$/, validate: validateAssignScoreEditor },
  {
    method: 'DELETE',
    regex: /^\/api\/tournaments\/[^/]+\/score-editors\/[^/]+$/,
    validate: validateRemoveScoreEditor,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/proctor-transfer$/,
    validate: validateProctorTransferRequest,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/proctor-transfer\/accept$/,
    validate: validateProctorTransferAction,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/proctor-transfer\/decline$/,
    validate: validateProctorTransferAction,
  },
  { method: 'GET', regex: /^\/api\/tournaments\/[^/]+\/scoresheet$/, validate: validateScoresheetList },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/start$/,
    validate: validateLiveMatchGameRoute,
  },
  {
    method: 'GET',
    regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/live$/,
    validate: validateLiveMatchGameRoute,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/live\/takeover-request$/,
    validate: validateLiveMatchGameRoute,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/live\/handoff$/,
    validate: validateLiveMatchGameRoute,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/live\/takeover-decline$/,
    validate: validateLiveMatchGameRoute,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/live\/takeover-cancel$/,
    validate: validateLiveMatchGameRoute,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/live\/takeover-force$/,
    validate: validateLiveMatchGameRoute,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/turns\/advance$/,
    validate: validateLiveMatchGameRoute,
  },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/end-series-game$/,
    validate: validateEndSeriesGame,
  },
  { method: 'PUT', regex: /^\/api\/tournaments\/[^/]+\/games\/[^/]+\/scores$/, validate: validateUpdateGameScores },
  { method: 'GET', regex: /^\/api\/tournaments\/[^/]+\/leaderboard$/, validate: validateLeaderboardRead },
  {
    method: 'POST',
    regex: /^\/api\/tournaments\/[^/]+\/leaderboard\/recompute$/,
    validate: validateLeaderboardRecompute,
  },
  {
    method: 'GET',
    regex: /^\/api\/tournaments\/[^/]+\/playing-pattern\/round-robin$/,
    validate: validateRoundRobinPatternRead,
  },
];

const validationMiddleware = (req, res, next) => {
  try {
    const validatorEntry = routeValidators.find(
      (entry) => entry.method === req.method && entry.regex.test(req.path)
    );

    if (validatorEntry) {
      validatorEntry.validate(req);
    }

    return next();
  } catch (error) {
    return next(error);
  }
};

module.exports = { validationMiddleware };
