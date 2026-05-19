const ApiError = require('../utils/ApiError');

const requireAuth = (req, res, next) => {
  if (req.auth && req.auth.tokenError) {
    return next(new ApiError(401, 'INVALID_TOKEN', 'Invalid or expired token'));
  }

  if (!req.auth || !req.auth.userId) {
    return next(new ApiError(401, 'UNAUTHORIZED', 'Authentication required'));
  }

  return next();
};

module.exports = { requireAuth };
