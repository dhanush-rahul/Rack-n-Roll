import { apiGet } from './api';

export async function fetchAppVersionRequirements() {
  const response = await apiGet('/api/app/version');
  return response.data;
}
