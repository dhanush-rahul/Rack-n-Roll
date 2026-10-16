import React, { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import { ScaledText as Text } from '../ui/ScaledText';
import { ActionButton } from '../tournament/TournamentChrome';
import { AuthDivider } from './AuthChrome';
import { authUi } from '../../styles/authUi';
import { getAuthErrorMessage } from '../../utils/authErrors';

export function AppleSignInSection({ onCredential, disabled = false }) {
  const [isAvailable, setIsAvailable] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorText, setErrorText] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'ios') {
      return undefined;
    }

    let cancelled = false;

    AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (!cancelled) {
          setIsAvailable(Boolean(available));
        }
      })
      .catch(() => {
        if (!cancelled) {
          setIsAvailable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (!isAvailable) {
    return null;
  }

  const onPress = async () => {
    try {
      setErrorText('');
      setIsLoading(true);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential?.identityToken) {
        return;
      }

      await onCredential({
        identityToken: credential.identityToken,
        authorizationCode: credential.authorizationCode || null,
        fullName: credential.fullName
          ? {
              givenName: credential.fullName.givenName || '',
              familyName: credential.fullName.familyName || '',
            }
          : null,
      });
    } catch (error) {
      if (error?.code === 'ERR_REQUEST_CANCELED') {
        return;
      }

      setErrorText(getAuthErrorMessage(error, 'Apple sign-in failed. Please try again.'));
    } finally {
      setIsLoading(false);
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
        label={isLoading ? 'Connecting…' : 'Continue with Apple'}
        onPress={onPress}
        disabled={disabled || isLoading}
        variant="secondary"
        fullWidth
      />
      <Text style={[authUi.hintText, { marginTop: 10, marginBottom: 0, textAlign: 'center' }]}>
        We use your Apple name and email only to create or sign in to your Rack-n-Roll account. You can pick your
        username after the first sign-in.
      </Text>
    </View>
  );
}
