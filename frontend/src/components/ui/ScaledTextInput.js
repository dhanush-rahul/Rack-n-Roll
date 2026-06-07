import React, { useMemo } from 'react';
import { StyleSheet, TextInput as RNTextInput } from 'react-native';
import { useTypography } from '../../context/TypographyContext';
import { tournamentColors } from '../../styles/tournamentUi';

/** Matches body/label text (auth fields, form rows). */
export const INPUT_BASE_FONT_SIZE = 16;

export function buildScaledInputStyle(style, { fs, sp, lh }) {
  const flat = StyleSheet.flatten([
    {
      fontSize: INPUT_BASE_FONT_SIZE,
      lineHeight: lh(INPUT_BASE_FONT_SIZE),
      color: tournamentColors.text,
      paddingVertical: 12,
      paddingHorizontal: 14,
    },
    style,
  ]);

  if (!flat) {
    return {
      fontSize: fs(INPUT_BASE_FONT_SIZE),
      lineHeight: lh(INPUT_BASE_FONT_SIZE),
      color: tournamentColors.text,
      paddingVertical: sp(12),
      paddingHorizontal: sp(14),
    };
  }

  const next = { ...flat };
  const baseFont =
    typeof next.fontSize === 'number' ? next.fontSize : INPUT_BASE_FONT_SIZE;

  next.fontSize = fs(baseFont);
  next.lineHeight =
    typeof next.lineHeight === 'number' ? fs(next.lineHeight) : lh(baseFont);

  if (typeof next.paddingVertical === 'number') {
    next.paddingVertical = sp(next.paddingVertical);
  }

  if (typeof next.paddingHorizontal === 'number') {
    next.paddingHorizontal = sp(next.paddingHorizontal);
  }

  return next;
}

export function useScaledInputStyle(style) {
  const typography = useTypography();
  return useMemo(() => buildScaledInputStyle(style, typography), [style, typography]);
}

export function ScaledTextInput({ style, ...rest }) {
  const typography = useTypography();
  const scaledStyle = useMemo(
    () => buildScaledInputStyle(style, typography),
    [style, typography]
  );

  return <RNTextInput style={scaledStyle} {...rest} />;
}
