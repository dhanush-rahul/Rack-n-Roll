const mongoose = require('mongoose');

const playerSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    displayName: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 120,
    },
    handicapEnabled: {
      type: Boolean,
      default: false,
    },
    handicapValue: {
      type: Number,
      default: 0,
      min: 0,
      max: 300,
    },
    teamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    awaitingPartner: {
      type: Boolean,
      default: false,
      index: true,
    },
    status: {
      type: String,
      enum: ['active', 'removed'],
      default: 'active',
      index: true,
    },
    pendingLinkEmail: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      maxlength: 254,
    },
    addedByHostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

playerSchema.index({ tournamentId: 1, displayName: 1 });
playerSchema.index(
  { tournamentId: 1, userId: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'active',
      userId: { $type: 'objectId' },
    },
  }
);
playerSchema.index(
  { tournamentId: 1, pendingLinkEmail: 1 },
  {
    unique: true,
    partialFilterExpression: {
      status: 'active',
      pendingLinkEmail: { $type: 'string' },
    },
  }
);

const Player = mongoose.model('Player', playerSchema);

module.exports = Player;
