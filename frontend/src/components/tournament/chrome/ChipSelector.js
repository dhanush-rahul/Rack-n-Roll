import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { tournamentColors } from '../../../styles/tournamentUi';

export function ChipSelector({ label, options, value, onChange }) {
  const { sp, isWide } = useTypography();

  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={{ fontWeight: '700', fontSize: 13, color: tournamentColors.textMuted, marginBottom: isWide ? sp(10) : 8 }}>
        {label}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: isWide ? sp(10) : 8 }}>
        {options.map((option) => {
          const selected = String(value) === String(option.value);

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                paddingHorizontal: isWide ? sp(16) : 14,
                paddingVertical: isWide ? sp(12) : 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? tournamentColors.primary : tournamentColors.border,
                backgroundColor: selected ? '#dbeafe' : '#f8fafc',
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 13,
                  color: selected ? tournamentColors.primary : tournamentColors.textMuted,
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
