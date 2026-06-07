import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
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
  emoji,
}) {
  return (
    <Modal animationType="fade" transparent visible={Boolean(visible)} onRequestClose={onCancel}>
      <View style={tournamentUi.modalOverlay}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={isLoading ? undefined : onCancel} />
        <View style={[discoverUi.surfaceCard, { marginHorizontal: 4 }]}>
          {Boolean(emoji) && <Text style={{ fontSize: 32, marginBottom: 8 }}>{emoji}</Text>}
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
