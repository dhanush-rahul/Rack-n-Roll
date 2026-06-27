import React from 'react';
import { Pressable } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { tournamentColors } from '../../../styles/tournamentUi';

export function ToolbarIconButton({ label, onPress, disabled, active = false, fullWidth = false }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: active ? '#dbeafe' : '#f1f5f9',
        borderWidth: 1,
        borderColor: active ? tournamentColors.primary : '#e2e8f0',
        opacity: disabled ? 0.5 : 1,
        alignItems: 'center',
        ...(fullWidth ? { flex: 1, alignSelf: 'stretch' } : {}),
      }}
    >
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: active ? tournamentColors.primary : tournamentColors.text,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
