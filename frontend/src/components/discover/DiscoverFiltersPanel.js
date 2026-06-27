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
  getSortLabel,
  getFilterLabel,
} from '../../hooks/useDiscoverFilters';

export function DiscoverFiltersPanel({
  expanded,
  onToggle,
  panelAnimation,
  activeFilterCount,
  searchQuery,
  sortId,
  filterId,
  pageSize,
  isRefreshing,
  onRefresh,
  onSearchQueryChange,
  onClearSearch,
  onSortChange,
  onFilterChange,
  onPageSizeChange,
}) {
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

  const chevronRotation = panelAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const summaryParts = [
    searchQuery.trim() ? `"${searchQuery.trim()}"` : null,
    getSortLabel(sortId),
    getFilterLabel(filterId),
    `${pageSize} / page`,
  ].filter(Boolean);

  return (
    <View style={[discoverUi.surfaceCard, { overflow: 'hidden' }]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 14,
          backgroundColor: tournamentColors.white,
        }}
      >
        <Pressable onPress={onToggle} style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.88 : 1, gap: 4 })}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: tournamentColors.text }}>Search & filters</Text>
            {activeFilterCount > 0 && (
              <View
                style={{
                  minWidth: 22,
                  height: 22,
                  paddingHorizontal: 6,
                  borderRadius: 11,
                  backgroundColor: tournamentColors.primary,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ color: tournamentColors.white, fontSize: 11, fontWeight: '800' }}>
                  {activeFilterCount}
                </Text>
              </View>
            )}
          </View>
          <Text style={{ fontSize: 12, color: tournamentColors.textMuted }} numberOfLines={1}>
            {expanded ? 'Tap to hide options' : summaryParts.join(' · ')}
          </Text>
        </Pressable>

        <Pressable
          onPress={onRefresh}
          disabled={isRefreshing}
          hitSlop={8}
          style={{
            paddingHorizontal: 12,
            paddingVertical: 8,
            borderRadius: 10,
            backgroundColor: '#f1f5f9',
            opacity: isRefreshing ? 0.6 : 1,
          }}
        >
          <AppIcon name="refresh" size={16} color={tournamentColors.primary} />
        </Pressable>

        <Pressable onPress={onToggle} hitSlop={8}>
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <AppIcon name="chevronDown" size={18} color={tournamentColors.primary} />
          </Animated.View>
        </Pressable>
      </View>

      <Animated.View style={panelBodyStyle} pointerEvents={expanded ? 'auto' : 'none'}>
        <View style={{ gap: 14, paddingHorizontal: 14, paddingBottom: 14 }}>
          <View style={{ gap: 8 }}>
            <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.textMuted, letterSpacing: 0.6 }}>
              SEARCH
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TextInput
                style={[tournamentUi.input, { flex: 1, paddingVertical: 11 }]}
                placeholder="Search by tournament name"
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
                    backgroundColor: '#f1f5f9',
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
              {SORT_OPTIONS.map((option) => {
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
                      backgroundColor: selected ? '#dbeafe' : '#f8fafc',
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
              FILTER
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {FILTER_OPTIONS.map((option) => {
                const selected = filterId === option.id;
                return (
                  <Pressable
                    key={option.id}
                    onPress={() => onFilterChange(option.id)}
                    style={{
                      paddingHorizontal: 14,
                      paddingVertical: 8,
                      borderRadius: 999,
                      borderWidth: 1,
                      borderColor: selected ? tournamentColors.primary : tournamentColors.border,
                      backgroundColor: selected ? '#dbeafe' : '#f8fafc',
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

          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={{ fontSize: 12, fontWeight: '600', color: tournamentColors.textMuted }}>Per page</Text>
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {PAGE_SIZE_OPTIONS.map((size) => {
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
                      backgroundColor: selected ? '#dbeafe' : tournamentColors.white,
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
        </View>
      </Animated.View>
    </View>
  );
}
