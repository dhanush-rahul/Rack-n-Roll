import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ActionButton } from '../tournament/TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';

/**
 * Per-match scoring access (who may mark this game). Mutual handoff: request → hand off / decline.
 */
export function LiveMatchScoringAccess({
  session,
  isBusy,
  onRequestTakeover,
  onHandOff,
  onDecline,
  onCancelRequest,
  onForceTakeover,
  onResumeScoring,
}) {
  if (!session?.canEdit || session.status !== 'inProgress') {
    return null;
  }

  const controllerName = session?.sessionController?.displayName || 'Another proctor';
  const requesterName = session?.takeoverRequest?.displayName || 'Another proctor';

  return (
    <View
      style={{
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(148, 163, 184, 0.4)',
        backgroundColor: tournamentColors.white,
        gap: 10,
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.1, color: tournamentColors.textMuted }}>
        THIS MATCH — SCORING ACCESS
      </Text>
      <Text style={{ fontSize: 13, color: tournamentColors.textMuted, lineHeight: 18 }}>
        Another proctor must request takeover; the active scorer can hand off when ready. Controls this game only.
      </Text>

      {session.canMarkSession && !session.canHandOffScoring ? (
        <Text style={{ fontSize: 14, fontWeight: '700', color: '#166534' }}>
          You are the active scorer for this match.
        </Text>
      ) : session.sessionController ? (
        <Text style={{ fontSize: 14, color: tournamentColors.text }}>
          {controllerName} is scoring this match right now.
        </Text>
      ) : (
        <Text style={{ fontSize: 14, color: tournamentColors.text }}>
          No one is actively scoring this match.
        </Text>
      )}

      {session.canHandOffScoring && (
        <View style={{ gap: 8 }}>
          <Text style={{ fontSize: 13, color: '#15803d', lineHeight: 18 }}>
            {requesterName} requested takeover. Hand off scoring to let them mark this match, or decline.
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <ActionButton
                label={isBusy ? 'Working…' : 'Hand off scoring'}
                onPress={onHandOff}
                disabled={isBusy}
                fullWidth
              />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label={isBusy ? 'Working…' : 'Decline'}
                onPress={onDecline}
                disabled={isBusy}
                variant="secondary"
                fullWidth
              />
            </View>
          </View>
        </View>
      )}

      {session.canForceTakeover && (
        <View style={{ gap: 8 }}>
          <ActionButton
            label={isBusy ? 'Working…' : 'Take over scoring (host)'}
            onPress={onForceTakeover}
            disabled={isBusy}
            fullWidth
          />
          {session.canRequestTakeover && (
            <ActionButton
              label={isBusy ? 'Working…' : 'Request takeover'}
              onPress={onRequestTakeover}
              disabled={isBusy}
              variant="secondary"
              fullWidth
            />
          )}
        </View>
      )}

      {!session.canForceTakeover && session.canRequestTakeover && (
        <ActionButton
          label={isBusy ? 'Working…' : 'Request takeover'}
          onPress={onRequestTakeover}
          disabled={isBusy}
          variant="secondary"
          fullWidth
        />
      )}

      {session.canClaimScoring && (
        <ActionButton
          label={isBusy ? 'Working…' : 'Resume scoring'}
          onPress={onResumeScoring}
          disabled={isBusy}
          fullWidth
        />
      )}

      {session.canCancelTakeoverRequest && (
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, color: '#1d4ed8', lineHeight: 18 }}>
            Waiting for {controllerName} to hand off scoring.
          </Text>
          <ActionButton
            label={isBusy ? 'Working…' : 'Cancel takeover request'}
            onPress={onCancelRequest}
            disabled={isBusy}
            variant="ghost"
            fullWidth
          />
        </View>
      )}

      {session.takeoverRequest && !session.canMarkSession && !session.canHandOffScoring && !session.canCancelTakeoverRequest && (
        <Text style={{ fontSize: 13, color: tournamentColors.textMuted, lineHeight: 18 }}>
          {requesterName} requested takeover · waiting on {controllerName} to hand off.
        </Text>
      )}

      {!session.canMarkSession &&
        !session.canRequestTakeover &&
        !session.canForceTakeover &&
        !session.canClaimScoring &&
        !session.canCancelTakeoverRequest &&
        !session.sessionController && (
          <ActionButton
            label={isBusy ? 'Working…' : 'Start scoring this match'}
            onPress={onResumeScoring}
            disabled={isBusy}
            fullWidth
          />
        )}
    </View>
  );
}
