import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { AppIcon } from '../ui/AppIcon';
import { discoverUi, tournamentColors } from '../../styles/tournamentUi';

export function PaginationBar({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <View style={[discoverUi.surfaceCard, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }]}>
      <Pressable
        onPress={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: page <= 1 ? '#f1f5f9' : '#eff6ff',
          opacity: page <= 1 ? 0.5 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <AppIcon name="chevronLeft" size={16} color={tournamentColors.primary} />
          <Text style={{ fontWeight: '700', color: tournamentColors.primary }}>Prev</Text>
        </View>
      </Pressable>
      <Text style={{ fontSize: 13, fontWeight: '700', color: tournamentColors.textMuted }}>
        {page} / {totalPages}
      </Text>
      <Pressable
        onPress={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={{
          paddingHorizontal: 16,
          paddingVertical: 10,
          borderRadius: 10,
          backgroundColor: page >= totalPages ? '#f1f5f9' : '#eff6ff',
          opacity: page >= totalPages ? 0.5 : 1,
        }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
          <Text style={{ fontWeight: '700', color: tournamentColors.primary }}>Next</Text>
          <AppIcon name="chevronRight" size={16} color={tournamentColors.primary} />
        </View>
      </Pressable>
    </View>
  );
}
