import React, { useMemo } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { InfoBanner, SectionCard } from '../../components/tournament/TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';

function buildPendingMatchups({ knownParticipantIds = [], expectedCount = 0, participantNameById }) {
  const knownSlots = knownParticipantIds.map((id) => ({
    type: 'known',
    id: String(id),
    name: participantNameById.get(String(id)) || 'Player',
  }));

  const targetCount = Math.max(Number(expectedCount) || 0, knownSlots.length, 2);
  const tbdCount = Math.max(targetCount - knownSlots.length, 0);
  const slots = [...knownSlots, ...Array.from({ length: tbdCount }, () => ({ type: 'tbd' }))];

  const matchups = [];
  for (let index = 0; index < slots.length; index += 2) {
    matchups.push({
      key: `match-${index / 2 + 1}`,
      slotA: slots[index] || { type: 'tbd' },
      slotB: slots[index + 1] || { type: 'tbd' },
    });
  }

  return matchups;
}

function MatchupRow({ slotA, slotB, bestOf = 3 }) {
  const labelForSlot = (slot) => (slot.type === 'known' ? slot.name : 'TBD');

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: tournamentColors.border,
        borderRadius: 10,
        padding: 12,
        backgroundColor: '#f8fafc',
        gap: 6,
      }}
    >
      <Text style={{ fontWeight: '700', color: tournamentColors.text }}>
        {labelForSlot(slotA)} vs {labelForSlot(slotB)}
      </Text>
      <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>
        Best of {bestOf} • Waiting for host to start this round
      </Text>
    </View>
  );
}

export function StagePendingTabView({
  stage,
  bypassParticipantIds = [],
  expectedCount = 0,
  participantNameById = new Map(),
}) {
  const matchups = useMemo(
    () =>
      buildPendingMatchups({
        knownParticipantIds: bypassParticipantIds,
        expectedCount,
        participantNameById,
      }),
    [bypassParticipantIds, expectedCount, participantNameById]
  );

  const knownCount = bypassParticipantIds.length;
  const waitingCount = Math.max(Number(expectedCount) - knownCount, 0);

  return (
    <View style={{ gap: 14 }}>
      <InfoBanner
        tone="info"
        message={
          knownCount > 0
            ? `${knownCount} player${knownCount === 1 ? '' : 's'} already placed here. ` +
              `${waitingCount > 0 ? `${waitingCount} more slot${waitingCount === 1 ? '' : 's'} stay TBD until the previous round finishes.` : 'Remaining matchups unlock when the previous round finishes.'}`
            : 'This round unlocks after the host progresses from the previous stage.'
        }
      />

      <SectionCard title={stage?.name || 'Upcoming round'} subtitle="Preview only — scores unlock when this stage starts.">
        <View style={{ gap: 10 }}>
          {matchups.map((matchup) => (
            <MatchupRow
              key={matchup.key}
              slotA={matchup.slotA}
              slotB={matchup.slotB}
              bestOf={stage?.bestOf || 3}
            />
          ))}
        </View>
      </SectionCard>
    </View>
  );
}
