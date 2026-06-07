import axios from 'axios/dist/browser/axios.cjs';
import { resolveApiBaseUrl } from '../config/apiBaseUrl';

const API_BASE_URL = resolveApiBaseUrl();

const WAKE_RETRY_DELAYS_MS = [1000, 2000, 4000];
const WAKE_REQUEST_TIMEOUT_MS = 8000;

let wakePromise = null;
let lastWakeSuccessAt = 0;
const WAKE_TTL_MS = 45000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pingHealthOnce() {
  const response = await axios.get(`${API_BASE_URL}/health`, {
    timeout: WAKE_REQUEST_TIMEOUT_MS,
    validateStatus: (status) => status >= 200 && status < 500,
  });

  if (response.status >= 200 && response.status < 300) {
    const data = response.data;
    if (data?.status === 'ok' || data?.service) {
      return true;
    }
  }

  return false;
}

/**
 * Wake Render (or any sleeping host) before authenticated API calls.
 * Retries on network errors and 5xx responses.
 */
export async function wakeBackendIfNeeded({ force = false } = {}) {
  if (!force && Date.now() - lastWakeSuccessAt < WAKE_TTL_MS) {
    return true;
  }

  if (wakePromise && !force) {
    return wakePromise;
  }

  wakePromise = (async () => {
    const attempts = WAKE_RETRY_DELAYS_MS.length + 1;

    for (let attempt = 0; attempt < attempts; attempt += 1) {
      try {
        const ok = await pingHealthOnce();
        if (ok) {
          lastWakeSuccessAt = Date.now();
          return true;
        }
      } catch {
        // retry
      }

      if (attempt < WAKE_RETRY_DELAYS_MS.length) {
        await sleep(WAKE_RETRY_DELAYS_MS[attempt]);
      }
    }

    return false;
  })();

  try {
    return await wakePromise;
  } finally {
    wakePromise = null;
  }
}

export async function fetchHealth() {
  await wakeBackendIfNeeded();
  const { apiGet } = await import('./api');
  return apiGet('/health');
}
