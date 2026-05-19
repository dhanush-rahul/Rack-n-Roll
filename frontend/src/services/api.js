import axios from 'axios/dist/browser/axios.cjs';
import { Platform } from 'react-native';
import { getToken } from '../utils/tokenStore';

const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ||
  (Platform.OS === 'android' ? 'http://10.0.2.2:4000' : 'http://localhost:4000');

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  const token = await getToken();

  if (token) {
    config.headers = {
      ...(config.headers || {}),
      Authorization: `Bearer ${token}`,
    };
  }

  return config;
});

const normalizeError = (error) => {
  if (error.response?.data?.error) {
    return {
      code: error.response.data.error.code || 'REQUEST_FAILED',
      message: error.response.data.error.message || 'Request failed',
      status: error.response.status,
      details: error.response.data.error.details,
    };
  }

  if (error.request) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach server. Please try again.',
      status: null,
    };
  }

  return {
    code: 'UNKNOWN_ERROR',
    message: error.message || 'Unexpected error occurred',
    status: null,
  };
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeError(error))
);

export async function apiGet(path, config) {
  const response = await apiClient.get(path, config);
  return response.data;
}

export async function apiPost(path, body, config) {
  const response = await apiClient.post(path, body, config);
  return response.data;
}

export async function apiPut(path, body, config) {
  const response = await apiClient.put(path, body, config);
  return response.data;
}

export async function apiPatch(path, body, config) {
  const response = await apiClient.patch(path, body, config);
  return response.data;
}

export { apiClient };
