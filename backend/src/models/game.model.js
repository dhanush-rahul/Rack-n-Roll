const mongoose = require('mongoose');

const END_GAME_REASONS = ['potted8', 'scratchOn8', 'potted8NotCalled', 'potted8BeforeEnd'];

const turnSchema = new mongoose.Schema(
  {
    turnNumber: { type: Number, required: true, min: 1 },
    playerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', required: true },
    markedByProctorUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    legOption: { type: String, trim: true, default: null },
    legWinnerPlayerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Player', default: null },
  },
  { _id: false }
);

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
    endReason: {
      type: String,
      enum: END_GAME_REASONS,
      default: null,
    },
    legWinnerPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },
    currentTurnPlayerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
    },
    turns: {
      type: [turnSchema],
      default: [],
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
      default: null,
      index: true,
    },
    playerBId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Player',
      default: null,
      index: true,
    },
    teamAId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    teamBId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    stageId: {
      type: String,
      default: 'groupStage',
      index: true,
    },
    bracketRound: {
      type: Number,
      min: 1,
      default: null,
    },
    bracketPosition: {
      type: Number,
      min: 1,
      default: null,
    },
    bracketGroupKey: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    nextWinnerGameId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Game',
      default: null,
      index: true,
    },
    feedsFromGameIds: {
      type: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'Game',
        },
      ],
      default: [],
    },
    winnerSlot: {
      type: String,
      enum: ['playerA', 'playerB', 'teamA', 'teamB'],
      default: null,
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
    winnerTeamId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Team',
      default: null,
      index: true,
    },
    status: {
      type: String,
      enum: ['scheduled', 'inProgress', 'completed'],
      default: 'scheduled',
      index: true,
    },
    scheduledStartAt: {
      type: Date,
      default: null,
      index: true,
    },
    scheduledByUserId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    seriesState: {
      activeGameNumber: { type: Number, min: 1, default: 1 },
      startedAt: { type: Date, default: null },
      /** Proctor/host user id who may advance turns and end games in this session. */
      controllerUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      takeoverRequestedByUserId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
      },
      takeoverRequestedAt: { type: Date, default: null },
      controllerLastActiveAt: { type: Date, default: null },
    },
  },
  {
    timestamps: true,
  }
);

gameSchema.index({ tournamentId: 1, divisionId: 1, status: 1 });
gameSchema.index({ tournamentId: 1, stageId: 1, divisionId: 1, roundNumber: 1 });

gameSchema.pre('validate', function validateGameSides() {
  const hasPlayerA = Boolean(this.playerAId);
  const hasPlayerB = Boolean(this.playerBId);
  const hasTeamA = Boolean(this.teamAId);
  const hasTeamB = Boolean(this.teamBId);
  const hasPlayers = hasPlayerA && hasPlayerB;
  const hasTeams = hasTeamA && hasTeamB;

  const isKnockoutBracketSlot =
    Boolean(this.stageId) &&
    Number(this.bracketRound || 0) >= 1 &&
    !hasPlayerA &&
    !hasPlayerB &&
    !hasTeamA &&
    !hasTeamB;

  if (isKnockoutBracketSlot) {
    return;
  }

  const isSinglesBye = (hasPlayerA || hasPlayerB) && !hasPlayers && !hasTeamA && !hasTeamB;
  const isDoublesBye = (hasTeamA || hasTeamB) && !hasTeams && !hasPlayerA && !hasPlayerB;

  if (isSinglesBye || isDoublesBye) {
    return;
  }

  if (hasPlayers === hasTeams) {
    throw new Error('Game must have either playerAId/playerBId or teamAId/teamBId');
  }
});

const Game = mongoose.model('Game', gameSchema);

module.exports = Game;
