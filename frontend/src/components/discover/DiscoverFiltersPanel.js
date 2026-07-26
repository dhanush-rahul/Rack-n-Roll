import React from 'react';
import { Animated, Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';
import { AppIcon } from '../ui/AppIcon';
import { discoverUi, tournamentColors, tournamentUi } from '../../styles/tournamentUi';
import {
  FILTERS_PANEL_MAX_HEIGHT,
  FILTER_OPTIONS,
  SORT_OPTIONS,
  PAGE_SIZE_OPTIONS,
} from '../../hooks/useDiscoverFilters';

export function DiscoverFiltersPanel({
  expanded,
  panelAnimation,
  activeFilterCount,
  searchQuery,
  sortId,
  filterId,
  filterIds = [],
  filterMultiSelect = false,
  pageSize,
  isRefreshing,
  onRefresh,
  onSearchQueryChange,
  onClearSearch,
  onSortChange,
  onFilterChange,
  onFilterToggle,
  onPageSizeChange,
  filterOptions = FILTER_OPTIONS,
  sortOptions = SORT_OPTIONS,
  pageSizeOptions = PAGE_SIZE_OPTIONS,
  showPageSize = true,
  searchPlaceholder = 'Search by tournament name',
  panelTitle = 'Search & filters',
  filterSectionLabel = 'FILTER',
}) {
  if (!expanded) {
    return null;
  }

  const panelBodyStyle = {
    maxHeight: panelAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, FILTERS_PANEL_MAX_HEIGHT],
    }),
    opacity: panelAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, 1],
    }),
    overflow: 'hidden',
  };

  return (
    <View style={[discoverUi.surfaceCard, { overflow: 'hidden', marginBottom: 16 }]}>
      <Animated.View style={panelBodyStyle}>
        <View style={{ gap: 14, paddingHorizontal: 14, paddingTop: 14, paddingBottom: 18 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 14, fontWeight: '800', color: tournamentColors.text }}>{panelTitle}</Text>
            <Pressable
              onPress={onRefresh}
              disabled={isRefreshing}
              hitSlop={8}
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 8,
                backgroundColor: tournamentColors.inputFill,
                opacity: isRefreshing ? 0.6 : 1,
              }}
            >
              <AppIcon name="refresh" size={16} color={tournamentColors.primary} />
            </Pressable>
          </View>

          {activeFilterCount > 0 ? (
            <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>
              {activeFilterCount} active {activeFilterCount === 1 ? 'filter' : 'filters'}
            </Text>
          ) : null}

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.textMuted, letterSpacing: 0.6 }}>
              SEARCH
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={[tournamentUi.input, { flex: 1, paddingVertical: 11 }]}
                placeholder={searchPlaceholder}
                value={searchQuery}
                onChangeText={onSearchQueryChange}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="search"
                clearButtonMode="while-editing"
              />
              {Boolean(searchQuery.trim()) && (
                <Pressable
                  onPress={onClearSearch}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 11,
                    borderRadius: 10,
                    backgroundColor: tournamentColors.inputFill,
                  }}
                >
                  <Text style={{ fontWeight: '700', color: tournamentColors.textMuted }}>Clear</Text>
                </Pressable>
              )}
            </View>
          </View>

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.textMuted, letterSpacing: 0.6 }}>
              SORT BY
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {sortOptions.map((option) => {
                const selected = sortId === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => onSortChange(option.id)}
                    style={{
                      paddingHorizontal: 12,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? tournamentColors.primary : tournamentColors.border,
                      backgroundColor: selected ? tournamentColors.chipSelectedBg : tournamentColors.surfaceRaised,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '700',
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

          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.textMuted, letterSpacing: 0.6 }}>
              {filterSectionLabel}
            </Text>
            {filterMultiSelect ? (
              <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>Select one or more</Text>
            ) : null}
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {filterOptions.map((option) => {
                const selected = filterMultiSelect
                  ? option.id === 'all'
                    ? filterIds.length === 0
                    : filterIds.includes(option.id)
                  : filterId === option.id;
                const onPress = filterMultiSelect
                  ? () => onFilterToggle?.(option.id)
                  : () => onFilterChange?.(option.id);

                return (
                  <Pressable
                    key={option.id}
                    onPress={onPress}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? tournamentColors.primary : tournamentColors.border,
                      backgroundColor: selected ? tournamentColors.chipSelectedBg : tournamentColors.surfaceRaised,
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
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

          {showPageSize ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: tournamentColors.textMuted }}>Per page</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {pageSizeOptions.map((size) => {
                const selected = pageSize === size;
                return (
                  <Pressable
                    key={size}
                    onPress={() => onPageSizeChange(size)}
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      borderWidth: 1,
                      borderColor: selected ? tournamentColors.primary : tournamentColors.border,
                      backgroundColor: selected ? tournamentColors.chipSelectedBg : tournamentColors.white,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 13,
                        fontWeight: '700',
                        color: selected ? tournamentColors.primary : tournamentColors.textMuted,
                      }}
                    >
                      {size}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          ) : null}
        </View>
      </Animated.View>
    </View>
  );
}
