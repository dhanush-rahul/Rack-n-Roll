import React, { useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { ScaledText as Text } from '../ui/ScaledText';
import { ActionButton, CollapsibleSectionCard } from './TournamentChrome';
import { WebScheduleInputs } from '../scheduling/WebScheduleInputs';
import { tournamentColors } from '../../styles/tournamentUi';

const formatDateTime = (value) => {
  if (!value) {
    return 'Not set';
  }

  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Not set';
  }

  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const buildNextEnd = (endsAt, startsAt) => {
  const currentEnd = endsAt ? new Date(endsAt) : null;
  const start = startsAt ? new Date(startsAt) : null;
  const base =
    currentEnd && !Number.isNaN(currentEnd.getTime())
      ? currentEnd
      : start && !Number.isNaN(start.getTime())
        ? start
        : new Date();

  return new Date(base.getTime() + 24 * 60 * 60 * 1000);
};

function PickerField({ label, value, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        borderWidth: 1,
        borderColor: tournamentColors.border,
        borderRadius: 10,
        padding: 12,
        backgroundColor: tournamentColors.inputFill,
        opacity: pressed ? 0.9 : 1,
        gap: 6,
      })}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>{label}</Text>
      <Text style={{ fontSize: 15, fontWeight: '600', color: tournamentColors.text }}>{value}</Text>
    </Pressable>
  );
}

export function ExtendEndDateSection({ startsAt, endsAt, onExtend }) {
  const hasEnd = Boolean(endsAt);
  const minimumDate = useMemo(() => {
    const currentEnd = endsAt ? new Date(endsAt) : null;
    const start = startsAt ? new Date(startsAt) : null;

    if (currentEnd && !Number.isNaN(currentEnd.getTime())) {
      return currentEnd;
    }

    if (start && !Number.isNaN(start.getTime())) {
      return start;
    }

    return new Date();
  }, [endsAt, startsAt]);

  const [draftEndsAt, setDraftEndsAt] = useState(() => buildNextEnd(endsAt, startsAt));

  useEffect(() => {
    setDraftEndsAt(buildNextEnd(endsAt, startsAt));
  }, [endsAt, startsAt]);
  const [activePicker, setActivePicker] = useState(null);
  const [errorText, setErrorText] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const applyDraft = (nextDate) => {
    setDraftEndsAt(nextDate);
    setErrorText('');
  };

  const onPickerChange = (event, selectedDate) => {
    const picker = activePicker;

    if (Platform.OS === 'android') {
      setActivePicker(null);
    }

    if (event?.type === 'dismissed' || !selectedDate || !picker) {
      return;
    }

    setDraftEndsAt((previous) => {
      const next = new Date(previous);

      if (picker === 'date') {
        next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      } else {
        next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      }

      return next;
    });
    setErrorText('');
  };

  const onSave = async () => {
    if (!(draftEndsAt instanceof Date) || Number.isNaN(draftEndsAt.getTime()) || draftEndsAt.getTime() <= minimumDate.getTime()) {
      setErrorText(hasEnd ? 'Pick an end date after the current end date.' : 'Pick an end date after the start date.');
      return;
    }

    try {
      setIsSaving(true);
      setErrorText('');
      await onExtend(draftEndsAt.toISOString());
      setActivePicker(null);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <CollapsibleSectionCard
      title="Schedule"
      subtitle={
        hasEnd
          ? 'Start date stays fixed. Extend the end date to keep this tournament in Ongoing.'
          : 'Start date stays fixed. Set an end date to give this tournament a finish window.'
      }
      defaultExpanded={false}
    >
      <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
        Starts {formatDateTime(startsAt)}
      </Text>
      <Text style={{ fontSize: 13, color: tournamentColors.text }}>
        Ends {formatDateTime(endsAt)}
      </Text>

      {Platform.OS === 'web' ? (
        <WebScheduleInputs
          value={draftEndsAt}
          onChange={applyDraft}
          dateLabel="New end date"
          timeLabel="New end time"
          minDate={minimumDate}
        />
      ) : (
        <View style={{ gap: 10 }}>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <PickerField
              label="New end date"
              value={draftEndsAt.toLocaleDateString(undefined, {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })}
              onPress={() => setActivePicker((current) => (current === 'date' ? null : 'date'))}
            />
            <PickerField
              label="New end time"
              value={draftEndsAt.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}
              onPress={() => setActivePicker((current) => (current === 'time' ? null : 'time'))}
            />
          </View>
          {activePicker ? (
            <View
              style={{
                borderWidth: 1,
                borderColor: tournamentColors.border,
                borderRadius: 12,
                overflow: 'hidden',
                backgroundColor: tournamentColors.inputFill,
              }}
            >
              <DateTimePicker
                value={draftEndsAt}
                mode={activePicker}
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={onPickerChange}
                minimumDate={activePicker === 'date' ? minimumDate : undefined}
              />
              {Platform.OS === 'ios' ? (
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
              ) : null}
            </View>
          ) : null}
        </View>
      )}

      {Boolean(errorText) && (
        <Text style={{ color: tournamentColors.error, fontSize: 13 }}>{errorText}</Text>
      )}

      <ActionButton
        label={isSaving ? 'Saving…' : hasEnd ? 'Extend end date' : 'Set end date'}
        onPress={onSave}
        disabled={isSaving}
        variant="secondary"
        fullWidth
      />
    </CollapsibleSectionCard>
  );
}
