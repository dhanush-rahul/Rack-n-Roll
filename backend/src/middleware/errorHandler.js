const { logger } = require('../utils/logger');

const errorHandler = (err, req, res, _next) => {
  const isApiError = Number.isInteger(err?.statusCode) && Boolean(err?.code);
  const status = isApiError ? err.statusCode : 500;
  const code = isApiError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = isApiError ? err.message || 'Request failed' : 'Unexpected error occurred';
  const safeDetails = isApiError ? err.details : undefined;

  const logPayload = {
    requestId: req.id,
    userId: req.auth?.userId || null,
    method: req.method,
    path: req.originalUrl,
    statusCode: status,
    errorCode: code,
    ...(safeDetails ? { details: safeDetails } : {}),
  };

  if (!isApiError) {
    logger.error({ ...logPayload, err }, 'unexpected error');
  } else if (status >= 500) {
    logger.error({ ...logPayload, err }, 'request failed');
  } else {
    logger.warn(logPayload, message);
  }

  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(safeDetails ? { details: safeDetails } : {}),
    },
  });
};

module.exports = { errorHandler };
