import axios from 'axios/dist/browser/axios.cjs';
import { resolveApiBaseUrl } from '../config/apiBaseUrl';
import { getToken } from '../utils/tokenStore';
import { logApiError } from '../utils/errorLogger';
import { wakeBackendIfNeeded } from './systemService';
import { decrementApiLoading, incrementApiLoading } from './apiLoadingStore';

const API_BASE_URL = resolveApiBaseUrl();

if (__DEV__) {
  console.log('[rack-n-roll] API base URL:', API_BASE_URL);
}

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
});

apiClient.interceptors.request.use(async (config) => {
  const isHealthCheck = String(config.url || '').includes('/health');

  if (!isHealthCheck) {
    incrementApiLoading();
    config.__racknrollLoadingTracked = true;
    await wakeBackendIfNeeded();
  }

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
  (response) => {
    if (response.config?.__racknrollLoadingTracked) {
      decrementApiLoading();
    }
    return response;
  },
  (error) => {
    if (error?.config?.__racknrollLoadingTracked) {
      decrementApiLoading();
    }
    const normalized = normalizeError(error);
    const requestConfig = error?.config || {};

    logApiError(normalized, {
      method: requestConfig.method?.toUpperCase() || null,
      url: requestConfig.url || null,
    });

    return Promise.reject(normalized);
  }
);

export async function apiGet(path, config) {
  const response = await apiClient.get(path, config);
  return response.data;
}

export async function apiPost(path, body, config) {
  const response = await apiClient.post(path, body, config);
  return response.data;
}

/** Retry once after waking backend when Render cold-start causes NETWORK_ERROR. */
export async function apiPostWithWakeRetry(path, body, config) {
  try {
    return await apiPost(path, body, config);
  } catch (error) {
    if (error?.code !== 'NETWORK_ERROR') {
      throw error;
    }

    await wakeBackendIfNeeded({ force: true });
    return apiPost(path, body, config);
  }
}

export async function apiPut(path, body, config) {
  const response = await apiClient.put(path, body, config);
  return response.data;
}

export async function apiPatch(path, body, config) {
  const response = await apiClient.patch(path, body, config);
  return response.data;
}

export async function apiDelete(path, config) {
  const response = await apiClient.delete(path, config);
  return response.data;
}

export { apiClient };
