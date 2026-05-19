const { createApp } = require('./app');
const { loadAndValidateEnv } = require('./config/env');
const { connectToDatabase } = require('./config/db');

const start = async () => {
  try {
    const env = loadAndValidateEnv();

    if (!env.skipDb) {
      await connectToDatabase(env.mongoUri);
    }

    const app = createApp(env);

    app.listen(env.port, () => {
      console.log(`[startup] rack-n-roll-api listening on port ${env.port}`);
    });
  } catch (error) {
    console.error('[startup] failed to start server', error.message);
    process.exit(1);
  }
};

start();
