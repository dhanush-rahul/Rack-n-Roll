import React, { useMemo } from 'react';
import { Pressable } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTheme } from '../../../context/ThemeContext';
import { useTypography } from '../../../context/TypographyContext';

export function ActionButton({ label, onPress, disabled, variant = 'primary', fullWidth = false }) {
  const { colors } = useTheme();
  const { sp, fs } = useTypography();

  const styles = useMemo(() => {
    const variants = {
      primary: { bg: colors.primary, text: colors.onPrimary, border: colors.primary },
      secondary: {
        bg: colors.surfaceRaised,
        text: colors.primary,
        border: colors.primaryTint || colors.primary,
      },
      danger: { bg: colors.errorSurface, text: colors.error, border: colors.errorBorder },
      ghost: { bg: colors.inputFill, text: colors.text, border: colors.borderLight },
      muted: { bg: colors.inputDisabled, text: colors.textMuted, border: colors.border },
    };

    return variants[variant] || variants.primary;
  }, [colors, variant]);

  const backgroundColor =
    disabled && variant === 'primary' ? colors.primaryMuted : styles.bg;
  const textColor = disabled ? colors.textMuted : styles.text;

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: fullWidth ? '100%' : undefined,
        paddingVertical: sp(10),
        paddingHorizontal: sp(12),
        borderRadius: sp(10),
        borderWidth: 1,
        borderColor: disabled ? colors.border : styles.border,
        backgroundColor,
        alignItems: 'center',
        opacity: pressed || disabled ? 0.72 : 1,
      })}
    >
      <Text style={{ fontWeight: '700', fontSize: fs(14), color: textColor, numberOfLines: 2 }}>
        {label}
      </Text>
    </Pressable>
  );
}
