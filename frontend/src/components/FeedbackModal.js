import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { AppIcon } from './ui/AppIcon';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';

const iconToneFor = (icon) => {
  if (icon === 'celebrate' || icon === 'success') {
    return 'success';
  }

  if (icon === 'error' || icon === 'warning') {
    return 'danger';
  }

  return 'primary';
};

export function FeedbackModal({
  visible,
  title,
  message,
  onDismiss,
  icon = 'help',
  dismissLabel = 'Got it',
}) {
  const displayMessage = String(message || '').trim();
  const displayTitle = String(title || '').trim();
  const iconTone = iconToneFor(icon);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(visible)}
      onRequestClose={onDismiss}
    >
      <View style={tournamentUi.modalOverlay}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={onDismiss} />
        <View style={tournamentUi.modalCard}>
          {Boolean(icon) && (
            <View style={tournamentUi.modalIconWrap(iconTone)}>
              <AppIcon
                name={icon}
                size={28}
                color={
                  iconTone === 'success'
                    ? tournamentColors.success
                    : iconTone === 'danger'
                      ? tournamentColors.error
                      : tournamentColors.primary
                }
              />
            </View>
          )}
          {Boolean(displayTitle) && <Text style={tournamentUi.modalTitle}>{displayTitle}</Text>}
          {Boolean(displayMessage) && (
            <Text style={tournamentUi.modalMessage}>{displayMessage}</Text>
          )}
          <View style={{ marginTop: 4 }}>
            <ActionButton label={dismissLabel} onPress={onDismiss} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}
