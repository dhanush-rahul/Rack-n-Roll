const Tournament = require('../../models/tournament.model');
const TournamentRegistration = require('../../models/tournamentRegistration.model');
const Player = require('../../models/player.model');
const User = require('../../models/user.model');
const Division = require('../../models/division.model');
const Game = require('../../models/game.model');
const ApiError = require('../../utils/ApiError');
const { normalizeUsername } = require('../username.service');
const { materializeApprovedPlayerForUser } = require('./roster.service');
const { syncApprovedPlayerToGroups, syncApprovedPlayerToGroupsByPlayerId } = require('./fixtures.service');
const { recomputeLeaderboardForScope } = require('./leaderboard.service');
const {
  assertHostAccess,
  mapRegistrationSummary,
  mapGuestPlayerRosterItem,
  mapHostTournamentDetail,
  mapScoreEditorResponse,
  validateGuestParticipantInput,
  normalizeGuestEmail,
  ensureApprovedParticipantsCountInitialized,
  reserveApprovalCapacitySlot,
  releaseApprovalCapacitySlot,
} = require('./shared');

const findOutgoingPlayerMembership = async (tournamentId, playerId) => {
  const division = await Division.findOne({
    tournamentId,
    name: { $ne: 'Final Stage' },
    playerIds: playerId,
  }).lean();

  if (!division) {
    return { division: null, slotIndex: -1 };
  }

  const playerIds = (division.playerIds || []).map(String);
  return {
    division,
    slotIndex: playerIds.indexOf(String(playerId)),
  };
};

const pullPlayerFromDivisions = async (tournamentId, playerId) => {
  await Division.updateMany(
    { tournamentId, name: { $ne: 'Final Stage' } },
    { $pull: { playerIds: playerId } }
  );
};

const cancelIncompleteGroupGamesForPlayer = async (tournamentId, playerId) => {
  const result = await Game.deleteMany({
    tournamentId,
    stage: 'groupStage',
    status: { $in: ['scheduled', 'inProgress'] },
    $or: [{ playerAId: playerId }, { playerBId: playerId }],
  });

  return result.deletedCount || 0;
};

const swapPlayerInIncompleteGroupGames = async (tournamentId, outgoingPlayerId, incomingPlayerId) => {
  const games = await Game.find({
    tournamentId,
    stage: 'groupStage',
    status: { $in: ['scheduled', 'inProgress'] },
    $or: [{ playerAId: outgoingPlayerId }, { playerBId: outgoingPlayerId }],
  }).lean();

  let gamesUpdated = 0;

  for (const game of games) {
    const updates = {};

    if (String(game.playerAId) === String(outgoingPlayerId)) {
      updates.playerAId = incomingPlayerId;
    }

    if (String(game.playerBId) === String(outgoingPlayerId)) {
      updates.playerBId = incomingPlayerId;
    }

    if (Object.keys(updates).length > 0) {
      await Game.updateOne({ _id: game._id }, { $set: updates });
      gamesUpdated += 1;
    }
  }

  return gamesUpdated;
};

const assignPlayerToDivisionSlot = async (divisionId, playerId, slotIndex = -1) => {
  const division = await Division.findById(divisionId).lean();

  if (!division) {
    return;
  }

  const currentIds = (division.playerIds || []).map(String).filter(Boolean);
  const normalizedPlayerId = String(playerId);
  const withoutPlayer = currentIds.filter((id) => id !== normalizedPlayerId);

  if (slotIndex >= 0 && slotIndex <= withoutPlayer.length) {
    withoutPlayer.splice(slotIndex, 0, normalizedPlayerId);
  } else {
    withoutPlayer.push(normalizedPlayerId);
  }

  await Division.updateOne({ _id: divisionId }, { $set: { playerIds: withoutPlayer } });
};

const removeOutgoingPlayerInternal = async (
  tournamentId,
  hostUserId,
  outgoingPlayer,
  { cancelIncompleteGames = true } = {}
) => {
  const playerId = String(outgoingPlayer._id);

  await ensureApprovedParticipantsCountInitialized(tournamentId);

  const reservedRemovalCapacity = await Tournament.findOneAndUpdate(
    { _id: tournamentId, approvedParticipantsCount: { $gt: 0 } },
    { $inc: { approvedParticipantsCount: -1 } },
    { new: false }
  ).lean();

  if (!reservedRemovalCapacity) {
    throw new ApiError(404, 'APPROVED_PARTICIPANT_NOT_FOUND', 'Approved participant not found for removal');
  }

  const reviewedAt = new Date();
  let removedSummary = null;

  if (outgoingPlayer.userId) {
    const removedRegistration = await TournamentRegistration.findOneAndUpdate(
      { tournamentId, userId: outgoingPlayer.userId, status: 'approved' },
      { $set: { status: 'removed', reviewedByUserId: hostUserId, reviewedAt } },
      { new: true }
    ).lean();

    if (!removedRegistration) {
      await Tournament.updateOne({ _id: tournamentId }, { $inc: { approvedParticipantsCount: 1 } });
      throw new ApiError(404, 'APPROVED_PARTICIPANT_NOT_FOUND', 'Approved participant not found for removal');
    }

    removedSummary = mapRegistrationSummary(removedRegistration);
    await Player.updateOne(
      { _id: playerId, tournamentId, status: 'active' },
      { $set: { status: 'removed' } }
    );
  } else {
    const removedGuest = await Player.findOneAndUpdate(
      {
        _id: playerId,
        tournamentId,
        status: 'active',
        userId: null,
        $or: [
          { pendingLinkEmail: { $type: 'string', $ne: null } },
          { pendingLinkUsername: { $type: 'string', $ne: null } },
        ],
      },
      { $set: { status: 'removed', pendingLinkEmail: null, pendingLinkUsername: null } },
      { new: true }
    ).lean();

    if (!removedGuest) {
      await Tournament.updateOne({ _id: tournamentId }, { $inc: { approvedParticipantsCount: 1 } });
      throw new ApiError(404, 'GUEST_PARTICIPANT_NOT_FOUND', 'Guest participant not found for removal');
    }

    removedSummary = mapGuestPlayerRosterItem(removedGuest);
  }

  const { division } = await findOutgoingPlayerMembership(tournamentId, playerId);
  await pullPlayerFromDivisions(tournamentId, playerId);

  let gamesCancelled = 0;

  if (cancelIncompleteGames) {
    gamesCancelled = await cancelIncompleteGroupGamesForPlayer(tournamentId, playerId);
  }

  if (division?._id) {
    await recomputeLeaderboardForScope(tournamentId, division._id);
  }

  return {
    removedSummary,
    divisionId: division?._id ? String(division._id) : null,
    gamesCancelled,
  };
};

// ── Manual participant add/remove ──────────────────────────────────────────

const manuallyAddParticipant = async (tournamentId, hostUserId, targetUserId, options = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const normalizedTargetUserId = String(targetUserId || '').trim();

  if (!normalizedTargetUserId) {
    throw new ApiError(400, 'TARGET_USER_REQUIRED', 'Target userId is required for manual add');
  }

  if (String(tournament.hostUserId) === normalizedTargetUserId) {
    throw new ApiError(400, 'HOST_CANNOT_REGISTER', 'Host cannot be added as a participant');
  }

  const existingRegistration = await TournamentRegistration.findOne({
    tournamentId,
    userId: normalizedTargetUserId,
  }).lean();

  if (existingRegistration?.status === 'approved') {
    throw new ApiError(409, 'PARTICIPANT_ALREADY_APPROVED', 'Participant is already approved for this tournament');
  }

  await reserveApprovalCapacitySlot(tournamentId);
  const reviewedAt = new Date();

  try {
    if (existingRegistration) {
      const updatedRegistration = await TournamentRegistration.findOneAndUpdate(
        { _id: existingRegistration._id, tournamentId, status: { $ne: 'approved' } },
        { $set: { status: 'approved', reviewedByUserId: hostUserId, reviewedAt } },
        { new: true }
      ).lean();

      if (!updatedRegistration) {
        throw new ApiError(
          409,
          'PARTICIPANT_ALREADY_APPROVED',
          'Participant is already approved for this tournament'
        );
      }

      await materializeApprovedPlayerForUser(tournamentId, normalizedTargetUserId);
      const groupSync = options.skipGroupSync
        ? null
        : await syncApprovedPlayerToGroups(tournamentId, normalizedTargetUserId);

      return { ...mapRegistrationSummary(updatedRegistration), groupSync };
    }

    const createdRegistration = await TournamentRegistration.create({
      tournamentId,
      userId: normalizedTargetUserId,
      status: 'approved',
      reviewedByUserId: hostUserId,
      reviewedAt,
    });

    await materializeApprovedPlayerForUser(tournamentId, normalizedTargetUserId);
    const groupSync = options.skipGroupSync
      ? null
      : await syncApprovedPlayerToGroups(tournamentId, normalizedTargetUserId);

    return { ...mapRegistrationSummary(createdRegistration.toObject()), groupSync };
  } catch (error) {
    await releaseApprovalCapacitySlot(tournamentId);

    if (error?.code === 11000) {
      throw new ApiError(409, 'REGISTRATION_ALREADY_EXISTS', 'Registration already exists for this user');
    }

    throw error;
  }
};

const manuallyRemoveParticipant = async (tournamentId, hostUserId, targetUserId) => {
  await assertHostAccess(tournamentId, hostUserId);

  const normalizedTargetUserId = String(targetUserId || '').trim();

  if (!normalizedTargetUserId) {
    throw new ApiError(400, 'TARGET_USER_REQUIRED', 'Target userId is required for manual remove');
  }

  const outgoingPlayer = await Player.findOne({
    tournamentId,
    userId: normalizedTargetUserId,
    status: 'active',
  }).lean();

  if (!outgoingPlayer) {
    throw new ApiError(404, 'APPROVED_PARTICIPANT_NOT_FOUND', 'Approved participant not found for removal');
  }

  const result = await removeOutgoingPlayerInternal(tournamentId, hostUserId, outgoingPlayer, {
    cancelIncompleteGames: true,
  });

  return result.removedSummary;
};

// ── Guest participant add/remove ───────────────────────────────────────────

const addGuestParticipant = async (tournamentId, hostUserId, payload = {}, options = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const { normalizedName, normalizedUsername } = validateGuestParticipantInput(payload);
  const hostUser = await User.findById(tournament.hostUserId).select({ name: 1, username: 1 }).lean();

  if (hostUser && normalizeUsername(hostUser.username) === normalizedUsername) {
    throw new ApiError(400, 'HOST_CANNOT_REGISTER', 'Host cannot be added as a participant');
  }

  const existingUser = await User.findOne({ username: normalizedUsername }).select({ _id: 1 }).lean();

  if (existingUser) {
    throw new ApiError(
      409,
      'USERNAME_ALREADY_REGISTERED',
      'This username is already registered. Search for the player and add them directly.'
    );
  }

  const existingGuest = await Player.findOne({
    tournamentId,
    status: 'active',
    pendingLinkUsername: normalizedUsername,
  }).lean();

  if (existingGuest) {
    throw new ApiError(
      409,
      'GUEST_ALREADY_ON_ROSTER',
      'A guest with this username is already on the roster for this tournament'
    );
  }

  await reserveApprovalCapacitySlot(tournamentId);

  const tournamentMeta = await Tournament.findById(tournamentId).select({ name: 1, competitionConfig: 1 }).lean();
  const useHandicap = Boolean(tournamentMeta?.competitionConfig?.handicapEnabled);

  let createdPlayer;

  try {
    createdPlayer = await Player.create({
      tournamentId,
      userId: null,
      displayName: normalizedName,
      pendingLinkUsername: normalizedUsername,
      pendingLinkEmail: null,
      addedByHostUserId: hostUserId,
      handicapEnabled: useHandicap,
      handicapValue: 0,
      status: 'active',
    });
  } catch (error) {
    await releaseApprovalCapacitySlot(tournamentId);

    if (error?.code === 11000) {
      throw new ApiError(
        409,
        'GUEST_ALREADY_ON_ROSTER',
        'A guest with this username is already on the roster for this tournament'
      );
    }

    throw error;
  }

  const groupSync = options.skipGroupSync
    ? null
    : await syncApprovedPlayerToGroupsByPlayerId(tournamentId, String(createdPlayer._id));

  return {
    ...mapGuestPlayerRosterItem(createdPlayer.toObject()),
    groupSync,
    isGuest: true,
    linkedImmediately: false,
    inviteEmailSent: false,
    inviteEmailQueued: false,
  };
};

const linkPendingGuestPlayersForUser = async (userId) => {
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedUserId) {
    return { linkedTournamentIds: [] };
  }

  const user = await User.findById(normalizedUserId).select({ name: 1, email: 1, username: 1 }).lean();

  if (!user) {
    return { linkedTournamentIds: [] };
  }

  const pendingFilters = [];

  if (user.username) {
    pendingFilters.push({ pendingLinkUsername: user.username });
  }

  if (user.email) {
    pendingFilters.push({ pendingLinkEmail: normalizeGuestEmail(user.email) });
  }

  if (pendingFilters.length === 0) {
    return { linkedTournamentIds: [] };
  }

  const pendingPlayers = await Player.find({
    $or: pendingFilters,
    userId: null,
    status: 'active',
  }).lean();

  if (pendingPlayers.length === 0) {
    return { linkedTournamentIds: [] };
  }

  const linkedTournamentIds = [];
  const reviewedAt = new Date();
  const linkedPlayerIds = new Set();

  for (const player of pendingPlayers) {
    if (linkedPlayerIds.has(String(player._id))) {
      continue;
    }

    linkedPlayerIds.add(String(player._id));

    await Player.updateOne(
      { _id: player._id },
      {
        $set: {
          userId: normalizedUserId,
          displayName: user.name || player.displayName,
          pendingLinkEmail: null,
          pendingLinkUsername: null,
        },
      }
    );

    const existingRegistration = await TournamentRegistration.findOne({
      tournamentId: player.tournamentId,
      userId: normalizedUserId,
    }).lean();

    if (!existingRegistration) {
      await TournamentRegistration.create({
        tournamentId: player.tournamentId,
        userId: normalizedUserId,
        status: 'approved',
        reviewedAt,
      });
    } else if (existingRegistration.status !== 'approved') {
      await TournamentRegistration.findOneAndUpdate(
        { _id: existingRegistration._id, status: { $ne: 'approved' } },
        { $set: { status: 'approved', reviewedAt } }
      );
    }

    linkedTournamentIds.push(String(player.tournamentId));
  }

  return { linkedTournamentIds };
};

const removeGuestParticipant = async (tournamentId, hostUserId, playerId) => {
  await assertHostAccess(tournamentId, hostUserId);

  const normalizedPlayerId = String(playerId || '').trim();

  if (!normalizedPlayerId) {
    throw new ApiError(400, 'PLAYER_ID_REQUIRED', 'playerId is required for guest remove');
  }

  const outgoingPlayer = await Player.findOne({
    _id: normalizedPlayerId,
    tournamentId,
    status: 'active',
    userId: null,
  }).lean();

  if (!outgoingPlayer) {
    throw new ApiError(404, 'GUEST_PARTICIPANT_NOT_FOUND', 'Guest participant not found for removal');
  }

  const result = await removeOutgoingPlayerInternal(tournamentId, hostUserId, outgoingPlayer, {
    cancelIncompleteGames: true,
  });

  return result.removedSummary;
};

const replaceApprovedParticipant = async (tournamentId, hostUserId, payload = {}) => {
  await assertHostAccess(tournamentId, hostUserId);

  const outgoingPlayerId = String(payload.outgoingPlayerId || '').trim();
  const replacement = payload.replacement || {};

  if (!outgoingPlayerId) {
    throw new ApiError(400, 'PLAYER_ID_REQUIRED', 'outgoingPlayerId is required');
  }

  const outgoingPlayer = await Player.findOne({
    _id: outgoingPlayerId,
    tournamentId,
    status: 'active',
  }).lean();

  if (!outgoingPlayer) {
    throw new ApiError(404, 'APPROVED_PARTICIPANT_NOT_FOUND', 'Outgoing participant not found');
  }

  const { division, slotIndex } = await findOutgoingPlayerMembership(tournamentId, outgoingPlayerId);
  const divisionId = division?._id ? String(division._id) : null;

  const removalResult = await removeOutgoingPlayerInternal(tournamentId, hostUserId, outgoingPlayer, {
    cancelIncompleteGames: false,
  });

  let addedParticipant = null;
  let incomingPlayerId = null;

  if (replacement.type === 'user') {
    const normalizedUserId = String(replacement.userId || '').trim();

    if (!normalizedUserId) {
      throw new ApiError(400, 'TARGET_USER_REQUIRED', 'replacement.userId is required');
    }

    addedParticipant = await manuallyAddParticipant(tournamentId, hostUserId, normalizedUserId, {
      skipGroupSync: Boolean(divisionId),
    });

    const incomingPlayer = await Player.findOne({
      tournamentId,
      userId: normalizedUserId,
      status: 'active',
    }).lean();

    incomingPlayerId = incomingPlayer ? String(incomingPlayer._id) : null;
  } else if (replacement.type === 'guest') {
    addedParticipant = await addGuestParticipant(
      tournamentId,
      hostUserId,
      {
        name: replacement.rosterName || replacement.name,
        username: replacement.username,
      },
      { skipGroupSync: Boolean(divisionId) }
    );

    incomingPlayerId = String(addedParticipant.playerId || addedParticipant.id || '');
  } else {
    throw new ApiError(400, 'INVALID_REPLACEMENT', 'replacement.type must be user or guest');
  }

  if (!incomingPlayerId) {
    throw new ApiError(500, 'REPLACEMENT_PLAYER_NOT_FOUND', 'Unable to resolve replacement player');
  }

  let gamesUpdated = 0;

  if (divisionId) {
    await assignPlayerToDivisionSlot(divisionId, incomingPlayerId, slotIndex);
    gamesUpdated = await swapPlayerInIncompleteGroupGames(tournamentId, outgoingPlayerId, incomingPlayerId);
    await recomputeLeaderboardForScope(tournamentId, divisionId);
  }

  return {
    removed: removalResult.removedSummary,
    added: addedParticipant,
    incomingPlayerId,
    divisionId,
    gamesUpdated,
  };
};

// ── Score editors ──────────────────────────────────────────────────────────

const assignScoreEditor = async (tournamentId, hostUserId, editorUserId) => {
  const normalizedEditorUserId = String(editorUserId || '').trim();

  if (!normalizedEditorUserId) {
    throw new ApiError(400, 'SCORE_EDITOR_USER_REQUIRED', 'editorUserId is required');
  }

  const tournament = await assertHostAccess(tournamentId, hostUserId);

  if (String(tournament.hostUserId) === normalizedEditorUserId) {
    throw new ApiError(400, 'HOST_ALREADY_HAS_ACCESS', 'Host already has score edit access');
  }

  const currentEditors = (tournament.scoreEditorUserIds || []).map((value) => String(value));

  if (currentEditors.includes(normalizedEditorUserId)) {
    throw new ApiError(409, 'SCORE_EDITOR_ALREADY_ASSIGNED', 'User is already a score editor');
  }

  const updatedTournament = await Tournament.findOneAndUpdate(
    { _id: tournamentId, hostUserId, scoreEditorUserIds: { $ne: normalizedEditorUserId } },
    { $addToSet: { scoreEditorUserIds: normalizedEditorUserId } },
    { new: true }
  ).lean();

  if (!updatedTournament) {
    throw new ApiError(
      409,
      'SCORE_EDITOR_ASSIGNMENT_CONFLICT',
      'Unable to assign score editor due to concurrent update'
    );
  }

  return mapScoreEditorResponse(updatedTournament);
};

const removeScoreEditor = async (tournamentId, hostUserId, editorUserId) => {
  const normalizedEditorUserId = String(editorUserId || '').trim();

  if (!normalizedEditorUserId) {
    throw new ApiError(400, 'SCORE_EDITOR_USER_REQUIRED', 'editorUserId is required');
  }

  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const currentEditors = (tournament.scoreEditorUserIds || []).map((value) => String(value));

  if (!currentEditors.includes(normalizedEditorUserId)) {
    throw new ApiError(404, 'SCORE_EDITOR_NOT_FOUND', 'User is not assigned as a score editor');
  }

  const updatedTournament = await Tournament.findOneAndUpdate(
    { _id: tournamentId, hostUserId },
    { $pull: { scoreEditorUserIds: normalizedEditorUserId } },
    { new: true }
  ).lean();

  if (!updatedTournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  return mapScoreEditorResponse(updatedTournament);
};

// ── Proctor transfer ───────────────────────────────────────────────────────

const requestProctorTransfer = async (tournamentId, actorUserId, targetUserId) => {
  const normalizedTargetUserId = String(targetUserId || '').trim();

  if (!normalizedTargetUserId) {
    throw new ApiError(400, 'PROCTOR_TRANSFER_TARGET_REQUIRED', 'targetUserId is required');
  }

  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const normalizedActorUserId = String(actorUserId);
  const isHost = String(tournament.hostUserId) === normalizedActorUserId;
  const currentEditors = (tournament.scoreEditorUserIds || []).map((value) => String(value));
  const isProctor = currentEditors.includes(normalizedActorUserId);

  if (!isHost && !isProctor) {
    throw new ApiError(403, 'FORBIDDEN_PROCTOR', 'Only the host or an assigned proctor can request a transfer');
  }

  if (String(tournament.hostUserId) === normalizedTargetUserId) {
    throw new ApiError(400, 'INVALID_TRANSFER_TARGET', 'Cannot transfer proctor role to the host');
  }

  if (currentEditors.includes(normalizedTargetUserId)) {
    throw new ApiError(409, 'PROCTOR_ALREADY_ASSIGNED', 'Target user is already a proctor');
  }

  if (!isHost && !currentEditors.includes(normalizedActorUserId)) {
    throw new ApiError(403, 'FORBIDDEN_PROCTOR', 'Only current proctors can initiate a handoff');
  }

  const fromUserId = normalizedActorUserId;

  const updatedTournament = await Tournament.findByIdAndUpdate(
    tournamentId,
    {
      proctorTransferRequest: {
        fromUserId,
        toUserId: normalizedTargetUserId,
        requestedAt: new Date(),
      },
    },
    { new: true }
  ).lean();

  return {
    ...mapScoreEditorResponse(updatedTournament),
    proctorTransferRequest: mapHostTournamentDetail(updatedTournament).proctorTransferRequest,
  };
};

const acceptProctorTransfer = async (tournamentId, actorUserId) => {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament) {
    throw new ApiError(404, 'TOURNAMENT_NOT_FOUND', 'Tournament not found');
  }

  const transfer = tournament.proctorTransferRequest;

  if (!transfer?.toUserId) {
    throw new ApiError(404, 'PROCTOR_TRANSFER_NOT_FOUND', 'No pending proctor transfer request');
  }

  if (String(transfer.toUserId) !== String(actorUserId)) {
    throw new ApiError(403, 'FORBIDDEN_PROCTOR_ACCEPT', 'Only the requested user can accept the transfer');
  }

  const fromUserId = String(transfer.fromUserId || '');
  const toUserId = String(transfer.toUserId);
  const currentEditors = (tournament.scoreEditorUserIds || []).map((value) => String(value));
  const nextEditors = currentEditors.filter((id) => id !== fromUserId);

  if (!nextEditors.includes(toUserId)) {
    nextEditors.push(toUserId);
  }

  const updatedTournament = await Tournament.findByIdAndUpdate(
    tournamentId,
    {
      scoreEditorUserIds: nextEditors,
      proctorTransferRequest: { fromUserId: null, toUserId: null, requestedAt: null },
    },
    { new: true }
  ).lean();

  return {
    ...mapScoreEditorResponse(updatedTournament),
    proctorTransferRequest: null,
  };
};

const declineProctorTransfer = async (tournamentId, actorUserId) => {
  const tournament = await Tournament.findById(tournamentId).lean();

  if (!tournament?.proctorTransferRequest?.toUserId) {
    throw new ApiError(404, 'PROCTOR_TRANSFER_NOT_FOUND', 'No pending proctor transfer request');
  }

  const normalizedActorUserId = String(actorUserId);
  const isHost = String(tournament.hostUserId) === normalizedActorUserId;
  const isTarget = String(tournament.proctorTransferRequest.toUserId) === normalizedActorUserId;

  if (!isHost && !isTarget) {
    throw new ApiError(403, 'FORBIDDEN_PROCTOR_DECLINE', 'Only the host or target user can decline the transfer');
  }

  const updatedTournament = await Tournament.findByIdAndUpdate(
    tournamentId,
    { proctorTransferRequest: { fromUserId: null, toUserId: null, requestedAt: null } },
    { new: true }
  ).lean();

  return {
    ...mapScoreEditorResponse(updatedTournament),
    proctorTransferRequest: null,
  };
};

module.exports = {
  manuallyAddParticipant,
  manuallyRemoveParticipant,
  addGuestParticipant,
  linkPendingGuestPlayersForUser,
  removeGuestParticipant,
  replaceApprovedParticipant,
  assignScoreEditor,
  removeScoreEditor,
  requestProctorTransfer,
  acceptProctorTransfer,
  declineProctorTransfer,
};
