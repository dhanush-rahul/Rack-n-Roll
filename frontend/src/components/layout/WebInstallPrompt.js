import React from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { AppIcon } from '../ui/AppIcon';
import { ActionButton } from '../tournament/TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';
import { useWebInstallPrompt } from '../../hooks/useWebInstallPrompt';

export function WebInstallPrompt() {
  const {
    isVisible,
    canPromptInstall,
    showManualIosInstructions,
    promptInstall,
    dismiss,
  } = useWebInstallPrompt();

  if (Platform.OS !== 'web' || !isVisible) {
    return null;
  }

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
            Install Rack n Roll
          </Text>
          <Text style={{ marginTop: 4, fontSize: 13, lineHeight: 18, color: tournamentColors.textMuted }}>
            {showManualIosInstructions
              ? 'On iPhone or iPad: tap Share, then Add to Home Screen for quick access like a native app.'
              : 'Add this app to your home screen or pin it in your browser for one-tap access to tournaments and scores.'}
          </Text>
        </View>
        <Pressable onPress={dismiss} accessibilityRole="button" accessibilityLabel="Dismiss install prompt">
          <AppIcon name="close" size={18} color={tournamentColors.textMuted} />
        </Pressable>
      </View>

      {canPromptInstall ? (
        <ActionButton label="Add to home screen" onPress={promptInstall} fullWidth />
      ) : null}

      <ActionButton label="Not now" onPress={dismiss} variant="ghost" fullWidth />
    </View>
  );
}
