import React, { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import {
  AuthErrorBanner,
  AuthField,
  AuthFormCard,
  AuthPasswordMatchHint,
  AuthPrimaryButton,
  AuthScreenShell,
  AuthSidePanel,
  AuthTextLink,
} from '../components/auth/AuthChrome';
import { AuthUsernameField } from '../components/auth/AuthUsernameField';
import { LegalConsent, LegalFooter } from '../components/legal/LegalLinks';
import { GoogleSignInSection } from '../components/auth/GoogleSignInSection';
import { isGoogleSignInAvailable } from '../config/googleAuth';
import { useAuth } from '../context/AuthContext';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { tournamentColors } from '../styles/tournamentUi';
import { getAuthErrorMessage } from '../utils/authErrors';
import { hasValidationErrors, validateSignUpInput } from '../utils/authValidation';
import { navigateAfterAuth } from '../utils/navigateAfterAuth';
import { navigateAfterGoogleAuth } from '../utils/navigateAfterGoogleAuth';
import { suggestUsernameFromFirstName } from '../utils/usernameUtils';

export function SignUpScreen({ navigation, route }) {
  const { signUp, signInWithGoogle } = useAuth();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [acceptedLegal, setAcceptedLegal] = useState(false);
  const [legalError, setLegalError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({
    firstName: '',
    lastName: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const usernameTouchedRef = useRef(false);

  const { status, reason, isAvailable, isChecking } = useUsernameAvailability(username, {
    purpose: 'signup',
    enabled: Boolean(username),
  });

  useEffect(() => {
    if (usernameTouchedRef.current) {
      return;
    }

    const suggestion = suggestUsernameFromFirstName(firstName);
    setUsername(suggestion);
  }, [firstName]);

  const onSubmit = async () => {
    const { errors, sanitized } = validateSignUpInput({
      firstName,
      lastName,
      username,
      email,
      password,
      confirmPassword,
    });
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

    if (!isAvailable) {
      setErrorText('Choose an available username to continue.');
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
          eyebrow="JOIN THE TABLE"
          title="Create your account"
          subtitle="Set up your profile to discover tournaments and track your matches."
          features={[
            {
              icon: 'registration',
              title: 'One profile',
              description: 'Use your username to sign in and appear on rosters.',
            },
            {
              icon: 'secure',
              title: 'Your data stays yours',
              description: 'Email is optional and only used for account recovery when provided.',
            },
            {
              icon: 'celebrate',
              title: 'Ready in minutes',
              description: 'Sign up, find a tournament, and get on the bracket fast.',
            },
          ]}
        />
      }
    >
      <AuthFormCard title="Create account" subtitle="Choose a username for sign-in and how you appear on tournament rosters.">
        <AuthErrorBanner message={errorText} />

        <AuthField
          label="First name"
          placeholder="First name"
          value={firstName}
          onChangeText={(value) => {
            setFirstName(value);
            setFieldErrors((current) => ({ ...current, firstName: '' }));
            setErrorText('');
          }}
          error={fieldErrors.firstName}
          autoCorrect={false}
          maxLength={50}
        />

        <AuthField
          label="Last name"
          placeholder="Last name"
          value={lastName}
          onChangeText={(value) => {
            setLastName(value);
            setFieldErrors((current) => ({ ...current, lastName: '' }));
            setErrorText('');
          }}
          error={fieldErrors.lastName}
          autoCorrect={false}
          maxLength={50}
        />

        <AuthUsernameField
          label="Username"
          placeholder="Enter username"
          value={username}
          onChangeText={(value) => {
            usernameTouchedRef.current = true;
            setUsername(value);
            setFieldErrors((current) => ({ ...current, username: '' }));
            setErrorText('');
          }}
          error={fieldErrors.username}
          availabilityStatus={status}
          availabilityReason={reason}
          helperText="Used to sign in. Lowercase letters, numbers, and underscores only."
        />

        <AuthField
          label="Email (optional)"
          placeholder="For password recovery"
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
          disabled={isSubmitting || isGoogleSubmitting || isChecking}
          loading={isSubmitting}
        />

        {isGoogleSignInAvailable() ? (
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
