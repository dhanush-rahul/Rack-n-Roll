const { createTournament, listDiscoverTournaments, listMyRegisteredDiscoverTournaments, getHostTournamentDetail, validateInviteCodeForTournament, updateHostTournamentSettings, closeTournamentRegistration } = require('./discovery.service');
const { submitRegistrationRequest, listPendingRegistrationRequests, listHostRegistrations, approveRegistrationRequest, rejectRegistrationRequest, searchManualAddUsers, getRoundRobinPlayingPattern } = require('./registration.service');
const { manuallyAddParticipant, manuallyRemoveParticipant, addGuestParticipant, linkPendingGuestPlayersForUser, removeGuestParticipant, replaceApprovedParticipant, assignScoreEditor, removeScoreEditor, requestProctorTransfer, acceptProctorTransfer, declineProctorTransfer } = require('./participants.service');
const { isStageProctored, canUserEditGameScores } = require('./shared');
const { canUserEditTournamentScores, assertCanEditTournamentScores, assertCanEditGameScores, assertUserCanScheduleMatch } = require('./permissions');
const { listTournamentScoresheet, updateGameScores, updateGameSchedule, upsertAndScoreGroupStageGame } = require('./scoring.service');
const { recomputeLeaderboardForScope, listTournamentLeaderboard, listGroupStandings, listGroupStandingsForHost } = require('./leaderboard.service');
const { assignRandomGroups, regenerateGroupStageFixtures } = require('./fixtures.service');
const { startFinalStageFromGroups, finalizeTournamentWithoutFinalStage, finalizeTournamentWithFinalStage, updateProgressionPlan, appendProgressionStage, abandonPendingProgressionStage, getGroupAdvancementPreview, getStageCandidates, startProgressionStage, regenerateProgressionStageFixtures, completeProgressionStage, finalizeTournamentAfterGroups } = require('./progression.service');
const { materializeApprovedPlayers, materializeApprovedPlayerForUser } = require('./roster.service');

module.exports = {
  createTournament,
  listDiscoverTournaments,
  listMyRegisteredDiscoverTournaments,
  getHostTournamentDetail,
  validateInviteCodeForTournament,
  submitRegistrationRequest,
  listPendingRegistrationRequests,
  listHostRegistrations,
  approveRegistrationRequest,
  rejectRegistrationRequest,
  searchManualAddUsers,
  manuallyAddParticipant,
  addGuestParticipant,
  linkPendingGuestPlayersForUser,
  manuallyRemoveParticipant,
  removeGuestParticipant,
  replaceApprovedParticipant,
  assignScoreEditor,
  removeScoreEditor,
  requestProctorTransfer,
  acceptProctorTransfer,
  declineProctorTransfer,
  isStageProctored,
  canUserEditGameScores,
  canUserEditTournamentScores,
  assertCanEditTournamentScores,
  assertCanEditGameScores,
  assertUserCanScheduleMatch,
  listTournamentScoresheet,
  updateGameScores,
  updateGameSchedule,
  upsertAndScoreGroupStageGame,
  getRoundRobinPlayingPattern,
  recomputeLeaderboardForScope,
  listTournamentLeaderboard,
  listGroupStandings,
  listGroupStandingsForHost,
  closeTournamentRegistration,
  updateHostTournamentSettings,
  assignRandomGroups,
  regenerateGroupStageFixtures,
  startFinalStageFromGroups,
  finalizeTournamentWithoutFinalStage,
  finalizeTournamentWithFinalStage,
  updateProgressionPlan,
  appendProgressionStage,
  abandonPendingProgressionStage,
  getGroupAdvancementPreview,
  getStageCandidates,
  startProgressionStage,
  regenerateProgressionStageFixtures,
  completeProgressionStage,
  finalizeTournamentAfterGroups,
  materializeApprovedPlayers,
  materializeApprovedPlayerForUser,
};
