import React, { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { ActionButton } from '../components/tournament/TournamentChrome';
import {
  AuthErrorBanner,
  AuthField,
  AuthFormCard,
  AuthHero,
  AuthPinInput,
  AuthPrimaryButton,
  AuthPasswordMatchHint,
  AuthScreenShell,
  AuthStepIndicator,
  AuthSuccessBanner,
  AuthTextLink,
} from '../components/auth/AuthChrome';
import { LegalFooter } from '../components/legal/LegalLinks';
import { confirmPasswordReset, requestPasswordResetPin, validatePasswordResetPin } from '../services/authService';
import { authUi } from '../styles/authUi';
import { getAuthErrorMessage } from '../utils/authErrors';
import {
  hasValidationErrors,
  validateForgotPasswordPinInput,
  validateForgotPasswordRequestInput,
  validateForgotPasswordResetInput,
} from '../utils/authValidation';

const DEFAULT_RESEND_COOLDOWN_SECONDS = 60;

function formatCountdown(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function ForgotPasswordScreen({ navigation }) {
  const [email, setEmail] = useState('');
  const [pin, setPin] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [hasRequestedPin, setHasRequestedPin] = useState(false);
  const [isPinValidated, setIsPinValidated] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [pinExpiresInMinutes, setPinExpiresInMinutes] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({
    email: '',
    pin: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const currentStepIndex = isPinValidated ? 2 : hasRequestedPin ? 1 : 0;
  const passwordsMatch =
    Boolean(newPassword) && Boolean(confirmPassword) && newPassword === confirmPassword;
  const canSubmitReset =
    Boolean(resetToken) && Boolean(newPassword) && Boolean(confirmPassword) && passwordsMatch;

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return undefined;
    }

    const timerId = setTimeout(() => {
      setResendCooldownSeconds((current) => Math.max(0, current - 1));
    }, 1000);

    return () => clearTimeout(timerId);
  }, [resendCooldownSeconds]);

  const onRequestPin = async () => {
    const { errors, sanitized } = validateForgotPasswordRequestInput({ email });
    setFieldErrors((current) => ({ ...current, email: errors.email }));

    if (hasValidationErrors(errors)) {
      setErrorText('Enter a valid email address.');
      return;
    }

    try {
      setErrorText('');
      setSuccessText('');
      setIsSubmitting(true);

      const response = await requestPasswordResetPin({ email: sanitized.email });
      setEmail(sanitized.email);
      setHasRequestedPin(true);
      setIsPinValidated(false);
      setResetToken('');
      setPin('');
      setNewPassword('');
      setConfirmPassword('');
      setResendCooldownSeconds(Number(response.resendCooldownSeconds) || DEFAULT_RESEND_COOLDOWN_SECONDS);
      setPinExpiresInMinutes(Number(response.pinExpiresInMinutes) || null);
      setSuccessText(response.message || 'If an account exists for that email, a reset PIN has been sent.');
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Unable to send reset PIN.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onValidatePin = async (pinOverride) => {
    const pinValue = pinOverride ?? pin;
    const { errors, sanitized } = validateForgotPasswordPinInput({ email, pin: pinValue });
    setFieldErrors((current) => ({ ...current, email: errors.email, pin: errors.pin }));

    if (hasValidationErrors(errors)) {
      setErrorText('Please enter a valid PIN.');
      return;
    }

    try {
      setErrorText('');
      setSuccessText('');
      setIsSubmitting(true);

      const response = await validatePasswordResetPin({
        email: sanitized.email,
        pin: sanitized.pin,
      });

      setResetToken(response.resetToken || '');
      setNewPassword('');
      setConfirmPassword('');
      setIsPinValidated(true);
      setSuccessText(response.message || 'PIN verified. Choose a new password below.');
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Unable to verify PIN.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const onConfirmReset = async () => {
    const { errors, sanitized } = validateForgotPasswordResetInput({
      email,
      newPassword,
      confirmPassword,
    });

    setFieldErrors((current) => ({
      ...current,
      email: errors.email,
      newPassword: errors.newPassword,
      confirmPassword: errors.confirmPassword,
    }));

    if (hasValidationErrors(errors)) {
      setErrorText('Please fix the highlighted fields.');
      return;
    }

    try {
      setErrorText('');
      setSuccessText('');
      setIsSubmitting(true);

      const response = await confirmPasswordReset({
        email: sanitized.email,
        resetToken,
        newPassword: sanitized.newPassword,
      });

      const successMessage = response.message || 'Password updated successfully.';
      setSuccessText(successMessage);
      setPin('');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setHasRequestedPin(false);
      setIsPinValidated(false);
      setResendCooldownSeconds(0);
      setPinExpiresInMinutes(null);
      Alert.alert('Password updated', 'Please sign in with your new password.', [
        {
          text: 'OK',
          onPress: () => navigation.navigate('SignIn'),
        },
      ]);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Unable to reset password.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell
      sidePanel={
        <AuthHero
          eyebrow="ACCOUNT RECOVERY"
          title="Reset password"
          subtitle="We'll email a 6-digit PIN. Verify it, then set a new password."
        />
      }
    >
      <AuthFormCard>
        <AuthStepIndicator steps={['Email', 'PIN', 'Password']} currentIndex={currentStepIndex} />
        <AuthErrorBanner message={errorText} />
        <AuthSuccessBanner message={successText} />

        {currentStepIndex === 0 && (
          <>
            <Text style={authUi.formTitle}>Request a PIN</Text>
            <Text style={authUi.formSubtitle}>
              Enter the email linked to your account. If it exists, we'll send a reset PIN.
            </Text>
            <AuthField
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChangeText={(value) => {
                setEmail(value);
                setFieldErrors((current) => ({ ...current, email: '' }));
                setErrorText('');
                setSuccessText('');
              }}
              error={fieldErrors.email}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              maxLength={254}
            />
            <AuthPrimaryButton
              label="Send reset PIN"
              onPress={onRequestPin}
              disabled={isSubmitting}
              loading={isSubmitting}
            />
          </>
        )}

        {currentStepIndex === 1 && (
          <>
            <Text style={authUi.formTitle}>Enter your PIN</Text>
            <Text style={authUi.formSubtitle}>
              Check {email}
              {pinExpiresInMinutes ? ` — expires in ${pinExpiresInMinutes} min` : ''}.
            </Text>
            <AuthPinInput
              value={pin}
              onChangeValue={(value) => {
                setPin(value);
                setFieldErrors((current) => ({ ...current, pin: '' }));
                setErrorText('');
              }}
              error={fieldErrors.pin}
            />
            <AuthPrimaryButton
              label="Verify PIN"
              onPress={() => onValidatePin()}
              disabled={isSubmitting || pin.length < 6}
              loading={isSubmitting}
            />
            <View style={{ marginTop: 10 }}>
              <ActionButton
                label={
                  resendCooldownSeconds > 0
                    ? `Resend PIN in ${formatCountdown(resendCooldownSeconds)}`
                    : 'Resend PIN'
                }
                onPress={onRequestPin}
                variant="secondary"
                fullWidth
                disabled={isSubmitting || resendCooldownSeconds > 0}
              />
            </View>
            {resendCooldownSeconds > 0 && (
              <Text style={[authUi.hintText, { marginTop: 10, marginBottom: 0 }]}>
                You can request another PIN when the timer finishes.
              </Text>
            )}
            <View style={{ marginTop: 10 }}>
              <ActionButton
                label="Use a different email"
                onPress={() => {
                  setHasRequestedPin(false);
                  setPin('');
                  setSuccessText('');
                  setErrorText('');
                }}
                variant="ghost"
                fullWidth
              />
            </View>
          </>
        )}

        {currentStepIndex === 2 && (
          <>
            <Text style={authUi.formTitle}>Choose a new password</Text>
            <Text style={authUi.formSubtitle}>Must be at least 8 characters.</Text>
            <AuthField
              label="New password"
              placeholder="At least 8 characters"
              value={newPassword}
              onChangeText={(value) => {
                setNewPassword(value);
                setFieldErrors((current) => ({ ...current, newPassword: '', confirmPassword: '' }));
                setErrorText('');
              }}
              error={fieldErrors.newPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="newPassword"
              maxLength={72}
            />
            <AuthField
              label="Confirm password"
              placeholder="Re-enter new password"
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
            <AuthPasswordMatchHint password={newPassword} confirmPassword={confirmPassword} />
            <AuthPrimaryButton
              label="Update password"
              onPress={onConfirmReset}
              disabled={isSubmitting || !canSubmitReset}
              loading={isSubmitting}
            />
          </>
        )}
      </AuthFormCard>

      <AuthTextLink prompt="Remembered it?" actionLabel="Back to sign in" onPress={() => navigation.navigate('SignIn')} />
      <LegalFooter style={{ marginTop: 4 }} />
    </AuthScreenShell>
  );
}
