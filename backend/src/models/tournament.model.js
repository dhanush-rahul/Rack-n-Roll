const mongoose = require('mongoose');

const isValidCoordinateNumber = (value) => typeof value === 'number' && Number.isFinite(value);

const locationSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ['Point'],
      required: true,
      default: 'Point',
    },
    coordinates: {
      type: [Number],
      required: true,
      validate: [
        {
          validator: (value) => Array.isArray(value) && value.length === 2,
          message: 'Location coordinates must be [lng, lat]',
        },
        {
          validator: (value) => Array.isArray(value) && value.every((entry) => isValidCoordinateNumber(entry)),
          message: 'Location coordinates must contain numeric values',
        },
        {
          validator: (value) => {
            if (!Array.isArray(value) || value.length !== 2) {
              return false;
            }

            const [lng, lat] = value;
            return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
          },
          message: 'Location coordinates are out of range for [lng, lat]',
        },
      ],
    },
    countryCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      minlength: 2,
      maxlength: 3,
    },
    provinceCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 10,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    formattedAddress: {
      type: String,
      required: true,
      trim: true,
      maxlength: 280,
    },
  },
  {
    _id: false,
  }
);

const tournamentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 3,
      maxlength: 120,
    },
    hostUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    maxParticipants: {
      type: Number,
      required: true,
      min: 1,
      max: 10000,
    },
    approvedParticipantsCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    registrationMode: {
      type: String,
      required: true,
      enum: ['public', 'inviteOnly'],
      default: 'public',
      index: true,
    },
    inviteCode: {
      type: String,
      trim: true,
      uppercase: true,
      required: function requiredInviteCode() {
        return this.registrationMode === 'inviteOnly';
      },
      validate: {
        validator: function validateInviteCode(value) {
          if (this.registrationMode !== 'inviteOnly') {
            return true;
          }

          return typeof value === 'string' && value.trim().length >= 4;
        },
        message: 'Invite code is required for invite-only tournaments',
      },
    },
    registrationStatus: {
      type: String,
      required: true,
      enum: ['open', 'closed'],
      default: 'open',
      index: true,
    },
    location: {
      type: locationSchema,
      required: true,
    },
    startsAt: {
      type: Date,
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'cancelled'],
      default: 'draft',
      index: true,
    },
    scoreEditorUserIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User',
        },
      ],
      default: [],
      validate: {
        validator: (value) => Array.isArray(value) && value.length <= 2,
        message: 'A tournament can have at most 2 proctors',
      },
    },
    proctorTransferRequest: {
      fromUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      toUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      requestedAt: {
        type: Date,
        default: null,
      },
    },
    competitionConfig: {
      format: {
        type: String,
        enum: ['singles', 'doubles'],
        default: 'singles',
      },
      pairFormationMode: {
        type: String,
        enum: ['playerPicksPartner', 'hostAssigns'],
        default: 'playerPicksPartner',
      },
      groupCount: {
        type: Number,
        default: null,
        min: 1,
        max: 64,
      },
      groupStageBestOf: {
        type: Number,
        enum: [1, 3, 5, 7],
        default: 1,
      },
      finalStageEnabled: {
        type: Boolean,
        default: false,
      },
      finalStageBestOf: {
        type: Number,
        enum: [1, 3, 5, 7],
        default: 3,
      },
      finalStageTopPerGroup: {
        type: Number,
        default: 2,
        min: 1,
        max: 32,
      },
      handicapEnabled: {
        type: Boolean,
        default: false,
      },
      groupStageProctored: {
        type: Boolean,
        default: false,
      },
      finalStageProctored: {
        type: Boolean,
        default: false,
      },
    },
    progressionPlan: {
      deferred: {
        type: Boolean,
        default: false,
      },
      stages: {
        type: [
          {
            stageId: { type: String, required: true, trim: true },
            name: { type: String, required: true, trim: true, minlength: 2, maxlength: 40 },
            order: { type: Number, required: true, min: 1 },
            format: { type: String, enum: ['knockout', 'roundRobin'], required: true },
            bestOf: { type: Number, enum: [1, 3, 5, 7], default: 3 },
            proctored: { type: Boolean, default: false },
            advancement: {
              source: { type: String, enum: ['groups', 'previousStage'], required: true },
              sourceStageId: { type: String, default: null },
              topPerGroup: { type: Number, min: 1, max: 32, default: null },
              advanceCount: { type: Number, min: 1, max: 256, default: null },
              selectionMode: {
                type: String,
                enum: ['autoStandings', 'hostManual'],
                default: 'autoStandings',
              },
              poolMode: {
                type: String,
                enum: ['combined', 'groupPairKnockout', 'randomKnockout'],
                default: 'combined',
              },
              directPromotePerGroup: { type: Number, min: 0, max: 32, default: 0 },
              bypassTargetStageName: { type: String, default: null, maxlength: 40 },
              advancePerGroupPair: { type: Number, min: 1, max: 32, default: 1 },
            },
            status: {
              type: String,
              enum: ['pending', 'active', 'completed'],
              default: 'pending',
            },
          },
        ],
        default: [],
      },
    },
    progressionBypass: {
      type: [
        {
          targetStageName: { type: String, required: true, trim: true },
          participantIds: { type: [String], default: [] },
          sourceStageId: { type: String, default: null },
        },
      ],
      default: [],
    },
    activeStageId: {
      type: String,
      default: null,
      index: true,
    },
    progressionState: {
      type: String,
      enum: ['registration', 'groupSetup', 'groupStage', 'stageActive', 'finalStage', 'completed'],
      default: 'registration',
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

tournamentSchema.index({ hostUserId: 1, status: 1 });
tournamentSchema.index({ location: '2dsphere' });

const Tournament = mongoose.model('Tournament', tournamentSchema);

module.exports = Tournament;
