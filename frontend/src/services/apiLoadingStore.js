import { useSyncExternalStore } from 'react';

let inFlightCount = 0;
const listeners = new Set();

const notify = () => {
  listeners.forEach((listener) => listener());
};

export const incrementApiLoading = () => {
  inFlightCount += 1;
  notify();
};

export const decrementApiLoading = () => {
  inFlightCount = Math.max(0, inFlightCount - 1);
  notify();
};

export const getApiLoadingCount = () => inFlightCount;

export const subscribeApiLoading = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function useApiLoadingCount() {
  return useSyncExternalStore(subscribeApiLoading, getApiLoadingCount, getApiLoadingCount);
}
