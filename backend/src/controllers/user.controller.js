const { getUserProfile, updateUserHandicap } = require('../services/user.service');

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

module.exports = {
  getMyProfileController,
  updateMyHandicapController,
};
