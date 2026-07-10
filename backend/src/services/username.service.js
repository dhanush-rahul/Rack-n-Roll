const User = require('../models/user.model');
const Player = require('../models/player.model');
const ApiError = require('../utils/ApiError');

const USERNAME_MIN_LENGTH = 3;
const USERNAME_MAX_LENGTH = 20;
const USERNAME_MAX_CHANGE_COUNT = 2;
const usernameRegex = /^[a-z0-9_]+$/;

const sanitizeUsernameBase = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

const normalizeUsername = (username) => sanitizeUsernameBase(username);

const normalizeNamePart = (value) => String(value || '').trim().replace(/\s+/g, ' ');

const buildDisplayName = (firstName, lastName, fallback = '') => {
  const normalized = normalizeNamePart(`${normalizeNamePart(firstName)} ${normalizeNamePart(lastName)}`);

  if (normalized.length >= 2) {
    return normalized.slice(0, 100);
  }

  const legacy = normalizeNamePart(fallback);
  return legacy.length >= 2 ? legacy.slice(0, 100) : 'Player';
};

const parseNameParts = (fullName) => {
  const normalized = normalizeNamePart(fullName);
  const parts = normalized.split(' ').filter(Boolean);

  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }

  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }

  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  };
};

const validateUsernameFormat = (username) => {
  const normalized = normalizeUsername(username);

  if (!normalized || normalized.length < USERNAME_MIN_LENGTH) {
    throw new ApiError(400, 'INVALID_USERNAME', `Username must be at least ${USERNAME_MIN_LENGTH} characters`);
  }

  if (normalized.length > USERNAME_MAX_LENGTH) {
    throw new ApiError(400, 'INVALID_USERNAME', `Username must be at most ${USERNAME_MAX_LENGTH} characters`);
  }

  if (!usernameRegex.test(normalized)) {
    throw new ApiError(
      400,
      'INVALID_USERNAME',
      'Username may only contain lowercase letters, numbers, and underscores'
    );
  }

  return normalized;
};

const buildMigrationUsernameBase = (name, email) => {
  const { firstName, lastName } = parseNameParts(name);
  const fromName = sanitizeUsernameBase(lastName || firstName);

  if (fromName.length >= USERNAME_MIN_LENGTH) {
    return fromName.slice(0, USERNAME_MAX_LENGTH - 2);
  }

  const localPart = String(email || '').split('@')[0] || '';
  const fromEmail = sanitizeUsernameBase(localPart);

  if (fromEmail.length >= USERNAME_MIN_LENGTH) {
    return fromEmail.slice(0, USERNAME_MAX_LENGTH - 2);
  }

  return 'player';
};

const buildMigrationUsernameSuffix = (email) => {
  const localPart = String(email || '').split('@')[0] || '';
  const digits = localPart.replace(/\D/g, '');
  const suffix = digits.slice(-2) || localPart.slice(-2) || '00';
  return sanitizeUsernameBase(suffix).padStart(2, '0').slice(-2);
};

const buildMigrationUsernameCandidate = (name, email) => {
  const base = buildMigrationUsernameBase(name, email);
  const suffix = buildMigrationUsernameSuffix(email);
  const combined = `${base}${suffix}`.slice(0, USERNAME_MAX_LENGTH);

  if (combined.length >= USERNAME_MIN_LENGTH) {
    return combined;
  }

  return `${base}00`.slice(0, USERNAME_MAX_LENGTH);
};

const isUsernameTakenByUser = async (username, { excludeUserId } = {}) => {
  const normalized = normalizeUsername(username);

  if (!normalized) {
    return false;
  }

  const query = { username: normalized };

  if (excludeUserId) {
    query._id = { $ne: excludeUserId };
  }

  return Boolean(await User.exists(query));
};

const isUsernameReservedByGuest = async (username) => {
  const normalized = normalizeUsername(username);

  if (!normalized) {
    return false;
  }

  return Boolean(
    await Player.exists({
      pendingLinkUsername: normalized,
      userId: null,
      status: 'active',
    })
  );
};

const checkUsernameAvailability = async (username, purpose = 'signup') => {
  let normalized;

  try {
    normalized = validateUsernameFormat(username);
  } catch (error) {
    if (error instanceof ApiError && error.code === 'INVALID_USERNAME') {
      return {
        username: normalizeUsername(username),
        available: false,
        reason: 'invalid',
      };
    }

    throw error;
  }

  if (await isUsernameTakenByUser(normalized)) {
    return {
      username: normalized,
      available: false,
      reason: 'taken',
    };
  }

  return {
    username: normalized,
    available: true,
    reason: null,
  };
};

const allocateUniqueUsername = async (baseCandidate) => {
  const base = sanitizeUsernameBase(baseCandidate) || 'player';

  for (let attempt = 0; attempt < 1000; attempt += 1) {
    const suffix = attempt === 0 ? '' : String(attempt + 1);
    const trimmedBase = base.slice(0, Math.max(1, USERNAME_MAX_LENGTH - suffix.length));
    let candidate = `${trimmedBase}${suffix}`.slice(0, USERNAME_MAX_LENGTH);

    if (candidate.length < USERNAME_MIN_LENGTH) {
      candidate = `player${suffix}`.slice(0, USERNAME_MAX_LENGTH);
    }

    const availability = await checkUsernameAvailability(candidate, 'signup');

    if (availability.available) {
      return candidate;
    }
  }

  throw new ApiError(500, 'USERNAME_ALLOCATION_FAILED', 'Unable to allocate a unique username');
};

const suggestUsernameFromFirstName = async (firstName) => {
  const base = sanitizeUsernameBase(firstName);

  if (base.length < USERNAME_MIN_LENGTH) {
    return allocateUniqueUsername('player');
  }

  return allocateUniqueUsername(base);
};

const suggestMigrationUsername = async (name, email) =>
  allocateUniqueUsername(buildMigrationUsernameCandidate(name, email));

const assertUsernameAvailableForSignup = async (username) => {
  const availability = await checkUsernameAvailability(username, 'signup');

  if (availability.available) {
    return availability.username;
  }

  if (availability.reason === 'taken') {
    throw new ApiError(409, 'USERNAME_TAKEN', 'This username is already taken');
  }

  throw new ApiError(400, 'INVALID_USERNAME', 'Username is invalid');
};

const changeUsername = async (userId, nextUsername) => {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const user = await User.findById(normalizedUserId);

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  const normalizedUsername = validateUsernameFormat(nextUsername);

  if (normalizeUsername(user.username) === normalizedUsername) {
    return {
      username: normalizedUsername,
      usernameChangesRemaining: Math.max(USERNAME_MAX_CHANGE_COUNT - Number(user.usernameChangeCount || 0), 0),
    };
  }

  if (Number(user.usernameChangeCount || 0) >= USERNAME_MAX_CHANGE_COUNT) {
    throw new ApiError(409, 'USERNAME_CHANGE_LIMIT', 'Username can only be changed twice');
  }

  if (await isUsernameTakenByUser(normalizedUsername, { excludeUserId: user._id })) {
    throw new ApiError(409, 'USERNAME_TAKEN', 'This username is already taken');
  }

  const nextChangeCount = Number(user.usernameChangeCount || 0) + 1;

  await User.updateOne(
    { _id: user._id },
    {
      $set: { username: normalizedUsername },
      $inc: { usernameChangeCount: 1 },
    }
  );

  const { linkPendingGuestPlayersForUser } = require('./tournament/participants.service');
  await linkPendingGuestPlayersForUser(user._id);

  return {
    username: normalizedUsername,
    usernameChangesRemaining: Math.max(USERNAME_MAX_CHANGE_COUNT - nextChangeCount, 0),
  };
};

module.exports = {
  USERNAME_MIN_LENGTH,
  USERNAME_MAX_LENGTH,
  USERNAME_MAX_CHANGE_COUNT,
  normalizeUsername,
  normalizeNamePart,
  buildDisplayName,
  parseNameParts,
  validateUsernameFormat,
  buildMigrationUsernameCandidate,
  isUsernameTakenByUser,
  isUsernameReservedByGuest,
  checkUsernameAvailability,
  allocateUniqueUsername,
  suggestUsernameFromFirstName,
  suggestMigrationUsername,
  assertUsernameAvailableForSignup,
  changeUsername,
};
