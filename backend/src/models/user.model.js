const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    passwordResetPinHash: {
      type: String,
      default: null,
      select: false,
    },
    passwordResetPinExpiresAt: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetPinRequestedAt: {
      type: Date,
      default: null,
      select: false,
    },
    passwordResetPinAttemptCount: {
      type: Number,
      default: 0,
      select: false,
      min: 0,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model('User', userSchema);

module.exports = User;
