const {
  signup,
  login,
  signInWithGoogle,
  requestPasswordReset,
  validatePasswordResetPin,
  resetPasswordWithToken,
} = require('../services/auth.service');

const signupController = async (req, res, next) => {
  try {
    const result = await signup(req.body);
    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const loginController = async (req, res, next) => {
  try {
    const result = await login(req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const requestPasswordResetController = async (req, res, next) => {
  try {
    const result = await requestPasswordReset(req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const validatePasswordResetPinController = async (req, res, next) => {
  try {
    const result = await validatePasswordResetPin(req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const resetPasswordWithTokenController = async (req, res, next) => {
  try {
    const result = await resetPasswordWithToken(req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const googleSignInController = async (req, res, next) => {
  try {
    const result = await signInWithGoogle(req.body);
    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

module.exports = {
  signupController,
  loginController,
  googleSignInController,
  requestPasswordResetController,
  validatePasswordResetPinController,
  resetPasswordWithTokenController,
};
