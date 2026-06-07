import React, { useState } from 'react';
import { View } from 'react-native';
import {
  AuthErrorBanner,
  AuthField,
  AuthFormCard,
  AuthHero,
  AuthPrimaryButton,
  AuthScreenShell,
  AuthTextLink,
} from '../components/auth/AuthChrome';
import { ActionButton } from '../components/tournament/TournamentChrome';
import { LegalFooter } from '../components/legal/LegalLinks';
import { useAuth } from '../context/AuthContext';
import { hasValidationErrors, validateSignInInput } from '../utils/authValidation';

export function SignInScreen({ navigation }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ email: '', password: '' });
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const onSubmit = async () => {
    const { errors, sanitized } = validateSignInInput({ email, password });
    setFieldErrors(errors);

    if (hasValidationErrors(errors)) {
      setErrorText('Please fix the highlighted fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorText('');
      await signIn(sanitized);
    } catch (error) {
      if (error?.code === 'NETWORK_ERROR') {
        setErrorText(
          __DEV__
            ? 'Unable to reach the server. Start the backend (node src/index.js) and restart Expo with -c. Check the Metro log for [rack-n-roll] API base URL.'
            : 'Unable to reach the server. Check your connection and try again.'
        );
      } else {
        setErrorText('Invalid email or password. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell>
      <AuthHero
        compact
        eyebrow="WELCOME BACK"
        title="Sign in"
        subtitle="Pick up where you left off—your tournaments and scores are waiting."
      />

      <AuthFormCard title="Account details" subtitle="Use the email and password for your Rack n Roll account.">
        <AuthErrorBanner message={errorText} />

        <AuthField
          label="Email"
          placeholder="you@example.com"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            setFieldErrors((current) => ({ ...current, email: '' }));
            setErrorText('');
          }}
          error={fieldErrors.email}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
          textContentType="emailAddress"
          maxLength={254}
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

        <AuthPrimaryButton label="Sign in" onPress={onSubmit} disabled={isSubmitting} loading={isSubmitting} />
      </AuthFormCard>

      <AuthTextLink prompt="New here?" actionLabel="Create an account" onPress={() => navigation.navigate('SignUp')} />
      <LegalFooter style={{ marginTop: 4 }} />
    </AuthScreenShell>
  );
}
