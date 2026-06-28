const cors = require('cors');
const express = require('express');
const helmet = require('helmet');
const { requestLogger } = require('./middleware/requestLogger');
const { requestId } = require('./middleware/requestId');
const { authContext } = require('./middleware/authContext');
const { validationMiddleware } = require('./middleware/validation');
const { errorHandler } = require('./middleware/errorHandler');
const { registerRoutes } = require('./routes');
const cache = require('./utils/cache');
const ApiError = require('./utils/ApiError');

const createApp = (env) => {
  const app = express();

  if (env.cache) {
    cache.configure(env.cache);
  }

  app.set('trust proxy', 1);

  if (env.corsOrigins?.length) {
    app.use(
      cors({
        origin: env.corsOrigins,
        credentials: true,
      })
    );
  }

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );

  app.use(express.json({ limit: '1mb' }));
  app.use(requestId);
  app.use(requestLogger);
  app.use(authContext(env.jwtSecret));
  app.use(validationMiddleware);

  registerRoutes(app);

  app.use((req, res, next) => {
    next(new ApiError(404, 'NOT_FOUND', 'Route not found', { path: req.originalUrl }));
  });

  app.use(errorHandler);

  return app;
};

module.exports = { createApp };
