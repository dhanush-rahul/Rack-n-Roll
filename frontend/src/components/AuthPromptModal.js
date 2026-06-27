import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { AppIcon } from './ui/AppIcon';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';

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
        <View style={tournamentUi.modalCard}>
          <View style={tournamentUi.modalIconWrap('primary')}>
            <AppIcon name="secure" size={28} color={tournamentColors.primary} />
          </View>
          <Text style={tournamentUi.modalTitle}>{title}</Text>
          <Text style={tournamentUi.modalMessage}>{message}</Text>
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
