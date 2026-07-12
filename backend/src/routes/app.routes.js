const express = require('express');
const { getAppVersion } = require('../controllers/appVersion.controller');

const router = express.Router();

router.get('/version', getAppVersion);

module.exports = router;
