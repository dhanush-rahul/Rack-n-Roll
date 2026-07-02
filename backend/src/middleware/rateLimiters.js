const rateLimit = require('express-rate-limit');
const ApiError = require('../utils/ApiError');

const isTestEnv = () => process.env.NODE_ENV === 'test';

const rateLimitHandler = (req, res, next, options) => {
  next(
    new ApiError(429, 'RATE_LIMIT_EXCEEDED', 'Too many requests. Please try again later.', {
      retryAfterSeconds: Math.ceil(options.windowMs / 1000),
    })
  );
};

const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  handler: rateLimitHandler,
  validate: { trustProxy: true },
});

const passwordResetRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  handler: rateLimitHandler,
  validate: { trustProxy: true },
});

const accountPasswordRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  skip: isTestEnv,
  handler: rateLimitHandler,
  validate: { trustProxy: true },
  keyGenerator: (req) => req.auth?.userId || req.ip,
});

module.exports = {
  authRateLimiter,
  passwordResetRateLimiter,
  accountPasswordRateLimiter,
};
