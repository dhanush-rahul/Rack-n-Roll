import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTheme } from '../../../context/ThemeContext';
import { useTypography } from '../../../context/TypographyContext';

export function ChipSelector({ label, options, value, onChange }) {
  const { colors } = useTheme();
  const { sp, fs } = useTypography();

  return (
    <View style={{ marginBottom: sp(4) }}>
      <Text style={{ fontWeight: '700', fontSize: fs(13), color: colors.textMuted, marginBottom: sp(8) }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp(8) }}>
        {options.map((option) => {
          const selected = String(value) === String(option.value);

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                paddingHorizontal: sp(12),
                paddingVertical: sp(9),
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? colors.primary : colors.border,
                backgroundColor: selected ? colors.primary : colors.inputFill,
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: fs(13),
                  color: selected ? colors.onPrimary : colors.textMuted,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}
