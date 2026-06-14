const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/user.model');
const ApiError = require('../utils/ApiError');
const { sendPasswordResetPinEmail } = require('./email.service');
const { verifyGoogleIdToken } = require('./googleAuth.service');

const SALT_ROUNDS = 10;
const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;
const RESET_PIN_LENGTH = 6;
const RESET_PIN_TTL_MINUTES = Number(process.env.PASSWORD_RESET_PIN_TTL_MINUTES || 15);
const RESET_PIN_COOLDOWN_SECONDS = Number(process.env.PASSWORD_RESET_PIN_COOLDOWN_SECONDS || 60);
const RESET_PIN_MAX_ATTEMPTS = Number(process.env.PASSWORD_RESET_PIN_MAX_ATTEMPTS || 5);
const PASSWORD_RESET_SESSION_TTL_MINUTES = Number(process.env.PASSWORD_RESET_SESSION_TTL_MINUTES || 10);
const controlCharacterRegex = /[\u0000-\u001F\u007F]/;
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const createToken = (userId) => {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({}, jwtSecret, {
    subject: String(userId),
    expiresIn: jwtExpiresIn,
  });
};

const createPasswordResetToken = ({ userId, email }) => {
  const jwtSecret = process.env.JWT_SECRET;

  return jwt.sign(
    {
      purpose: 'password-reset',
      email,
    },
    jwtSecret,
    {
      subject: String(userId),
      expiresIn: `${PASSWORD_RESET_SESSION_TTL_MINUTES}m`,
    }
  );
};

const normalizeEmail = (email) => String(email || '').trim().toLowerCase();
const normalizeName = (name) => String(name || '').trim().replace(/\s+/g, ' ');
const normalizePassword = (password) => String(password || '');
const normalizePin = (pin) => String(pin || '').trim();

const hashResetPin = (pin) => crypto.createHash('sha256').update(pin).digest('hex');

const createResetPin = () => crypto.randomInt(0, 10 ** RESET_PIN_LENGTH).toString().padStart(RESET_PIN_LENGTH, '0');

const clearPasswordResetState = (user) => {
  user.passwordResetPinHash = null;
  user.passwordResetPinExpiresAt = null;
  user.passwordResetPinRequestedAt = null;
  user.passwordResetPinAttemptCount = 0;
};

const isTestEnv = () => process.env.NODE_ENV === 'test';

const sanitizeUser = (userDoc, { hasPassword } = {}) => ({
  id: String(userDoc._id),
  name: userDoc.name,
  email: userDoc.email,
  authProvider: userDoc.authProvider || 'local',
  hasPassword: hasPassword ?? (userDoc.authProvider !== 'google'),
});

const validateEmail = (email) => {
  const normalizedEmail = normalizeEmail(email);

  if (!emailRegex.test(normalizedEmail) || normalizedEmail.length > EMAIL_MAX_LENGTH) {
    throw new ApiError(400, 'INVALID_EMAIL', 'A valid email address is required');
  }

  return normalizedEmail;
};

const validatePassword = (password, errorMessage = 'Password must be at least 8 characters long') => {
  const normalizedPassword = normalizePassword(password);

  if (!normalizedPassword || normalizedPassword.length < PASSWORD_MIN_LENGTH) {
    throw new ApiError(400, 'WEAK_PASSWORD', errorMessage);
  }

  if (normalizedPassword.length > PASSWORD_MAX_LENGTH || controlCharacterRegex.test(normalizedPassword)) {
    throw new ApiError(400, 'WEAK_PASSWORD', 'Password contains invalid characters');
  }

  return normalizedPassword;
};

const validateResetPin = (pin) => {
  const normalizedPin = normalizePin(pin);

  if (!/^\d{6}$/.test(normalizedPin)) {
    throw new ApiError(400, 'INVALID_RESET_PIN', 'PIN must be a 6-digit code');
  }

  return normalizedPin;
};

const validateSignupInput = ({ name, email, password }) => {
  const normalizedName = normalizeName(name);

  if (!normalizedName || normalizedName.length < NAME_MIN_LENGTH) {
    throw new ApiError(400, 'INVALID_NAME', 'Name must be at least 2 characters long');
  }

  if (normalizedName.length > NAME_MAX_LENGTH || controlCharacterRegex.test(normalizedName)) {
    throw new ApiError(400, 'INVALID_NAME', 'Name contains unsupported characters');
  }

  validateEmail(email);
  validatePassword(password);
};

const signup = async ({ name, email, password }) => {
  validateSignupInput({ name, email, password });
  const normalizedEmail = normalizeEmail(email);
  const normalizedName = normalizeName(name);

  const existingUser = await User.findOne({ email: normalizedEmail }).lean();
  if (existingUser) {
    throw new ApiError(409, 'EMAIL_ALREADY_IN_USE', 'Email address is already registered');
  }

  const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

  const createdUser = await User.create({
    name: normalizedName,
    email: normalizedEmail,
    passwordHash,
    authProvider: 'local',
  });

  const token = createToken(createdUser._id);

  return {
    token,
    user: sanitizeUser(createdUser, { hasPassword: true }),
  };
};

const login = async ({ email, password }) => {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizePassword(password);

  if (!normalizedEmail || !normalizedPassword) {
    throw new ApiError(400, 'MISSING_CREDENTIALS', 'Email and password are required');
  }

  if (normalizedEmail.length > EMAIL_MAX_LENGTH || normalizedPassword.length > PASSWORD_MAX_LENGTH) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');

  if (!user) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  if (!user.passwordHash) {
    throw new ApiError(401, 'GOOGLE_AUTH_REQUIRED', 'Sign in with Google for this account');
  }

  const isPasswordValid = await bcrypt.compare(normalizedPassword, user.passwordHash);

  if (!isPasswordValid) {
    throw new ApiError(401, 'INVALID_CREDENTIALS', 'Invalid email or password');
  }

  const token = createToken(user._id);

  return {
    token,
    user: sanitizeUser(user, { hasPassword: true }),
  };
};

const normalizeGoogleName = (payload, fallbackEmail) => {
  const fromGoogle = normalizeName(payload?.name || payload?.given_name || '');

  if (fromGoogle.length >= NAME_MIN_LENGTH) {
    return fromGoogle.slice(0, NAME_MAX_LENGTH);
  }

  const localPart = String(fallbackEmail || '').split('@')[0] || 'Player';
  const fallbackName = normalizeName(localPart.replace(/[._-]+/g, ' '));

  if (fallbackName.length >= NAME_MIN_LENGTH) {
    return fallbackName.slice(0, NAME_MAX_LENGTH);
  }

  return 'Player';
};

const signInWithGoogle = async ({ idToken }) => {
  const normalizedToken = String(idToken || '').trim();

  if (!normalizedToken) {
    throw new ApiError(400, 'ID_TOKEN_REQUIRED', 'Google ID token is required');
  }

  let payload;

  try {
    payload = await verifyGoogleIdToken(normalizedToken);
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in token is invalid or expired');
  }

  const googleId = String(payload?.sub || '').trim();
  const normalizedEmail = normalizeEmail(payload?.email);

  if (!googleId) {
    throw new ApiError(401, 'INVALID_GOOGLE_TOKEN', 'Google sign-in token is missing required profile data');
  }

  if (!payload?.email_verified) {
    throw new ApiError(401, 'GOOGLE_EMAIL_NOT_VERIFIED', 'Google account email must be verified');
  }

  validateEmail(normalizedEmail);

  const displayName = normalizeGoogleName(payload, normalizedEmail);

  let user = await User.findOne({ googleId }).select('+passwordHash');

  if (!user) {
    user = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
  }

  if (user) {
    if (user.googleId && user.googleId !== googleId) {
      throw new ApiError(409, 'GOOGLE_ACCOUNT_MISMATCH', 'This email is linked to a different Google account');
    }

    if (!user.googleId) {
      user.googleId = googleId;

      if (!user.passwordHash) {
        user.authProvider = 'google';
      }

      await user.save();
    }
  } else {
    user = await User.create({
      name: displayName,
      email: normalizedEmail,
      googleId,
      authProvider: 'google',
      passwordHash: null,
    });
  }

  const token = createToken(user._id);

  return {
    token,
    user: sanitizeUser(user, { hasPassword: Boolean(user.passwordHash) }),
  };
};

const requestPasswordReset = async ({ email }) => {
  const normalizedEmail = validateEmail(email);
  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordHash +passwordResetPinHash +passwordResetPinExpiresAt +passwordResetPinRequestedAt +passwordResetPinAttemptCount'
  );

  const genericResponse = {
    message: 'If an account exists for that email, a password reset PIN has been sent.',
    resendCooldownSeconds: RESET_PIN_COOLDOWN_SECONDS,
    pinExpiresInMinutes: RESET_PIN_TTL_MINUTES,
  };

  if (!user) {
    return genericResponse;
  }

  if (!user.passwordHash) {
    return genericResponse;
  }

  const now = new Date();
  const lastRequestedAt = user.passwordResetPinRequestedAt ? new Date(user.passwordResetPinRequestedAt) : null;
  const cooldownMs = RESET_PIN_COOLDOWN_SECONDS * 1000;

  if (lastRequestedAt && now.getTime() - lastRequestedAt.getTime() < cooldownMs) {
    return genericResponse;
  }

  const pin = createResetPin();
  const expiresAt = new Date(now.getTime() + RESET_PIN_TTL_MINUTES * 60 * 1000);

  await sendPasswordResetPinEmail({
    toEmail: user.email,
    toName: user.name,
    pin,
    ttlMinutes: RESET_PIN_TTL_MINUTES,
  });

  user.passwordResetPinHash = hashResetPin(pin);
  user.passwordResetPinExpiresAt = expiresAt;
  user.passwordResetPinRequestedAt = now;
  user.passwordResetPinAttemptCount = 0;
  await user.save();

  return {
    ...genericResponse,
    ...(isTestEnv() ? { devResetPin: pin } : {}),
  };
};

const validatePasswordResetPin = async ({ email, pin }) => {
  const normalizedEmail = validateEmail(email);
  const normalizedPin = validateResetPin(pin);

  const user = await User.findOne({ email: normalizedEmail }).select(
    '+passwordHash +passwordResetPinHash +passwordResetPinExpiresAt +passwordResetPinRequestedAt +passwordResetPinAttemptCount'
  );

  if (!user || !user.passwordHash || !user.passwordResetPinHash || !user.passwordResetPinExpiresAt) {
    throw new ApiError(400, 'INVALID_RESET_PIN', 'Invalid or expired reset PIN');
  }

  const now = new Date();
  if (new Date(user.passwordResetPinExpiresAt).getTime() < now.getTime()) {
    clearPasswordResetState(user);
    await user.save();
    throw new ApiError(400, 'RESET_PIN_EXPIRED', 'Reset PIN has expired. Please request a new one.');
  }

  if (Number(user.passwordResetPinAttemptCount || 0) >= RESET_PIN_MAX_ATTEMPTS) {
    clearPasswordResetState(user);
    await user.save();
    throw new ApiError(400, 'RESET_PIN_LOCKED', 'Too many invalid PIN attempts. Please request a new one.');
  }

  const expectedHash = Buffer.from(String(user.passwordResetPinHash), 'hex');
  const providedHash = Buffer.from(hashResetPin(normalizedPin), 'hex');
  const isPinValid =
    expectedHash.length === providedHash.length && crypto.timingSafeEqual(expectedHash, providedHash);

  if (!isPinValid) {
    user.passwordResetPinAttemptCount = Number(user.passwordResetPinAttemptCount || 0) + 1;

    if (user.passwordResetPinAttemptCount >= RESET_PIN_MAX_ATTEMPTS) {
      clearPasswordResetState(user);
      await user.save();
      throw new ApiError(400, 'RESET_PIN_LOCKED', 'Too many invalid PIN attempts. Please request a new one.');
    }

    await user.save();
    throw new ApiError(400, 'INVALID_RESET_PIN', 'Invalid or expired reset PIN');
  }

  const resetToken = createPasswordResetToken({
    userId: user._id,
    email: user.email,
  });

  clearPasswordResetState(user);
  await user.save();

  return {
    message: 'PIN verified successfully',
    resetToken,
    resetTokenExpiresInMinutes: PASSWORD_RESET_SESSION_TTL_MINUTES,
  };
};

const resetPasswordWithToken = async ({ email, resetToken, newPassword }) => {
  const normalizedEmail = validateEmail(email);
  const normalizedPassword = validatePassword(newPassword, 'New password must be at least 8 characters long');

  if (!resetToken || typeof resetToken !== 'string') {
    throw new ApiError(400, 'RESET_TOKEN_REQUIRED', 'A valid password reset session is required');
  }

  let payload;

  try {
    payload = jwt.verify(resetToken, process.env.JWT_SECRET);
  } catch (error) {
    throw new ApiError(400, 'INVALID_RESET_TOKEN', 'Reset session is invalid or expired');
  }

  if (payload?.purpose !== 'password-reset' || payload?.email !== normalizedEmail || !payload?.sub) {
    throw new ApiError(400, 'INVALID_RESET_TOKEN', 'Reset session is invalid or expired');
  }

  const user = await User.findOne({ _id: payload.sub, email: normalizedEmail }).select('+passwordHash');

  if (!user || !user.passwordHash) {
    throw new ApiError(400, 'INVALID_RESET_TOKEN', 'Reset session is invalid or expired');
  }

  const isSamePassword = await bcrypt.compare(normalizedPassword, user.passwordHash);
  if (isSamePassword) {
    throw new ApiError(400, 'PASSWORD_REUSE_NOT_ALLOWED', 'Choose a new password that has not been used recently');
  }

  user.passwordHash = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);
  await user.save();

  return {
    message: 'Password updated successfully',
  };
};

const setAccountPassword = async (userId, { password }) => {
  const normalizedPassword = validatePassword(password, 'Password must be at least 8 characters long');
  const user = await User.findById(userId).select('+passwordHash');

  if (!user) {
    throw new ApiError(404, 'USER_NOT_FOUND', 'User not found');
  }

  if (user.passwordHash) {
    throw new ApiError(409, 'PASSWORD_ALREADY_SET', 'A password is already set for this account');
  }

  user.passwordHash = await bcrypt.hash(normalizedPassword, SALT_ROUNDS);
  await user.save();

  return {
    hasPassword: true,
  };
};

module.exports = {
  signup,
  login,
  signInWithGoogle,
  setAccountPassword,
  requestPasswordReset,
  validatePasswordResetPin,
  resetPasswordWithToken,
};
