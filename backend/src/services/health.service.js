const buildHealthPayload = () => ({
  status: 'ok',
  service: 'rack-n-roll-api',
  timestamp: new Date().toISOString(),
});

module.exports = { buildHealthPayload };
