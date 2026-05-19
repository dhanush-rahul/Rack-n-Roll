const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const { protectedPing } = require('../controllers/protected.controller');

const router = express.Router();

router.get('/ping', requireAuth, protectedPing);

module.exports = router;
