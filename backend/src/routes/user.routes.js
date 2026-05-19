const express = require('express');
const { getMyProfileController } = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/me/profile', requireAuth, getMyProfileController);

module.exports = router;
