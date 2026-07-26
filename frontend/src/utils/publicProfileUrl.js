import { Platform } from 'react-native';
import { PRODUCTION_API_BASE_URL } from '../config/apiBaseUrl';

export function getPublicProfilePath(username) {
  const normalized = String(username || '').trim().toLowerCase();
  return `/players/${encodeURIComponent(normalized)}`;
}

export function getPublicProfileUrl(username) {
  const path = getPublicProfilePath(username);

  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}${path}`;
  }

  return `https://rack-n-roll.app${path}`;
}

export function getPublicProfileApiWebUrl(username) {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location?.origin) {
    return getPublicProfileUrl(username);
  }

  return `${PRODUCTION_API_BASE_URL.replace(/\/$/, '')}${getPublicProfilePath(username)}`;
}
