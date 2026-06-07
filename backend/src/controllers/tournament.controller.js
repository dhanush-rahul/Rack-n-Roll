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
  manuallyRemoveParticipant,
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
  listGroupStandingsForHost,
} = require('../services/tournament.service');
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
} = require('../services/liveMatch.service');

const createTournamentController = async (req, res, next) => {
  try {
    const result = await createTournament(req.body, req.auth?.userId);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const discoverTournamentsController = async (req, res, next) => {
  try {
    const result = await listDiscoverTournaments(req.query, req.auth?.userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const getHostTournamentDetailController = async (req, res, next) => {
  try {
    const result = await getHostTournamentDetail(req.params.tournamentId, req.auth?.userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const validateInviteCodeController = async (req, res, next) => {
  try {
    const result = await validateInviteCodeForTournament(req.params.tournamentId, req.body?.inviteCode);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const submitRegistrationRequestController = async (req, res, next) => {
  try {
    const result = await submitRegistrationRequest(req.params.tournamentId, req.auth?.userId, req.body);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const listPendingRegistrationRequestsController = async (req, res, next) => {
  try {
    const result = await listPendingRegistrationRequests(req.params.tournamentId, req.auth?.userId, req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const listHostRegistrationsController = async (req, res, next) => {
  try {
    const result = await listHostRegistrations(req.params.tournamentId, req.auth?.userId, req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const searchManualAddUsersController = async (req, res, next) => {
  try {
    const result = await searchManualAddUsers(req.params.tournamentId, req.auth?.userId, req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const approveRegistrationRequestController = async (req, res, next) => {
  try {
    const result = await approveRegistrationRequest(
      req.params.tournamentId,
      req.params.registrationId,
      req.auth?.userId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const rejectRegistrationRequestController = async (req, res, next) => {
  try {
    const result = await rejectRegistrationRequest(
      req.params.tournamentId,
      req.params.registrationId,
      req.auth?.userId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const manuallyAddParticipantController = async (req, res, next) => {
  try {
    const result = await manuallyAddParticipant(req.params.tournamentId, req.auth?.userId, req.body?.userId);

    return res.status(201).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const manuallyRemoveParticipantController = async (req, res, next) => {
  try {
    const result = await manuallyRemoveParticipant(
      req.params.tournamentId,
      req.auth?.userId,
      req.params.userId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const assignScoreEditorController = async (req, res, next) => {
  try {
    const result = await assignScoreEditor(req.params.tournamentId, req.auth?.userId, req.body?.editorUserId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const removeScoreEditorController = async (req, res, next) => {
  try {
    const result = await removeScoreEditor(
      req.params.tournamentId,
      req.auth?.userId,
      req.params.editorUserId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const requestProctorTransferController = async (req, res, next) => {
  try {
    const result = await requestProctorTransfer(
      req.params.tournamentId,
      req.auth?.userId,
      req.body?.targetUserId
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const acceptProctorTransferController = async (req, res, next) => {
  try {
    const result = await acceptProctorTransfer(req.params.tournamentId, req.auth?.userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const declineProctorTransferController = async (req, res, next) => {
  try {
    const result = await declineProctorTransfer(req.params.tournamentId, req.auth?.userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const listTournamentScoresheetController = async (req, res, next) => {
  try {
    const result = await listTournamentScoresheet(req.params.tournamentId, req.auth?.userId, req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const closeTournamentRegistrationController = async (req, res, next) => {
  try {
    const result = await closeTournamentRegistration(req.params.tournamentId, req.auth?.userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const updateHostTournamentSettingsController = async (req, res, next) => {
  try {
    const result = await updateHostTournamentSettings(req.params.tournamentId, req.auth?.userId, req.body);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const assignRandomGroupsController = async (req, res, next) => {
  try {
    const result = await assignRandomGroups(req.params.tournamentId, req.auth?.userId, req.body);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const regenerateGroupStageFixturesController = async (req, res, next) => {
  try {
    const result = await regenerateGroupStageFixtures(req.params.tournamentId, req.auth?.userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const startFinalStageFromGroupsController = async (req, res, next) => {
  try {
    const result = await startFinalStageFromGroups(req.params.tournamentId, req.auth?.userId, req.body);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const listGroupStandingsForHostController = async (req, res, next) => {
  try {
    const result = await listGroupStandings(req.params.tournamentId, req.auth?.userId, req.query);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const finalizeTournamentWithoutFinalStageController = async (req, res, next) => {
  try {
    const result = await finalizeTournamentWithoutFinalStage(req.params.tournamentId, req.auth?.userId, req.body);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const finalizeTournamentWithFinalStageController = async (req, res, next) => {
  try {
    const result = await finalizeTournamentWithFinalStage(req.params.tournamentId, req.auth?.userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const updateGameScoresController = async (req, res, next) => {
  try {
    const result = await updateGameScores(req.params.tournamentId, req.params.gameId, req.auth?.userId, req.body);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const updateGameScheduleController = async (req, res, next) => {
  try {
    const result = await updateGameSchedule(
      req.params.tournamentId,
      req.params.gameId,
      req.auth?.userId,
      req.body
    );

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const upsertAndScoreGroupStageGameController = async (req, res, next) => {
  try {
    const result = await upsertAndScoreGroupStageGame(req.params.tournamentId, req.auth?.userId, req.body);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const listTournamentLeaderboardController = async (req, res, next) => {
  try {
    const result = await listTournamentLeaderboard(req.params.tournamentId, req.query?.divisionId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const getRoundRobinPlayingPatternController = async (req, res, next) => {
  try {
    const result = await getRoundRobinPlayingPattern(req.params.tournamentId, req.auth?.userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const recomputeTournamentLeaderboardController = async (req, res, next) => {
  try {
    await assertCanEditTournamentScores(req.params.tournamentId, req.auth?.userId);
    const result = await recomputeLeaderboardForScope(req.params.tournamentId, req.body?.divisionId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    return next(error);
  }
};

const startGameSessionController = async (req, res, next) => {
  try {
    const result = await startGameSession(req.params.tournamentId, req.params.gameId, req.auth?.userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const getLiveMatchStateController = async (req, res, next) => {
  try {
    const result = await getLiveMatchState(req.params.tournamentId, req.params.gameId, req.auth?.userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const advanceGameTurnController = async (req, res, next) => {
  try {
    const result = await advanceGameTurn(
      req.params.tournamentId,
      req.params.gameId,
      req.auth?.userId,
      req.body
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const endSeriesGameController = async (req, res, next) => {
  try {
    const result = await endSeriesGame(
      req.params.tournamentId,
      req.params.gameId,
      req.auth?.userId,
      req.body
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const requestLiveMatchTakeoverController = async (req, res, next) => {
  try {
    const result = await requestLiveMatchTakeover(
      req.params.tournamentId,
      req.params.gameId,
      req.auth?.userId
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const handoffLiveMatchScoringController = async (req, res, next) => {
  try {
    const result = await handoffLiveMatchScoring(
      req.params.tournamentId,
      req.params.gameId,
      req.auth?.userId
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const declineLiveMatchTakeoverController = async (req, res, next) => {
  try {
    const result = await declineLiveMatchTakeover(
      req.params.tournamentId,
      req.params.gameId,
      req.auth?.userId
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const cancelLiveMatchTakeoverController = async (req, res, next) => {
  try {
    const result = await cancelLiveMatchTakeover(
      req.params.tournamentId,
      req.params.gameId,
      req.auth?.userId
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const hostForceTakeoverLiveMatchController = async (req, res, next) => {
  try {
    const result = await hostForceTakeoverLiveMatch(
      req.params.tournamentId,
      req.params.gameId,
      req.auth?.userId
    );
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

const exportTournamentXlsxController = async (req, res, next) => {
  try {
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
  } catch (error) {
    return next(error);
  }
};

const emailTournamentExportController = async (req, res, next) => {
  try {
    const result = await emailTournamentExport(req.params.tournamentId, req.auth?.userId);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    return next(error);
  }
};

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
  manuallyRemoveParticipantController,
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
