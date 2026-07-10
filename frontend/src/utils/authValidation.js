import { validateUsernameFormat, normalizeUsername } from './usernameUtils';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CONTROL_CHAR_REGEX = /[\u0000-\u001F\u007F]/;

const NAME_MIN_LENGTH = 2;
const NAME_MAX_LENGTH = 80;
const EMAIL_MAX_LENGTH = 254;
const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

export function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

export function normalizeName(name) {
  return String(name || '')
    .trim()
    .replace(/\s+/g, ' ');
}

export function normalizePassword(password) {
  return String(password || '');
}

export function normalizePin(pin) {
  return String(pin || '')
    .trim()
    .replace(/\D/g, '');
}

function hasControlCharacters(value) {
  return CONTROL_CHAR_REGEX.test(value);
}

function validatePassword(password) {
  if (!password) {
    return 'Password is required.';
  }

  if (password.length < PASSWORD_MIN_LENGTH) {
    return 'Password must be at least 8 characters.';
  }

  if (password.length > PASSWORD_MAX_LENGTH) {
    return 'Password must be 72 characters or fewer.';
  }

  if (hasControlCharacters(password)) {
    return 'Password contains invalid characters.';
  }

  return '';
}

export function validateSignInInput({ username, password }) {
  const normalizedUsername = normalizeUsername(username);
  const normalizedPassword = normalizePassword(password);

  const errors = {
    username: '',
    password: '',
  };

  if (!normalizedUsername) {
    errors.username = 'Username is required.';
  } else {
    errors.username = validateUsernameFormat(normalizedUsername);
  }

  if (!normalizedPassword) {
    errors.password = 'Password is required.';
  } else {
    errors.password = validatePassword(normalizedPassword);
  }

  return {
    errors,
    sanitized: {
      username: normalizedUsername,
      password: normalizedPassword,
    },
  };
}

export function validateSignUpInput({
  firstName,
  lastName,
  username,
  email,
  password,
  confirmPassword,
}) {
  const normalizedFirstName = normalizeName(firstName);
  const normalizedLastName = normalizeName(lastName);
  const normalizedUsername = normalizeUsername(username);
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizePassword(password);
  const normalizedConfirmPassword = normalizePassword(confirmPassword);

  const errors = {
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  };

  if (!normalizedFirstName) {
    errors.firstName = 'First name is required.';
  } else if (normalizedFirstName.length < 1) {
    errors.firstName = 'First name is required.';
  } else if (hasControlCharacters(normalizedFirstName)) {
    errors.firstName = 'First name contains invalid characters.';
  }

  if (hasControlCharacters(normalizedLastName)) {
    errors.lastName = 'Last name contains invalid characters.';
  }

  errors.username = validateUsernameFormat(normalizedUsername);

  if (normalizedEmail && (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalizedEmail))) {
    errors.email = 'Enter a valid email address.';
  }

  errors.password = validatePassword(normalizedPassword);

  if (!normalizedConfirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (normalizedPassword !== normalizedConfirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return {
    errors,
    sanitized: {
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      username: normalizedUsername,
      email: normalizedEmail || undefined,
      password: normalizedPassword,
    },
  };
}

export function hasValidationErrors(errors) {
  return Object.values(errors).some(Boolean);
}

export function validateSetPasswordInput({ password, confirmPassword }) {
  const normalizedPassword = normalizePassword(password);
  const normalizedConfirmPassword = normalizePassword(confirmPassword);

  const errors = {
    password: '',
    confirmPassword: '',
  };

  errors.password = validatePassword(normalizedPassword);

  if (!normalizedConfirmPassword) {
    errors.confirmPassword = 'Please confirm your password.';
  } else if (normalizedPassword !== normalizedConfirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return {
    errors,
    sanitized: {
      password: normalizedPassword,
    },
  };
}

export function validateChangePasswordInput({ currentPassword, password, confirmPassword }) {
  const normalizedCurrentPassword = normalizePassword(currentPassword);
  const normalizedPassword = normalizePassword(password);
  const normalizedConfirmPassword = normalizePassword(confirmPassword);

  const errors = {
    currentPassword: '',
    password: '',
    confirmPassword: '',
  };

  if (!normalizedCurrentPassword) {
    errors.currentPassword = 'Current password is required.';
  } else if (normalizedCurrentPassword.length > PASSWORD_MAX_LENGTH) {
    errors.currentPassword = 'Current password must be 72 characters or fewer.';
  }

  errors.password = validatePassword(normalizedPassword);

  if (!normalizedConfirmPassword) {
    errors.confirmPassword = 'Please confirm your new password.';
  } else if (normalizedPassword !== normalizedConfirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  } else if (normalizedCurrentPassword && normalizedCurrentPassword === normalizedPassword) {
    errors.password = 'New password must be different from your current password.';
  }

  return {
    errors,
    sanitized: {
      currentPassword: normalizedCurrentPassword,
      password: normalizedPassword,
    },
  };
}

export function validateForgotPasswordRequestInput({ email }) {
  const normalizedEmail = normalizeEmail(email);

  const errors = {
    email: '',
  };

  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  return {
    errors,
    sanitized: {
      email: normalizedEmail,
    },
  };
}

export function validateForgotPasswordPinInput({ email, pin }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPin = normalizePin(pin);

  const errors = {
    email: '',
    pin: '',
  };

  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!normalizedPin) {
    errors.pin = 'PIN is required.';
  } else if (!/^\d{6}$/.test(normalizedPin)) {
    errors.pin = 'PIN must be 6 digits.';
  }

  return {
    errors,
    sanitized: {
      email: normalizedEmail,
      pin: normalizedPin,
    },
  };
}

export function validateForgotPasswordResetInput({ email, newPassword, confirmPassword }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizePassword(newPassword);
  const normalizedConfirmPassword = normalizePassword(confirmPassword);

  const errors = {
    email: '',
    newPassword: '',
    confirmPassword: '',
  };

  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  errors.newPassword = validatePassword(normalizedPassword);

  if (!normalizedConfirmPassword) {
    errors.confirmPassword = 'Please confirm your new password.';
  } else if (normalizedPassword !== normalizedConfirmPassword) {
    errors.confirmPassword = 'Passwords do not match.';
  }

  return {
    errors,
    sanitized: {
      email: normalizedEmail,
      newPassword: normalizedPassword,
      confirmPassword: normalizedConfirmPassword,
    },
  };
}