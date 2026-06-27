import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { AppIcon } from './ui/AppIcon';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';

export function FeedbackModal({ visible, title, message, onDismiss, icon = 'help' }) {
  const displayMessage = String(message || '').trim();
  const displayTitle = String(title || '').trim();

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
            <View
              style={{
                alignSelf: 'center',
                width: 52,
                height: 52,
                borderRadius: 26,
                backgroundColor: '#eff4ff',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <AppIcon name={icon} size={28} color={tournamentColors.primary} />
            </View>
          )}
          {Boolean(displayTitle) && <Text style={tournamentUi.modalTitle}>{displayTitle}</Text>}
          {Boolean(displayMessage) && (
            <Text style={[tournamentUi.modalMessage, { color: '#000000' }]}>{displayMessage}</Text>
          )}
          <Pressable
            onPress={onDismiss}
            style={({ pressed }) => [
              tournamentUi.primaryButton,
              {
                width: '50%',
                alignSelf: 'center',
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            <Text style={tournamentUi.primaryButtonText}>Sure!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
