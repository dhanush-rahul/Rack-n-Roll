const { getUserProfile, updateUserHandicap } = require('../services/user.service');
const { setAccountPassword } = require('../services/auth.service');

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
    await setAccountPassword(req.auth?.userId, req.body);
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
