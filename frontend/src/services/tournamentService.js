import { apiGet, apiPatch, apiPost, apiPut } from './api';

export async function createTournament(payload) {
  const response = await apiPost('/api/tournaments', payload);
  return response.data;
}

export async function fetchDiscoverTournaments(params = {}) {
  const response = await apiGet('/api/tournaments/discover', { params });
  return response.data;
}

export async function validateTournamentInviteCode(tournamentId, inviteCode) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/validate-invite-code`, { inviteCode });
  return response.data;
}

export async function submitTournamentRegistrationRequest(tournamentId, payload = {}) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/registrations`, payload);
  return response.data;
}

export async function fetchHostTournamentDetail(tournamentId) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/host-detail`);
  return response.data;
}

export async function fetchHostTournamentRegistrations(tournamentId, params = {}) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/registrations/host-list`, { params });
  return response.data;
}

export async function approveTournamentRegistrationRequest(tournamentId, registrationId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/registrations/${registrationId}/approve`);
  return response.data;
}

export async function rejectTournamentRegistrationRequest(tournamentId, registrationId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/registrations/${registrationId}/reject`);
  return response.data;
}

export async function searchTournamentManualAddUsers(tournamentId, params = {}) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/participants/search`, { params });
  return response.data;
}

export async function manuallyAddTournamentParticipant(tournamentId, userId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/participants/manual-add`, { userId });
  return response.data;
}

export async function fetchRoundRobinPlayingPattern(tournamentId) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/playing-pattern/round-robin`);
  return response.data;
}

export async function closeTournamentRegistration(tournamentId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/registration/close`);
  return response.data;
}

export async function updateHostTournamentSettings(tournamentId, payload) {
  const response = await apiPatch(`/api/tournaments/${tournamentId}/settings`, payload);
  return response.data;
}

export async function assignTournamentGroupsRandomly(tournamentId, payload = {}) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/groups/assign-random`, payload);
  return response.data;
}

export async function fetchTournamentGroupStandings(tournamentId, params = {}) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/groups/standings`, { params });
  return response.data;
}

export async function startTournamentFinalStage(tournamentId, payload = {}) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/final-stage/start`, payload);
  return response.data;
}

export async function completeTournamentWithoutFinalStage(tournamentId, payload = {}) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/final-stage/skip-and-complete`, payload);
  return response.data;
}

export async function completeTournamentWithFinalStage(tournamentId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/final-stage/complete`);
  return response.data;
}

export async function fetchTournamentScoresheet(tournamentId, params = {}) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/scoresheet`, { params });
  return response.data;
}

export async function updateTournamentGameScores(tournamentId, gameId, payload) {
  const response = await apiPut(`/api/tournaments/${tournamentId}/games/${gameId}/scores`, payload);
  return response.data;
}

export async function upsertAndScoreTournamentGroupGame(tournamentId, payload) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/games/upsert-and-score`, payload);
  return response.data;
}

export async function fetchTournamentLeaderboard(tournamentId, params = {}) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/leaderboard`, { params });
  return response.data;
}

export async function recomputeTournamentLeaderboard(tournamentId, payload = {}) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/leaderboard/recompute`, payload);
  return response.data;
}
