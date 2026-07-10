const AUTH_ERROR_MESSAGES = {
  SIGNUP_FAILED:
    'Unable to create an account with these details. Try signing in if you already have one.',
  INVALID_CREDENTIALS: 'Invalid username or password. Please try again.',
  GOOGLE_AUTH_REQUIRED: 'This account uses Google sign-in. Continue with Google or set a password in Profile.',
  INVALID_GOOGLE_TOKEN: 'Google sign-in failed. Please try again.',
  GOOGLE_EMAIL_NOT_VERIFIED: 'Your Google account email must be verified before signing in.',
  GOOGLE_ACCOUNT_MISMATCH: 'This email is linked to a different Google account.',
  RATE_LIMIT_EXCEEDED: 'Too many attempts. Please wait and try again.',
  INVALID_RESET_PIN: 'That PIN is incorrect or has expired.',
  RESET_PIN_EXPIRED: 'Your reset PIN has expired. Request a new one.',
  RESET_PIN_LOCKED: 'Too many invalid PIN attempts. Request a new PIN.',
  INVALID_RESET_TOKEN: 'Your reset session expired. Start over from the email step.',
  PASSWORD_REUSE_NOT_ALLOWED: 'Choose a new password that has not been used recently.',
  PASSWORD_ALREADY_SET: 'A password is already set for this account.',
  PASSWORD_NOT_SET: 'Set a password first before changing it.',
  INVALID_CURRENT_PASSWORD: 'Current password is incorrect.',
  WEAK_PASSWORD: 'Password must be at least 8 characters.',
  INVALID_EMAIL: 'Enter a valid email address.',
  EMAIL_ALREADY_SET: 'Your account already has an email on file.',
  EMAIL_TAKEN: 'This email is already linked to another account.',
  INVALID_NAME: 'Name contains unsupported characters.',
  INVALID_USERNAME: 'Username must be 3–20 characters using lowercase letters, numbers, or underscores.',
  USERNAME_TAKEN: 'This username is already taken.',
  USERNAME_RESERVED: 'This username is reserved for a tournament guest invite.',
  USERNAME_ALREADY_REGISTERED:
    'This username is already registered. Search for the player and add them directly.',
  USERNAME_CHANGE_LIMIT: 'Username can only be changed twice.',
};

export function getAuthErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  if (!error || typeof error !== 'object') {
    return fallback;
  }

  if (error.code === 'ACCOUNT_LOCKED') {
    const retryMinutes = error.details?.retryAfterSeconds
      ? Math.max(1, Math.ceil(error.details.retryAfterSeconds / 60))
      : 15;
    return `Too many failed sign-in attempts. Try again in about ${retryMinutes} minute(s).`;
  }

  if (error.code === 'NETWORK_ERROR') {
    return __DEV__
      ? 'Unable to reach the server. Start the backend and restart Expo with -c.'
      : 'Unable to reach the server. Check your connection and try again.';
  }

  return AUTH_ERROR_MESSAGES[error.code] ?? fallback;
}
