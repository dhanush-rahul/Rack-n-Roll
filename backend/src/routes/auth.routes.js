const express = require('express');
const {
	signupController,
	loginController,
	googleSignInController,
	checkUsernameController,
	requestPasswordResetController,
	validatePasswordResetPinController,
	resetPasswordWithTokenController,
} = require('../controllers/auth.controller');
const { authRateLimiter, passwordResetRateLimiter } = require('../middleware/rateLimiters');

const router = express.Router();

router.get('/username/check', authRateLimiter, checkUsernameController);

router.post('/signup', authRateLimiter, signupController);
router.post('/login', authRateLimiter, loginController);
router.post('/google', authRateLimiter, googleSignInController);
router.post('/forgot-password/request', passwordResetRateLimiter, requestPasswordResetController);
router.post('/forgot-password/validate-pin', passwordResetRateLimiter, validatePasswordResetPinController);
router.post('/forgot-password', passwordResetRateLimiter, resetPasswordWithTokenController);

module.exports = router;
