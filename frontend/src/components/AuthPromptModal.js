import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { AppIcon } from './ui/AppIcon';
import { discoverUi, tournamentColors, tournamentUi } from '../styles/tournamentUi';

export function AuthPromptModal({
  visible,
  title = 'Sign in required',
  message = 'Sign in or create an account to continue.',
  onSignIn,
  onSignUp,
  onCancel,
}) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(visible)} onRequestClose={onCancel}>
      <View style={tournamentUi.modalOverlay}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={onCancel} />
        <View style={[discoverUi.surfaceCard, { marginHorizontal: 4 }]}>
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: '#eff4ff',
              alignItems: 'center',
              justifyContent: 'center',
              marginBottom: 10,
            }}
          >
            <AppIcon name="secure" size={28} color={tournamentColors.primary} />
          </View>
          <Text style={{ fontSize: 18, fontWeight: '800', color: tournamentColors.text, marginBottom: 8 }}>
            {title}
          </Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: tournamentColors.textMuted, marginBottom: 16 }}>
            {message}
          </Text>
          <View style={{ gap: 10 }}>
            <ActionButton label="Sign in" onPress={onSignIn} variant="primary" fullWidth />
            <ActionButton label="Create account" onPress={onSignUp} variant="ghost" fullWidth />
            <ActionButton label="Cancel" onPress={onCancel} variant="ghost" fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}
