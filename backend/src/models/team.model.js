const mongoose = require('mongoose');

const teamSchema = new mongoose.Schema(
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
    player1Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      index: true,
    },
    player2Id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      required: true,
      index: true,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 160,
    },
    customDisplayName: {
      type: String,
      trim: true,
      maxlength: 160,
      default: null,
    },
    status: {
      type: String,
      enum: ['active', 'dissolved'],
      default: 'active',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

teamSchema.index({ tournamentId: 1, status: 1 });
teamSchema.index(
  { tournamentId: 1, player1Id: 1, player2Id: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } }
);

const Team = mongoose.model('Team', teamSchema);

module.exports = Team;
