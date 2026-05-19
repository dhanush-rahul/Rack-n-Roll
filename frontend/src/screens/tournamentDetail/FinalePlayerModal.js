import React from 'react';
import { Button, Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { tournamentUi } from '../../styles/tournamentUi';

const FINAL_BEST_OF_OPTIONS = ['1', '3', '5'];

export function FinalePlayerModal({
  visible,
  onClose,
  groupStandings,
  isLoadingFinaleCandidates,
  selectedFinalistIds,
  suggestedFinalistIds,
  onToggleFinalist,
  selectedFinalistCount,
  canStartFinale,
  isProgressing,
  onStartFinalStage,
  finalBestOfInput,
  onFinalBestOfChange,
}) {
  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={tournamentUi.modalOverlay}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={onClose} />
        <View style={[tournamentUi.modalCard, { maxHeight: '80%' }]}>
          <Text style={tournamentUi.modalTitle}>Select Finale Players</Text>
          <Text style={{ marginTop: 4 }}>Pick players from groups to move to finale (minimum 2).</Text>
          <Text style={{ marginTop: 4, color: '#065f46' }}>Selected: {selectedFinalistCount}</Text>

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {FINAL_BEST_OF_OPTIONS.map((option) => {
              const selected = String(finalBestOfInput) === option;

              return (
                <Pressable
                  key={option}
                  onPress={() => onFinalBestOfChange(option)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: selected ? '#2563eb' : '#d1d5db',
                    backgroundColor: selected ? '#2563eb' : '#ffffff',
                  }}
                >
                  <Text style={{ color: selected ? '#ffffff' : '#2563eb', fontWeight: '600' }}>
                    Best of {option}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {isLoadingFinaleCandidates && <Text style={{ marginTop: 8 }}>Loading group standings...</Text>}
          {!isLoadingFinaleCandidates && groupStandings.length === 0 && (
            <Text style={{ marginTop: 8 }}>No group standings available.</Text>
          )}

          <ScrollView style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
            {groupStandings.map((group) => (
              <View
                key={group.divisionId}
                style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, gap: 6 }}
              >
                <Text style={{ fontWeight: '600' }}>{group.divisionName}</Text>
                {(group.standings || []).map((entry) => {
                  const playerLabel = entry.player?.displayName || entry.playerId;
                  const selected = Boolean(selectedFinalistIds[entry.playerId]);
                  const isSuggested = Boolean(suggestedFinalistIds[entry.playerId]);

                  return (
                    <Pressable
                      key={`${group.divisionId}-${entry.playerId}`}
                      onPress={() => onToggleFinalist(entry.playerId)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingVertical: 6,
                        paddingHorizontal: 4,
                        borderRadius: 6,
                        backgroundColor: selected ? '#eff6ff' : 'transparent',
                      }}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 4,
                          borderWidth: 2,
                          borderColor: selected ? '#2563eb' : '#9ca3af',
                          backgroundColor: selected ? '#2563eb' : '#ffffff',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {selected ? <Text style={{ color: '#ffffff', fontSize: 14 }}>✓</Text> : null}
                      </View>
                      <View style={{ flex: 1, gap: 2 }}>
                        <Text>
                          #{entry.rank} {playerLabel} ({entry.points} pts)
                        </Text>
                        {isSuggested ? (
                          <Text style={{ color: '#2563eb', fontSize: 12, fontWeight: '600' }}>Top 2 suggested</Text>
                        ) : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            <View style={{ flex: 1 }}>
              <Button title="Cancel" onPress={onClose} disabled={isProgressing} />
            </View>
            <View style={{ flex: 1 }}>
              <Pressable
                onPress={canStartFinale ? onStartFinalStage : undefined}
                disabled={!canStartFinale}
                accessibilityLabel="Start Finale"
                accessibilityRole="button"
                style={({ pressed }) => [
                  tournamentUi.primaryButton,
                  {
                    backgroundColor: canStartFinale ? '#2563eb' : '#94a3b8',
                    opacity: pressed && canStartFinale ? 0.85 : 1,
                  },
                ]}
              >
                <Text style={tournamentUi.primaryButtonText}>
                  {isProgressing ? 'Working...' : 'Start Finale'}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
