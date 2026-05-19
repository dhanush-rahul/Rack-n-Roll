const { buildHealthPayload } = require('../services/health.service');

const getHealth = (req, res) => {
  const payload = buildHealthPayload();
  return res.status(200).json(payload);
};

module.exports = { getHealth };
