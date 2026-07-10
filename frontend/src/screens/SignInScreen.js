import React, { useState } from 'react';
import { View } from 'react-native';
import {
  AuthErrorBanner,
  AuthField,
  AuthFormCard,
  AuthPrimaryButton,
  AuthScreenShell,
  AuthSidePanel,
  AuthTextLink,
} from '../components/auth/AuthChrome';
import { ActionButton } from '../components/tournament/TournamentChrome';
import { LegalFooter } from '../components/legal/LegalLinks';
import { GoogleSignInSection } from '../components/auth/GoogleSignInSection';
import { isGoogleSignInAvailable } from '../config/googleAuth';
import { useAuth } from '../context/AuthContext';
import { getAuthErrorMessage } from '../utils/authErrors';
import { hasValidationErrors, validateSignInInput } from '../utils/authValidation';
import { navigateAfterAuth } from '../utils/navigateAfterAuth';
import { navigateAfterGoogleAuth } from '../utils/navigateAfterGoogleAuth';

export function SignInScreen({ navigation, route }) {
  const { signIn, signInWithGoogle } = useAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ username: '', password: '' });
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const onSubmit = async () => {
    const { errors, sanitized } = validateSignInInput({ username, password });
    setFieldErrors(errors);

    if (hasValidationErrors(errors)) {
      setErrorText('Please fix the highlighted fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorText('');
      await signIn(sanitized);
      navigateAfterAuth(navigation, route.params?.returnTo);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Invalid username or password. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleIdToken = async (idToken) => {
    try {
      setIsGoogleSubmitting(true);
      setErrorText('');
      const result = await signInWithGoogle(idToken);
      navigateAfterGoogleAuth(navigation, route, result);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Google sign-in failed. Please try again.'));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      sidePanel={
        <AuthSidePanel
          eyebrow="WELCOME BACK"
          title="Sign in to Rack n Roll"
          subtitle="Pick up where you left off—your tournaments and scores are waiting."
          features={[
            {
              icon: 'pool',
              title: 'Discover events',
              description: 'Browse open tournaments and request a spot in seconds.',
            },
            {
              icon: 'chart',
              title: 'Track standings',
              description: 'Follow brackets, scores, and your place in the field.',
            },
            {
              icon: 'trophy',
              title: 'Host tournaments',
              description: 'Create events, manage players, and run matches from one place.',
            },
          ]}
        />
      }
    >
      <AuthFormCard title="Sign in" subtitle="Use your username and password, or continue with Google.">
        <AuthErrorBanner message={errorText} />

        <AuthField
          label="Username"
          placeholder="your_username"
          value={username}
          onChangeText={(value) => {
            setUsername(value);
            setFieldErrors((current) => ({ ...current, username: '' }));
            setErrorText('');
          }}
          error={fieldErrors.username}
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={20}
        />

        <AuthField
          label="Password"
          placeholder="Your password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setFieldErrors((current) => ({ ...current, password: '' }));
            setErrorText('');
          }}
          error={fieldErrors.password}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="password"
          maxLength={72}
        />

        <View style={{ marginBottom: 8 }}>
          <ActionButton label="Forgot password?" onPress={() => navigation.navigate('ForgotPassword')} variant="ghost" fullWidth />
        </View>

        <AuthPrimaryButton label="Sign in" onPress={onSubmit} disabled={isSubmitting || isGoogleSubmitting} loading={isSubmitting} />

        {isGoogleSignInAvailable() ? (
          <GoogleSignInSection
            onIdToken={handleGoogleIdToken}
            disabled={isSubmitting || isGoogleSubmitting}
          />
        ) : null}
      </AuthFormCard>

      <AuthTextLink prompt="New here?" actionLabel="Create an account" onPress={() => navigation.navigate('SignUp')} />
      <LegalFooter style={{ marginTop: 4 }} />
    </AuthScreenShell>
  );
}
