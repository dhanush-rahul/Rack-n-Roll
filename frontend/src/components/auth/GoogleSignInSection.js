import React, { useState } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ActionButton } from '../tournament/TournamentChrome';
import { AuthDivider } from './AuthChrome';
import { useGoogleSignIn } from '../../hooks/useGoogleSignIn';
import { authUi } from '../../styles/authUi';

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
      setErrorText(error.message || 'Google sign-in failed. Please try again.');
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
    </View>
  );
}
