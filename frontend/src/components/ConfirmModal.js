import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { AppIcon } from './ui/AppIcon';
import { useTypography } from '../context/TypographyContext';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { getWebModalStyles } from '../utils/modalStyles';

export function ConfirmModal({
  visible,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  isLoading = false,
  confirmVariant = 'primary',
  icon,
}) {
  const { width } = useTypography();
  const webModal = getWebModalStyles(width);
  const iconColor = confirmVariant === 'danger' ? tournamentColors.error : tournamentColors.primary;
  const iconTone = confirmVariant === 'danger' ? 'danger' : 'primary';

  return (
    <Modal animationType="fade" transparent visible={Boolean(visible)} onRequestClose={onCancel}>
      <View style={[tournamentUi.modalOverlay, webModal?.overlay]}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={isLoading ? undefined : onCancel} />
        <View style={[tournamentUi.modalCard, webModal?.card]}>
          {Boolean(icon) && (
            <View style={[tournamentUi.modalIconWrap(iconTone), webModal?.iconWrap]}>
              <AppIcon name={icon} size={webModal?.iconSize || 26} color={iconColor} />
            </View>
          )}
          {Boolean(title) && <Text style={[tournamentUi.modalTitle, webModal?.title]}>{title}</Text>}
          {Boolean(message) && <Text style={[tournamentUi.modalMessage, webModal?.message]}>{message}</Text>}
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
            <View style={{ flex: 1 }}>
              <ActionButton label={cancelLabel} onPress={onCancel} disabled={isLoading} variant="ghost" fullWidth />
            </View>
            <View style={{ flex: 1 }}>
              <ActionButton
                label={isLoading ? 'Working…' : confirmLabel}
                onPress={onConfirm}
                disabled={isLoading}
                variant={confirmVariant}
                fullWidth
              />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
