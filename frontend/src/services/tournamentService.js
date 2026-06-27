import { Platform } from 'react-native';
import { fetch } from 'expo/fetch';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { resolveApiBaseUrl } from '../config/apiBaseUrl';
import { getToken } from '../utils/tokenStore';
import { apiClient, apiDelete, apiGet, apiPatch, apiPost, apiPostWithWakeRetry, apiPut } from './api';

const unwrapApiPayload = (response) => {
  if (response && typeof response === 'object' && response.success === true && response.data) {
    return response.data;
  }
  if (response && typeof response === 'object' && response.data && typeof response.data === 'object') {
    return response.data;
  }
  return response;
};

export const normalizeLiveMatchSession = (payload) => {
  const session = unwrapApiPayload(payload);
  if (!session || typeof session !== 'object') {
    return null;
  }
  return session;
};

export async function createTournament(payload) {
  const response = await apiPostWithWakeRetry('/api/tournaments', payload);
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

export async function addGuestTournamentParticipant(tournamentId, payload) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/participants/guest-add`, payload);
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

export async function updateTournamentGameSchedule(tournamentId, gameId, payload) {
  const response = await apiPatch(`/api/tournaments/${tournamentId}/games/${gameId}/schedule`, payload);
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

export async function assignTournamentProctor(tournamentId, editorUserId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/score-editors`, { editorUserId });
  return response.data;
}

export async function removeTournamentProctor(tournamentId, editorUserId) {
  const response = await apiDelete(`/api/tournaments/${tournamentId}/score-editors/${editorUserId}`);
  return response.data;
}

export async function requestTournamentProctorTransfer(tournamentId, targetUserId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/proctor-transfer`, { targetUserId });
  return response.data;
}

export async function acceptTournamentProctorTransfer(tournamentId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/proctor-transfer/accept`);
  return response.data;
}

export async function declineTournamentProctorTransfer(tournamentId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/proctor-transfer/decline`);
  return response.data;
}

export async function startLiveMatchSession(tournamentId, gameId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/games/${gameId}/start`);
  return normalizeLiveMatchSession(response);
}

export async function fetchLiveMatchState(tournamentId, gameId) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/games/${gameId}/live`);
  return normalizeLiveMatchSession(response);
}

export async function advanceLiveMatchTurn(tournamentId, gameId, payload) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/games/${gameId}/turns/advance`, payload);
  return normalizeLiveMatchSession(response);
}

export async function endLiveSeriesGame(tournamentId, gameId, payload) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/games/${gameId}/end-series-game`, payload);
  return unwrapApiPayload(response);
}

export async function requestLiveMatchTakeover(tournamentId, gameId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/games/${gameId}/live/takeover-request`);
  return unwrapApiPayload(response);
}

export async function handoffLiveMatchScoring(tournamentId, gameId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/games/${gameId}/live/handoff`);
  return unwrapApiPayload(response);
}

export async function declineLiveMatchTakeover(tournamentId, gameId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/games/${gameId}/live/takeover-decline`);
  return unwrapApiPayload(response);
}

export async function cancelLiveMatchTakeover(tournamentId, gameId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/games/${gameId}/live/takeover-cancel`);
  return unwrapApiPayload(response);
}

export async function forceTakeoverLiveMatchScoring(tournamentId, gameId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/games/${gameId}/live/takeover-force`);
  return unwrapApiPayload(response);
}

const unwrapItemsPayload = (response) => {
  const payload = response?.data ?? response ?? {};
  const items = payload.items ?? (Array.isArray(payload) ? payload : []);
  return { items };
};

export async function fetchTournamentTeams(tournamentId) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/teams`);
  return unwrapItemsPayload(response);
}

export async function fetchTournamentSoloPlayers(tournamentId) {
  const response = await apiGet(`/api/tournaments/${tournamentId}/teams/solo-players`);
  return unwrapItemsPayload(response);
}

export async function pickTournamentPartner(tournamentId, partnerPlayerId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/teams/pick-partner`, { partnerPlayerId });
  return response.data;
}

export async function randomPairTournamentTeams(tournamentId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/teams/random-pair`);
  return response.data;
}

export async function hostFormTournamentTeam(tournamentId, payload) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/teams/host-form`, payload);
  return response.data;
}

export async function breakTournamentTeam(tournamentId, teamId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/teams/${teamId}/break`);
  return response.data;
}

export async function updateTournamentTeamDisplayName(tournamentId, teamId, payload) {
  const response = await apiPatch(`/api/tournaments/${tournamentId}/teams/${teamId}/display-name`, payload);
  return response.data;
}

function buildExportFilename(tournamentName = 'tournament') {
  const safeName = String(tournamentName || 'tournament')
    .trim()
    .replace(/[^\w\- ]+/g, '')
    .replace(/\s+/g, '-')
    .slice(0, 40);

  return `${safeName || 'tournament'}-export.xlsx`;
}

async function prepareTournamentExportFile(tournamentId, tournamentName = 'tournament') {
  const filename = buildExportFilename(tournamentName);

  if (Platform.OS === 'web') {
    const response = await apiClient.get(`/api/tournaments/${tournamentId}/export/xlsx`, {
      responseType: 'arraybuffer',
    });
    const blob = new Blob([response.data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    });
    const url = URL.createObjectURL(blob);
    return { filename, uri: url, isWebBlob: true };
  }

  const baseUrl = resolveApiBaseUrl();
  const token = await getToken();
  const response = await fetch(`${baseUrl}/api/tournaments/${tournamentId}/export/xlsx`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!response.ok) {
    throw {
      code: 'EXPORT_FAILED',
      message: 'Unable to download tournament export.',
      status: response.status,
    };
  }

  const file = new File(Paths.document, filename);
  if (file.exists) {
    file.delete();
  }
  file.create();
  file.write(await response.bytes());

  return { filename, uri: file.uri, isWebBlob: false };
}

export async function downloadTournamentExport(tournamentId, tournamentName = 'tournament') {
  const { filename, uri, isWebBlob } = await prepareTournamentExportFile(tournamentId, tournamentName);

  if (isWebBlob) {
    const link = document.createElement('a');
    link.href = uri;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(uri);
    return { filename };
  }

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      dialogTitle: 'Export tournament',
      UTI: 'com.microsoft.excel.xlsx',
    });
  }

  return { filename, uri };
}

export async function emailTournamentExport(tournamentId) {
  const response = await apiPost(`/api/tournaments/${tournamentId}/export/email`);
  return response?.data ?? response;
}
