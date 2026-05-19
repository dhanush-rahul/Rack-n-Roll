const mongoose = require('mongoose');

const divisionSchema = new mongoose.Schema(
  {
    tournamentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Tournament',
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80,
    },
    playerIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Player',
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ['open', 'closed'],
      default: 'open',
    },
  },
  {
    timestamps: true,
  }
);

divisionSchema.index({ tournamentId: 1, name: 1 }, { unique: true });

const Division = mongoose.model('Division', divisionSchema);

module.exports = Division;
