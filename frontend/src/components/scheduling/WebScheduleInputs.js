import React, { createElement, useMemo } from 'react';
import { Platform, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { useTheme } from '../../context/ThemeContext';

const toDateInputValue = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toTimeInputValue = (date) => {
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

function FieldLabel({ children, color }) {
  return <Text style={{ fontSize: 13, fontWeight: '600', color }}>{children}</Text>;
}

export function WebScheduleInputs({ value, onChange, dateLabel = 'Date', timeLabel = 'Time', minDate }) {
  const { colors, isDark } = useTheme();

  const inputStyle = useMemo(
    () => ({
      width: '100%',
      borderWidth: 1,
      borderStyle: 'solid',
      borderColor: colors.border,
      borderRadius: 10,
      padding: 12,
      fontSize: 15,
      fontWeight: 600,
      color: colors.text,
      backgroundColor: colors.inputFill,
      boxSizing: 'border-box',
      colorScheme: isDark ? 'dark' : 'light',
    }),
    [colors.border, colors.inputFill, colors.text, isDark]
  );

  if (Platform.OS !== 'web') {
    return null;
  }

  const minDateValue = minDate ? toDateInputValue(minDate) : undefined;

  const applyDateChange = (dateValue) => {
    if (!dateValue) {
      return;
    }

    const [year, month, day] = dateValue.split('-').map(Number);
    const next = new Date(value);
    next.setFullYear(year, month - 1, day);
    onChange(next);
  };

  const applyTimeChange = (timeValue) => {
    if (!timeValue) {
      return;
    }

    const [hours, minutes] = timeValue.split(':').map(Number);
    const next = new Date(value);
    next.setHours(hours, minutes, 0, 0);
    onChange(next);
  };

  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1, gap: 6 }}>
        <FieldLabel color={colors.textMuted}>{dateLabel}</FieldLabel>
        {createElement('input', {
          type: 'date',
          value: toDateInputValue(value),
          min: minDateValue,
          onChange: (event) => applyDateChange(event.target.value),
          style: inputStyle,
        })}
      </View>
      <View style={{ flex: 1, gap: 6 }}>
        <FieldLabel color={colors.textMuted}>{timeLabel}</FieldLabel>
        {createElement('input', {
          type: 'time',
          value: toTimeInputValue(value),
          onChange: (event) => applyTimeChange(event.target.value),
          style: inputStyle,
        })}
      </View>
    </View>
  );
}
