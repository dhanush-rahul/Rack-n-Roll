import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { AppIcon } from '../ui/AppIcon';
import { CollapsibleSectionCard } from '../tournament/chrome/SectionCard';
import { discoverUi, tournamentColors } from '../../styles/tournamentUi';

const formatStartsAt = (value) => {
  if (!value) return 'Start date TBD';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Start date TBD';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatLocation = (location) => {
  if (!location) return 'Location TBD';
  return location.formattedAddress || location.city || 'Location TBD';
};

const getTournamentMonogram = (name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
};

const registrationStatusLabel = (status) => {
  if (status === 'approved') return { label: 'Registered', tone: 'success' };
  if (status === 'underReview') return { label: 'Pending approval', tone: 'warning' };
  return { label: 'Registered', tone: 'neutral' };
};

const badgePalette = {
  neutral: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
  success: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
  warning: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
};

function StatusBadge({ status }) {
  const { label, tone } = registrationStatusLabel(status);
  const palette = badgePalette[tone];

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

function RegisteredTournamentRow({ item, onPress }) {
  const accentColor = tournamentColors.primary;

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => ({
        opacity: pressed ? 0.92 : 1,
        borderTopWidth: 1,
        borderTopColor: tournamentColors.borderLight,
      })}
      accessibilityRole="button"
      accessibilityLabel={`Open ${item.name} scoresheet`}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 }}>
        <View style={[discoverUi.monogram, { backgroundColor: `${accentColor}18` }]}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: accentColor }}>
            {getTournamentMonogram(item.name)}
          </Text>
        </View>

        <View style={{ flex: 1, gap: 6 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
            <Text
              style={{ flex: 1, fontSize: 15, fontWeight: '800', color: tournamentColors.text, lineHeight: 20 }}
              numberOfLines={2}
            >
              {item.name}
            </Text>
            <StatusBadge status={item.currentUserRegistrationStatus} />
          </View>

          <View style={discoverUi.metaRow}>
            <View style={discoverUi.metaIcon}>
              <AppIcon name="calendar" size={15} color={tournamentColors.textMuted} />
            </View>
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: tournamentColors.text, fontWeight: '600' }}>
              {formatStartsAt(item.startsAt)}
            </Text>
          </View>

          <View style={discoverUi.metaRow}>
            <View style={discoverUi.metaIcon}>
              <AppIcon name="location" size={15} color={tournamentColors.textMuted} />
            </View>
            <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: tournamentColors.textMuted }} numberOfLines={1}>
              {formatLocation(item.location)}
            </Text>
          </View>
        </View>

        <AppIcon name="chevronRight" size={18} color={tournamentColors.textMuted} />
      </View>
    </Pressable>
  );
}

export function DiscoverRegisteredSection({ items, isLoading, errorMessage, onOpenScoresheet }) {
  const countLabel = items.length === 1 ? '1 tournament' : `${items.length} tournaments`;
  const subtitle = isLoading
    ? 'Loading your registrations…'
    : items.length > 0
      ? `${countLabel} · sorted by start date (newest first)`
      : 'Tournaments you have signed up for will appear here.';

  return (
    <CollapsibleSectionCard
      title="Your registrations"
      subtitle={subtitle}
      defaultExpanded={false}
    >
      {isLoading && items.length === 0 ? (
        <View style={{ alignItems: 'center', paddingVertical: 16 }}>
          <ActivityIndicator color={tournamentColors.primary} />
        </View>
      ) : null}

      {Boolean(errorMessage) && (
        <View
          style={{
            padding: 12,
            borderRadius: 12,
            backgroundColor: '#fef2f2',
            borderWidth: 1,
            borderColor: '#fecaca',
            flexDirection: 'row',
            gap: 8,
            alignItems: 'center',
          }}
        >
          <AppIcon name="warning" size={16} color={tournamentColors.error} />
          <Text style={{ flex: 1, fontSize: 13, lineHeight: 18, color: tournamentColors.error }}>{errorMessage}</Text>
        </View>
      )}

      {!isLoading && items.length === 0 && !errorMessage ? (
        <View style={{ alignItems: 'center', paddingVertical: 8, gap: 6 }}>
          <AppIcon name="registration" size={28} color={tournamentColors.textMuted} />
          <Text style={{ fontSize: 14, lineHeight: 20, color: tournamentColors.textMuted, textAlign: 'center' }}>
            You have not registered for any tournaments yet.
          </Text>
        </View>
      ) : null}

      {items.length > 0 ? (
        <View style={[discoverUi.listCard, { borderWidth: 0, shadowOpacity: 0, elevation: 0 }]}>
          {items.map((item) => (
            <RegisteredTournamentRow key={item.id} item={item} onPress={onOpenScoresheet} />
          ))}
        </View>
      ) : null}
    </CollapsibleSectionCard>
  );
}
