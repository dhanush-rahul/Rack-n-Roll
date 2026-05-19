const express = require('express');
const {
	signupController,
	loginController,
	requestPasswordResetController,
	validatePasswordResetPinController,
	resetPasswordWithTokenController,
} = require('../controllers/auth.controller');

const router = express.Router();

router.post('/signup', signupController);
router.post('/login', loginController);
router.post('/forgot-password/request', requestPasswordResetController);
router.post('/forgot-password/validate-pin', validatePasswordResetPinController);
router.post('/forgot-password', resetPasswordWithTokenController);

module.exports = router;
