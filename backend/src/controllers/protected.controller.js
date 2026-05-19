const { buildProtectedPingPayload } = require('../services/protected.service');

const protectedPing = (req, res) => {
  const payload = buildProtectedPingPayload(req.auth.userId);
  return res.status(200).json(payload);
};

module.exports = { protectedPing };
