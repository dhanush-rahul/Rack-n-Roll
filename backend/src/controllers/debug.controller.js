const ApiError = require('../utils/ApiError');

const throwSampleError = (req, res, next) => {
  return next(new ApiError(500, 'SAMPLE_ERROR', 'Sample controller failure'));
};

module.exports = { throwSampleError };
