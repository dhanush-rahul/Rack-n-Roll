import { apiGet } from './api';

export async function fetchHealth() {
  return apiGet('/health');
}
