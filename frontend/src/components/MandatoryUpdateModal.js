import React from 'react';
import { Modal, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ActionButton } from './tournament/TournamentChrome';
import { AppIcon } from './ui/AppIcon';
import { useTypography } from '../context/TypographyContext';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { getWebModalStyles } from '../utils/modalStyles';

export function MandatoryUpdateModal({ visible, title, message, confirmLabel = 'Update now', onConfirm }) {
  const { width } = useTypography();
  const webModal = getWebModalStyles(width);

  return (
    <Modal animationType="fade" transparent visible={Boolean(visible)} onRequestClose={() => {}}>
      <View style={[tournamentUi.modalOverlay, webModal?.overlay]}>
        <View style={[tournamentUi.modalCard, webModal?.card]}>
          <View style={[tournamentUi.modalIconWrap('primary'), webModal?.iconWrap]}>
            <AppIcon name="download" size={webModal?.iconSize || 26} color={tournamentColors.primary} />
          </View>
          <Text style={[tournamentUi.modalTitle, webModal?.title]}>{title}</Text>
          <Text style={[tournamentUi.modalMessage, webModal?.message]}>{message}</Text>
          <ActionButton label={confirmLabel} onPress={onConfirm} fullWidth />
        </View>
      </View>
    </Modal>
  );
}
