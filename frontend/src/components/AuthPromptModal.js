import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { AppIcon } from './ui/AppIcon';
import { useTypography } from '../context/TypographyContext';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { getWebModalStyles } from '../utils/modalStyles';

export function AuthPromptModal({
  visible,
  title = 'Sign in required',
  message = 'Sign in or create an account to continue.',
  onSignIn,
  onSignUp,
  onCancel,
}) {
  const { width } = useTypography();
  const webModal = getWebModalStyles(width);

  return (
    <Modal animationType="fade" transparent visible={Boolean(visible)} onRequestClose={onCancel}>
      <View style={[tournamentUi.modalOverlay, webModal?.overlay]}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={onCancel} />
        <View style={[tournamentUi.modalCard, webModal?.card]}>
          <View style={[tournamentUi.modalIconWrap('primary'), webModal?.iconWrap]}>
            <AppIcon name="secure" size={webModal?.iconSize || 28} color={tournamentColors.primary} />
          </View>
          <Text style={[tournamentUi.modalTitle, webModal?.title]}>{title}</Text>
          <Text style={[tournamentUi.modalMessage, webModal?.message]}>{message}</Text>
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
