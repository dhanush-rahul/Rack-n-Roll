const healthRoutes = require('./health.routes');
const protectedRoutes = require('./protected.routes');
const debugRoutes = require('./debug.routes');
const authRoutes = require('./auth.routes');
const tournamentRoutes = require('./tournament.routes');
const userRoutes = require('./user.routes');

const registerRoutes = (app) => {
  app.use('/', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/protected', protectedRoutes);
  app.use('/api/debug', debugRoutes);
  app.use('/api/users', userRoutes);
  app.use('/api/tournaments', tournamentRoutes);
};

module.exports = { registerRoutes };
