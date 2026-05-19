const jwt = require('jsonwebtoken');

const authContext = (jwtSecret) => (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.auth = { userId: null, tokenError: null };
    return next();
  }

  const token = authHeader.slice(7);

  try {
    const payload = jwt.verify(token, jwtSecret);
    req.auth = { userId: payload.sub || null, tokenError: null };
  } catch (error) {
    req.auth = { userId: null, tokenError: 'INVALID_OR_EXPIRED_TOKEN' };
  }

  return next();
};

module.exports = { authContext };
