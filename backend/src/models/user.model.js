const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 20,
    },
    firstName: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },
    lastName: {
      type: String,
      trim: true,
      maxlength: 50,
      default: '',
    },
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
    },
    usernameChangeCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 2,
    },
    usernameChangeCount: {
      type: Number,
      default: 0,
      min: 0,
      max: 2,
    },
    authProvider: {
      type: String,
      enum: ['local', 'google'],
      default: 'local',
    },
    googleId: {
      type: String,
      sparse: true,
      unique: true,
    },
    passwordHash: {
      type: String,
      default: null,
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
    failedLoginAttempts: {
      type: Number,
      default: 0,
      select: false,
      min: 0,
    },
    lockoutUntil: {
      type: Date,
      default: null,
      select: false,
    },
    handicap: {
      type: Number,
      default: 0,
      min: 0,
      max: 300,
    },
  },
  {
    timestamps: true,
  }
);

userSchema.pre('validate', function validatePasswordRequirement(next) {
  const provider = this.authProvider || 'local';

  if (provider === 'local' && !this.passwordHash) {
    this.invalidate('passwordHash', 'Password is required for local accounts');
  }

  next();
});

const User = mongoose.model('User', userSchema);

module.exports = User;
