const mongoose = require('mongoose');

const connectToDatabase = async (mongoUri) => {
  await mongoose.connect(mongoUri);
  console.log('[startup] connected to MongoDB');
};

module.exports = { connectToDatabase };
