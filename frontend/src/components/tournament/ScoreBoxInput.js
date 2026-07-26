import React from 'react';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';
import { tournamentColors } from '../../styles/tournamentUi';

export function ScoreBoxInput({ value, onChangeText, editable = true, saving = false, highlighted = false }) {
  const borderColor = saving
    ? tournamentColors.primary
    : highlighted
      ? tournamentColors.successBorder
      : tournamentColors.border;
  const backgroundColor = highlighted
    ? tournamentColors.statusSuccessBg
    : editable
      ? tournamentColors.inputFill
      : tournamentColors.inputDisabled;

  return (
    <TextInput
      value={value}
      onChangeText={onChangeText}
      editable={editable && !saving}
      keyboardType="number-pad"
      placeholder="0"
      style={{
        minWidth: 36,
        width: 40,
        height: 34,
        borderRadius: 8,
        borderWidth: highlighted ? 1.5 : 1,
        borderColor,
        backgroundColor,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '700',
        color: highlighted ? tournamentColors.statusSuccessText : tournamentColors.text,
        paddingHorizontal: 4,
        paddingVertical: 4,
      }}
    />
  );
}
