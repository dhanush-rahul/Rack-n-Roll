import React from 'react';
import { Animated, Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';
import { AppIcon } from '../ui/AppIcon';
import { discoverUi, tournamentColors, tournamentUi } from '../../styles/tournamentUi';

const EXPANDED_SECTION_MAX_HEIGHT = 720;

const formatLocation = (location) => {
  if (!location) return 'Location TBD';
  return location.formattedAddress || location.city || 'Location TBD';
};

const formatStartsAt = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

const formatStartsAtRelative = (value) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const diffMs = date.getTime() - Date.now();
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  if (diffMs < -60 * 60 * 1000) return 'In progress';
  if (diffDays <= 0) return 'Starts today';
  if (diffDays === 1) return 'Starts tomorrow';
  if (diffDays < 7) return `Starts in ${diffDays} days`;
  return formatStartsAt(value);
};

const getTournamentMonogram = (name) => {
  const trimmed = String(name || '').trim();
  if (!trimmed) return '?';
  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return trimmed.slice(0, 2).toUpperCase();
};

const getAccentColor = (item, isHostTournament) => {
  if (isHostTournament) return tournamentColors.accentPurple;
  if (item.registrationMode === 'inviteOnly') return tournamentColors.accentAmber;
  return tournamentColors.primary;
};

function Badge({ label, tone = 'neutral' }) {
  const palette = {
    neutral: {
      bg: tournamentColors.statusNeutralBg,
      text: tournamentColors.statusNeutralText,
      border: tournamentColors.borderLight,
    },
    primary: {
      bg: tournamentColors.statusInfoBg,
      text: tournamentColors.statusInfoText,
      border: tournamentColors.primaryTint,
    },
    success: {
      bg: tournamentColors.statusSuccessBg,
      text: tournamentColors.statusSuccessText,
      border: tournamentColors.successBorder,
    },
    warning: {
      bg: tournamentColors.statusWarningBg,
      text: tournamentColors.statusWarningText,
      border: tournamentColors.warning,
    },
    host: {
      bg: tournamentColors.badgeHostBg,
      text: tournamentColors.badgeHostText,
      border: tournamentColors.badgeHostBorder,
    },
    new: {
      bg: tournamentColors.primarySoft,
      text: tournamentColors.liveAccent,
      border: tournamentColors.primaryTint,
    },
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
        <AppIcon name={icon} size={15} color={tournamentColors.textMuted} />
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

function DiscoverActionButton({ label, onPress, disabled, variant = 'primary', fullWidth = false, icon }) {
  const styles = {
    primary: {
      backgroundColor: disabled ? tournamentColors.primaryMuted : tournamentColors.primary,
      text: tournamentColors.onPrimary || '#ffffff',
      border: tournamentColors.primary,
    },
    secondary: {
      backgroundColor: tournamentColors.surfaceRaised,
      text: tournamentColors.primary,
      border: tournamentColors.primary,
    },
    ghost: {
      backgroundColor: tournamentColors.surfaceRaised,
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
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        {Boolean(icon) && <AppIcon name={icon} size={16} color={styles.text} />}
        <Text style={{ fontWeight: '700', fontSize: 14, color: styles.text }}>{label}</Text>
      </View>
    </Pressable>
  );
}

export function DiscoverTournamentCard({
  item,
  isExpanded,
  isHighlighted,
  isAuthenticated,
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
    borderColor: isExpanded ? tournamentColors.primaryTint : tournamentColors.borderLight,
  };

  const animatedShellStyle = isHighlighted
    ? {
        ...cardShellStyle,
        borderWidth: 2,
        borderColor: highlightBlinkAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [tournamentColors.primaryTint, tournamentColors.primary],
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
          outputRange: [tournamentColors.surface, tournamentColors.primarySoft],
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
                    backgroundColor: isExpanded ? tournamentColors.chipSelectedBg : tournamentColors.inputFill,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <AppIcon
                    name={isExpanded ? 'chevronUp' : 'chevronDown'}
                    size={16}
                    color={tournamentColors.primary}
                  />
                </View>
              </View>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {isHighlighted && <Badge label="Just launched" tone="new" />}
                {isHostTournament && <Badge label="Your event" tone="host" />}
                {item.registrationMode === 'inviteOnly' && <Badge label="Invite only" tone="warning" />}
                <Badge
                  label={item.registrationStatus === 'open' ? 'Open' : 'Closed'}
                  tone={item.registrationStatus === 'open' ? 'success' : 'neutral'}
                />
              </View>
            </View>
          </View>

          {!isExpanded && (
            <Text
              style={{ paddingLeft: 56, fontSize: 13, color: tournamentColors.textMuted }}
              numberOfLines={1}
            >
              {startsAtRelative ? `${startsAtRelative} · ` : ''}
              {locationLabel}
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
              backgroundColor: tournamentColors.surfaceAlt,
            }}
          >
            <View style={{ gap: 8, marginTop: 10 }}>
              <MetaRow icon="location" label={locationLabel} />
              {Boolean(startsAtLabel) && <MetaRow icon="calendar" label={startsAtLabel} emphasis />}
              <MetaRow icon="players" label={`Up to ${item.maxParticipants} players`} />
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

            {item.registrationMode === 'inviteOnly' && !isHostTournament && isAuthenticated && (
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
              icon={hasExistingRegistration ? 'check' : undefined}
              label={
                hasExistingRegistration
                  ? 'Registered'
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
                  : item.registrationMode === 'inviteOnly' && !isAuthenticated
                  ? 'Sign in to validate your invite code and register.'
                  : item.registrationMode === 'inviteOnly'
                  ? 'Validate your invite code above to unlock registration.'
                  : !isAuthenticated
                  ? 'Sign in to request a spot in this tournament.'
                  : 'Registration is not available right now.'}
              </Text>
            )}
          </View>
        </Animated.View>
      </CardBody>
    </CardShell>
  );
}
