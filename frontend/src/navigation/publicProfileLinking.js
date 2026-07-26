import {
  findFocusedRoute,
  getPathFromState,
  getStateFromPath,
} from '@react-navigation/native';

const PUBLIC_PROFILE_PATH_PATTERN = /^\/players\/[^/?#]+\/?$/;

const linkingConfig = {
  screens: {
    PublicPlayerProfile: 'players/:username',
  },
};

/**
 * Deep-link config scoped to public player profiles only.
 * In-app navigation elsewhere keeps the browser URL at `/`.
 */
export const publicProfileLinking = {
  prefixes: [],
  config: linkingConfig,
  getStateFromPath(path, options) {
    const normalizedPath = String(path || '').split('?')[0];
    if (!PUBLIC_PROFILE_PATH_PATTERN.test(normalizedPath)) {
      return undefined;
    }
    return getStateFromPath(path, options);
  },
  getPathFromState(state, options) {
    const focusedRoute = findFocusedRoute(state);
    if (focusedRoute?.name !== 'PublicPlayerProfile' || !focusedRoute.params?.username) {
      return '/';
    }
    return getPathFromState(state, options);
  },
};
