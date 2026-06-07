const express = require('express');
const { requireAuth } = require('../middleware/requireAuth');
const {
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
	startGameSessionController,
	getLiveMatchStateController,
	requestLiveMatchTakeoverController,
	handoffLiveMatchScoringController,
	declineLiveMatchTakeoverController,
	cancelLiveMatchTakeoverController,
	hostForceTakeoverLiveMatchController,
	advanceGameTurnController,
	endSeriesGameController,
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
	exportTournamentXlsxController,
	emailTournamentExportController,
} = require('../controllers/tournament.controller');

const router = express.Router();
const {
  listTournamentTeamsController,
  listSoloPlayersController,
  pickPartnerController,
  breakTeamController,
  hostFormTeamController,
  updateTeamDisplayNameController,
  randomPairTeamsController,
} = require('../controllers/team.controller');

router.get('/discover', requireAuth, discoverTournamentsController);
router.get('/:tournamentId/host-detail', requireAuth, getHostTournamentDetailController);
router.get('/:tournamentId/export/xlsx', requireAuth, exportTournamentXlsxController);
router.post('/:tournamentId/export/email', requireAuth, emailTournamentExportController);
router.post('/:tournamentId/registration/close', requireAuth, closeTournamentRegistrationController);
router.patch('/:tournamentId/settings', requireAuth, updateHostTournamentSettingsController);
router.post('/:tournamentId/validate-invite-code', requireAuth, validateInviteCodeController);
router.post('/:tournamentId/registrations', requireAuth, submitRegistrationRequestController);
router.get('/:tournamentId/registrations/pending', requireAuth, listPendingRegistrationRequestsController);
router.get('/:tournamentId/registrations/host-list', requireAuth, listHostRegistrationsController);
router.post(
	'/:tournamentId/registrations/:registrationId/approve',
	requireAuth,
	approveRegistrationRequestController
);
router.post(
	'/:tournamentId/registrations/:registrationId/reject',
	requireAuth,
	rejectRegistrationRequestController
);
router.get('/:tournamentId/participants/search', requireAuth, searchManualAddUsersController);
router.post('/:tournamentId/participants/manual-add', requireAuth, manuallyAddParticipantController);
router.post('/:tournamentId/participants/:userId/remove', requireAuth, manuallyRemoveParticipantController);
router.post('/:tournamentId/score-editors', requireAuth, assignScoreEditorController);
router.delete('/:tournamentId/score-editors/:editorUserId', requireAuth, removeScoreEditorController);
router.post('/:tournamentId/proctor-transfer', requireAuth, requestProctorTransferController);
router.post('/:tournamentId/proctor-transfer/accept', requireAuth, acceptProctorTransferController);
router.post('/:tournamentId/proctor-transfer/decline', requireAuth, declineProctorTransferController);
router.get('/:tournamentId/scoresheet', requireAuth, listTournamentScoresheetController);
router.post('/:tournamentId/games/:gameId/start', requireAuth, startGameSessionController);
router.get('/:tournamentId/games/:gameId/live', requireAuth, getLiveMatchStateController);
router.post('/:tournamentId/games/:gameId/live/takeover-request', requireAuth, requestLiveMatchTakeoverController);
router.post('/:tournamentId/games/:gameId/live/handoff', requireAuth, handoffLiveMatchScoringController);
router.post('/:tournamentId/games/:gameId/live/takeover-decline', requireAuth, declineLiveMatchTakeoverController);
router.post('/:tournamentId/games/:gameId/live/takeover-cancel', requireAuth, cancelLiveMatchTakeoverController);
router.post('/:tournamentId/games/:gameId/live/takeover-force', requireAuth, hostForceTakeoverLiveMatchController);
router.post('/:tournamentId/games/:gameId/turns/advance', requireAuth, advanceGameTurnController);
router.post('/:tournamentId/games/:gameId/end-series-game', requireAuth, endSeriesGameController);
router.put('/:tournamentId/games/:gameId/scores', requireAuth, updateGameScoresController);
router.patch('/:tournamentId/games/:gameId/schedule', requireAuth, updateGameScheduleController);
router.post('/:tournamentId/games/upsert-and-score', requireAuth, upsertAndScoreGroupStageGameController);
router.get('/:tournamentId/leaderboard', requireAuth, listTournamentLeaderboardController);
router.get('/:tournamentId/playing-pattern/round-robin', requireAuth, getRoundRobinPlayingPatternController);
router.post('/:tournamentId/groups/assign-random', requireAuth, assignRandomGroupsController);
router.get('/:tournamentId/teams', requireAuth, listTournamentTeamsController);
router.get('/:tournamentId/teams/solo-players', requireAuth, listSoloPlayersController);
router.post('/:tournamentId/teams/pick-partner', requireAuth, pickPartnerController);
router.post('/:tournamentId/teams/random-pair', requireAuth, randomPairTeamsController);
router.post('/:tournamentId/teams/host-form', requireAuth, hostFormTeamController);
router.post('/:tournamentId/teams/:teamId/break', requireAuth, breakTeamController);
router.patch('/:tournamentId/teams/:teamId/display-name', requireAuth, updateTeamDisplayNameController);
router.post('/:tournamentId/groups/regenerate', requireAuth, regenerateGroupStageFixturesController);
router.get('/:tournamentId/groups/standings', requireAuth, listGroupStandingsForHostController);
router.post('/:tournamentId/final-stage/start', requireAuth, startFinalStageFromGroupsController);
router.post('/:tournamentId/final-stage/skip-and-complete', requireAuth, finalizeTournamentWithoutFinalStageController);
router.post('/:tournamentId/final-stage/complete', requireAuth, finalizeTournamentWithFinalStageController);
router.post('/:tournamentId/leaderboard/recompute', requireAuth, recomputeTournamentLeaderboardController);
router.post('/', requireAuth, createTournamentController);

module.exports = router;
