import React, { useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { useTheme } from '../context/ThemeContext';
import { useMyProfile } from '../hooks/queries/useMyProfile';
import { useAuth } from '../context/AuthContext';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { ActionButton, SectionCard } from '../components/tournament/TournamentChrome';
import { AuthField, AuthPasswordMatchHint } from '../components/auth/AuthChrome';
import { tournamentUi } from '../styles/tournamentUi';
import { useResponsiveLayout, centeredContentStyle } from '../utils/responsive';
import { setMyPassword, updateMyEmail } from '../services/userService';
import { queryKeys } from '../hooks/queries/queryKeys';
import { formatApiError } from '../hooks/useScreenFeedback';
import { getAuthErrorMessage } from '../utils/authErrors';
import {
  hasValidationErrors,
  validateChangePasswordInput,
  validateForgotPasswordRequestInput,
  validateSetPasswordInput,
} from '../utils/authValidation';

export function SettingsScreen() {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { scrollPaddingBottom } = useScreenInsets();
  const { contentMaxWidth, horizontalPadding, isDesktopWeb } = useResponsiveLayout();
  const { data: profile, isLoading, isFetching, refetch } = useMyProfile({ enabled: Boolean(currentUser?.id) });

  const [passwordInput, setPasswordInput] = useState('');
  const [confirmPasswordInput, setConfirmPasswordInput] = useState('');
  const [currentPasswordInput, setCurrentPasswordInput] = useState('');
  const [passwordFieldErrors, setPasswordFieldErrors] = useState({
    currentPassword: '',
    password: '',
    confirmPassword: '',
  });
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [passwordSuccessText, setPasswordSuccessText] = useState('');
  const [emailInput, setEmailInput] = useState('');
  const [emailFieldError, setEmailFieldError] = useState('');
  const [isSavingEmail, setIsSavingEmail] = useState(false);
  const [emailSuccessText, setEmailSuccessText] = useState('');
  const [saveErrorText, setSaveErrorText] = useState('');

  const showSetPassword = profile?.user?.hasPassword === false;
  const showChangePassword = profile?.user?.hasPassword === true;
  const showAddEmail = !profile?.user?.email;

  const addEmailValidation = useMemo(
    () => validateForgotPasswordRequestInput({ email: emailInput }),
    [emailInput]
  );
  const canSubmitAddEmail =
    !isSavingEmail && !hasValidationErrors(addEmailValidation.errors) && Boolean(emailInput.trim());

  const changePasswordValidation = useMemo(
    () =>
      validateChangePasswordInput({
        currentPassword: currentPasswordInput,
        password: passwordInput,
        confirmPassword: confirmPasswordInput,
      }),
    [confirmPasswordInput, currentPasswordInput, passwordInput]
  );
  const canSubmitChangePassword =
    !isSavingPassword && !hasValidationErrors(changePasswordValidation.errors);

  const setPasswordValidation = useMemo(
    () =>
      validateSetPasswordInput({
        password: passwordInput,
        confirmPassword: confirmPasswordInput,
      }),
    [confirmPasswordInput, passwordInput]
  );
  const canSubmitSetPassword = !isSavingPassword && !hasValidationErrors(setPasswordValidation.errors);

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDesktopWeb ? colors.backgroundAlt : colors.background }}
      contentContainerStyle={[
        tournamentUi.content,
        { paddingHorizontal: horizontalPadding, paddingBottom: scrollPaddingBottom },
        centeredContentStyle(contentMaxWidth),
      ]}
      refreshControl={<RefreshControl refreshing={isFetching && !isLoading} onRefresh={() => refetch()} tintColor={colors.primary} />}
    >
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16 }}>Settings</Text>

      {Boolean(saveErrorText) && (
        <View style={{ padding: 14, borderRadius: 12, backgroundColor: colors.errorSurface, marginBottom: 14 }}>
          <Text style={{ color: colors.error, fontSize: 13 }}>{saveErrorText}</Text>
        </View>
      )}

      <View style={{ gap: 14 }}>
        <SectionCard title="Notifications" subtitle="Coming soon">
          <Text style={{ color: colors.textMuted, fontSize: 13 }}>Email and push notification preferences will appear here.</Text>
        </SectionCard>

        {showAddEmail ? (
          <SectionCard title="Recovery email" subtitle="Add an email for forgot-password PIN recovery.">
            {Boolean(emailSuccessText) && (
              <Text style={{ color: colors.success, fontSize: 13, marginBottom: 10 }}>{emailSuccessText}</Text>
            )}
            <AuthField
              label="Email"
              placeholder="you@example.com"
              value={emailInput}
              onChangeText={setEmailInput}
              error={emailFieldError}
              autoCapitalize="none"
              keyboardType="email-address"
            />
            <ActionButton
              label={isSavingEmail ? 'Saving…' : 'Save email'}
              onPress={async () => {
                const { errors, sanitized } = addEmailValidation;
                setEmailFieldError(errors.email);
                if (hasValidationErrors(errors)) return;
                try {
                  setIsSavingEmail(true);
                  const updated = await updateMyEmail(sanitized.email);
                  queryClient.setQueryData(queryKeys.profile(), updated);
                  setEmailInput('');
                  setEmailSuccessText('Email saved.');
                } catch (error) {
                  setSaveErrorText(getAuthErrorMessage(error, 'Unable to save email.'));
                } finally {
                  setIsSavingEmail(false);
                }
              }}
              disabled={!canSubmitAddEmail}
              fullWidth
            />
          </SectionCard>
        ) : null}

        {showSetPassword ? (
          <SectionCard title="Sign-in password" subtitle="Set a password for username sign-in.">
            {Boolean(passwordSuccessText) && (
              <Text style={{ color: colors.success, fontSize: 13, marginBottom: 10 }}>{passwordSuccessText}</Text>
            )}
            <AuthField label="New password" value={passwordInput} onChangeText={setPasswordInput} error={passwordFieldErrors.password} secureTextEntry />
            <AuthField label="Confirm password" value={confirmPasswordInput} onChangeText={setConfirmPasswordInput} error={passwordFieldErrors.confirmPassword} secureTextEntry />
            <AuthPasswordMatchHint password={passwordInput} confirmPassword={confirmPasswordInput} />
            <ActionButton
              label={isSavingPassword ? 'Saving…' : 'Set password'}
              onPress={async () => {
                const { errors, sanitized } = setPasswordValidation;
                setPasswordFieldErrors(errors);
                if (hasValidationErrors(errors)) return;
                try {
                  setIsSavingPassword(true);
                  const updated = await setMyPassword(sanitized.password);
                  queryClient.setQueryData(queryKeys.profile(), updated);
                  setPasswordInput('');
                  setConfirmPasswordInput('');
                  setPasswordSuccessText('Password saved.');
                } catch (error) {
                  setSaveErrorText(getAuthErrorMessage(error, 'Unable to set password.'));
                } finally {
                  setIsSavingPassword(false);
                }
              }}
              disabled={!canSubmitSetPassword}
              fullWidth
            />
          </SectionCard>
        ) : null}

        {showChangePassword ? (
          <SectionCard title="Change password" subtitle="Update your sign-in password.">
            {Boolean(passwordSuccessText) && (
              <Text style={{ color: colors.success, fontSize: 13, marginBottom: 10 }}>{passwordSuccessText}</Text>
            )}
            <AuthField label="Current password" value={currentPasswordInput} onChangeText={setCurrentPasswordInput} error={passwordFieldErrors.currentPassword} secureTextEntry />
            <AuthField label="New password" value={passwordInput} onChangeText={setPasswordInput} error={passwordFieldErrors.password} secureTextEntry />
            <AuthField label="Confirm new password" value={confirmPasswordInput} onChangeText={setConfirmPasswordInput} error={passwordFieldErrors.confirmPassword} secureTextEntry />
            <AuthPasswordMatchHint password={passwordInput} confirmPassword={confirmPasswordInput} />
            <ActionButton
              label={isSavingPassword ? 'Saving…' : 'Change password'}
              onPress={async () => {
                const { errors, sanitized } = changePasswordValidation;
                setPasswordFieldErrors(errors);
                if (hasValidationErrors(errors)) return;
                try {
                  setIsSavingPassword(true);
                  const updated = await setMyPassword(sanitized.password, sanitized.currentPassword);
                  queryClient.setQueryData(queryKeys.profile(), updated);
                  setCurrentPasswordInput('');
                  setPasswordInput('');
                  setConfirmPasswordInput('');
                  setPasswordSuccessText('Password updated.');
                } catch (error) {
                  setSaveErrorText(getAuthErrorMessage(error, 'Unable to change password.'));
                } finally {
                  setIsSavingPassword(false);
                }
              }}
              disabled={!canSubmitChangePassword}
              fullWidth
            />
          </SectionCard>
        ) : null}
      </View>
    </ScrollView>
  );
}
