const Tournament = require('../../models/tournament.model');
const TournamentRegistration = require('../../models/tournamentRegistration.model');
const Player = require('../../models/player.model');
const User = require('../../models/user.model');
const ApiError = require('../../utils/ApiError');
const { sendGuestTournamentInviteEmail } = require('../email.service');
const { materializeApprovedPlayerForUser } = require('./roster.service');
const { syncApprovedPlayerToGroups, syncApprovedPlayerToGroupsByPlayerId } = require('./fixtures.service');
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

// ── Manual participant add/remove ──────────────────────────────────────────

const manuallyAddParticipant = async (tournamentId, hostUserId, targetUserId) => {
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
      const groupSync = await syncApprovedPlayerToGroups(tournamentId, normalizedTargetUserId);

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
    const groupSync = await syncApprovedPlayerToGroups(tournamentId, normalizedTargetUserId);

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
  const removedRegistration = await TournamentRegistration.findOneAndUpdate(
    { tournamentId, userId: normalizedTargetUserId, status: 'approved' },
    { $set: { status: 'removed', reviewedByUserId: hostUserId, reviewedAt } },
    { new: true }
  ).lean();

  if (!removedRegistration) {
    await Tournament.updateOne(
      { _id: tournamentId },
      { $inc: { approvedParticipantsCount: 1 } }
    );

    throw new ApiError(404, 'APPROVED_PARTICIPANT_NOT_FOUND', 'Approved participant not found for removal');
  }

  return mapRegistrationSummary(removedRegistration);
};

// ── Guest participant add/remove ───────────────────────────────────────────

const addGuestParticipant = async (tournamentId, hostUserId, payload = {}) => {
  const tournament = await assertHostAccess(tournamentId, hostUserId);
  const { normalizedName, normalizedEmail } = validateGuestParticipantInput(payload);
  const hostUser = await User.findById(tournament.hostUserId).select({ name: 1, email: 1 }).lean();

  if (hostUser && normalizeGuestEmail(hostUser.email) === normalizedEmail) {
    throw new ApiError(400, 'HOST_CANNOT_REGISTER', 'Host cannot be added as a participant');
  }

  const existingUser = await User.findOne({ email: normalizedEmail }).select({ _id: 1 }).lean();

  if (existingUser) {
    const manualAddResult = await manuallyAddParticipant(tournamentId, hostUserId, String(existingUser._id));

    return {
      ...manualAddResult,
      isGuest: false,
      linkedImmediately: true,
      inviteEmailSent: false,
    };
  }

  const existingGuest = await Player.findOne({
    tournamentId,
    status: 'active',
    pendingLinkEmail: normalizedEmail,
  }).lean();

  if (existingGuest) {
    throw new ApiError(
      409,
      'GUEST_ALREADY_ON_ROSTER',
      'A guest player with this email is already on the roster for this tournament'
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
      pendingLinkEmail: normalizedEmail,
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
        'A guest player with this email is already on the roster for this tournament'
      );
    }

    throw error;
  }

  const groupSync = await syncApprovedPlayerToGroupsByPlayerId(tournamentId, String(createdPlayer._id));

  void sendGuestTournamentInviteEmail({
    toEmail: normalizedEmail,
    toName: normalizedName,
    tournamentName: tournamentMeta?.name || 'Tournament',
    hostName: hostUser?.name || 'the tournament host',
  }).catch((error) => {
    console.error('[guest-add] invite email failed:', error?.message || error);
  });

  return {
    ...mapGuestPlayerRosterItem(createdPlayer.toObject()),
    groupSync,
    isGuest: true,
    linkedImmediately: false,
    inviteEmailSent: true,
    inviteEmailQueued: true,
  };
};

const linkPendingGuestPlayersForUser = async (userId, email) => {
  const normalizedEmail = normalizeGuestEmail(email);
  const normalizedUserId = String(userId || '').trim();

  if (!normalizedEmail || !normalizedUserId) {
    return { linkedTournamentIds: [] };
  }

  const user = await User.findById(normalizedUserId).select({ name: 1, email: 1 }).lean();

  if (!user) {
    return { linkedTournamentIds: [] };
  }

  const pendingPlayers = await Player.find({
    pendingLinkEmail: normalizedEmail,
    userId: null,
    status: 'active',
  }).lean();

  if (pendingPlayers.length === 0) {
    return { linkedTournamentIds: [] };
  }

  const linkedTournamentIds = [];
  const reviewedAt = new Date();

  for (const player of pendingPlayers) {
    await Player.updateOne(
      { _id: player._id },
      {
        $set: {
          userId: normalizedUserId,
          displayName: user.name || player.displayName,
          pendingLinkEmail: null,
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

  await ensureApprovedParticipantsCountInitialized(tournamentId);

  const reservedRemovalCapacity = await Tournament.findOneAndUpdate(
    { _id: tournamentId, approvedParticipantsCount: { $gt: 0 } },
    { $inc: { approvedParticipantsCount: -1 } },
    { new: false }
  ).lean();

  if (!reservedRemovalCapacity) {
    throw new ApiError(404, 'APPROVED_PARTICIPANT_NOT_FOUND', 'Approved participant not found for removal');
  }

  const removedPlayer = await Player.findOneAndUpdate(
    {
      _id: normalizedPlayerId,
      tournamentId,
      status: 'active',
      userId: null,
      pendingLinkEmail: { $type: 'string', $ne: null },
    },
    { $set: { status: 'removed', pendingLinkEmail: null } },
    { new: true }
  ).lean();

  if (!removedPlayer) {
    await Tournament.updateOne(
      { _id: tournamentId },
      { $inc: { approvedParticipantsCount: 1 } }
    );

    throw new ApiError(404, 'GUEST_PARTICIPANT_NOT_FOUND', 'Guest participant not found for removal');
  }

  return mapGuestPlayerRosterItem(removedPlayer);
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
  assignScoreEditor,
  removeScoreEditor,
  requestProctorTransfer,
  acceptProctorTransfer,
  declineProctorTransfer,
};
