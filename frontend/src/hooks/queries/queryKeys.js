export const queryKeys = {
  discover: (params) => ['discover', params],
  profile: () => ['profile'],
  hostDetail: (tournamentId) => ['tournament', tournamentId, 'host-detail'],
  registrations: (tournamentId, params = {}) => ['tournament', tournamentId, 'registrations', params],
  standings: (tournamentId, params = {}) => ['tournament', tournamentId, 'standings', params],
  scoresheet: (tournamentId, params = {}) => ['tournament', tournamentId, 'scoresheet', params],
};

export const discoverQueryKey = ({ page, pageSize, sort, q }) =>
  queryKeys.discover({ page, pageSize, sort, q: q || '' });

export const tournamentQueryPrefix = (tournamentId) => ['tournament', tournamentId];
