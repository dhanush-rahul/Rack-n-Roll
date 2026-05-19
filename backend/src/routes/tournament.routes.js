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
	listTournamentScoresheetController,
	updateGameScoresController,
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
} = require('../controllers/tournament.controller');

const router = express.Router();

router.get('/discover', requireAuth, discoverTournamentsController);
router.get('/:tournamentId/host-detail', requireAuth, getHostTournamentDetailController);
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
router.get('/:tournamentId/scoresheet', requireAuth, listTournamentScoresheetController);
router.put('/:tournamentId/games/:gameId/scores', requireAuth, updateGameScoresController);
router.post('/:tournamentId/games/upsert-and-score', requireAuth, upsertAndScoreGroupStageGameController);
router.get('/:tournamentId/leaderboard', requireAuth, listTournamentLeaderboardController);
router.get('/:tournamentId/playing-pattern/round-robin', requireAuth, getRoundRobinPlayingPatternController);
router.post('/:tournamentId/groups/assign-random', requireAuth, assignRandomGroupsController);
router.post('/:tournamentId/groups/regenerate', requireAuth, regenerateGroupStageFixturesController);
router.get('/:tournamentId/groups/standings', requireAuth, listGroupStandingsForHostController);
router.post('/:tournamentId/final-stage/start', requireAuth, startFinalStageFromGroupsController);
router.post('/:tournamentId/final-stage/skip-and-complete', requireAuth, finalizeTournamentWithoutFinalStageController);
router.post('/:tournamentId/final-stage/complete', requireAuth, finalizeTournamentWithFinalStageController);
router.post('/:tournamentId/leaderboard/recompute', requireAuth, recomputeTournamentLeaderboardController);
router.post('/', requireAuth, createTournamentController);

module.exports = router;
