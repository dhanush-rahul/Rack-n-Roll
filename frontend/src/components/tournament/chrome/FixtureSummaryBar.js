import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { tournamentColors } from '../../../styles/tournamentUi';

export function FixtureSummaryBar({ text }) {
  if (!text) {
    return null;
  }

  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.text, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}
