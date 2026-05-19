const mongoose = require('mongoose');

const leaderboardSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    divisionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Division',
      default: null,
      index: true,
    },
    playerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      index: true,
    },
    rank: {
      type: Number,
      default: 0,
      min: 0,
    },
    points: {
      type: Number,
      default: 0,
    },
    wins: {
      type: Number,
      default: 0,
      min: 0,
    },
    draws: {
      type: Number,
      default: 0,
      min: 0,
    },
    losses: {
      type: Number,
      default: 0,
      min: 0,
    },
    scoreFor: {
      type: Number,
      default: 0,
      min: 0,
    },
    scoreAgainst: {
      type: Number,
      default: 0,
      min: 0,
    },
    scoreDifferential: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

leaderboardSchema.index({ tournamentId: 1, divisionId: 1, rank: 1 });
leaderboardSchema.index({ tournamentId: 1, divisionId: 1, playerId: 1 }, { unique: true });

const Leaderboard = mongoose.model('Leaderboard', leaderboardSchema);

module.exports = Leaderboard;
