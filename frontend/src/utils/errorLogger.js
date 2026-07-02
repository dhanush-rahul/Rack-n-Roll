const formatError = (error) => {
  if (!error || typeof error !== 'object') {
    return {
      code: 'UNKNOWN_ERROR',
      message: String(error || 'Unknown error'),
      status: null,
    };
  }

  return {
    code: error.code || 'UNKNOWN_ERROR',
    message: error.message || 'Unexpected error occurred',
    status: error.status ?? null,
    details: error.details,
  };
};

export const logApiError = (error, context = {}) => {
  const normalized = formatError(error);

  if (__DEV__) {
    console.warn('[rack-n-roll:api-error]', {
      ...normalized,
      ...context,
    });
    return;
  }

  console.warn('[rack-n-roll:api-error]', {
    code: normalized.code,
    message: normalized.message,
    status: normalized.status,
    ...context,
  });
};

export const logWarning = (message, context = {}) => {
  if (__DEV__) {
    console.warn('[rack-n-roll:warn]', message, context);
  }
};

export const logInfo = (message, context = {}) => {
  if (__DEV__) {
    console.log('[rack-n-roll:info]', message, context);
  }
};
