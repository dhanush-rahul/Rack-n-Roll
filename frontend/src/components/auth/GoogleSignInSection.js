import React, { useState } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ActionButton } from '../tournament/TournamentChrome';
import { AuthDivider } from './AuthChrome';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { authUi } from '../../styles/authUi';
import { getAuthErrorMessage } from '../../utils/authErrors';

export function GoogleSignInSection({ onIdToken, disabled = false }) {
  const { promptGoogleSignIn, isGoogleLoading } = useGoogleSignIn();
  const [errorText, setErrorText] = useState('');

  const onPress = async () => {
    try {
      setErrorText('');
      const idToken = await promptGoogleSignIn();

      if (!idToken) {
        return;
      }

      await onIdToken(idToken);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Google sign-in failed. Please try again.'));
    }
  };

  return (
    <View style={{ marginTop: 4 }}>
      <AuthDivider label="or" />
      {Boolean(errorText) && (
        <View style={[authUi.errorBanner, { marginTop: 0 }]}>
          <Text style={authUi.errorBannerText}>{errorText}</Text>
        </View>
      )}
      <ActionButton
        label={isGoogleLoading ? 'Connecting…' : 'Continue with Google'}
        onPress={onPress}
        disabled={disabled || isGoogleLoading}
        variant="secondary"
        fullWidth
      />
      <Text style={[authUi.hintText, { marginTop: 10, marginBottom: 0, textAlign: 'center' }]}>
        We use your Google name and email only to create or sign in to your Rack-n-Roll account. We don&apos;t access
        other Google data.
      </Text>
    </View>
  );
}
