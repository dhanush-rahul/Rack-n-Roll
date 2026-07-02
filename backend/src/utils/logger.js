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
      'currentPassword',
      'pin',
      'resetToken',
      'idToken',
      'email',
      'token',
      'req.body',
      'data.token',
    ],
    censor: '[REDACTED]',
  },
});

module.exports = { logger };
