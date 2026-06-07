import React, { useEffect, useState } from 'react';
import { Modal, Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScaledText as Text } from '../ui/ScaledText';
import { ActionButton } from './TournamentChrome';
import { discoverUi, tournamentColors, tournamentUi } from '../../styles/tournamentUi';

const formatPickerDate = (date) =>
  date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const formatPickerTime = (date) =>
  date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

export const formatMatchScheduledAt = (isoValue) => {
  if (!isoValue) {
    return null;
  }

  const date = new Date(isoValue);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

function PickerField({ label, value, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: tournamentColors.border,
        backgroundColor: tournamentColors.white,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: tournamentColors.textMuted, marginBottom: 4 }}>
        {label}
      </Text>
      <Text style={{ fontSize: 14, fontWeight: '600', color: tournamentColors.text }}>{value}</Text>
    </Pressable>
  );
}

export function MatchScheduleModal({
  visible,
  matchLabel,
  initialScheduledAt = null,
  onSave,
  onCancel,
  isSaving = false,
}) {
  const [scheduledAt, setScheduledAt] = useState(new Date());
  const [activePicker, setActivePicker] = useState(null);

  useEffect(() => {
    if (!visible) {
      return;
    }

    if (initialScheduledAt) {
      const parsed = new Date(initialScheduledAt);
      setScheduledAt(Number.isNaN(parsed.getTime()) ? new Date() : parsed);
    } else {
      const defaultDate = new Date();
      defaultDate.setMinutes(0, 0, 0);
      defaultDate.setHours(defaultDate.getHours() + 1);
      setScheduledAt(defaultDate);
    }

    setActivePicker(null);
  }, [initialScheduledAt, visible]);

  const onPickerChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setActivePicker(null);
    }

    if (event?.type === 'dismissed' || !selectedDate) {
      return;
    }

    setScheduledAt(selectedDate);
  };

  return (
    <Modal animationType="fade" transparent visible={Boolean(visible)} onRequestClose={onCancel}>
      <View style={tournamentUi.modalOverlay}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={isSaving ? undefined : onCancel} />
        <View style={[discoverUi.surfaceCard, { marginHorizontal: 4, gap: 12 }]}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: tournamentColors.text }}>Schedule match</Text>
          {Boolean(matchLabel) && (
            <Text style={{ fontSize: 14, lineHeight: 20, color: tournamentColors.textMuted }}>{matchLabel}</Text>
          )}
          <Text style={{ fontSize: 13, lineHeight: 18, color: tournamentColors.textMuted }}>
            Pick when you plan to play. Either side can update this anytime. Scoring does not require a scheduled time.
          </Text>

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PickerField
              label="Date"
              value={formatPickerDate(scheduledAt)}
              onPress={() => setActivePicker((current) => (current === 'date' ? null : 'date'))}
            />
            <PickerField
              label="Time"
              value={formatPickerTime(scheduledAt)}
              onPress={() => setActivePicker((current) => (current === 'time' ? null : 'time'))}
            />
          </View>

          {activePicker && (
            <View
              style={{
                borderWidth: 1,
                borderColor: tournamentColors.border,
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: tournamentColors.white,
              }}
            >
              <DateTimePicker
                value={scheduledAt}
                mode={activePicker}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
              />
              {Platform.OS === 'ios' && (
                <Pressable
                  onPress={() => setActivePicker(null)}
                  style={{
                    paddingVertical: 12,
                    alignItems: 'center',
                    borderTopWidth: 1,
                    borderTopColor: tournamentColors.borderLight,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: tournamentColors.primary }}>Done</Text>
                </Pressable>
              )}
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <ActionButton label="Cancel" onPress={onCancel} disabled={isSaving} variant="ghost" fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label={isSaving ? 'Saving…' : 'Save'}
                onPress={() => onSave(scheduledAt.toISOString())}
                disabled={isSaving}
                fullWidth
              />
            </View>
          </View>

          {initialScheduledAt ? (
            <ActionButton
              label={isSaving ? 'Working…' : 'Clear schedule'}
              onPress={() => onSave(null)}
              disabled={isSaving}
              variant="secondary"
              fullWidth
            />
          ) : null}
        </View>
      </View>
    </Modal>
  );
}
