import { apiGet, apiPostWithWakeRetry } from './api';

export async function checkUsernameAvailability(username, purpose = 'signup') {
  const response = await apiGet('/api/auth/username/check', {
    params: {
      username,
      purpose,
    },
  });
  return response.data;
}

export async function signupUser({ firstName, lastName, username, email, password }) {
  const payload = {
    firstName,
    lastName,
    username,
    password,
  };

  if (email) {
    payload.email = email;
  }

  const response = await apiPostWithWakeRetry('/api/auth/signup', payload);
  return response.data;
}

export async function loginUser({ username, password }) {
  const response = await apiPostWithWakeRetry('/api/auth/login', { username, password });
  return response.data;
}

export async function signInWithGoogle({ idToken }) {
  const response = await apiPostWithWakeRetry('/api/auth/google', { idToken });
  return response.data;
}

export async function requestPasswordResetPin({ email }) {
  const response = await apiPost('/api/auth/forgot-password/request', { email });
  return response.data;
}

export async function validatePasswordResetPin({ email, pin }) {
  const response = await apiPost('/api/auth/forgot-password/validate-pin', { email, pin });
  return response.data;
}

export async function confirmPasswordReset({ email, resetToken, newPassword }) {
  const response = await apiPost('/api/auth/forgot-password', { email, resetToken, newPassword });
  return response.data;
}
