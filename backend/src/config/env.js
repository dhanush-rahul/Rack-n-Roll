const dotenv = require('dotenv');

const toBoolean = (value) => String(value).toLowerCase() === 'true';

const DEFAULT_DEV_CORS_ORIGINS = [
  'http://localhost:8081',
  'http://localhost:19006',
  'http://127.0.0.1:8081',
  'http://127.0.0.1:19006',
];

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
  };
};

module.exports = { loadAndValidateEnv };
