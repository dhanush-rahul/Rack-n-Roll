export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;
const USERNAME_REGEX = /^[a-z0-9_]+$/;

export function sanitizeUsernameBase(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

export function normalizeUsername(value) {
  return sanitizeUsernameBase(value);
}

export function suggestUsernameFromFirstName(firstName) {
  const base = sanitizeUsernameBase(firstName);
  return base.slice(0, USERNAME_MAX_LENGTH);
}

export function validateUsernameFormat(username) {
  const normalized = normalizeUsername(username);

  if (!normalized) {
    return 'Username is required.';
  }

  if (normalized.length < USERNAME_MIN_LENGTH) {
    return `Username must be at least ${USERNAME_MIN_LENGTH} characters.`;
  }

  if (normalized.length > USERNAME_MAX_LENGTH) {
    return `Username must be ${USERNAME_MAX_LENGTH} characters or fewer.`;
  }

  if (!USERNAME_REGEX.test(normalized)) {
    return 'Use lowercase letters, numbers, and underscores only.';
  }

  return '';
}
