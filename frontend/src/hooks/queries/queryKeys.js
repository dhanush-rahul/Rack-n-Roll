export const queryKeys = {
  discover: (params) => ['discover', params],
  discoverRegistered: () => ['discover', 'registered'],
  profile: () => ['profile'],
  hostDetail: (tournamentId) => ['tournament', tournamentId, 'host-detail'],
  registrations: (tournamentId, params = {}) => ['tournament', tournamentId, 'registrations', params],
  standings: (tournamentId, params = {}) => ['tournament', tournamentId, 'standings', params],
  scoresheet: (tournamentId, params = {}) => ['tournament', tournamentId, 'scoresheet', params],
  teamsData: (tournamentId) => ['tournament', tournamentId, 'teams-data'],
};

export const discoverQueryKey = ({ page, pageSize, sort, q }) =>
  queryKeys.discover({ page, pageSize, sort, q: q || '' });

export const tournamentQueryPrefix = (tournamentId) => ['tournament', tournamentId];
