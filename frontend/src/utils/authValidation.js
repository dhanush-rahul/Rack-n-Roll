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

export function validateSignInInput({ email, password }) {
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizePassword(password);

  const errors = {
    email: '',
    password: '',
  };

  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
    errors.email = 'Enter a valid email address.';
  }

  if (!normalizedPassword) {
    errors.password = 'Password is required.';
  } else if (normalizedPassword.length > PASSWORD_MAX_LENGTH) {
    errors.password = 'Password must be 72 characters or fewer.';
  }

  return {
    errors,
    sanitized: {
      email: normalizedEmail,
      password: normalizedPassword,
    },
  };
}

export function validateSignUpInput({ name, email, password, confirmPassword }) {
  const normalizedName = normalizeName(name);
  const normalizedEmail = normalizeEmail(email);
  const normalizedPassword = normalizePassword(password);
  const normalizedConfirmPassword = normalizePassword(confirmPassword);

  const errors = {
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  };

  if (!normalizedName) {
    errors.name = 'Name is required.';
  } else if (normalizedName.length < NAME_MIN_LENGTH) {
    errors.name = 'Name must be at least 2 characters.';
  } else if (normalizedName.length > NAME_MAX_LENGTH) {
    errors.name = 'Name must be 80 characters or fewer.';
  } else if (hasControlCharacters(normalizedName)) {
    errors.name = 'Name contains invalid characters.';
  }

  if (!normalizedEmail) {
    errors.email = 'Email is required.';
  } else if (normalizedEmail.length > EMAIL_MAX_LENGTH || !EMAIL_REGEX.test(normalizedEmail)) {
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
      name: normalizedName,
      email: normalizedEmail,
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