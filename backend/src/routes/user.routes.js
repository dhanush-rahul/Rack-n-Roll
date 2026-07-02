const express = require('express');
const { getMyProfileController, updateMyHandicapController, setMyPasswordController } = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/requireAuth');
const { accountPasswordRateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/me/profile', requireAuth, getMyProfileController);
router.patch('/me/handicap', requireAuth, updateMyHandicapController);
router.post('/me/password', requireAuth, accountPasswordRateLimiter, setMyPasswordController);

module.exports = router;
