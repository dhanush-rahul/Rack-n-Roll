const { buildAppVersionPayload } = require('../services/appVersion.service');

const getAppVersion = (req, res) => {
  const payload = buildAppVersionPayload();
  return res.status(200).json({ success: true, data: payload });
};

module.exports = { getAppVersion };
