const express = require('express');
const { getMyProfileController, updateMyHandicapController } = require('../controllers/user.controller');
const { requireAuth } = require('../middleware/requireAuth');

const router = express.Router();

router.get('/me/profile', requireAuth, getMyProfileController);
router.patch('/me/handicap', requireAuth, updateMyHandicapController);

module.exports = router;
