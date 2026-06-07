import { apiPost, apiPostWithWakeRetry } from './api';

export async function signupUser({ name, email, password }) {
  const response = await apiPostWithWakeRetry('/api/auth/signup', { name, email, password });
  return response.data;
}

export async function loginUser({ email, password }) {
  const response = await apiPostWithWakeRetry('/api/auth/login', { email, password });
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
