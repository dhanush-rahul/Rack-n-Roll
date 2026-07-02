import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { AppIcon } from '../ui/AppIcon';
import { tournamentColors } from '../../styles/tournamentUi';

export function DiscoverTournamentsHeader({
  shownCount,
  activeFilterCount,
  filtersExpanded,
  onToggleFilters,
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 10,
      }}
    >
      <Text style={{ flex: 1, fontSize: 16, fontWeight: '800', color: tournamentColors.text }}>Tournaments</Text>

      <Pressable
        onPress={onToggleFilters}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={filtersExpanded ? 'Hide search and filters' : 'Show search and filters'}
        accessibilityState={{ expanded: filtersExpanded }}
        style={({ pressed }) => ({
          width: 32,
          height: 32,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.55 : 1,
        })}
      >
        <AppIcon
          name="filter"
          size={22}
          color={filtersExpanded ? tournamentColors.primary : tournamentColors.text}
        />
        {activeFilterCount > 0 ? (
          <View
            style={{
              position: 'absolute',
              top: -4,
              right: -4,
              minWidth: 16,
              height: 16,
              paddingHorizontal: 4,
              borderRadius: 8,
              backgroundColor: tournamentColors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: tournamentColors.white, fontSize: 10, fontWeight: '800' }}>{activeFilterCount}</Text>
          </View>
        ) : null}
      </Pressable>

      <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>{shownCount} shown</Text>
    </View>
  );
}
