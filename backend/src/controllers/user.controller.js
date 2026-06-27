const { getUserProfile, updateUserHandicap } = require('../services/user.service');
const { setAccountPassword, changeAccountPassword } = require('../services/auth.service');

const getMyProfileController = async (req, res, next) => {
  try {
    const result = await getUserProfile(req.auth?.userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const updateMyHandicapController = async (req, res, next) => {
  try {
    const result = await updateUserHandicap(req.auth?.userId, req.body?.handicap);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const setMyPasswordController = async (req, res, next) => {
  try {
    const { password, currentPassword } = req.body || {};

    if (currentPassword) {
      await changeAccountPassword(req.auth?.userId, { currentPassword, newPassword: password });
    } else {
      await setAccountPassword(req.auth?.userId, { password });
    }

    const result = await getUserProfile(req.auth?.userId);

    res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getMyProfileController,
  updateMyHandicapController,
  setMyPasswordController,
};
