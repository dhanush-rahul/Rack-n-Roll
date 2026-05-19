const mongoose = require('mongoose');

const tournamentRegistrationSchema = new mongoose.Schema(
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
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['underReview', 'approved', 'rejected', 'removed'],
      default: 'underReview',
      index: true,
    },
    inviteCodeUsed: {
      type: String,
      trim: true,
      default: null,
    },
    reviewedByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

tournamentRegistrationSchema.index({ tournamentId: 1, userId: 1 }, { unique: true });
tournamentRegistrationSchema.index({ tournamentId: 1, status: 1, createdAt: -1 });

const TournamentRegistration = mongoose.model('TournamentRegistration', tournamentRegistrationSchema);

module.exports = TournamentRegistration;
