import { markIgnoreNextPopState } from './navigationGuard';
import { navigateToCreateFlow } from './navigateToCreateFlow';

const ALLOWED_RETURN_SCREENS = new Set([
  'MainTabs',
  'Home',
  'Discover',
  'MyTournaments',
  'Profile',
  'CreateTab',
  'Settings',
  'PlayerCard',
  'Help',
  'CreateTournament',
  'CreateTournamentWalkthrough',
]);

const DISCOVER_PARAM_SANITIZERS = {
  highlightTournamentId: (value) => {
    const id = String(value || '').trim();
    return /^[a-f0-9]{24}$/i.test(id) ? id : undefined;
  },
  filterId: (value) => {
    const allowed = new Set(['all', 'open']);
    return allowed.has(value) ? value : undefined;
  },
};

function pickAllowedDiscoverParams(params) {
  if (!params || typeof params !== 'object') {
    return {};
  }

  return Object.entries(DISCOVER_PARAM_SANITIZERS).reduce((result, [key, sanitize]) => {
    if (params[key] === undefined) {
      return result;
    }

    const sanitized = sanitize(params[key]);
    if (sanitized !== undefined) {
      result[key] = sanitized;
    }

    return result;
  }, {});
}

function resolveMainTabsNavigation(returnTo) {
  if (!returnTo?.screen) {
    return { screen: 'Discover', params: undefined };
  }

  if (returnTo.screen === 'Home' || returnTo.screen === 'Discover') {
    return { screen: 'Discover', params: pickAllowedDiscoverParams(returnTo.params) };
  }

  if (
    returnTo.screen === 'MyTournaments' ||
    returnTo.screen === 'Profile' ||
    returnTo.screen === 'CreateTab'
  ) {
    return { screen: returnTo.screen, params: returnTo.params };
  }

  if (returnTo.screen === 'MainTabs') {
    return {
      screen: returnTo.params?.screen || 'Discover',
      params: returnTo.params?.params,
    };
  }

  return { screen: 'Discover', params: undefined };
}

export async function navigateAfterAuth(navigation, returnTo) {
  if (returnTo?.screen === 'CreateTournamentWalkthrough') {
    markIgnoreNextPopState();
    navigation.navigate('CreateTournamentWalkthrough', returnTo.params);
    return;
  }

  if (
    returnTo?.screen === 'CreateTournament' ||
    returnTo?.screen === 'CreateTab' ||
    (returnTo?.screen === 'MainTabs' &&
      (returnTo?.params?.screen === 'CreateTab' || returnTo?.params?.screen === 'CreateTournament'))
  ) {
    await navigateToCreateFlow(navigation);
    return;
  }

  if (returnTo?.screen === 'Settings' || returnTo?.screen === 'PlayerCard' || returnTo?.screen === 'Help') {
    markIgnoreNextPopState();
    navigation.navigate(returnTo.screen, returnTo.params);
    return;
  }

  if (returnTo?.screen && ALLOWED_RETURN_SCREENS.has(returnTo.screen)) {
    const { screen, params } = resolveMainTabsNavigation(returnTo);
    markIgnoreNextPopState();
    navigation.navigate('MainTabs', { screen, params });
    return;
  }

  if (navigation.canGoBack()) {
    markIgnoreNextPopState();
    navigation.goBack();
    return;
  }

  markIgnoreNextPopState();
  navigation.navigate('MainTabs', { screen: 'Discover' });
}

