import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { AppIcon } from '../ui/AppIcon';
import { tournamentColors } from '../../styles/tournamentUi';
import { groupTurnsByInning } from '../../utils/liveMatchInnings';

const END_REASON_LABELS = {
  potted8: 'Potted 8-ball',
  scratchOn8: 'Scratch on 8-ball',
  potted8NotCalled: '8 not called',
  potted8BeforeEnd: '8 before end of rack',
};

function resolvePlayerName(playerId, playerA, playerB) {
  if (String(playerId) === String(playerA?.id)) {
    return playerA?.displayName || 'Player A';
  }
  if (String(playerId) === String(playerB?.id)) {
    return playerB?.displayName || 'Player B';
  }
  return 'Player';
}

function VisitRow({ turn, playerA, playerB, isCurrent }) {
  const playerName = resolvePlayerName(turn.playerId, playerA, playerB);

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: isCurrent ? tournamentColors.liveCurrentBorder : tournamentColors.liveWaitingBorder,
        backgroundColor: isCurrent ? tournamentColors.liveCurrentBg : tournamentColors.liveWaitingPanel,
        marginBottom: 8,
      }}
    >
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text
          style={{
            fontSize: 11,
            fontWeight: '800',
            letterSpacing: 1.1,
            color: isCurrent ? tournamentColors.liveCurrentLabel : tournamentColors.mutedIcon,
          }}
        >
          VISIT {turn.turnNumber}
        </Text>
        {isCurrent && (
          <View
            style={{
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 999,
              backgroundColor: tournamentColors.liveAccentSoft,
            }}
          >
            <Text style={{ fontSize: 10, fontWeight: '800', color: tournamentColors.liveAccent }}>AT TABLE</Text>
          </View>
        )}
      </View>
      <Text style={{ marginTop: 6, fontSize: 16, fontWeight: '800', color: tournamentColors.text }}>{playerName}</Text>
      {turn.legWinnerPlayerId && (
        <Text style={{ marginTop: 4, fontSize: 13, color: tournamentColors.liveAccent, fontWeight: '600' }}>
          Lag won <AppIcon name="arrowRight" size={13} color={tournamentColors.liveAccent} />{' '}
          {resolvePlayerName(turn.legWinnerPlayerId, playerA, playerB)}
        </Text>
      )}
    </View>
  );
}

export function CollapsibleTurnLog({ session }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const turns = session?.activeGame?.turns || [];
  const innings = session?.activeGame?.innings;

  return (
    <View
      style={{
        borderRadius: 16,
        borderWidth: 1,
        borderColor: tournamentColors.livePanelBorder,
        backgroundColor: tournamentColors.white,
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={() => setIsExpanded((value) => !value)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 14,
        }}
      >
        <View>
          <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1.1, color: tournamentColors.textMuted }}>
            TURN LOG
          </Text>
          {innings && (
            <Text style={{ marginTop: 4, fontSize: 13, color: tournamentColors.text }}>
              Inning {innings.currentInning}
              {innings.inningsCompleted > 0 ? ` · ${innings.inningsCompleted} completed` : ''}
              {` · ${innings.totalVisits} visits`}
            </Text>
          )}
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: tournamentColors.textMuted }}>{isExpanded ? '−' : '+'}</Text>
      </Pressable>

      {isExpanded && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <LiveMatchTurnTimeline session={session} />
        </View>
      )}
    </View>
  );
}

export function LiveMatchTurnTimeline({ session }) {
  const turns = session?.activeGame?.turns || [];
  const playerA = session?.playerA;
  const playerB = session?.playerB;
  const currentTurnId = session?.currentTurnPlayerId;
  const inningGroups = groupTurnsByInning(turns, playerA?.id, playerB?.id);

  if (turns.length === 0) {
    return (
      <View
        style={{
          padding: 20,
          borderRadius: 16,
          borderWidth: 1,
          borderColor: tournamentColors.liveEmptyBorder,
          backgroundColor: tournamentColors.liveEmptyBg,
          alignItems: 'center',
        }}
      >
        <Text style={{ color: tournamentColors.textMuted, fontSize: 14, textAlign: 'center' }}>
          No visits logged yet. Game 1: mark lag won first. Later games: pass the table to track visits.
        </Text>
      </View>
    );
  }

  return (
    <View style={{ gap: 14 }}>
      {inningGroups.map((group) => (
        <View key={`inning-${group.inningNumber}`}>
          <Text
            style={{
              fontSize: 11,
              fontWeight: '800',
              letterSpacing: 1.2,
              color: group.inProgress ? tournamentColors.liveCurrentLabel : tournamentColors.mutedIcon,
              marginBottom: 8,
            }}
          >
            INNING {group.inningNumber}
            {group.inProgress ? ' · IN PROGRESS' : ''}
          </Text>
          {group.turns.map((turn) => {
            const isCurrent =
              group.inProgress &&
              turn.turnNumber === turns[turns.length - 1]?.turnNumber &&
              String(turn.playerId) === String(currentTurnId);

            return (
              <VisitRow
                key={`turn-${turn.turnNumber}`}
                turn={turn}
                playerA={playerA}
                playerB={playerB}
                isCurrent={isCurrent}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

export function CompletedGamesStrip({ session }) {
  const entries = (session?.scoreEntries || []).filter(
    (entry) => entry.endReason || Number(entry.playerAScore) + Number(entry.playerBScore) > 0
  );

  if (entries.length === 0) {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      <Text style={{ fontSize: 12, fontWeight: '800', letterSpacing: 1, color: tournamentColors.textMuted }}>
        COMPLETED GAMES IN SERIES
      </Text>
      {entries.map((entry) => {
        const winnerIsA = Number(entry.playerAScore) > Number(entry.playerBScore);
        return (
          <View
            key={`done-${entry.gameNumber}`}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 12,
              borderRadius: 12,
              backgroundColor: tournamentColors.inputFill,
              borderWidth: 1,
              borderColor: tournamentColors.borderLight,
            }}
          >
            <Text style={{ fontWeight: '700', color: tournamentColors.text }}>Game {entry.gameNumber}</Text>
            <Text style={{ fontWeight: '800', color: winnerIsA ? tournamentColors.accentGreen : tournamentColors.accentRed }}>
              {entry.playerAScore}–{entry.playerBScore}
            </Text>
            {entry.endReason && (
              <Text style={{ fontSize: 11, color: tournamentColors.textMuted }}>
                {END_REASON_LABELS[entry.endReason] || entry.endReason}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
