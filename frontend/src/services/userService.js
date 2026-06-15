import { apiGet, apiPatch, apiPost } from './api';

export async function fetchMyProfile() {
  const response = await apiGet('/api/users/me/profile');
  return response.data;
}

export async function updateMyHandicap(handicap) {
  const response = await apiPatch('/api/users/me/handicap', { handicap });
  return response.data;
}

export async function setMyPassword(password) {
  const response = await apiPost('/api/users/me/password', { password });
  return response.data;
}
