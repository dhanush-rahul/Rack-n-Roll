import React, { useEffect, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ScaledTextInput as TextInput } from './ui/ScaledTextInput';
import { ActionButton } from './tournament/TournamentChrome';
import { discoverUi, tournamentColors, tournamentUi } from '../styles/tournamentUi';

export function AddGuestPlayerModal({ visible, onCancel, onSubmit, isLoading = false }) {
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
      <View style={tournamentUi.modalOverlay}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={isLoading ? undefined : onCancel} />
        <View style={[discoverUi.surfaceCard, { marginHorizontal: 4, gap: 12 }]}>
          <Text style={{ fontSize: 18, fontWeight: '800', color: tournamentColors.text }}>Add player</Text>
          <Text style={{ fontSize: 14, lineHeight: 20, color: tournamentColors.textMuted }}>
            Enter the player&apos;s name and email. They can sign up later with this email to follow the tournament in
            the app.
          </Text>
          <TextInput
            style={tournamentUi.input}
            placeholder="Full name"
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            editable={!isLoading}
          />
          <TextInput
            style={tournamentUi.input}
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!isLoading}
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
      </View>
    </Modal>
  );
}
