import React, { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ScaledTextInput as TextInput } from './ui/ScaledTextInput';
import { ActionButton } from './tournament/TournamentChrome';
import { useTypography } from '../context/TypographyContext';
import { tournamentUi } from '../styles/tournamentUi';
import { getWebModalStyles } from '../utils/modalStyles';

export function AddGuestPlayerModal({ visible, onCancel, onSubmit, isLoading = false }) {
  const { width } = useTypography();
  const webModal = getWebModalStyles(width);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    if (!visible) {
      setName('');
      setEmail('');
    }
  }, [visible]);

  const handleSubmit = () => {
    onSubmit({ name: String(name || '').trim(), email: String(email || '').trim() });
  };

  return (
    <Modal animationType="fade" transparent visible={Boolean(visible)} onRequestClose={onCancel}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={[tournamentUi.modalOverlay, webModal?.overlay, { justifyContent: 'flex-end', paddingBottom: 0 }]}>
          <Pressable style={tournamentUi.modalBackdrop} onPress={isLoading ? undefined : onCancel} />
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              padding: webModal?.overlay?.padding ?? 20,
            }}
            bounces={false}
          >
            <View style={[tournamentUi.modalCard, webModal?.card, { gap: 12 }]}>
              <Text style={[tournamentUi.modalTitle, webModal?.title]}>Add player</Text>
              <Text style={[tournamentUi.modalMessage, webModal?.message, { textAlign: 'left' }]}>
                Enter the player&apos;s name and email. They can sign up later with this email to follow the tournament
                in the app.
              </Text>
              <TextInput
                style={tournamentUi.input}
                placeholder="Full name"
                value={name}
                onChangeText={setName}
                autoCapitalize="words"
                editable={!isLoading}
                returnKeyType="next"
              />
              <TextInput
                style={tournamentUi.input}
                placeholder="Email address"
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                keyboardType="email-address"
                editable={!isLoading}
                returnKeyType="done"
                onSubmitEditing={handleSubmit}
              />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <ActionButton label="Cancel" onPress={onCancel} disabled={isLoading} variant="ghost" fullWidth />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    label={isLoading ? 'Adding…' : 'Add player'}
                    onPress={handleSubmit}
                    disabled={isLoading || !String(name || '').trim() || !String(email || '').trim()}
                    fullWidth
                  />
                </View>
              </View>
            </View>
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
