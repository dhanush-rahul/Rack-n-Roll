const ALLOWED_RETURN_SCREENS = new Set(['Home']);

const HOME_PARAM_SANITIZERS = {
  highlightTournamentId: (value) => {
    const id = String(value || '').trim();
    return /^[a-f0-9]{24}$/i.test(id) ? id : undefined;
  },
  filterId: (value) => {
    const allowed = new Set(['all', 'open', 'mine']);
    return allowed.has(value) ? value : undefined;
  },
};

function pickAllowedHomeParams(params) {
  if (!params || typeof params !== 'object') {
    return {};
  }

  return Object.entries(HOME_PARAM_SANITIZERS).reduce((result, [key, sanitize]) => {
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

export function navigateAfterAuth(navigation, returnTo) {
  if (returnTo?.screen && ALLOWED_RETURN_SCREENS.has(returnTo.screen)) {
    const params = returnTo.screen === 'Home' ? pickAllowedHomeParams(returnTo.params) : {};
    navigation.navigate(returnTo.screen, params);
    return;
  }

  if (navigation.canGoBack()) {
    navigation.goBack();
    return;
  }

  navigation.navigate('Home');
}
