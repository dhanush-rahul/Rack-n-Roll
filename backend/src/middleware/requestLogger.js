const requestLogger = (req, res, next) => {
  console.log(`[request] ${req.method} ${req.originalUrl}`);
  next();
};

module.exports = { requestLogger };
