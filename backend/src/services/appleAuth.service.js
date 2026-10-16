const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const ApiError = require('../utils/ApiError');
const { logger } = require('../utils/logger');

const APPLE_ISSUER = 'https://appleid.apple.com';
const DEFAULT_CLIENT_ID = 'com.dhanushcharipally.racknroll';
const JWKS_URL = 'https://appleid.apple.com/auth/keys';

let verifyAppleIdentityTokenOverride = null;
let exchangeAppleAuthorizationCodeOverride = null;
let revokeAppleRefreshTokenOverride = null;
let jwksCache = { keys: [], fetchedAt: 0 };

const resolveAppleClientId = () => String(process.env.APPLE_CLIENT_ID || DEFAULT_CLIENT_ID).trim();

const createAppleClientSecret = () => {
  const teamId = String(process.env.APPLE_TEAM_ID || '').trim();
  const keyId = String(process.env.APPLE_KEY_ID || '').trim();
  const privateKey = String(process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();

  if (!teamId || !keyId || !privateKey) {
    return null;
  }

  return jwt.sign({}, privateKey, {
    algorithm: 'ES256',
    expiresIn: '180d',
    audience: APPLE_ISSUER,
    issuer: teamId,
    subject: resolveAppleClientId(),
    keyid: keyId,
  });
};

const fetchAppleKeys = async () => {
  if (jwksCache.keys.length > 0 && Date.now() - jwksCache.fetchedAt < 60 * 60 * 1000) {
    return jwksCache.keys;
  }

  const response = await fetch(JWKS_URL);

  if (!response.ok) {
    throw new ApiError(503, 'APPLE_AUTH_UNAVAILABLE', 'Apple sign-in is unavailable right now');
  }

  const body = await response.json();
  jwksCache = { keys: Array.isArray(body.keys) ? body.keys : [], fetchedAt: Date.now() };
  return jwksCache.keys;
};

const publicKeyForToken = async (identityToken) => {
  const decoded = jwt.decode(identityToken, { complete: true });
  const kid = decoded?.header?.kid;

  if (!kid) {
    throw new ApiError(401, 'INVALID_APPLE_TOKEN', 'Apple sign-in token is invalid or expired');
  }

  let keys = await fetchAppleKeys();
  let jwk = keys.find((key) => key.kid === kid);

  if (!jwk) {
    jwksCache = { keys: [], fetchedAt: 0 };
    keys = await fetchAppleKeys();
    jwk = keys.find((key) => key.kid === kid);
  }

  if (!jwk) {
    throw new ApiError(401, 'INVALID_APPLE_TOKEN', 'Apple sign-in token is invalid or expired');
  }

  return crypto.createPublicKey({ key: jwk, format: 'jwk' });
};

const verifyAppleIdentityToken = async (identityToken) => {
  if (verifyAppleIdentityTokenOverride) {
    return verifyAppleIdentityTokenOverride(identityToken);
  }

  const normalizedToken = String(identityToken || '').trim();

  if (!normalizedToken) {
    throw new ApiError(400, 'ID_TOKEN_REQUIRED', 'Apple identity token is required');
  }

  try {
    const publicKey = await publicKeyForToken(normalizedToken);
    return jwt.verify(normalizedToken, publicKey, {
      algorithms: ['RS256'],
      issuer: APPLE_ISSUER,
      audience: resolveAppleClientId(),
    });
  } catch (error) {
    if (error instanceof ApiError) {
      throw error;
    }

    throw new ApiError(401, 'INVALID_APPLE_TOKEN', 'Apple sign-in token is invalid or expired');
  }
};

const postAppleForm = async (url, params) => {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params),
  });

  return response;
};

const exchangeAppleAuthorizationCode = async (authorizationCode) => {
  if (exchangeAppleAuthorizationCodeOverride) {
    return exchangeAppleAuthorizationCodeOverride(authorizationCode);
  }

  const code = String(authorizationCode || '').trim();
  const clientSecret = createAppleClientSecret();

  if (!code || !clientSecret) {
    return null;
  }

  try {
    const response = await postAppleForm('https://appleid.apple.com/auth/token', {
      client_id: resolveAppleClientId(),
      client_secret: clientSecret,
      code,
      grant_type: 'authorization_code',
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Apple authorization code exchange failed');
      return null;
    }

    const body = await response.json();
    return body.refresh_token ? String(body.refresh_token) : null;
  } catch (error) {
    logger.warn({ err: error }, 'Apple authorization code exchange failed');
    return null;
  }
};

const revokeAppleRefreshToken = async (refreshToken) => {
  if (revokeAppleRefreshTokenOverride) {
    return revokeAppleRefreshTokenOverride(refreshToken);
  }

  const token = String(refreshToken || '').trim();
  const clientSecret = createAppleClientSecret();

  if (!token || !clientSecret) {
    return false;
  }

  try {
    const response = await postAppleForm('https://appleid.apple.com/auth/revoke', {
      client_id: resolveAppleClientId(),
      client_secret: clientSecret,
      token,
      token_type_hint: 'refresh_token',
    });

    if (!response.ok) {
      logger.warn({ status: response.status }, 'Apple token revocation failed');
      return false;
    }

    return true;
  } catch (error) {
    logger.warn({ err: error }, 'Apple token revocation failed');
    return false;
  }
};

const __setAppleAuthOverrides = ({ verify, exchange, revoke } = {}) => {
  verifyAppleIdentityTokenOverride = typeof verify === 'function' ? verify : null;
  exchangeAppleAuthorizationCodeOverride = typeof exchange === 'function' ? exchange : null;
  revokeAppleRefreshTokenOverride = typeof revoke === 'function' ? revoke : null;
};

module.exports = {
  verifyAppleIdentityToken,
  exchangeAppleAuthorizationCode,
  revokeAppleRefreshToken,
  __setAppleAuthOverrides,
};
