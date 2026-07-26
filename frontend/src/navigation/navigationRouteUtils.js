const MAIN_TAB_SCREEN_NAMES = new Set(['Discover', 'MyTournaments', 'CreateTab', 'Profile', 'MenuTab']);

const MAIN_TAB_TITLES = {
  Discover: 'Rack-N-Roll',
  MyTournaments: 'My Events',
  CreateTab: 'Create Tournament',
  Profile: 'Profile',
  MenuTab: 'Rack-N-Roll',
};

export function getFocusedRouteName(state) {
  if (!state) {
    return null;
  }

  const route = state.routes[state.index];
  if (route.state) {
    return getFocusedRouteName(route.state);
  }

  return route.name;
}

export function isMainTabScreen(routeName) {
  return MAIN_TAB_SCREEN_NAMES.has(routeName);
}

export function getMainTabTitle(routeName) {
  return MAIN_TAB_TITLES[routeName] || 'Rack-N-Roll';
}

export function resolveActiveTabName(rootState, routeName) {
  if (routeName === 'MainTabs') {
    return getFocusedRouteName(rootState) || 'Discover';
  }

  return getFocusedRouteName(rootState) || routeName;
}
