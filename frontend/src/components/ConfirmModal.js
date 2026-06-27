import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { AppIcon } from './ui/AppIcon';
import { discoverUi, tournamentColors, tournamentUi } from '../styles/tournamentUi';

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
  const iconBg = confirmVariant === 'danger' ? '#fef2f2' : '#eff4ff';

  return (
    <Modal animationType="fade" transparent visible={Boolean(visible)} onRequestClose={onCancel}>
      <View style={tournamentUi.modalOverlay}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={isLoading ? undefined : onCancel} />
        <View style={[discoverUi.surfaceCard, { marginHorizontal: 4 }]}>
          {Boolean(icon) && (
            <View
              style={{
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: iconBg,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 10,
              }}
            >
              <AppIcon name={icon} size={26} color={iconColor} />
            </View>
          )}
          {Boolean(title) && (
            <Text style={{ fontSize: 18, fontWeight: '800', color: tournamentColors.text, marginBottom: 8 }}>
              {title}
            </Text>
          )}
          {Boolean(message) && (
            <Text style={{ fontSize: 14, lineHeight: 20, color: tournamentColors.textMuted, marginBottom: 16 }}>
              {message}
            </Text>
          )}
          <View style={{ flexDirection: 'row', gap: 10 }}>
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
