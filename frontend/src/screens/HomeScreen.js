import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import {
  ActivityIndicator,
  Animated,
  Easing,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '../components/ui/ScaledTextInput';
import { useAuth } from '../context/AuthContext';
import { AuthPromptModal } from '../components/AuthPromptModal';
import { useRequireAuth } from '../hooks/useRequireAuth';
import { useDiscoverTournaments } from '../hooks/queries/useDiscoverTournaments';
import {
  submitTournamentRegistrationRequest,
  validateTournamentInviteCode,
} from '../services/tournamentService';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { discoverUi, tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { useResponsiveLayout, centeredContentStyle } from '../utils/responsive';

const HIGHLIGHT_BLINK_DURATION_MS = 6000;
const PAGE_SIZE_OPTIONS = [10, 20, 30];
const EXPANDED_SECTION_MAX_HEIGHT = 720;
const FILTER_OPTIONS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'mine', label: 'My events' },
];

const SORT_OPTIONS = [
  { id: 'newest', label: 'Newest' },
  { id: 'startsSoon', label: 'Starting soon' },
  { id: 'startsLatest', label: 'Latest start' },
  { id: 'oldest', label: 'Oldest' },
];

const SEARCH_DEBOUNCE_MS = 350;
const FILTERS_PANEL_MAX_HEIGHT = 360;

const getSortLabel = (sortId) => SORT_OPTIONS.find((option) => option.id === sortId)?.label || 'Newest';
const getFilterLabel = (filterId) => FILTER_OPTIONS.find((option) => option.id === filterId)?.label || 'All';

const countActiveFilters = ({ searchQuery, sortId, filterId, pageSize }) => {
  let count = 0;

  if (searchQuery.trim()) {
    count += 1;
  }

  if (sortId !== 'newest') {
    count += 1;
  }

  if (filterId !== 'all') {
    count += 1;
  }

  if (pageSize !== 10) {
    count += 1;
  }

  return count;
};

const formatLocation = (location) => {
  if (!location) {
    return 'Location TBD';
  }

  return location.formattedAddress || location.city || 'Location TBD';
};

const formatStartsAt = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatStartsAtRelative = (value) => {
  if (!value) {
    return null;
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (diffMs < -60 * 60 * 1000) {
    return 'In progress';
  }

  if (diffDays <= 0) {
    return 'Starts today';
  }

  if (diffDays === 1) {
    return 'Starts tomorrow';
  }

  if (diffDays < 7) {
    return `Starts in ${diffDays} days`;
  }

  return formatStartsAt(value);
};

const getTournamentMonogram = (name) => {
  const trimmed = String(name || '').trim();

  if (!trimmed) {
    return '?';
  }

  const words = trimmed.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0]}${words[1][0]}`.toUpperCase();
  }

  return trimmed.slice(0, 2).toUpperCase();
};

const getAccentColor = (item, isHostTournament) => {
  if (isHostTournament) {
    return '#7c3aed';
  }

  if (item.registrationMode === 'inviteOnly') {
    return '#d97706';
  }

  return tournamentColors.primary;
};

function Badge({ label, tone = 'neutral' }) {
  const palette = {
    neutral: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
    primary: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
    success: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
    warning: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    host: { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
    new: { bg: '#cffafe', text: '#0e7490', border: '#a5f3fc' },
  }[tone];

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.text }}>{label}</Text>
    </View>
  );
}

function MetaRow({ icon, label, emphasis = false }) {
  return (
    <View style={discoverUi.metaRow}>
      <View style={discoverUi.metaIcon}>
        <Text style={{ fontSize: 13 }}>{icon}</Text>
      </View>
      <Text
        style={{
          flex: 1,
          fontSize: 13,
          lineHeight: 18,
          color: emphasis ? tournamentColors.text : tournamentColors.textMuted,
          fontWeight: emphasis ? '600' : '400',
        }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

function DiscoverActionButton({ label, onPress, disabled, variant = 'primary', fullWidth = false }) {
  const styles = {
    primary: {
      backgroundColor: disabled ? tournamentColors.primaryMuted : tournamentColors.primary,
      text: tournamentColors.white,
      border: tournamentColors.primary,
    },
    secondary: {
      backgroundColor: tournamentColors.white,
      text: tournamentColors.primary,
      border: tournamentColors.primary,
    },
    ghost: {
      backgroundColor: '#f8fafc',
      text: tournamentColors.text,
      border: tournamentColors.border,
    },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        flex: fullWidth ? undefined : 1,
        width: fullWidth ? '100%' : undefined,
        minWidth: fullWidth ? undefined : '46%',
        paddingVertical: 12,
        paddingHorizontal: 12,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: styles.border,
        backgroundColor: styles.backgroundColor,
        alignItems: 'center',
        opacity: pressed || disabled ? 0.72 : 1,
      })}
    >
      <Text style={{ fontWeight: '700', fontSize: 14, color: styles.text }}>{label}</Text>
    </Pressable>
  );
}

function DiscoverHero({ total, openCount, myCount, onCreate }) {
  return (
    <View style={discoverUi.hero}>
      <View style={[discoverUi.heroGlow, { top: -40, right: -30 }]} />
      <View style={[discoverUi.heroGlow, { bottom: -50, left: -20, backgroundColor: 'rgba(124, 58, 237, 0.28)' }]} />

      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>DISCOVER</Text>
          <Text style={{ color: '#f8fafc', fontSize: 22, fontWeight: '800', lineHeight: 28 }}>Find your next table</Text>
          <Text style={{ color: '#94a3b8', fontSize: 14, lineHeight: 20 }}>
            Browse tournaments, join open events, or host your own.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600' }}>TOTAL</Text>
            <Text style={{ color: '#f8fafc', fontSize: 20, fontWeight: '800', marginTop: 2 }}>{total}</Text>
          </View>
          <View style={{ flex: 1, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600' }}>OPEN</Text>
            <Text style={{ color: '#86efac', fontSize: 20, fontWeight: '800', marginTop: 2 }}>{openCount}</Text>
          </View>
          <View style={{ flex: 1, padding: 10, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' }}>
            <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600' }}>YOURS</Text>
            <Text style={{ color: '#c4b5fd', fontSize: 20, fontWeight: '800', marginTop: 2 }}>{myCount}</Text>
          </View>
        </View>

        <Pressable
          onPress={onCreate}
          style={({ pressed }) => ({
            backgroundColor: tournamentColors.primary,
            borderRadius: 12,
            paddingVertical: 13,
            alignItems: 'center',
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: tournamentColors.white, fontWeight: '800', fontSize: 15 }}>+ Host a tournament</Text>
        </Pressable>
      </View>
    </View>
  );
}

function DiscoverFiltersPanel({
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
          <Text style={{ fontSize: 14, fontWeight: '700', color: tournamentColors.primary }}>
            {isRefreshing ? '…' : '↻'}
          </Text>
        </Pressable>

        <Pressable onPress={onToggle} hitSlop={8}>
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: tournamentColors.primary }}>▾</Text>
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

function PaginationBar({ page, totalPages, onPageChange }) {
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
        <Text style={{ fontWeight: '700', color: tournamentColors.primary }}>← Prev</Text>
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
        <Text style={{ fontWeight: '700', color: tournamentColors.primary }}>Next →</Text>
      </Pressable>
    </View>
  );
}

function SkeletonCard({ pulse }) {
  return (
    <Animated.View
      style={{
        height: 132,
        borderRadius: 16,
        backgroundColor: '#e2e8f0',
        opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0.75] }),
      }}
    />
  );
}

function LoadingPlaceholder({ pulse }) {
  return (
    <View style={{ gap: 12 }}>
      {[0, 1, 2].map((key) => (
        <SkeletonCard key={key} pulse={pulse} />
      ))}
    </View>
  );
}

function EmptyDiscoverState({ onCreate, filterId, searchQuery }) {
  const trimmedSearch = searchQuery.trim();

  const message = trimmedSearch
    ? `No tournaments match "${trimmedSearch}". Try another name or clear search.`
    : filterId === 'mine'
      ? "You haven't hosted any tournaments on this page yet."
      : filterId === 'open'
      ? 'No open registration events match your filters right now.'
      : 'Be the first to host — players are waiting for events like yours.';

  return (
    <View style={[discoverUi.surfaceCard, { alignItems: 'center', paddingVertical: 28, gap: 10 }]}>
      <View
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          backgroundColor: '#eff6ff',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: 32 }}>🎱</Text>
      </View>
      <Text style={{ fontSize: 18, fontWeight: '800', color: tournamentColors.text, textAlign: 'center' }}>
        Nothing here yet
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 21, color: tournamentColors.textMuted, textAlign: 'center' }}>
        {message}
      </Text>
      {!trimmedSearch && filterId !== 'open' && (
        <Pressable
          onPress={onCreate}
          style={{
            marginTop: 6,
            paddingHorizontal: 20,
            paddingVertical: 13,
            borderRadius: 12,
            backgroundColor: tournamentColors.primary,
          }}
        >
          <Text style={{ color: tournamentColors.white, fontWeight: '800' }}>Create tournament</Text>
        </Pressable>
      )}
    </View>
  );
}

function DiscoverTournamentCard({
  item,
  isExpanded,
  isHighlighted,
  isHostTournament,
  highlightBlinkAnimation,
  expansionAnimation,
  inviteCode,
  onInviteCodeChange,
  tournamentValidation,
  registrationState,
  hasExistingRegistration,
  existingRegistrationStatus,
  requestEnabled,
  onToggleExpand,
  onOpenTournamentDetail,
  onOpenScoresheet,
  onValidateInviteCode,
  onRequestRegistration,
}) {
  const startsAtLabel = formatStartsAt(item.startsAt);
  const startsAtRelative = formatStartsAtRelative(item.startsAt);
  const locationLabel = formatLocation(item.location);
  const accentColor = getAccentColor(item, isHostTournament);
  const monogram = getTournamentMonogram(item.name);

  const expandedSectionStyle = {
    maxHeight: expansionAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: [0, EXPANDED_SECTION_MAX_HEIGHT],
    }),
    opacity: expansionAnimation,
    transform: [
      {
        translateY: expansionAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [8, 0],
        }),
      },
    ],
    overflow: 'hidden',
  };

  const cardShellStyle = {
    ...discoverUi.listCard,
    borderColor: isExpanded ? '#93c5fd' : tournamentColors.borderLight,
  };

  const animatedShellStyle = isHighlighted
    ? {
        ...cardShellStyle,
        borderWidth: 2,
        borderColor: highlightBlinkAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: ['#93c5fd', '#2563eb'],
        }),
        shadowOpacity: highlightBlinkAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [0.07, 0.28],
        }),
      }
    : cardShellStyle;

  const CardShell = isHighlighted ? Animated.View : View;
  const CardBody = isHighlighted ? Animated.View : View;
  const cardBodyStyle = isHighlighted
    ? {
        backgroundColor: highlightBlinkAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: ['#ffffff', '#eff6ff'],
        }),
      }
    : null;

  return (
    <CardShell style={animatedShellStyle} collapsable={false}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: accentColor }} />

      <CardBody style={cardBodyStyle}>
        <Pressable
          onPress={() => onToggleExpand(item.id)}
          style={({ pressed }) => ({
            padding: 14,
            paddingLeft: 16,
            opacity: pressed ? 0.94 : 1,
            gap: 12,
          })}
        >
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
            <View style={[discoverUi.monogram, { backgroundColor: `${accentColor}18` }]}>
              <Text style={{ fontSize: 16, fontWeight: '800', color: accentColor }}>{monogram}</Text>
            </View>

            <View style={{ flex: 1, gap: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <Text style={{ flex: 1, fontSize: 17, fontWeight: '800', color: tournamentColors.text, lineHeight: 22 }}>
                  {item.name}
                </Text>
                <View
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 15,
                    backgroundColor: isExpanded ? '#dbeafe' : '#f1f5f9',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={{ fontSize: 14, color: tournamentColors.primary, fontWeight: '700' }}>
                    {isExpanded ? '▴' : '▾'}
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {isHighlighted && <Badge label="Just launched" tone="new" />}
                {isHostTournament && <Badge label="Your event" tone="host" />}
                <Badge
                  label={item.registrationMode === 'inviteOnly' ? 'Invite only' : 'Public'}
                  tone={item.registrationMode === 'inviteOnly' ? 'warning' : 'primary'}
                />
                <Badge
                  label={item.registrationStatus === 'open' ? 'Open' : 'Closed'}
                  tone={item.registrationStatus === 'open' ? 'success' : 'neutral'}
                />
                {Boolean(startsAtRelative) && <Badge label={startsAtRelative} tone="neutral" />}
              </View>
            </View>
          </View>

          {!isExpanded && (
            <Text
              style={{ paddingLeft: 56, fontSize: 13, color: tournamentColors.textMuted }}
              numberOfLines={1}
            >
              {startsAtLabel ? `${startsAtLabel} · ` : ''}
              {locationLabel}
            </Text>
          )}

          {!isExpanded && (
            <Text style={{ paddingLeft: 56, fontSize: 12, fontWeight: '600', color: tournamentColors.primary }}>
              Tap to expand →
            </Text>
          )}
        </Pressable>

        <Animated.View style={expandedSectionStyle} pointerEvents={isExpanded ? 'auto' : 'none'}>
          <View
            style={{
              gap: 12,
              paddingHorizontal: 14,
              paddingBottom: 14,
              paddingLeft: 16,
              borderTopWidth: 1,
              borderTopColor: tournamentColors.borderLight,
              backgroundColor: '#fafbfc',
            }}
          >
            <View style={{ gap: 8, marginTop: 10 }}>
              <MetaRow icon="📍" label={locationLabel} />
              {Boolean(startsAtLabel) && <MetaRow icon="📅" label={startsAtLabel} emphasis />}
              <MetaRow icon="👥" label={`Up to ${item.maxParticipants} players`} />
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
              {isHostTournament && (
                <DiscoverActionButton
                  label="Host dashboard"
                  onPress={() => onOpenTournamentDetail(item)}
                  variant="secondary"
                />
              )}
              <DiscoverActionButton label="Scoresheet" onPress={() => onOpenScoresheet(item)} variant="ghost" />
            </View>

            {item.registrationMode === 'inviteOnly' && !isHostTournament && (
              <View style={{ gap: 8 }}>
                <TextInput
                  style={tournamentUi.input}
                  placeholder="Enter invite code"
                  value={inviteCode}
                  onChangeText={onInviteCodeChange}
                  autoCapitalize="characters"
                />
                <DiscoverActionButton
                  label={tournamentValidation.isChecking ? 'Checking code…' : 'Validate invite code'}
                  onPress={() => onValidateInviteCode(item.id)}
                  disabled={tournamentValidation.isChecking}
                  variant="ghost"
                  fullWidth
                />
                {Boolean(tournamentValidation.message) && (
                  <Text
                    style={{
                      fontSize: 13,
                      color: tournamentValidation.valid ? tournamentColors.success : tournamentColors.error,
                    }}
                  >
                    {tournamentValidation.message}
                  </Text>
                )}
              </View>
            )}

            <DiscoverActionButton
              label={
                hasExistingRegistration
                  ? '✓ Registered'
                  : registrationState.isSubmitting
                  ? 'Sending request…'
                  : 'Request to join'
              }
              onPress={() => onRequestRegistration(item)}
              disabled={hasExistingRegistration || !requestEnabled || registrationState.isSubmitting}
              fullWidth
            />

            
            {hasExistingRegistration && (
              <Text style={{ fontSize: 13, color: tournamentColors.success, fontWeight: '600' }}>
                Your status: {existingRegistrationStatus}
              </Text>
            )}
            {!requestEnabled && !hasExistingRegistration && (
              <Text style={{ fontSize: 13, color: tournamentColors.error, lineHeight: 18 }}>
                {item.registrationStatus !== 'open'
                  ? 'Registration is closed for this tournament.'
                  : item.registrationMode === 'inviteOnly'
                  ? 'Validate your invite code above to unlock registration.'
                  : 'Registration is not available right now.'}
              </Text>
            )}
          </View>
        </Animated.View>
      </CardBody>
    </CardShell>
  );
}

export function HomeScreen({ navigation, route }) {
  const { currentUser, isAuthenticated } = useAuth();
  const { requireAuth, authPromptProps } = useRequireAuth(navigation);
  const queryClient = useQueryClient();
  const { scrollPaddingBottom } = useScreenInsets();
  const { contentMaxWidth, horizontalPadding } = useResponsiveLayout();
  const [filterId, setFilterId] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearchQuery, setDebouncedSearchQuery] = useState('');
  const [sortId, setSortId] = useState('newest');
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const filtersPanelAnimation = useRef(new Animated.Value(0)).current;
  const [inviteCodeByTournamentId, setInviteCodeByTournamentId] = useState({});
  const [validationByTournamentId, setValidationByTournamentId] = useState({});
  const [registrationByTournamentId, setRegistrationByTournamentId] = useState({});
  const [expandedTournamentId, setExpandedTournamentId] = useState(null);
  const expansionAnimationByIdRef = useRef({});
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const {
    data: discoveryData,
    error: discoveryQueryError,
    isLoading: isLoadingDiscovery,
    isFetching: isFetchingDiscovery,
    refetch: refetchDiscovery,
  } = useDiscoverTournaments({
    page,
    pageSize,
    sort: sortId,
    q: debouncedSearchQuery,
  });

  const discoveryItems = discoveryData?.items ?? [];
  const discoveryMeta = discoveryData?.pagination ?? null;
  const discoveryError = discoveryQueryError
    ? `${discoveryQueryError.code || 'ERROR'} - ${discoveryQueryError.message || 'Unable to load tournaments'}`
    : '';
  const isRefreshing = isFetchingDiscovery && !isLoadingDiscovery;
  const highlightTournamentId = route.params?.highlightTournamentId || null;
  const highlightBlinkAnimation = useRef(new Animated.Value(0)).current;
  const highlightBlinkLoopRef = useRef(null);
  const skeletonPulse = useRef(new Animated.Value(0)).current;

  const getExpansionAnimation = useCallback((tournamentId) => {
    if (!expansionAnimationByIdRef.current[tournamentId]) {
      expansionAnimationByIdRef.current[tournamentId] = new Animated.Value(0);
    }

    return expansionAnimationByIdRef.current[tournamentId];
  }, []);

  const runExpansionAnimation = useCallback(
    (tournamentId, toValue) => {
      const animationValue = getExpansionAnimation(tournamentId);
      animationValue.stopAnimation();
      Animated.timing(animationValue, {
        toValue,
        duration: 360,
        easing: Easing.bezier(0.22, 1, 0.36, 1),
        useNativeDriver: false,
      }).start();
    },
    [getExpansionAnimation]
  );

  useEffect(() => {
    if (!route.params?.filterId) {
      return;
    }

    setFilterId(route.params.filterId);
    navigation.setParams({ filterId: undefined });
  }, [navigation, route.params?.filterId]);

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(skeletonPulse, { toValue: 1, duration: 700, useNativeDriver: false }),
        Animated.timing(skeletonPulse, { toValue: 0, duration: 700, useNativeDriver: false }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [skeletonPulse]);

  useEffect(() => {
    const debounceMs = searchQuery.trim() ? SEARCH_DEBOUNCE_MS : 0;
    const timerId = setTimeout(() => {
      setDebouncedSearchQuery(searchQuery.trim());
      setPage(1);
    }, debounceMs);

    return () => clearTimeout(timerId);
  }, [searchQuery]);

  useEffect(() => {
    setPage(1);
  }, [sortId]);

  useFocusEffect(
    useCallback(() => {
      if (route.params?.highlightTournamentId) {
        setPage(1);
        setFilterId('all');
      }
    }, [route.params?.highlightTournamentId])
  );

  const getRequestEnabled = useCallback(
    (item) => {
      const isHostTournament = String(item.hostUserId) === String(currentUser?.id);

      if (item.registrationStatus !== 'open') {
        return false;
      }

      if (isHostTournament) {
        return true;
      }

      if (item.registrationMode === 'public') {
        return true;
      }

      return validationByTournamentId[item.id]?.requestEnabled === true;
    },
    [currentUser?.id, validationByTournamentId]
  );

  useEffect(() => {
    if (!highlightTournamentId) {
      return undefined;
    }

    const highlightedItemExists = discoveryItems.some((item) => item.id === highlightTournamentId);

    if (!highlightedItemExists) {
      return undefined;
    }

    setExpandedTournamentId(highlightTournamentId);
    runExpansionAnimation(highlightTournamentId, 1);

    highlightBlinkAnimation.setValue(0);
    highlightBlinkLoopRef.current = Animated.loop(
      Animated.sequence([
        Animated.timing(highlightBlinkAnimation, {
          toValue: 1,
          duration: 500,
          useNativeDriver: false,
        }),
        Animated.timing(highlightBlinkAnimation, {
          toValue: 0,
          duration: 500,
          useNativeDriver: false,
        }),
      ])
    );
    highlightBlinkLoopRef.current.start();

    const stopTimerId = setTimeout(() => {
      highlightBlinkLoopRef.current?.stop();
      highlightBlinkAnimation.setValue(0);
      navigation.setParams({ highlightTournamentId: undefined });
    }, HIGHLIGHT_BLINK_DURATION_MS);

    return () => {
      clearTimeout(stopTimerId);
      highlightBlinkLoopRef.current?.stop();
    };
  }, [discoveryItems, highlightBlinkAnimation, highlightTournamentId, navigation, runExpansionAnimation]);

  const onValidateInviteCode = useCallback(
    async (tournamentId) => {
      try {
        setValidationByTournamentId((previousState) => ({
          ...previousState,
          [tournamentId]: {
            ...(previousState[tournamentId] || {}),
            isChecking: true,
            message: '',
          },
        }));

        const inviteCode = inviteCodeByTournamentId[tournamentId] || '';
        const response = await validateTournamentInviteCode(tournamentId, inviteCode);

        setValidationByTournamentId((previousState) => ({
          ...previousState,
          [tournamentId]: {
            ...(previousState[tournamentId] || {}),
            isChecking: false,
            valid: response.valid,
            requestEnabled: response.requestEnabled,
            message:
              response.reason === 'INVITE_CODE_VALID'
                ? 'Invite code accepted — you can register now.'
                : response.reason === 'REGISTRATION_CLOSED'
                ? 'Registration is closed for this tournament.'
                : 'That invite code did not match.',
          },
        }));
      } catch (error) {
        setValidationByTournamentId((previousState) => ({
          ...previousState,
          [tournamentId]: {
            ...(previousState[tournamentId] || {}),
            isChecking: false,
            valid: false,
            requestEnabled: false,
            message: `${error.code || 'ERROR'} - ${error.message || 'Unable to validate invite code'}`,
          },
        }));
      }
    },
    [inviteCodeByTournamentId]
  );

  const submitRegistrationRequest = useCallback(
    async (item) => {
      try {
        setRegistrationByTournamentId((previousState) => ({
          ...previousState,
          [item.id]: {
            ...(previousState[item.id] || {}),
            isSubmitting: true,
            message: '',
            status: null,
          },
        }));

        const inviteCode = inviteCodeByTournamentId[item.id] || '';
        const payload = item.registrationMode === 'inviteOnly' ? { inviteCode } : {};

        const response = await submitTournamentRegistrationRequest(item.id, payload);

        setRegistrationByTournamentId((previousState) => ({
          ...previousState,
          [item.id]: {
            ...(previousState[item.id] || {}),
            isSubmitting: false,
            message: `Request sent — status: ${response.status}`,
            status: response.status,
          },
        }));
        await queryClient.invalidateQueries({ queryKey: ['discover'] });
      } catch (error) {
        setRegistrationByTournamentId((previousState) => ({
          ...previousState,
          [item.id]: {
            ...(previousState[item.id] || {}),
            isSubmitting: false,
            message: `${error.code || 'ERROR'} - ${error.message || 'Unable to submit registration request'}`,
            status: null,
          },
        }));
      }
    },
    [inviteCodeByTournamentId, queryClient]
  );

  const onRequestRegistration = useCallback(
    (item) => {
      requireAuth(() => submitRegistrationRequest(item), {
        message: 'Sign in to request a spot in this tournament.',
        returnTo: { screen: 'Home', params: { highlightTournamentId: item.id } },
      });
    },
    [requireAuth, submitRegistrationRequest]
  );

  const onToggleExpand = useCallback(
    (tournamentId) => {
      setExpandedTournamentId((previousId) => {
        if (previousId === tournamentId) {
          runExpansionAnimation(tournamentId, 0);
          return null;
        }

        if (previousId) {
          runExpansionAnimation(previousId, 0);
        }

        runExpansionAnimation(tournamentId, 1);
        return tournamentId;
      });
    },
    [runExpansionAnimation]
  );

  const onOpenTournamentDetail = useCallback(
    (item) => {
      requireAuth(
        () => {
          navigation.navigate('TournamentDetail', {
            tournamentId: item.id,
            tournamentName: item.name,
          });
        },
        {
          message: 'Sign in to open the host dashboard.',
          returnTo: { screen: 'Home', params: { highlightTournamentId: item.id } },
        }
      );
    },
    [navigation, requireAuth]
  );

  const onOpenScoresheet = useCallback(
    (item) => {
      navigation.navigate('Scoresheet', {
        tournamentId: item.id,
        tournamentName: item.name,
      });
    },
    [navigation]
  );

  const onCreateTournament = useCallback(() => {
    requireAuth(() => navigation.navigate('CreateTournament'), {
      message: 'Sign in to host a tournament.',
      returnTo: { screen: 'Home' },
    });
  }, [navigation, requireAuth]);

  const onFilterChange = useCallback(
    (nextFilterId) => {
      if (nextFilterId === 'mine' && !isAuthenticated) {
        requireAuth(undefined, {
          message: 'Sign in to see tournaments you host.',
          returnTo: { screen: 'Home', params: { filterId: 'mine' } },
        });
        return;
      }

      setFilterId(nextFilterId);
    },
    [isAuthenticated, requireAuth]
  );

  const onPageSizeChange = useCallback((size) => {
    setPageSize(size);
    setPage(1);
  }, []);

  const onPageChange = useCallback((nextPage) => {
    setPage(nextPage);
  }, []);

  const onToggleFiltersPanel = useCallback(() => {
    const nextExpanded = !filtersExpanded;
    setFiltersExpanded(nextExpanded);
    filtersPanelAnimation.stopAnimation();
    Animated.timing(filtersPanelAnimation, {
      toValue: nextExpanded ? 1 : 0,
      duration: 320,
      easing: Easing.bezier(0.22, 1, 0.36, 1),
      useNativeDriver: false,
    }).start();
  }, [filtersExpanded, filtersPanelAnimation]);

  const activeFilterCount = useMemo(
    () => countActiveFilters({ searchQuery, sortId, filterId, pageSize }),
    [filterId, pageSize, searchQuery, sortId]
  );

  const stats = useMemo(() => {
    const openCount = discoveryItems.filter((item) => item.registrationStatus === 'open').length;
    const myCount = discoveryItems.filter(
      (item) => String(item.hostUserId) === String(currentUser?.id)
    ).length;

    return { openCount, myCount };
  }, [currentUser?.id, discoveryItems]);

  const filteredItems = useMemo(() => {
    if (filterId === 'open') {
      return discoveryItems.filter((item) => item.registrationStatus === 'open');
    }

    if (filterId === 'mine') {
      return discoveryItems.filter((item) => String(item.hostUserId) === String(currentUser?.id));
    }

    return discoveryItems;
  }, [currentUser?.id, discoveryItems, filterId]);

  const totalCount = discoveryMeta?.total ?? discoveryItems.length;
  const totalPages = discoveryMeta?.totalPages ?? 1;

  return (
    <>
    <ScrollView
      style={tournamentUi.screen}
      contentContainerStyle={[
        { padding: horizontalPadding, paddingBottom: scrollPaddingBottom },
        centeredContentStyle(contentMaxWidth),
      ]}
      removeClippedSubviews={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={() => refetchDiscovery()}
          tintColor={tournamentColors.primary}
        />
      }
    >
      <View style={{ marginBottom: 16 }}>
        <DiscoverHero
          total={totalCount}
          openCount={stats.openCount}
          myCount={stats.myCount}
          onCreate={onCreateTournament}
        />
      </View>

      <View style={{ marginBottom: 16 }}>
        <DiscoverFiltersPanel
          expanded={filtersExpanded}
          onToggle={onToggleFiltersPanel}
          panelAnimation={filtersPanelAnimation}
          activeFilterCount={activeFilterCount}
          searchQuery={searchQuery}
          sortId={sortId}
          filterId={filterId}
          pageSize={pageSize}
          isRefreshing={isRefreshing || isLoadingDiscovery}
          onRefresh={() => refetchDiscovery()}
          onSearchQueryChange={setSearchQuery}
          onClearSearch={() => setSearchQuery('')}
          onSortChange={setSortId}
          onFilterChange={onFilterChange}
          onPageSizeChange={onPageSizeChange}
        />
      </View>

      {Boolean(discoveryError) && (
        <View
          style={{
            marginBottom: 16,
            padding: 14,
            borderRadius: 12,
            backgroundColor: '#fef2f2',
            borderWidth: 1,
            borderColor: '#fecaca',
            flexDirection: 'row',
            gap: 10,
            alignItems: 'center',
          }}
        >
          <Text style={{ fontSize: 18 }}>⚠️</Text>
          <Text style={{ flex: 1, color: tournamentColors.error, fontSize: 13, lineHeight: 18 }}>{discoveryError}</Text>
        </View>
      )}

      {isLoadingDiscovery && discoveryItems.length === 0 ? (
        <LoadingPlaceholder pulse={skeletonPulse} />
      ) : filteredItems.length === 0 ? (
        <EmptyDiscoverState
          onCreate={onCreateTournament}
          filterId={filterId}
          searchQuery={searchQuery}
        />
      ) : (
        <View>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 12,
            }}
          >
            <Text style={{ fontSize: 16, fontWeight: '800', color: tournamentColors.text }}>Tournaments</Text>
            <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>
              {filteredItems.length} shown
            </Text>
          </View>

          {filteredItems.map((item, index) => {
            const tournamentValidation = validationByTournamentId[item.id] || {};
            const registrationState = registrationByTournamentId[item.id] || {};
            const existingRegistrationStatus =
              registrationState.status || item.currentUserRegistrationStatus || null;
            const hasExistingRegistration = Boolean(existingRegistrationStatus);
            const requestEnabled = getRequestEnabled(item);
            const isHostTournament = String(item.hostUserId) === String(currentUser?.id);
            const isExpanded = expandedTournamentId === item.id;
            const isHighlighted = item.id === highlightTournamentId;

            return (
              <View key={item.id} style={{ marginBottom: index === filteredItems.length - 1 ? 0 : 12 }}>
              <DiscoverTournamentCard
                item={item}
                isExpanded={isExpanded}
                isHighlighted={isHighlighted}
                isHostTournament={isHostTournament}
                highlightBlinkAnimation={highlightBlinkAnimation}
                expansionAnimation={getExpansionAnimation(item.id)}
                inviteCode={inviteCodeByTournamentId[item.id] || ''}
                onInviteCodeChange={(value) =>
                  setInviteCodeByTournamentId((previousState) => ({
                    ...previousState,
                    [item.id]: value,
                  }))
                }
                tournamentValidation={tournamentValidation}
                registrationState={registrationState}
                hasExistingRegistration={hasExistingRegistration}
                existingRegistrationStatus={existingRegistrationStatus}
                requestEnabled={requestEnabled}
                onToggleExpand={onToggleExpand}
                onOpenTournamentDetail={onOpenTournamentDetail}
                onOpenScoresheet={onOpenScoresheet}
                onValidateInviteCode={onValidateInviteCode}
                onRequestRegistration={onRequestRegistration}
              />
              </View>
            );
          })}
        </View>
      )}

      <View style={{ marginTop: 16 }}>
        <PaginationBar page={page} totalPages={totalPages} onPageChange={onPageChange} />
      </View>

      {isLoadingDiscovery && discoveryItems.length > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            paddingVertical: 12,
            marginTop: 8,
          }}
        >
          <ActivityIndicator color={tournamentColors.primary} size="small" />
          <Text style={{ color: tournamentColors.textMuted, fontSize: 13, fontWeight: '600' }}>Updating…</Text>
        </View>
      )}
    </ScrollView>
    <AuthPromptModal {...authPromptProps} />
    </>
  );
}
