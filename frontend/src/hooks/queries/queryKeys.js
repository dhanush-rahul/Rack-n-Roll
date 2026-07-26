export const queryKeys = {
  discover: (params) => ['discover', params],
  discoverRegistered: () => ['discover', 'registered'],
  myTournaments: (params) => ['tournaments', 'my', params],
  profile: () => ['profile'],
  publicProfile: (username) => ['profile', 'public', username],
  hostDetail: (tournamentId) => ['tournament', tournamentId, 'host-detail'],
  registrations: (tournamentId, params = {}) => ['tournament', tournamentId, 'registrations', params],
  standings: (tournamentId, params = {}) => ['tournament', tournamentId, 'standings', params],
  tracker: (tournamentId, params = {}) => ['tournament', tournamentId, 'tracker', params],
  scoresheet: (tournamentId, params = {}) => ['tournament', tournamentId, 'scoresheet', params],
  teamsData: (tournamentId) => ['tournament', tournamentId, 'teams-data'],
};

export const discoverQueryKey = ({ page, pageSize, sort, q, upcoming, ongoing, registrationOpen }) =>
  queryKeys.discover({
    page,
    pageSize,
    sort,
    q: q || '',
    upcoming: upcoming ? 'true' : 'false',
    ongoing: ongoing ? 'true' : 'false',
    registrationOpen: registrationOpen ? 'true' : 'false',
  });

export const myTournamentsQueryKey = ({ page, pageSize, sort, q, filter }) =>
  queryKeys.myTournaments({
    page,
    pageSize,
    sort,
    q: q || '',
    filter: filter || 'all',
  });

export const tournamentQueryPrefix = (tournamentId) => ['tournament', tournamentId];
