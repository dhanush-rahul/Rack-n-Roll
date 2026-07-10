export function getRosterUsername(item) {
  if (item?.isGuest) {
    return item.guestUsername || item.user?.username || null;
  }

  return item?.user?.username || null;
}

export function formatRosterRowTitle(item) {
  return item?.rosterName || item?.user?.name || 'Player';
}

export function formatRosterRowSubtitle(item) {
  const username = getRosterUsername(item);

  if (item?.isGuest) {
    return username ? `@${username} · No account yet` : 'Guest · No account yet';
  }

  return username ? `@${username}` : 'Username unavailable';
}

export function formatPendingRowTitle(item) {
  return item?.rosterName || item?.user?.name || 'Player';
}

export function formatPendingRowSubtitle(item) {
  const username = item?.user?.username;
  return username ? `@${username}` : 'Username unavailable';
}

export function formatSearchUserSubtitle(user) {
  return user?.username ? `@${user.username}` : 'No username on file';
}

export function getRosterOutgoingPlayerId(item) {
  if (item?.isGuest) {
    return String(item.playerId || item.id || '');
  }

  return String(item.playerId || '');
}
