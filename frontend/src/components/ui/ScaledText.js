import React, { useMemo } from 'react';
import { StyleSheet, Text as RNText } from 'react-native';
import { useTypography } from '../../context/TypographyContext';

function scaleTextStyle(style, fs) {
  if (!style) {
    return style;
  }

  if (Array.isArray(style)) {
    return style.map((entry) => scaleTextStyle(entry, fs));
  }

  const flat = StyleSheet.flatten(style);
  if (!flat) {
    return style;
  }

  const next = { ...flat };

  if (typeof next.fontSize === 'number') {
    next.fontSize = fs(next.fontSize);
  }

  if (typeof next.lineHeight === 'number') {
    next.lineHeight = fs(next.lineHeight);
  }

  return next;
}

export function ScaledText({ style, ...rest }) {
  const { fs, fontScale } = useTypography();
  const scaledStyle = useMemo(() => {
    if (fontScale === 1) {
      return style;
    }
    return scaleTextStyle(style, fs);
  }, [fontScale, fs, style]);

  return <RNText style={scaledStyle} {...rest} />;
}
