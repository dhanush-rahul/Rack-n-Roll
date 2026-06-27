import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { AppIcon } from './ui/AppIcon';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';

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
  const iconColor = confirmVariant === 'danger' ? tournamentColors.error : tournamentColors.primary;
  const iconTone = confirmVariant === 'danger' ? 'danger' : 'primary';

  return (
    <Modal animationType="fade" transparent visible={Boolean(visible)} onRequestClose={onCancel}>
      <View style={tournamentUi.modalOverlay}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={isLoading ? undefined : onCancel} />
        <View style={tournamentUi.modalCard}>
          {Boolean(icon) && (
            <View style={tournamentUi.modalIconWrap(iconTone)}>
              <AppIcon name={icon} size={26} color={iconColor} />
            </View>
          )}
          {Boolean(title) && <Text style={tournamentUi.modalTitle}>{title}</Text>}
          {Boolean(message) && <Text style={tournamentUi.modalMessage}>{message}</Text>}
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
