import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { AppIcon } from './ui/AppIcon';
import { useTypography } from '../context/TypographyContext';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { getWebModalStyles } from '../utils/modalStyles';

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
  const { width } = useTypography();
  const webModal = getWebModalStyles(width);

  return (
    <Modal
      animationType="fade"
      transparent
      visible={Boolean(visible)}
      onRequestClose={onDismiss}
    >
      <View style={[tournamentUi.modalOverlay, webModal?.overlay]}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={onDismiss} />
        <View style={[tournamentUi.modalCard, webModal?.card]}>
          {Boolean(icon) && (
            <View style={[tournamentUi.modalIconWrap(iconTone), webModal?.iconWrap]}>
              <AppIcon
                name={icon}
                size={webModal?.iconSize || 28}
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
          {Boolean(displayTitle) && <Text style={[tournamentUi.modalTitle, webModal?.title]}>{displayTitle}</Text>}
          {Boolean(displayMessage) && (
            <Text style={[tournamentUi.modalMessage, webModal?.message]}>{displayMessage}</Text>
          )}
          <View style={{ marginTop: 4 }}>
            <ActionButton label={dismissLabel} onPress={onDismiss} fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}
