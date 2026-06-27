const { exportTournamentWorkbook, emailTournamentExport } = require('../services/tournamentExport.service');
const {
  createTournament,
  listDiscoverTournaments,
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
  manuallyRemoveParticipant,
  removeGuestParticipant,
  assignScoreEditor,
  removeScoreEditor,
  requestProctorTransfer,
  acceptProctorTransfer,
  declineProctorTransfer,
  listTournamentScoresheet,
  updateGameScores,
  updateGameSchedule,
  upsertAndScoreGroupStageGame,
  getRoundRobinPlayingPattern,
  recomputeLeaderboardForScope,
  listTournamentLeaderboard,
  assertCanEditTournamentScores,
  closeTournamentRegistration,
  updateHostTournamentSettings,
  assignRandomGroups,
  regenerateGroupStageFixtures,
  startFinalStageFromGroups,
  finalizeTournamentWithoutFinalStage,
  finalizeTournamentWithFinalStage,
  listGroupStandings,
} = require('../services/tournament');
const {
  startGameSession,
  getLiveMatchState,
  requestLiveMatchTakeover,
  handoffLiveMatchScoring,
  hostForceTakeoverLiveMatch,
  declineLiveMatchTakeover,
  cancelLiveMatchTakeover,
  advanceGameTurn,
  endSeriesGame,
} = require('../services/liveMatch');
const { asyncHandler } = require('../utils/asyncHandler');

const createTournamentController = asyncHandler(async (req, res) => {
  const result = await createTournament(req.body, req.auth?.userId);
  return res.status(201).json({ success: true, data: result });
});

const discoverTournamentsController = asyncHandler(async (req, res) => {
  const result = await listDiscoverTournaments(req.query, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const getHostTournamentDetailController = asyncHandler(async (req, res) => {
  const result = await getHostTournamentDetail(req.params.tournamentId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const validateInviteCodeController = asyncHandler(async (req, res) => {
  const result = await validateInviteCodeForTournament(req.params.tournamentId, req.body?.inviteCode);
  return res.status(200).json({ success: true, data: result });
});

const submitRegistrationRequestController = asyncHandler(async (req, res) => {
  const result = await submitRegistrationRequest(req.params.tournamentId, req.auth?.userId, req.body);
  return res.status(201).json({ success: true, data: result });
});

const listPendingRegistrationRequestsController = asyncHandler(async (req, res) => {
  const result = await listPendingRegistrationRequests(req.params.tournamentId, req.auth?.userId, req.query);
  return res.status(200).json({ success: true, data: result });
});

const listHostRegistrationsController = asyncHandler(async (req, res) => {
  const result = await listHostRegistrations(req.params.tournamentId, req.auth?.userId, req.query);
  return res.status(200).json({ success: true, data: result });
});

const searchManualAddUsersController = asyncHandler(async (req, res) => {
  const result = await searchManualAddUsers(req.params.tournamentId, req.auth?.userId, req.query);
  return res.status(200).json({ success: true, data: result });
});

const approveRegistrationRequestController = asyncHandler(async (req, res) => {
  const result = await approveRegistrationRequest(
    req.params.tournamentId,
    req.params.registrationId,
    req.auth?.userId
  );
  return res.status(200).json({ success: true, data: result });
});

const rejectRegistrationRequestController = asyncHandler(async (req, res) => {
  const result = await rejectRegistrationRequest(
    req.params.tournamentId,
    req.params.registrationId,
    req.auth?.userId
  );
  return res.status(200).json({ success: true, data: result });
});

const manuallyAddParticipantController = asyncHandler(async (req, res) => {
  const result = await manuallyAddParticipant(req.params.tournamentId, req.auth?.userId, req.body?.userId);
  return res.status(201).json({ success: true, data: result });
});

const addGuestParticipantController = asyncHandler(async (req, res) => {
  const result = await addGuestParticipant(req.params.tournamentId, req.auth?.userId, req.body);
  return res.status(201).json({ success: true, data: result });
});

const manuallyRemoveParticipantController = asyncHandler(async (req, res) => {
  const result = await manuallyRemoveParticipant(
    req.params.tournamentId,
    req.auth?.userId,
    req.params.userId
  );
  return res.status(200).json({ success: true, data: result });
});

const removeGuestParticipantController = asyncHandler(async (req, res) => {
  const result = await removeGuestParticipant(
    req.params.tournamentId,
    req.auth?.userId,
    req.params.playerId
  );
  return res.status(200).json({ success: true, data: result });
});

const assignScoreEditorController = asyncHandler(async (req, res) => {
  const result = await assignScoreEditor(req.params.tournamentId, req.auth?.userId, req.body?.editorUserId);
  return res.status(200).json({ success: true, data: result });
});

const removeScoreEditorController = asyncHandler(async (req, res) => {
  const result = await removeScoreEditor(
    req.params.tournamentId,
    req.auth?.userId,
    req.params.editorUserId
  );
  return res.status(200).json({ success: true, data: result });
});

const requestProctorTransferController = asyncHandler(async (req, res) => {
  const result = await requestProctorTransfer(
    req.params.tournamentId,
    req.auth?.userId,
    req.body?.targetUserId
  );
  return res.status(200).json({ success: true, data: result });
});

const acceptProctorTransferController = asyncHandler(async (req, res) => {
  const result = await acceptProctorTransfer(req.params.tournamentId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const declineProctorTransferController = asyncHandler(async (req, res) => {
  const result = await declineProctorTransfer(req.params.tournamentId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const listTournamentScoresheetController = asyncHandler(async (req, res) => {
  const result = await listTournamentScoresheet(req.params.tournamentId, req.auth?.userId, req.query);
  return res.status(200).json({ success: true, data: result });
});

const closeTournamentRegistrationController = asyncHandler(async (req, res) => {
  const result = await closeTournamentRegistration(req.params.tournamentId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const updateHostTournamentSettingsController = asyncHandler(async (req, res) => {
  const result = await updateHostTournamentSettings(req.params.tournamentId, req.auth?.userId, req.body);
  return res.status(200).json({ success: true, data: result });
});

const assignRandomGroupsController = asyncHandler(async (req, res) => {
  const result = await assignRandomGroups(req.params.tournamentId, req.auth?.userId, req.body);
  return res.status(200).json({ success: true, data: result });
});

const regenerateGroupStageFixturesController = asyncHandler(async (req, res) => {
  const result = await regenerateGroupStageFixtures(req.params.tournamentId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const startFinalStageFromGroupsController = asyncHandler(async (req, res) => {
  const result = await startFinalStageFromGroups(req.params.tournamentId, req.auth?.userId, req.body);
  return res.status(200).json({ success: true, data: result });
});

const listGroupStandingsForHostController = asyncHandler(async (req, res) => {
  const result = await listGroupStandings(req.params.tournamentId, req.auth?.userId, req.query);
  return res.status(200).json({ success: true, data: result });
});

const finalizeTournamentWithoutFinalStageController = asyncHandler(async (req, res) => {
  const result = await finalizeTournamentWithoutFinalStage(req.params.tournamentId, req.auth?.userId, req.body);
  return res.status(200).json({ success: true, data: result });
});

const finalizeTournamentWithFinalStageController = asyncHandler(async (req, res) => {
  const result = await finalizeTournamentWithFinalStage(req.params.tournamentId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const updateGameScoresController = asyncHandler(async (req, res) => {
  const result = await updateGameScores(req.params.tournamentId, req.params.gameId, req.auth?.userId, req.body);
  return res.status(200).json({ success: true, data: result });
});

const updateGameScheduleController = asyncHandler(async (req, res) => {
  const result = await updateGameSchedule(
    req.params.tournamentId,
    req.params.gameId,
    req.auth?.userId,
    req.body
  );
  return res.status(200).json({ success: true, data: result });
});

const upsertAndScoreGroupStageGameController = asyncHandler(async (req, res) => {
  const result = await upsertAndScoreGroupStageGame(req.params.tournamentId, req.auth?.userId, req.body);
  return res.status(200).json({ success: true, data: result });
});

const listTournamentLeaderboardController = asyncHandler(async (req, res) => {
  const result = await listTournamentLeaderboard(req.params.tournamentId, req.query?.divisionId);
  return res.status(200).json({ success: true, data: result });
});

const getRoundRobinPlayingPatternController = asyncHandler(async (req, res) => {
  const result = await getRoundRobinPlayingPattern(req.params.tournamentId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const recomputeTournamentLeaderboardController = asyncHandler(async (req, res) => {
  await assertCanEditTournamentScores(req.params.tournamentId, req.auth?.userId);
  const result = await recomputeLeaderboardForScope(req.params.tournamentId, req.body?.divisionId);
  return res.status(200).json({ success: true, data: result });
});

const startGameSessionController = asyncHandler(async (req, res) => {
  const result = await startGameSession(req.params.tournamentId, req.params.gameId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const getLiveMatchStateController = asyncHandler(async (req, res) => {
  const result = await getLiveMatchState(req.params.tournamentId, req.params.gameId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

const advanceGameTurnController = asyncHandler(async (req, res) => {
  const result = await advanceGameTurn(
    req.params.tournamentId,
    req.params.gameId,
    req.auth?.userId,
    req.body
  );
  return res.status(200).json({ success: true, data: result });
});

const endSeriesGameController = asyncHandler(async (req, res) => {
  const result = await endSeriesGame(
    req.params.tournamentId,
    req.params.gameId,
    req.auth?.userId,
    req.body
  );
  return res.status(200).json({ success: true, data: result });
});

const requestLiveMatchTakeoverController = asyncHandler(async (req, res) => {
  const result = await requestLiveMatchTakeover(
    req.params.tournamentId,
    req.params.gameId,
    req.auth?.userId
  );
  return res.status(200).json({ success: true, data: result });
});

const handoffLiveMatchScoringController = asyncHandler(async (req, res) => {
  const result = await handoffLiveMatchScoring(
    req.params.tournamentId,
    req.params.gameId,
    req.auth?.userId
  );
  return res.status(200).json({ success: true, data: result });
});

const declineLiveMatchTakeoverController = asyncHandler(async (req, res) => {
  const result = await declineLiveMatchTakeover(
    req.params.tournamentId,
    req.params.gameId,
    req.auth?.userId
  );
  return res.status(200).json({ success: true, data: result });
});

const cancelLiveMatchTakeoverController = asyncHandler(async (req, res) => {
  const result = await cancelLiveMatchTakeover(
    req.params.tournamentId,
    req.params.gameId,
    req.auth?.userId
  );
  return res.status(200).json({ success: true, data: result });
});

const hostForceTakeoverLiveMatchController = asyncHandler(async (req, res) => {
  const result = await hostForceTakeoverLiveMatch(
    req.params.tournamentId,
    req.params.gameId,
    req.auth?.userId
  );
  return res.status(200).json({ success: true, data: result });
});

const exportTournamentXlsxController = asyncHandler(async (req, res) => {
  const { buffer, filename } = await exportTournamentWorkbook(
    req.params.tournamentId,
    req.auth?.userId
  );
  res.setHeader(
    'Content-Type',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  );
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.status(200).send(buffer);
});

const emailTournamentExportController = asyncHandler(async (req, res) => {
  const result = await emailTournamentExport(req.params.tournamentId, req.auth?.userId);
  return res.status(200).json({ success: true, data: result });
});

module.exports = {
  createTournamentController,
  discoverTournamentsController,
  getHostTournamentDetailController,
  validateInviteCodeController,
  submitRegistrationRequestController,
  listPendingRegistrationRequestsController,
  listHostRegistrationsController,
  approveRegistrationRequestController,
  rejectRegistrationRequestController,
  searchManualAddUsersController,
  manuallyAddParticipantController,
  addGuestParticipantController,
  manuallyRemoveParticipantController,
  removeGuestParticipantController,
  assignScoreEditorController,
  removeScoreEditorController,
  requestProctorTransferController,
  acceptProctorTransferController,
  declineProctorTransferController,
  listTournamentScoresheetController,
  updateGameScoresController,
  updateGameScheduleController,
  upsertAndScoreGroupStageGameController,
  listTournamentLeaderboardController,
  getRoundRobinPlayingPatternController,
  recomputeTournamentLeaderboardController,
  closeTournamentRegistrationController,
  updateHostTournamentSettingsController,
  assignRandomGroupsController,
  regenerateGroupStageFixturesController,
  listGroupStandingsForHostController,
  startFinalStageFromGroupsController,
  finalizeTournamentWithoutFinalStageController,
  finalizeTournamentWithFinalStageController,
  startGameSessionController,
  getLiveMatchStateController,
  requestLiveMatchTakeoverController,
  handoffLiveMatchScoringController,
  declineLiveMatchTakeoverController,
  cancelLiveMatchTakeoverController,
  hostForceTakeoverLiveMatchController,
  advanceGameTurnController,
  endSeriesGameController,
  exportTournamentXlsxController,
  emailTournamentExportController,
};
