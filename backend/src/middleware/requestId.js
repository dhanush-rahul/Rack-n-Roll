const crypto = require('crypto');

const REQUEST_ID_HEADER = 'x-request-id';

const requestId = (req, res, next) => {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const id = typeof incoming === 'string' && incoming.trim() ? incoming.trim() : crypto.randomUUID();

  req.id = id;
  res.setHeader('X-Request-Id', id);
  next();
};

module.exports = { requestId, REQUEST_ID_HEADER };
