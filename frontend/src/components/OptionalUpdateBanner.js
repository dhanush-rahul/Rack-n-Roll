import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { AppIcon } from './ui/AppIcon';
import { ActionButton } from './tournament/TournamentChrome';
import { tournamentColors } from '../styles/tournamentUi';

export function OptionalUpdateBanner({
  message,
  latestVersion,
  primaryLabel = 'Update',
  onPrimaryPress,
  onDismiss,
  secondaryLabel,
  onSecondaryPress,
}) {
  return (
    <View
      style={{
        marginBottom: 14,
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#bfdbfe',
        backgroundColor: '#eff6ff',
        gap: 10,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <AppIcon name="download" size={22} color={tournamentColors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 15, fontWeight: '800', color: tournamentColors.text }}>
            Update available
            {latestVersion ? ` (${latestVersion})` : ''}
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: tournamentColors.textMuted }}>
            {message}
          </Text>
        </View>
        {onDismiss ? (
          <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss update prompt">
            <AppIcon name="close" size={18} color={tournamentColors.textMuted} />
          </Pressable>
        ) : null}
      </View>

      <View style={{ flexDirection: Platform.OS === 'web' ? 'row' : 'column', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ActionButton label={primaryLabel} onPress={onPrimaryPress} fullWidth />
        </View>
        {secondaryLabel && onSecondaryPress ? (
          <View style={{ flex: 1 }}>
            <ActionButton label={secondaryLabel} onPress={onSecondaryPress} variant="ghost" fullWidth />
          </View>
        ) : null}
        {onDismiss ? (
          <View style={{ flex: 1 }}>
            <ActionButton label="Not now" onPress={onDismiss} variant="ghost" fullWidth />
          </View>
        ) : null}
      </View>
    </View>
  );
}
