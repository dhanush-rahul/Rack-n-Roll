const dotenv = require('dotenv');

const toBoolean = (value) => String(value).toLowerCase() === 'true';

const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
];

const toPositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : fallback;
};

const parseCacheConfig = () => {
  const isTest = process.env.NODE_ENV === 'test';
  const enabled = isTest
    ? false
    : process.env.CACHE_ENABLED === undefined
      ? true
      : toBoolean(process.env.CACHE_ENABLED);

  return {
    enabled,
    ttls: {
      leaderboard: toPositiveInt(process.env.CACHE_TTL_LEADERBOARD_MS, 30 * 1000),
      standings: toPositiveInt(process.env.CACHE_TTL_STANDINGS_MS, 30 * 1000),
      scoresheet: toPositiveInt(process.env.CACHE_TTL_SCORESHEET_MS, 15 * 1000),
      discover: toPositiveInt(process.env.CACHE_TTL_DISCOVER_MS, 120 * 1000),
    },
  };
};

const parseCorsOrigins = () => {
  const raw = String(process.env.CORS_ORIGINS || '').trim();

  if (raw) {
    return raw
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);
  }

  if (process.env.NODE_ENV === 'production') {
    return [];
  }

  return DEFAULT_DEV_CORS_ORIGINS;
};

const loadAndValidateEnv = () => {
  dotenv.config();

  const missing = [];
  const skipDb = toBoolean(process.env.SKIP_DB || 'false');

  if (!process.env.PORT) missing.push('PORT');
  if (!process.env.JWT_SECRET) missing.push('JWT_SECRET');
  if (!skipDb && !process.env.MONGODB_URI) missing.push('MONGODB_URI');

  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }

  return {
    port: Number(process.env.PORT),
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
    mongoUri: process.env.MONGODB_URI,
    skipDb,
    corsOrigins: parseCorsOrigins(),
    cache: parseCacheConfig(),
  };
};

module.exports = { loadAndValidateEnv };
