const pino = require('pino');

const isTestEnv = () => process.env.NODE_ENV === 'test';

const logger = pino({
  level: process.env.LOG_LEVEL || (isTestEnv() ? 'silent' : 'info'),
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'password',
      'newPassword',
      'confirmPassword',
      'pin',
      'resetToken',
      'idToken',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = { logger };
