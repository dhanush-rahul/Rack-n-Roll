import React from 'react';
import { Pressable } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { tournamentColors } from '../../../styles/tournamentUi';

const buttonStyles = {
  primary: { bg: tournamentColors.primary, text: tournamentColors.white, border: tournamentColors.primary },
  secondary: { bg: tournamentColors.white, text: tournamentColors.primary, border: tournamentColors.primary },
  danger: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
  ghost: { bg: '#f8fafc', text: tournamentColors.text, border: tournamentColors.border },
  muted: { bg: '#e2e8f0', text: '#64748b', border: '#cbd5e1' },
};

export function ActionButton({ label, onPress, disabled, variant = 'primary', fullWidth = false }) {
  const styles = buttonStyles[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: fullWidth ? '100%' : undefined,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: styles.border,
        backgroundColor: disabled && variant === 'primary' ? tournamentColors.primaryMuted : styles.bg,
        alignItems: 'center',
        opacity: pressed || disabled ? 0.72 : 1,
      })}
    >
      <Text style={{ fontWeight: '700', fontSize: 14, color: styles.text }}>{label}</Text>
    </Pressable>
  );
}
