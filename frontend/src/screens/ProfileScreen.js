import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '../components/ui/ScaledTextInput';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { LegalMenuSection } from '../components/legal/LegalLinks';
import { ActionButton, SectionCard } from '../components/tournament/TournamentChrome';
import { useAuth } from '../context/AuthContext';
import { setMyPassword } from '../services/userService';
import { useMyProfile } from '../hooks/queries/useMyProfile';
import { queryKeys } from '../hooks/queries/queryKeys';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { discoverUi, tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { useResponsiveLayout, centeredContentStyle } from '../utils/responsive';
import { formatApiError } from '../hooks/useScreenFeedback';
import { AuthField, AuthPasswordMatchHint } from '../components/auth/AuthChrome';
import { hasValidationErrors, validateChangePasswordInput, validateSetPasswordInput } from '../utils/authValidation';

function StatCard({ label, value, accent }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '46%',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        backgroundColor: '#fafbfc',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: tournamentColors.textMuted }}>{label}</Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 24,
          fontWeight: '800',
          color: accent || tournamentColors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function formatMemberSince(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ProfileScreen({ navigation }) {
  const { signOut, currentUser } = useAuth();
  const queryClient = useQueryClient();
  const { scrollPaddingBottom } = useScreenInsets();
  const { contentMaxWidth } = useResponsiveLayout();
  const {
    data: profile,
    isLoading,
    isFetching,
    error: profileError,
    refetch,
  } = useMyProfile({ enabled: Boolean(currentUser?.id) });

  const [handicapInput, setHandicapInput] = useState('0');
  const [saveErrorText, setSaveErrorText] = useState('');
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

  useEffect(() => {
    if (profile?.user?.handicap !== undefined && profile?.user?.handicap !== null) {
      setHandicapInput(String(profile.user.handicap));
    }
  }, [profile?.user?.handicap]);

  useFocusEffect(
    useCallback(() => {
      if (currentUser?.id) {
        refetch();
      }
    }, [currentUser?.id, refetch])
  );

  const errorText = profileError
    ? formatApiError(profileError, 'Unable to load your profile.')
    : saveErrorText;

  const displayName = profile?.user?.name || currentUser?.name || 'Player';
  const initial = displayName.charAt(0).toUpperCase();
  const stats = profile?.stats || {};
  const isRefreshing = isFetching && !isLoading;
  const showSetPassword = profile?.user?.hasPassword === false;
  const showChangePassword = profile?.user?.hasPassword === true;

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
    <View style={tournamentUi.screen}>
      <ScrollView
        contentContainerStyle={[tournamentUi.content, centeredContentStyle(contentMaxWidth), { paddingBottom: scrollPaddingBottom }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => refetch()} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[discoverUi.hero, { marginBottom: 16 }]}>
          <View style={[discoverUi.heroGlow, { top: -40, right: -30 }]} />
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: 'rgba(37, 99, 235, 0.35)',
                borderWidth: 2,
                borderColor: 'rgba(191, 219, 254, 0.6)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#f8fafc', fontSize: 30, fontWeight: '800' }}>{initial}</Text>
            </View>
            <Text style={{ color: '#f8fafc', fontSize: 22, fontWeight: '800' }}>{displayName}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>{profile?.user?.email || '—'}</Text>
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
              Member since {formatMemberSince(profile?.user?.memberSince)}
            </Text>
          </View>
        </View>

        {isLoading && (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={tournamentColors.primary} />
          </View>
        )}

        {Boolean(errorText) && !isLoading && (
          <View
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: '#fef2f2',
              borderWidth: 1,
              borderColor: '#fecaca',
              marginBottom: 14,
            }}
          >
            <Text style={{ color: '#b91c1c', fontSize: 13, lineHeight: 18 }}>{errorText}</Text>
            <View style={{ marginTop: 10 }}>
              <ActionButton label="Try again" onPress={() => refetch()} variant="secondary" fullWidth />
            </View>
          </View>
        )}

        {!isLoading && !errorText && (
          <>
            <SectionCard title="Tournament activity" subtitle="Events you host and join">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <StatCard label="Hosted" value={String(stats.tournamentsHosted ?? 0)} accent="#7c3aed" />
                <StatCard label="Joined" value={String(stats.tournamentsJoined ?? 0)} accent="#2563eb" />
                <StatCard label="Pending" value={String(stats.registrationsPending ?? 0)} accent="#b45309" />
              </View>
            </SectionCard>

            <View style={{ marginTop: 14 }}>
              <SectionCard title="Match record" subtitle="Completed matches across your tournaments">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <StatCard label="Played" value={String(stats.matchesPlayed ?? 0)} />
                  <StatCard label="Wins" value={String(stats.matchesWon ?? 0)} accent="#166534" />
                  <StatCard label="Losses" value={String(stats.matchesLost ?? 0)} accent="#b91c1c" />
                  <StatCard
                    label="Win rate"
                    value={stats.winRate === null || stats.winRate === undefined ? '—' : `${stats.winRate}%`}
                    accent="#2563eb"
                  />
                </View>
              </SectionCard>
            </View>

            <View style={{ marginTop: 14 }}>
              <SectionCard title="Handicap" subtitle="Lower number = stronger player (APA-style skill index).">
              <TextInput
                style={[tournamentUi.input, { backgroundColor: '#f1f5f9', color: tournamentColors.textMuted }]}
                value={handicapInput}
                editable={false}
                keyboardType="number-pad"
                placeholder="0–300"
              />
              <View style={{ marginTop: 10 }}>
                <ActionButton
                  label="Save Handicap (Coming soon!)"
                  onPress={() => {}}
                  disabled
                  variant="muted"
                  fullWidth
                />
              </View>
            </SectionCard>
            </View>

            {showSetPassword ? (
              <View style={{ marginTop: 14 }}>
                <SectionCard
                  title="Sign-in password"
                  subtitle="Set a password to sign in with email or use forgot-password recovery. Google sign-in still works."
                >
                  {Boolean(passwordSuccessText) && (
                    <View
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: '#ecfdf5',
                        borderWidth: 1,
                        borderColor: '#a7f3d0',
                        marginBottom: 14,
                      }}
                    >
                      <Text style={{ color: '#166534', fontSize: 13, lineHeight: 18 }}>{passwordSuccessText}</Text>
                    </View>
                  )}

                  <AuthField
                    label="New password"
                    placeholder="At least 8 characters"
                    value={passwordInput}
                    onChangeText={(value) => {
                      setPasswordInput(value);
                      setPasswordFieldErrors((current) => ({ ...current, password: '', confirmPassword: '' }));
                      setSaveErrorText('');
                      setPasswordSuccessText('');
                    }}
                    error={passwordFieldErrors.password}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    maxLength={72}
                  />

                  <AuthField
                    label="Confirm password"
                    placeholder="Re-enter your password"
                    value={confirmPasswordInput}
                    onChangeText={(value) => {
                      setConfirmPasswordInput(value);
                      setPasswordFieldErrors((current) => ({ ...current, confirmPassword: '' }));
                      setSaveErrorText('');
                      setPasswordSuccessText('');
                    }}
                    error={passwordFieldErrors.confirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    maxLength={72}
                  />

                  <AuthPasswordMatchHint password={passwordInput} confirmPassword={confirmPasswordInput} />

                  <View style={{ marginTop: 10 }}>
                    <ActionButton
                      label={isSavingPassword ? 'Saving…' : 'Set password'}
                      onPress={async () => {
                        const { errors, sanitized } = setPasswordValidation;
                        setPasswordFieldErrors(errors);

                        if (hasValidationErrors(errors)) {
                          setSaveErrorText('Please fix the highlighted fields.');
                          return;
                        }

                        try {
                          setIsSavingPassword(true);
                          setSaveErrorText('');
                          setPasswordSuccessText('');
                          const updated = await setMyPassword(sanitized.password);
                          queryClient.setQueryData(queryKeys.profile(), updated);
                          setPasswordInput('');
                          setConfirmPasswordInput('');
                          setPasswordSuccessText('Password saved. You can now sign in with email and password.');
                        } catch (error) {
                          setSaveErrorText(error.message || 'Unable to set password.');
                        } finally {
                          setIsSavingPassword(false);
                        }
                      }}
                      disabled={!canSubmitSetPassword}
                      variant={canSubmitSetPassword ? 'primary' : 'muted'}
                      fullWidth
                    />
                  </View>
                </SectionCard>
              </View>
            ) : null}

            {showChangePassword ? (
              <View style={{ marginTop: 14 }}>
                <SectionCard
                  title="Change password"
                  subtitle="Update the password you use to sign in with email."
                >
                  {Boolean(passwordSuccessText) && (
                    <View
                      style={{
                        padding: 12,
                        borderRadius: 12,
                        backgroundColor: '#ecfdf5',
                        borderWidth: 1,
                        borderColor: '#a7f3d0',
                        marginBottom: 14,
                      }}
                    >
                      <Text style={{ color: '#166534', fontSize: 13, lineHeight: 18 }}>{passwordSuccessText}</Text>
                    </View>
                  )}

                  <AuthField
                    label="Current password"
                    placeholder="Enter current password"
                    value={currentPasswordInput}
                    onChangeText={(value) => {
                      setCurrentPasswordInput(value);
                      setPasswordFieldErrors((current) => ({ ...current, currentPassword: '' }));
                      setSaveErrorText('');
                      setPasswordSuccessText('');
                    }}
                    error={passwordFieldErrors.currentPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="password"
                    maxLength={72}
                  />

                  <AuthField
                    label="New password"
                    placeholder="At least 8 characters"
                    value={passwordInput}
                    onChangeText={(value) => {
                      setPasswordInput(value);
                      setPasswordFieldErrors((current) => ({ ...current, password: '', confirmPassword: '' }));
                      setSaveErrorText('');
                      setPasswordSuccessText('');
                    }}
                    error={passwordFieldErrors.password}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    maxLength={72}
                  />

                  <AuthField
                    label="Confirm new password"
                    placeholder="Re-enter new password"
                    value={confirmPasswordInput}
                    onChangeText={(value) => {
                      setConfirmPasswordInput(value);
                      setPasswordFieldErrors((current) => ({ ...current, confirmPassword: '' }));
                      setSaveErrorText('');
                      setPasswordSuccessText('');
                    }}
                    error={passwordFieldErrors.confirmPassword}
                    secureTextEntry
                    autoCapitalize="none"
                    autoCorrect={false}
                    textContentType="newPassword"
                    maxLength={72}
                  />

                  <AuthPasswordMatchHint password={passwordInput} confirmPassword={confirmPasswordInput} />

                  <View style={{ marginTop: 10 }}>
                    <ActionButton
                      label={isSavingPassword ? 'Saving…' : 'Change password'}
                      onPress={async () => {
                        const { errors, sanitized } = changePasswordValidation;
                        setPasswordFieldErrors(errors);

                        if (hasValidationErrors(errors)) {
                          setSaveErrorText('Please fix the highlighted fields.');
                          return;
                        }

                        try {
                          setIsSavingPassword(true);
                          setSaveErrorText('');
                          setPasswordSuccessText('');
                          const updated = await setMyPassword(sanitized.password, sanitized.currentPassword);
                          queryClient.setQueryData(queryKeys.profile(), updated);
                          setCurrentPasswordInput('');
                          setPasswordInput('');
                          setConfirmPasswordInput('');
                          setPasswordFieldErrors({
                            currentPassword: '',
                            password: '',
                            confirmPassword: '',
                          });
                          setPasswordSuccessText('Password updated successfully.');
                        } catch (error) {
                          setSaveErrorText(error.message || 'Unable to change password.');
                        } finally {
                          setIsSavingPassword(false);
                        }
                      }}
                      disabled={!canSubmitChangePassword}
                      variant={canSubmitChangePassword ? 'primary' : 'muted'}
                      fullWidth
                    />
                  </View>
                </SectionCard>
              </View>
            ) : null}
          </>
        )}

        <View style={{ marginTop: 14 }}>
          <SectionCard title="Legal" subtitle="Terms and privacy information">
            <LegalMenuSection />
          </SectionCard>
        </View>

        <View style={{ marginTop: 20 }}>
          <ActionButton label="Sign out" onPress={signOut} variant="danger" fullWidth />
        </View>
      </ScrollView>
    </View>
  );
}
