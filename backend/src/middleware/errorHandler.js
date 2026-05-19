const errorHandler = (err, req, res, next) => {
  const isApiError = Number.isInteger(err?.statusCode) && Boolean(err?.code);
  const status = isApiError ? err.statusCode : 500;
  const code = isApiError ? err.code : 'INTERNAL_SERVER_ERROR';
  const message = isApiError ? err.message || 'Request failed' : 'Unexpected error occurred';
  const safeDetails = isApiError ? err.details : undefined;

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
