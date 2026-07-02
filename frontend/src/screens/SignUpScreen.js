import React, { useState } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import {
  AuthErrorBanner,
  AuthField,
  AuthFormCard,
  AuthHero,
  AuthPasswordMatchHint,
  AuthPrimaryButton,
  AuthScreenShell,
  AuthTextLink,
} from '../components/auth/AuthChrome';
import { LegalConsent, LegalFooter } from '../components/legal/LegalLinks';
import { GoogleSignInSection } from '../components/auth/GoogleSignInSection';
import { isGoogleSignInConfigured } from '../config/googleAuth';
import { useAuth } from '../context/AuthContext';
import { tournamentColors } from '../styles/tournamentUi';
import { getAuthErrorMessage } from '../utils/authErrors';
import { hasValidationErrors, validateSignUpInput } from '../utils/authValidation';
import { navigateAfterAuth } from '../utils/navigateAfterAuth';

export function SignUpScreen({ navigation, route }) {
  const { signUp, signInWithGoogle } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);

  const onSubmit = async () => {
    const { errors, sanitized } = validateSignUpInput({ name, email, password, confirmPassword });
    setFieldErrors(errors);

    if (!acceptedLegal) {
      setLegalError('Please accept the Terms of Service and Privacy Policy.');
      setErrorText('Please accept the Terms of Service and Privacy Policy.');
      return;
    }

    if (hasValidationErrors(errors)) {
      setErrorText('Please fix the highlighted fields.');
      return;
    }

    try {
      setIsSubmitting(true);
      setErrorText('');
      await signUp(sanitized);
      navigateAfterAuth(navigation, route.params?.returnTo);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Unable to create account. Please try again.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleIdToken = async (idToken) => {
    try {
      setIsGoogleSubmitting(true);
      setErrorText('');
      await signInWithGoogle(idToken);
      navigateAfterAuth(navigation, route.params?.returnTo);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Google sign-in failed. Please try again.'));
    } finally {
      setIsGoogleSubmitting(false);
    }
  };

  return (
    <AuthScreenShell>
      <AuthHero
        compact
        eyebrow="JOIN THE TABLE"
        title="Create account"
        subtitle="Set up your profile to discover tournaments and track your matches."
      />

      <AuthFormCard title="Your details" subtitle="You'll use these to sign in and appear on tournament rosters.">
        <AuthErrorBanner message={errorText} />

        <AuthField
          label="Display name"
          placeholder="How others see you"
          value={name}
          onChangeText={(value) => {
            setName(value);
            setFieldErrors((current) => ({ ...current, name: '' }));
            setErrorText('');
          }}
          error={fieldErrors.name}
          autoCorrect={false}
          maxLength={80}
        />

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
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          maxLength={254}
        />

        <AuthField
          label="Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            setFieldErrors((current) => ({ ...current, password: '', confirmPassword: '' }));
            setErrorText('');
          }}
          error={fieldErrors.password}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          maxLength={72}
        />

        <AuthField
          label="Confirm password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            setFieldErrors((current) => ({ ...current, confirmPassword: '' }));
            setErrorText('');
          }}
          error={fieldErrors.confirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="newPassword"
          maxLength={72}
        />

        <AuthPasswordMatchHint password={password} confirmPassword={confirmPassword} />

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
            Use a strong password with letters and numbers. You can update your profile later from the app.
          </Text>
        </View>

        <LegalConsent
          checked={acceptedLegal}
          onToggle={(value) => {
            setAcceptedLegal(value);
            setLegalError('');
            setErrorText('');
          }}
          error={legalError}
        />

        <AuthPrimaryButton
          label="Create account"
          onPress={onSubmit}
          disabled={isSubmitting || isGoogleSubmitting}
          loading={isSubmitting}
        />

        {isGoogleSignInConfigured() ? (
          <GoogleSignInSection
            onIdToken={handleGoogleIdToken}
            disabled={isSubmitting || isGoogleSubmitting}
          />
        ) : null}
      </AuthFormCard>

      <AuthTextLink prompt="Already registered?" actionLabel="Sign in" onPress={() => navigation.navigate('SignIn')} />
      <LegalFooter style={{ marginTop: 4 }} />
    </AuthScreenShell>
  );
}
