const Tournament = require('../../models/tournament.model');
const ApiError = require('../../utils/ApiError');
const { buildTeamSummaryById } = require('../team.service');
const {
  isStageProctored,
  parseBestOf,
  computeSeriesOutcome,
  buildPlayerSummaryById,
} = require('./shared');

// ── Pure permission checks ─────────────────────────────────────────────────

const canUserEditGameScores = (tournament, userId, game, playerSummaryById = new Map(), teamSummaryById = new Map()) => {
  if (!userId || !tournament || !game) {
    return false;
  }

  const normalizedUserId = String(userId);
  const isHost = String(tournament.hostUserId) === normalizedUserId;
  const isAssignedEditor = (tournament.scoreEditorUserIds || []).some(
    (editorUserId) => String(editorUserId) === normalizedUserId
  );
  const stage = game.stage || 'groupStage';
  const proctored = isStageProctored(tournament.competitionConfig || {}, stage);

  if (proctored) {
    return isHost || isAssignedEditor;
  }

  if (isHost) {
    return true;
  }

  if (game.teamAId && game.teamBId) {
    const teamA = teamSummaryById?.get?.(String(game.teamAId));
    const teamB = teamSummaryById?.get?.(String(game.teamBId));
    const memberUserIds = [
      teamA?.player1?.userId,
      teamA?.player2?.userId,
      teamB?.player1?.userId,
      teamB?.player2?.userId,
    ];
    return memberUserIds.some((matchUserId) => matchUserId && String(matchUserId) === normalizedUserId);
  }

  const playerA = playerSummaryById.get(String(game.playerAId));
  const playerB = playerSummaryById.get(String(game.playerBId));
  return [playerA?.userId, playerB?.userId].some(
    (matchUserId) => matchUserId && String(matchUserId) === normalizedUserId
  );
};

const isUserInMatch = (userId, game, playerSummaryById, teamSummaryById) => {
  const normalizedUserId = String(userId);

  if (game.teamAId && game.teamBId) {
    const teamA = teamSummaryById?.get?.(String(game.teamAId));
    const teamB = teamSummaryById?.get?.(String(game.teamBId));
    const memberUserIds = [
      teamA?.player1?.userId,
      teamA?.player2?.userId,
      teamB?.player1?.userId,
      teamB?.player2?.userId,
    ];

    return memberUserIds.some((matchUserId) => matchUserId && String(matchUserId) === normalizedUserId);
  }

  const playerA = playerSummaryById.get(String(game.playerAId));
  const playerB = playerSummaryById.get(String(game.playerBId));

  return [playerA?.userId, playerB?.userId].some(
    (matchUserId) => matchUserId && String(matchUserId) === normalizedUserId
  );
};

const canUserScheduleMatch = (tournament, userId, game, playerSummaryById, teamSummaryById) => {
  if (!userId) {
    return false;
  }

  if (String(tournament.hostUserId) === String(userId)) {
    return true;
  }

  return isUserInMatch(userId, game, playerSummaryById, teamSummaryById);
};

// ── Async assertion wrappers ───────────────────────────────────────────────

const assertUserCanScheduleMatch = async (tournamentId, userId, game) => {
  if (!userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const playerSummaryById = await buildPlayerSummaryById(
    [game.playerAId, game.playerBId].filter(Boolean)
  );
  const teamSummaryById = await buildTeamSummaryById(
    [game.teamAId, game.teamBId].filter(Boolean)
  );
  const allowed = canUserScheduleMatch(tournament, userId, game, playerSummaryById, teamSummaryById);

  if (!allowed) {
    throw new ApiError(
      403,
      'FORBIDDEN_SCHEDULE_EDIT',
      'Only the host or players in this match can schedule it'
    );
  }
};

const assertCanEditGameScores = async (tournamentId, userId, game) => {
  if (!userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1, competitionConfig: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const playerSummaryById = await buildPlayerSummaryById(
    [game.playerAId, game.playerBId].filter(Boolean)
  );
  const teamSummaryById = await buildTeamSummaryById(
    [game.teamAId, game.teamBId].filter(Boolean)
  );
  const allowed = canUserEditGameScores(tournament, userId, game, playerSummaryById, teamSummaryById);

  if (!allowed) {
    throw new ApiError(
      403,
      'FORBIDDEN_SCORE_EDIT',
      'Only the host, assigned proctors, or players in this match can edit scores'
    );
  }
};

const canUserEditTournamentScores = async (tournamentId, userId) => {
  if (!userId) {
    return false;
  }

  const tournament = await Tournament.findById(tournamentId)
    .select({ hostUserId: 1, scoreEditorUserIds: 1 })
    .lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const normalizedUserId = String(userId);
  const isHost = String(tournament.hostUserId) === normalizedUserId;
  const isAssignedEditor = (tournament.scoreEditorUserIds || []).some(
    (editorUserId) => String(editorUserId) === normalizedUserId
  );

  return isHost || isAssignedEditor;
};

const assertCanEditTournamentScores = async (tournamentId, userId) => {
  if (!userId) {
    throw new ApiError(401, 'UNAUTHORIZED', 'Authentication required');
  }

  const allowed = await canUserEditTournamentScores(tournamentId, userId);

  if (!allowed) {
    throw new ApiError(403, 'FORBIDDEN_SCORE_EDIT', 'Only host or assigned score editors can edit scores');
  }
};

// ── Game display helpers ───────────────────────────────────────────────────

const resolveGameDisplayStatus = (game) => {
  const scoreEntries = game.scoreEntries || [];
  const seriesOutcome = computeSeriesOutcome(game, scoreEntries);
  const storedStatus = game.status || 'scheduled';

  if (seriesOutcome.winnerPlayerId || storedStatus === 'completed') {
    return 'completed';
  }

  if (storedStatus === 'inProgress') {
    return 'inProgress';
  }

  return storedStatus;
};

const mapGameForScoresheet = (
  game,
  playerSummaryById = new Map(),
  divisionNameById = new Map(),
  {
    canEditMatch = false,
    canScheduleMatch = false,
    teamSummaryById = new Map(),
    tournamentMeta = null,
    viewerUserId = null,
  } = {}
) => {
  const seriesOutcome = computeSeriesOutcome(game, game.scoreEntries || []);
  const resolvedCanScheduleMatch =
    canScheduleMatch ||
    (tournamentMeta && viewerUserId
      ? canUserScheduleMatch(tournamentMeta, viewerUserId, game, playerSummaryById, teamSummaryById)
      : false);

  return {
    id: String(game._id),
    tournamentId: String(game.tournamentId),
    divisionId: game.divisionId ? String(game.divisionId) : null,
    divisionName: game.divisionId ? divisionNameById.get(String(game.divisionId)) || null : null,
    stage: game.stage || 'groupStage',
    roundNumber: Number(game.roundNumber || 1),
    bestOf: parseBestOf(game.bestOf, 1),
    playerAId: game.playerAId ? String(game.playerAId) : null,
    playerBId: game.playerBId ? String(game.playerBId) : null,
    teamAId: game.teamAId ? String(game.teamAId) : null,
    teamBId: game.teamBId ? String(game.teamBId) : null,
    playerA: game.playerAId ? playerSummaryById.get(String(game.playerAId)) || null : null,
    playerB: game.playerBId ? playerSummaryById.get(String(game.playerBId)) || null : null,
    teamA: game.teamAId ? teamSummaryById.get(String(game.teamAId)) || null : null,
    teamB: game.teamBId ? teamSummaryById.get(String(game.teamBId)) || null : null,
    playerASeriesWins: seriesOutcome.playerASeriesWins,
    playerBSeriesWins: seriesOutcome.playerBSeriesWins,
    winnerPlayerId: seriesOutcome.winnerPlayerId
      ? String(seriesOutcome.winnerPlayerId)
      : game.winnerPlayerId
        ? String(game.winnerPlayerId)
        : null,
    winnerTeamId: seriesOutcome.winnerTeamId
      ? String(seriesOutcome.winnerTeamId)
      : game.winnerTeamId
        ? String(game.winnerTeamId)
        : null,
    status: resolveGameDisplayStatus(game),
    canEditMatch,
    canScheduleMatch: resolvedCanScheduleMatch,
    scheduledStartAt: game.scheduledStartAt ? new Date(game.scheduledStartAt).toISOString() : null,
    scoreEntries: (game.scoreEntries || []).map((entry) => ({
      gameNumber: entry.gameNumber,
      playerAScore: entry.playerAScore,
      playerBScore: entry.playerBScore,
    })),
    updatedAt: game.updatedAt,
  };
};

module.exports = {
  canUserEditGameScores,
  isUserInMatch,
  canUserScheduleMatch,
  assertUserCanScheduleMatch,
  assertCanEditGameScores,
  canUserEditTournamentScores,
  assertCanEditTournamentScores,
  resolveGameDisplayStatus,
  mapGameForScoresheet,
};
