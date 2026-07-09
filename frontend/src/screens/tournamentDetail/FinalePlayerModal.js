import React from 'react';
import { Button, Modal, Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { AppIcon } from '../../components/ui/AppIcon';
import { useTypography } from '../../context/TypographyContext';
import { tournamentUi } from '../../styles/tournamentUi';
import { getWebModalStyles } from '../../utils/modalStyles';

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
  finalStageProctored = false,
  onFinalStageProctoredChange,
  isDoubles = false,
}) {
  const { width } = useTypography();
  const webModal = getWebModalStyles(width);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={[tournamentUi.modalOverlay, webModal?.overlay]}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={onClose} />
        <View style={[tournamentUi.modalCard, webModal?.card, { maxHeight: '80%' }]}>
          <Text style={[tournamentUi.modalTitle, webModal?.title]}>
            {isDoubles ? 'Select Finale Teams' : 'Select Finale Players'}
          </Text>
          <Text style={{ marginTop: 4 }}>
            Pick {isDoubles ? 'teams' : 'players'} from groups to move to finale (minimum 2).
          </Text>
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

          {!isDoubles && (
            <>
              <Text style={{ marginTop: 12, fontWeight: '600' }}>Finale scoring</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                <Pressable
                  onPress={() => onFinalStageProctoredChange?.(false)}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: !finalStageProctored ? '#2563eb' : '#d1d5db',
                    backgroundColor: !finalStageProctored ? '#eff6ff' : '#ffffff',
                  }}
                >
                  <Text style={{ color: !finalStageProctored ? '#2563eb' : '#374151', fontWeight: '700' }}>Manual</Text>
                  <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Grid scores on the Finale tab</Text>
                </Pressable>
                <Pressable
                  onPress={() => onFinalStageProctoredChange?.(true)}
                  style={{
                    flex: 1,
                    minWidth: 140,
                    paddingHorizontal: 12,
                    paddingVertical: 10,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: finalStageProctored ? '#2563eb' : '#d1d5db',
                    backgroundColor: finalStageProctored ? '#eff6ff' : '#ffffff',
                  }}
                >
                  <Text style={{ color: finalStageProctored ? '#2563eb' : '#374151', fontWeight: '700' }}>Proctored</Text>
                  <Text style={{ color: '#64748b', fontSize: 12, marginTop: 4 }}>Live match scoring with proctors</Text>
                </Pressable>
              </View>
            </>
          )}

          {isDoubles && (
            <Text style={{ marginTop: 12, color: '#64748b', fontSize: 13 }}>
              Doubles finale uses manual team scoring only.
            </Text>
          )}

          {isLoadingFinaleCandidates && <Text style={{ marginTop: 8 }}>Loading group standings...</Text>}
          {!isLoadingFinaleCandidates && groupStandings.length === 0 && (
            <Text style={{ marginTop: 8 }}>No group standings available.</Text>
          )}

          <ScrollView style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
            {groupStandings.map((group) => {
              const entries = isDoubles ? group.teamStandings || [] : group.standings || [];

              return (
                <View
                  key={group.divisionId}
                  style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, padding: 8, gap: 6 }}
                >
                  <Text style={{ fontWeight: '600' }}>{group.divisionName}</Text>
                  {entries.map((entry) => {
                    const finalistId = isDoubles ? entry.teamId : entry.playerId;
                    const label = isDoubles
                      ? entry.team?.displayName || entry.teamId
                      : entry.player?.displayName || entry.playerId;
                    const selected = Boolean(selectedFinalistIds[finalistId]);
                    const isSuggested = Boolean(suggestedFinalistIds[finalistId]);

                    return (
                      <Pressable
                        key={`${group.divisionId}-${finalistId}`}
                        onPress={() => onToggleFinalist(finalistId)}
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
                          {selected ? <AppIcon name="check" size={16} color="#ffffff" /> : null}
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text>
                            #{entry.rank} {label} ({entry.points} pts)
                          </Text>
                          {isSuggested ? (
                            <Text style={{ color: '#2563eb', fontSize: 12, fontWeight: '600' }}>Top 2 suggested</Text>
                          ) : null}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>
              );
            })}
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
