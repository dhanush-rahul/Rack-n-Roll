import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { AppIcon } from '../../components/ui/AppIcon';
import { ActionButton, ChipSelector, SectionCard } from '../../components/tournament/TournamentChrome';
import { ScaledTextInput as TextInput } from '../../components/ui/ScaledTextInput';
import { useTypography } from '../../context/TypographyContext';
import { tournamentColors, tournamentUi } from '../../styles/tournamentUi';
import { getWebModalStyles } from '../../utils/modalStyles';

function countSelectedParticipants(selectedParticipantIds = {}) {
  return Object.entries(selectedParticipantIds).filter(([, selected]) => Boolean(selected)).length;
}

function getStandingEntryLabel(entry, isDoubles) {
  if (isDoubles) {
    return (
      entry.team?.displayName ||
      entry.team?.customDisplayName ||
      entry.displayName ||
      entry.teamId
    );
  }

  return (
    entry.player?.displayName ||
    entry.player?.username ||
    entry.displayName ||
    entry.playerName ||
    entry.playerId
  );
}

function getSelectionHint(stage) {
  const source = stage?.advancement?.source;
  const directPromotePerGroup = Math.max(Number(stage?.advancement?.directPromotePerGroup || 0), 0);
  const topPerGroup = Math.max(Number(stage?.advancement?.topPerGroup || stage?.topPerGroup || 2), 1);
  const playingPerGroup = Math.max(topPerGroup - directPromotePerGroup, 0);

  if (directPromotePerGroup > 0) {
    const bypassTarget = stage?.advancement?.bypassTargetStageName || 'a later round';
    return `#1 in each group skips to ${bypassTarget}. Suggested picks are #${directPromotePerGroup + 1}${playingPerGroup > 1 ? `–#${topPerGroup}` : ''} by standings — change the selection if scores are tied or you want a different lineup.`;
  }

  if (source === 'groups' || stage?.order === 1 || source === 'previousStage' || stage?.advancement?.sourceStageId) {
    return `Suggested picks are the top ${topPerGroup} by standings in each group. You can select anyone else too — useful when players are tied on points.`;
  }

  return 'Select the players who will compete in this round.';
}

function getEntrySelectionState({ id, stage, bypassParticipantIds, entry }) {
  const directPromotePerGroup = Math.max(Number(stage?.advancement?.directPromotePerGroup || 0), 0);
  const rank = Number(entry.rank || 0);
  const bypassTarget =
    bypassParticipantIds[id] || stage?.advancement?.bypassTargetStageName || 'next round';
  const isBypassed =
    Boolean(bypassParticipantIds[id]) ||
    (directPromotePerGroup > 0 && rank > 0 && rank <= directPromotePerGroup);

  return {
    rank,
    isBypassed,
    bypassTarget,
  };
}

export function StageStartModal({
  visible,
  onClose,
  stage,
  groupStandings = [],
  isLoadingStageCandidates,
  selectedParticipantIds,
  suggestedParticipantIds,
  bypassParticipantIds = {},
  onToggleParticipant,
  canStartStage,
  isProgressing,
  onStartStage,
  isDoubles = false,
  participantNameById,
  backButtonLabel = 'Back',
}) {
  const { width } = useTypography();
  const webModal = getWebModalStyles(width);
  const stageName = stage?.name || 'Stage';
  const [step, setStep] = useState('pick');
  const [confirmCount, setConfirmCount] = useState(0);
  const [oddResolution, setOddResolution] = useState('knockout');
  const [promoteBypassParticipantId, setPromoteBypassParticipantId] = useState('');
  const [promoteBypassTargetStageName, setPromoteBypassTargetStageName] = useState('');

  const selectedCount = useMemo(
    () => countSelectedParticipants(selectedParticipantIds),
    [selectedParticipantIds]
  );

  const suggestedCount = useMemo(
    () => Object.entries(suggestedParticipantIds).filter(([, suggested]) => Boolean(suggested)).length,
    [suggestedParticipantIds]
  );

  useEffect(() => {
    if (!visible) {
      setStep('pick');
      setConfirmCount(0);
      setOddResolution('knockout');
      setPromoteBypassParticipantId('');
      setPromoteBypassTargetStageName('');
    }
  }, [visible]);

  const selectedParticipantEntries = useMemo(() => {
    const entries = [];

    groupStandings.forEach((group) => {
      const groupEntries = isDoubles ? group.teamStandings || [] : group.standings || [];
      groupEntries.forEach((entry) => {
        const id = String(isDoubles ? entry.teamId : entry.playerId);
        if (selectedParticipantIds[id]) {
          entries.push({
            id,
            label: getStandingEntryLabel(entry, isDoubles),
          });
        }
      });
    });

    return entries;
  }, [groupStandings, isDoubles, selectedParticipantIds]);

  const needsOddResolution =
    stage?.format === 'knockout' &&
    selectedCount % 2 === 1 &&
    selectedCount >= 3;

  const selectionHint = useMemo(() => getSelectionHint(stage), [stage]);

  const handleRequestConfirm = () => {
    if (selectedCount < 2) {
      return;
    }
    if (needsOddResolution && oddResolution === 'knockout') {
      return;
    }
    if (needsOddResolution && oddResolution === 'promote' && !promoteBypassParticipantId) {
      return;
    }
    if (
      needsOddResolution &&
      oddResolution === 'promote' &&
      String(promoteBypassTargetStageName || '').trim().length < 2
    ) {
      return;
    }
    setConfirmCount(selectedCount);
    setStep('confirm');
  };

  const handleConfirmStart = async () => {
    await onStartStage?.({
      formatOverride: needsOddResolution && oddResolution === 'roundRobin' ? 'roundRobin' : null,
      promoteBypassParticipantId:
        needsOddResolution && oddResolution === 'promote' ? promoteBypassParticipantId : null,
      promoteBypassTargetStageName:
        needsOddResolution && oddResolution === 'promote'
          ? String(promoteBypassTargetStageName || '').trim()
          : null,
    });
  };

  const handleBackFromConfirm = () => {
    setStep('pick');
  };

  const handleClose = () => {
    setStep('pick');
    onClose?.();
  };

  const participantLabel = isDoubles ? 'team' : 'player';

  return (
    <Modal
      animationType="slide"
      transparent
      visible={visible}
      onRequestClose={step === 'confirm' ? handleBackFromConfirm : handleClose}
    >
      <View style={[tournamentUi.modalOverlay, webModal?.overlay]}>
        <Pressable
          style={tournamentUi.modalBackdrop}
          onPress={step === 'confirm' ? handleBackFromConfirm : handleClose}
        />
        <View style={[tournamentUi.modalCard, webModal?.card, { maxHeight: '80%' }]}>
          {step === 'confirm' ? (
            <>
              <View style={[tournamentUi.modalIconWrap('primary'), webModal?.iconWrap]}>
                <AppIcon name="trophy" size={webModal?.iconSize || 26} color={tournamentColors.primary} />
              </View>
              <Text style={[tournamentUi.modalTitle, webModal?.title]}>Launch {stageName}?</Text>
              <Text style={[tournamentUi.modalMessage, webModal?.message, { marginTop: 8 }]}>
                Create matches for {confirmCount} selected {participantLabel}
                {confirmCount === 1 ? '' : 's'} in {stageName}.
              </Text>
              <Text style={{ marginTop: 8, fontSize: 13, color: tournamentColors.textMuted }}>
                {stage?.format === 'knockout' ? 'Knockout bracket' : 'Round-robin pool'} · Best of{' '}
                {stage?.bestOf || 3}
              </Text>
              <View style={{ flexDirection: 'row', gap: 10, marginTop: 20 }}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <ActionButton
                    label="Back to picks"
                    onPress={handleBackFromConfirm}
                    disabled={isProgressing}
                    variant="ghost"
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
                  <ActionButton
                    label={isProgressing ? 'Working…' : 'Start round'}
                    onPress={handleConfirmStart}
                    disabled={isProgressing}
                    fullWidth
                  />
                  <Text
                    numberOfLines={2}
                    style={{ fontSize: 12, textAlign: 'center', color: tournamentColors.textMuted }}
                  >
                    {stageName}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <>
              <Text style={[tournamentUi.modalTitle, webModal?.title]}>Pick players for {stageName}</Text>
              <Text style={{ marginTop: 4 }}>
                {stage?.format === 'knockout' ? 'Knockout bracket' : 'Round-robin pool'} · Best of{' '}
                {stage?.bestOf || 3}
              </Text>
              <Text style={{ marginTop: 6, fontSize: 13, color: tournamentColors.textMuted, lineHeight: 18 }}>
                {selectionHint}
              </Text>
              <Text style={{ marginTop: 4, color: '#065f46' }}>
                Selected: {selectedCount}
                {suggestedCount > 0 ? ` · ${suggestedCount} suggested` : ''}
              </Text>

              {needsOddResolution ? (
                <View style={{ marginTop: 12, gap: 10 }}>
                  <Text style={{ fontSize: 13, color: tournamentColors.textMuted, lineHeight: 18 }}>
                    You selected an odd number of players for a knockout round. Choose how to proceed:
                  </Text>
                  <ChipSelector
                    label="Odd-player resolution"
                    options={[
                      { value: 'roundRobin', label: 'Round-robin instead' },
                      { value: 'promote', label: 'Promote one player' },
                    ]}
                    value={oddResolution === 'promote' ? 'promote' : oddResolution === 'roundRobin' ? 'roundRobin' : ''}
                    onChange={(value) => {
                      setOddResolution(value);
                      if (value !== 'promote') {
                        setPromoteBypassParticipantId('');
                      }
                    }}
                  />
                  {oddResolution === 'promote' ? (
                    <View style={{ gap: 6 }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>
                        Player to promote to {stageName}
                      </Text>
                      {selectedParticipantEntries.map((entry) => {
                        const selected = promoteBypassParticipantId === entry.id;
                        return (
                          <Pressable
                            key={entry.id}
                            onPress={() => setPromoteBypassParticipantId(entry.id)}
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              borderWidth: 1,
                              borderColor: selected ? '#2563eb' : '#d1d5db',
                              backgroundColor: selected ? '#eff6ff' : '#ffffff',
                            }}
                          >
                            <Text style={{ fontWeight: '600' }}>{entry.label}</Text>
                          </Pressable>
                        );
                      })}
                      <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>
                        The promoted player skips this round and joins the named future round directly. The remaining
                        players play knockout matches now.
                      </Text>
                      <TextInput
                        value={promoteBypassTargetStageName}
                        onChangeText={setPromoteBypassTargetStageName}
                        placeholder="Future round name (e.g. Finals)"
                        style={{
                          borderWidth: 1,
                          borderColor: tournamentColors.border,
                          borderRadius: 10,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          backgroundColor: tournamentColors.white,
                        }}
                      />
                    </View>
                  ) : null}
                </View>
              ) : null}

              {isLoadingStageCandidates && <Text style={{ marginTop: 8 }}>Loading candidates…</Text>}

              <ScrollView style={{ marginTop: 12, maxHeight: 320 }}>
                {groupStandings.map((group) => {
                  const entries = isDoubles ? group.teamStandings || [] : group.standings || [];

                  return (
                    <View key={group.divisionId} style={{ marginBottom: 12 }}>
                      <Text style={{ fontWeight: '700', marginBottom: 6 }}>{group.divisionName}</Text>
                      {entries.map((entry) => {
                        const id = String(isDoubles ? entry.teamId : entry.playerId);
                        const { rank, isBypassed, bypassTarget } = getEntrySelectionState({
                          id,
                          stage,
                          bypassParticipantIds,
                          entry,
                        });
                        const selected = Boolean(selectedParticipantIds[id]);
                        const suggested = Boolean(suggestedParticipantIds[id]);
                        const label = getStandingEntryLabel(entry, isDoubles);
                        const pointsLabel = entry.points != null ? ` · ${entry.points} pts` : '';

                        if (isBypassed) {
                          return (
                            <View
                              key={id}
                              style={{
                                padding: 10,
                                borderRadius: 8,
                                marginBottom: 6,
                                borderWidth: 1,
                                borderColor: '#d1d5db',
                                backgroundColor: '#f8fafc',
                              }}
                            >
                              <Text style={{ fontWeight: '600', color: tournamentColors.textMuted }}>
                                {rank ? `#${rank} ` : ''}
                                {label}
                                {pointsLabel} ({bypassTarget})
                              </Text>
                            </View>
                          );
                        }

                        return (
                          <Pressable
                            key={id}
                            onPress={() => onToggleParticipant(id)}
                            style={{
                              padding: 10,
                              borderRadius: 8,
                              marginBottom: 6,
                              borderWidth: 1,
                              borderColor: selected ? '#2563eb' : suggested ? '#93c5fd' : '#d1d5db',
                              backgroundColor: selected ? '#eff6ff' : '#ffffff',
                            }}
                          >
                            <Text style={{ fontWeight: '600' }}>
                              {rank ? `#${rank} ` : ''}
                              {label}
                              {pointsLabel}
                              {suggested ? ' · suggested' : ''}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  );
                })}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    label={backButtonLabel}
                    onPress={handleClose}
                    disabled={isProgressing}
                    variant="ghost"
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    label="Create matches"
                    onPress={handleRequestConfirm}
                    disabled={
                      !canStartStage ||
                      isProgressing ||
                      selectedCount < 2 ||
                      (needsOddResolution &&
                        (oddResolution === 'knockout' ||
                          (oddResolution === 'promote' &&
                            (!promoteBypassParticipantId ||
                              String(promoteBypassTargetStageName || '').trim().length < 2))))
                    }
                    fullWidth
                  />
                </View>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}
