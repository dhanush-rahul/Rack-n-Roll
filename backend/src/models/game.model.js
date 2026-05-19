const mongoose = require('mongoose');

const scoreEntrySchema = new mongoose.Schema(
  {
    gameNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    playerAScore: {
      type: Number,
      required: true,
      min: 0,
    },
    playerBScore: {
      type: Number,
      required: true,
      min: 0,
    },
  },
  {
    _id: false,
  }
);

const gameSchema = new mongoose.Schema(
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
    playerAId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      index: true,
    },
    playerBId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      index: true,
    },
    stage: {
      type: String,
      enum: ['groupStage', 'finalStage'],
      default: 'groupStage',
      index: true,
    },
    roundNumber: {
      type: Number,
      min: 1,
      default: 1,
    },
    bestOf: {
      type: Number,
      enum: [1, 3, 5, 7],
      default: 1,
    },
    scoreEntries: {
      type: [scoreEntrySchema],
      default: [],
    },
    playerASeriesWins: {
      type: Number,
      default: 0,
      min: 0,
    },
    playerBSeriesWins: {
      type: Number,
      default: 0,
      min: 0,
    },
    winnerPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'inProgress', 'completed'],
      default: 'scheduled',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

gameSchema.index({ tournamentId: 1, divisionId: 1, status: 1 });
gameSchema.index({ tournamentId: 1, stage: 1, divisionId: 1, roundNumber: 1 });

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
