import { apiGet } from './api';

export async function fetchMyProfile() {
  const response = await apiGet('/api/users/me/profile');
  return response.data;
}
