import React, { useState } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import {
  AuthErrorBanner,
  AuthFormCard,
  AuthPrimaryButton,
  AuthScreenShell,
  AuthSidePanel,
} from '../components/auth/AuthChrome';
import { AuthUsernameField } from '../components/auth/AuthUsernameField';
import { useAuth } from '../context/AuthContext';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { changeMyUsername } from '../services/userService';
import { tournamentColors } from '../styles/tournamentUi';
import { getAuthErrorMessage } from '../utils/authErrors';
import { navigateAfterAuth } from '../utils/navigateAfterAuth';
import { normalizeUsername, validateUsernameFormat } from '../utils/usernameUtils';

export function ChooseUsernameScreen({ navigation, route }) {
  const { currentUser, updateCurrentUser } = useAuth();
  const initialUsername = route.params?.initialUsername || currentUser?.username || '';
  const [username, setUsername] = useState(initialUsername);
  const [fieldError, setFieldError] = useState('');
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { status, reason, isAvailable, isChecking } = useUsernameAvailability(username, {
    purpose: 'signup',
    enabled: normalizeUsername(username) !== normalizeUsername(initialUsername),
  });

  const resolvedAvailabilityStatus =
    normalizeUsername(username) === normalizeUsername(initialUsername) ? 'available' : status;

  const onSubmit = async () => {
    const normalized = normalizeUsername(username);
    const formatError = validateUsernameFormat(normalized);
    setFieldError(formatError);

    const usernameChanged = normalized !== normalizeUsername(initialUsername);

    if (formatError) {
      setErrorText('Choose a valid username to continue.');
      return;
    }

    if (usernameChanged && !isAvailable) {
      setErrorText('Choose an available username to continue.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorText('');

      if (usernameChanged) {
        const result = await changeMyUsername(normalized);
        updateCurrentUser(result.user);
      }

      navigateAfterAuth(navigation, route.params?.returnTo);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Unable to save username. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      sidePanel={
        <AuthSidePanel
          eyebrow="ALMOST THERE"
          title="Choose your username"
          subtitle="This is how you sign in and how hosts can find you on Rack n Roll."
          features={[
            {
              icon: 'registration',
              title: 'Your login handle',
              description: 'Use this username every time you sign in.',
            },
            {
              icon: 'secure',
              title: 'Unique to you',
              description: 'We check availability as you type.',
            },
          ]}
        />
      }
    >
      <AuthFormCard
        title="Pick a username"
        subtitle="You can keep the suggestion below or choose another available name."
      >
        <AuthErrorBanner message={errorText} />

        <AuthUsernameField
          label="Username"
          placeholder="Enter username"
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setFieldError('');
            setErrorText('');
          }}
          error={fieldError}
          availabilityStatus={resolvedAvailabilityStatus}
          availabilityReason={reason}
          helperText="Lowercase letters, numbers, and underscores only."
        />

        <View
          style={{
            padding: 10,
            borderRadius: 10,
            backgroundColor: '#f8fafc',
            borderWidth: 1,
            borderColor: '#e5e7eb',
            marginBottom: 14,
          }}
        >
          <Text style={{ fontSize: 12, lineHeight: 17, color: tournamentColors.textMuted }}>
            If a host added you as a guest with this username, your tournament entries will link automatically.
          </Text>
        </View>

        <AuthPrimaryButton
          label="Continue"
          onPress={onSubmit}
          disabled={isSubmitting || isChecking}
          loading={isSubmitting}
        />
      </AuthFormCard>
    </AuthScreenShell>
  );
}
