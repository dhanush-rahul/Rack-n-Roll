import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ScaledTextInput as TextInput } from './ui/ScaledTextInput';
import { AuthUsernameField } from './auth/AuthUsernameField';
import { ActionButton } from './tournament/TournamentChrome';
import { useTypography } from '../context/TypographyContext';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { getWebModalStyles } from '../utils/modalStyles';
import { suggestUsernameFromFirstName, validateUsernameFormat } from '../utils/usernameUtils';

export function AddGuestPlayerModal({
  visible,
  onCancel,
  onSubmit,
  isLoading = false,
  title = 'Add guest player',
  subtitle,
}) {
  const { width } = useTypography();
  const webModal = getWebModalStyles(width);
  const [rosterName, setRosterName] = useState('');
  const [username, setUsername] = useState('');
  const usernameTouchedRef = useRef(false);

  const { status, reason, isAvailable, isChecking } = useUsernameAvailability(username, {
    purpose: 'guest',
    enabled: Boolean(visible),
  });

  useEffect(() => {
    if (!visible) {
      setRosterName('');
      setUsername('');
      usernameTouchedRef.current = false;
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || usernameTouchedRef.current) {
      return;
    }

    const firstToken = String(rosterName || '').trim().split(/\s+/)[0] || '';
    setUsername(suggestUsernameFromFirstName(firstToken));
  }, [rosterName, visible]);

  const usernameTakenByRegisteredUser = status === 'unavailable' && reason === 'taken';
  const canSubmit =
    !isLoading &&
    !isChecking &&
    String(rosterName || '').trim().length >= 2 &&
    isAvailable &&
    !validateUsernameFormat(username);

  const handleSubmit = () => {
    onSubmit({
      name: String(rosterName || '').trim(),
      username: String(username || '').trim().toLowerCase(),
    });
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
              <Text style={[tournamentUi.modalTitle, webModal?.title]}>{title}</Text>
              <Text style={[tournamentUi.modalMessage, webModal?.message, { textAlign: 'left' }]}>
                {subtitle ||
                  'Add someone who does not have a Rack n Roll account yet. Enter the username they will use when they sign up — their roster entry links automatically.'}
              </Text>

              <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.textMuted }}>Roster name</Text>
              <TextInput
                style={tournamentUi.input}
                placeholder="Name shown on brackets"
                value={rosterName}
                onChangeText={setRosterName}
                autoCapitalize="words"
                editable={!isLoading}
                returnKeyType="next"
              />

              <AuthUsernameField
                label="Username for sign-up"
                placeholder="username_they_will_use"
                value={username}
                onChangeText={(value) => {
                  usernameTouchedRef.current = true;
                  setUsername(value);
                }}
                availabilityStatus={status}
                availabilityReason={reason}
                helperText="Must be available — if taken, search and add the registered player instead."
                editable={!isLoading}
              />

              {usernameTakenByRegisteredUser ? (
                <View
                  style={{
                    padding: 10,
                    borderRadius: 10,
                    backgroundColor: '#fff7ed',
                    borderWidth: 1,
                    borderColor: '#fed7aa',
                  }}
                >
                  <Text style={{ fontSize: 12, lineHeight: 17, color: '#9a3412' }}>
                    This username is already registered. Close this dialog and use Search users to add them to the
                    roster.
                  </Text>
                </View>
              ) : null}

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <ActionButton label="Cancel" onPress={onCancel} disabled={isLoading} variant="ghost" fullWidth />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    label={isLoading ? (title.toLowerCase().includes('replace') ? 'Replacing…' : 'Adding…') : title.toLowerCase().includes('replace') ? 'Replace' : 'Add guest'}
                    onPress={handleSubmit}
                    disabled={!canSubmit}
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
