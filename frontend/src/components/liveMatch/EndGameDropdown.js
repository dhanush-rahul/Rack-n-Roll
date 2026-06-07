import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ActionButton } from '../tournament/TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';

const END_REASON_LABELS = {
  potted8: 'Potted 8-ball',
  scratchOn8: 'Scratch on 8-ball',
  potted8NotCalled: 'Potted 8 but did not call',
  potted8BeforeEnd: 'Potted 8 before end of rack',
};

export function EndGameDropdown({
  session,
  selectedWinnerId,
  onSelectWinner,
  selectedEndReason,
  onSelectEndReason,
  onConfirm,
  isBusy,
  disabled,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const playerAId = session?.playerA?.id;
  const playerBId = session?.playerB?.id;
  const reasons = session?.endGameReasonOptions || Object.keys(END_REASON_LABELS);

  const summaryLabel =
    selectedWinnerId && selectedEndReason
      ? `${session?.playerA?.id === selectedWinnerId ? session.playerA?.displayName : session.playerB?.displayName} · ${END_REASON_LABELS[selectedEndReason] || selectedEndReason}`
      : 'Choose winner and how the game ended';

  return (
    <View style={{ gap: 10 }}>
      <Pressable
        onPress={() => !disabled && setIsOpen((open) => !open)}
        disabled={disabled}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: 14,
          paddingHorizontal: 16,
          borderRadius: 12,
          borderWidth: 1,
          borderColor: isOpen ? tournamentColors.primary : tournamentColors.border,
          backgroundColor: isOpen ? '#eff6ff' : tournamentColors.white,
          opacity: pressed || disabled ? 0.85 : 1,
        })}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.primary }}>END GAME</Text>
          <Text style={{ marginTop: 4, fontSize: 14, fontWeight: '600', color: tournamentColors.text }} numberOfLines={2}>
            {summaryLabel}
          </Text>
        </View>
        <Text style={{ fontSize: 18, fontWeight: '700', color: tournamentColors.primary }}>
          {isOpen ? '▴' : '▾'}
        </Text>
      </Pressable>

      {isOpen && !disabled && (
        <View
          style={{
            borderRadius: 14,
            borderWidth: 1,
            borderColor: tournamentColors.borderLight,
            backgroundColor: '#f8fafc',
            padding: 12,
            gap: 12,
          }}
        >
          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.textMuted, marginBottom: 8 }}>
              Winner
            </Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              {[playerAId, playerBId].map((id) => {
                const selected = selectedWinnerId === id;
                const label =
                  id === playerAId ? session.playerA?.displayName : session.playerB?.displayName;
                return (
                  <Pressable
                    key={id}
                    onPress={() => onSelectWinner(id)}
                    style={{
                      flex: 1,
                      paddingVertical: 12,
                      paddingHorizontal: 10,
                      borderRadius: 10,
                      borderWidth: 2,
                      borderColor: selected ? tournamentColors.primary : tournamentColors.border,
                      backgroundColor: selected ? '#eff6ff' : tournamentColors.white,
                    }}
                  >
                    <Text style={{ fontWeight: '700', textAlign: 'center', fontSize: 14 }}>{label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.textMuted, marginBottom: 8 }}>
              How the game ended
            </Text>
            {reasons.map((reason) => {
              const selected = selectedEndReason === reason;
              return (
                <Pressable
                  key={reason}
                  onPress={() => onSelectEndReason(reason)}
                  style={{
                    paddingVertical: 11,
                    paddingHorizontal: 12,
                    marginBottom: 6,
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: selected ? tournamentColors.primary : tournamentColors.borderLight,
                    backgroundColor: selected ? '#eff6ff' : tournamentColors.white,
                  }}
                >
                  <Text style={{ fontSize: 14, fontWeight: selected ? '700' : '500', color: tournamentColors.text }}>
                    {END_REASON_LABELS[reason] || reason}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <ActionButton
            label={isBusy ? 'Saving…' : 'Confirm end game'}
            onPress={() => {
              setIsOpen(false);
              onConfirm();
            }}
            disabled={isBusy || !selectedWinnerId || !selectedEndReason}
            fullWidth
          />
        </View>
      )}
    </View>
  );
}
