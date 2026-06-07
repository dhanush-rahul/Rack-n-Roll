import React, { useMemo } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ActionButton, InfoBanner } from './TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';

/**
 * Tournament-wide proctor role transfer (scoresheet / proctor view).
 */
export function ProctorHandoffPanel({
  currentUserId,
  proctors = [],
  proctorTransferRequest,
  isBusy,
  onRequestTransfer,
  onAcceptTransfer,
  onDeclineTransfer,
}) {
  const isAssignedProctor = proctors.some((entry) => String(entry.userId) === String(currentUserId));
  const pendingForMe =
    proctorTransferRequest?.toUserId &&
    String(proctorTransferRequest.toUserId) === String(currentUserId);

  const handoffTargets = useMemo(
    () =>
      proctors.filter(
        (entry) =>
          String(entry.userId) !== String(currentUserId) &&
          String(entry.userId) !== String(proctorTransferRequest?.toUserId)
      ),
    [currentUserId, proctorTransferRequest?.toUserId, proctors]
  );

  if (!isAssignedProctor && !pendingForMe) {
    return null;
  }

  return (
    <View
      style={{
        marginBottom: 14,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        backgroundColor: tournamentColors.white,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.1, color: tournamentColors.textMuted }}>
        PROCTOR HANDOFF (TOURNAMENT)
      </Text>

      {pendingForMe && (
        <View style={{ gap: 8 }}>
          <InfoBanner
            emoji="🎯"
            tone="warning"
            title="Proctor role offered to you"
            message="Accept to mark scores for this entire tournament."
          />
          <ActionButton
            label={isBusy ? 'Working…' : 'Accept proctor role'}
            onPress={onAcceptTransfer}
            disabled={isBusy}
            fullWidth
          />
          <ActionButton
            label="Decline"
            onPress={onDeclineTransfer}
            disabled={isBusy}
            variant="ghost"
            fullWidth
          />
        </View>
      )}

      {isAssignedProctor && !pendingForMe && (
        <>
          <Text style={{ fontSize: 13, color: tournamentColors.textMuted, lineHeight: 18 }}>
            Ask another assigned proctor to take over tournament scoring. They must accept on their scoresheet.
          </Text>
          {handoffTargets.length === 0 ? (
            <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
              No other proctors assigned yet. The host can add proctors on the Players tab.
            </Text>
          ) : (
            handoffTargets.map((entry) => (
              <ActionButton
                key={entry.userId}
                label={
                  isBusy
                    ? '…'
                    : `Request handoff to ${entry.displayName || entry.userId?.slice(-6) || 'proctor'}`
                }
                onPress={() => onRequestTransfer(entry.userId)}
                disabled={isBusy || Boolean(proctorTransferRequest?.toUserId)}
                variant="secondary"
                fullWidth
              />
            ))
          )}
          {proctorTransferRequest?.toUserId && (
            <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>
              Handoff pending — waiting for the other proctor to accept.
            </Text>
          )}
        </>
      )}
    </View>
  );
}
