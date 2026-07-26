import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';
import { LoadingPlaceholder } from '../components/ui/LoadingPlaceholder';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '../components/ui/ScaledTextInput';
import { useFocusEffect } from '@react-navigation/native';
import { useQueryClient } from '@tanstack/react-query';
import { ActionButton, SectionCard } from '../components/tournament/TournamentChrome';
import { useAuth } from '../context/AuthContext';
import { changeMyUsername } from '../services/userService';
import { useMyProfile } from '../hooks/queries/useMyProfile';
import { queryKeys } from '../hooks/queries/queryKeys';
import { useTabScreenInsets } from '../hooks/useTabScreenInsets';
import { discoverUi, tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { useResponsiveLayout, centeredContentStyle } from '../utils/responsive';
import { WebTwoColumnLayout } from '../components/layout/WebTwoColumnLayout';
import { formatApiError } from '../hooks/useScreenFeedback';
import { getAuthErrorMessage } from '../utils/authErrors';
import { AuthUsernameField } from '../components/auth/AuthUsernameField';
import { useUsernameAvailability } from '../hooks/useUsernameAvailability';
import { normalizeUsername, validateUsernameFormat } from '../utils/usernameUtils';

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
        backgroundColor: tournamentColors.surfaceAlt,
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
  const { currentUser, updateCurrentUser } = useAuth();
  const queryClient = useQueryClient();
  const { scrollPaddingBottom } = useTabScreenInsets();
  const { contentMaxWidth, horizontalPadding, isDesktopWeb } = useResponsiveLayout();
  const {
    data: profile,
    isLoading,
    isFetching,
    error: profileError,
    refetch,
  } = useMyProfile({ enabled: Boolean(currentUser?.id) });

  const [handicapInput, setHandicapInput] = useState('0');
  const [saveErrorText, setSaveErrorText] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [usernameFieldError, setUsernameFieldError] = useState('');
  const [isSavingUsername, setIsSavingUsername] = useState(false);
  const [usernameSuccessText, setUsernameSuccessText] = useState('');

  useEffect(() => {
    if (profile?.user?.handicap !== undefined && profile?.user?.handicap !== null) {
      setHandicapInput(String(profile.user.handicap));
    }
  }, [profile?.user?.handicap]);

  useEffect(() => {
    if (profile?.user?.username) {
      setUsernameInput(profile.user.username);
    }
  }, [profile?.user?.username]);

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
  const currentUsername = profile?.user?.username || currentUser?.username || '';
  const usernameChangesRemaining = Number(profile?.user?.usernameChangesRemaining ?? 0);
  const showUsernameChange = usernameChangesRemaining > 0;

  const usernameChanged =
    normalizeUsername(usernameInput) !== normalizeUsername(currentUsername);

  const { status: usernameAvailabilityStatus, reason: usernameAvailabilityReason, isAvailable: isUsernameAvailable, isChecking: isCheckingUsername } =
    useUsernameAvailability(usernameInput, {
      purpose: 'signup',
      enabled: showUsernameChange && usernameChanged,
    });

  const resolvedUsernameAvailabilityStatus = usernameChanged ? usernameAvailabilityStatus : 'available';

  const canSubmitUsernameChange =
    !isSavingUsername && !isCheckingUsername && usernameChanged && !usernameFieldError && isUsernameAvailable;

  return (
    <View style={[tournamentUi.screen, isDesktopWeb && { backgroundColor: tournamentColors.backgroundAlt }]}>
      <ScrollView
        contentContainerStyle={[
          tournamentUi.content,
          { paddingHorizontal: horizontalPadding },
          centeredContentStyle(contentMaxWidth),
          { paddingBottom: scrollPaddingBottom },
        ]}
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
                backgroundColor: tournamentColors.avatarRingBg,
                borderWidth: 2,
                borderColor: tournamentColors.avatarRingBorder,
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: tournamentColors.heroText, fontSize: 30, fontWeight: '800' }}>{initial}</Text>
            </View>
            <Text style={{ color: tournamentColors.heroText, fontSize: 22, fontWeight: '800' }}>{displayName}</Text>
            <Text style={{ color: tournamentColors.heroSubtext, fontSize: 14, marginTop: 4 }}>
              @{profile?.user?.username || currentUser?.username || 'username'}
            </Text>
            {profile?.user?.email ? (
              <Text style={{ color: tournamentColors.mutedIcon, fontSize: 12, marginTop: 4 }}>{profile.user.email}</Text>
            ) : null}
            <Text style={{ color: tournamentColors.mutedIcon, fontSize: 12, marginTop: 6 }}>
              Member since {formatMemberSince(profile?.user?.memberSince)}
            </Text>
          </View>
        </View>

        {isLoading && <LoadingPlaceholder message="Loading profile…" />}

        {Boolean(errorText) && !isLoading && (
          <View
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: tournamentColors.errorSurface,
              borderWidth: 1,
              borderColor: tournamentColors.errorBorder,
              marginBottom: 14,
            }}
          >
            <Text style={{ color: tournamentColors.error, fontSize: 13, lineHeight: 18 }}>{errorText}</Text>
            <View style={{ marginTop: 10 }}>
              <ActionButton label="Try again" onPress={() => refetch()} variant="secondary" fullWidth />
            </View>
          </View>
        )}

        {!isLoading && !errorText && (
          <WebTwoColumnLayout
            left={
              <View style={{ gap: 14 }}>
                <SectionCard title="Tournament activity" subtitle="Events you host and join">
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    <StatCard label="Hosted" value={String(stats.tournamentsHosted ?? 0)} accent={tournamentColors.accentPurple} />
                    <StatCard label="Joined" value={String(stats.tournamentsJoined ?? 0)} accent={tournamentColors.accentBlue} />
                    <StatCard label="Pending" value={String(stats.registrationsPending ?? 0)} accent={tournamentColors.accentAmber} />
                  </View>
                </SectionCard>

                <SectionCard title="Match record" subtitle="Completed matches across your tournaments">
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                    <StatCard label="Played" value={String(stats.matchesPlayed ?? 0)} />
                    <StatCard label="Wins" value={String(stats.matchesWon ?? 0)} accent={tournamentColors.accentGreen} />
                    <StatCard label="Losses" value={String(stats.matchesLost ?? 0)} accent={tournamentColors.accentRed} />
                    <StatCard
                      label="Win rate"
                      value={stats.winRate === null || stats.winRate === undefined ? '—' : `${stats.winRate}%`}
                      accent={tournamentColors.accentBlue}
                    />
                  </View>
                </SectionCard>

                <SectionCard title="Handicap" subtitle="Lower number = stronger player (APA-style skill index).">
                  <TextInput
                    style={[tournamentUi.input, { backgroundColor: tournamentColors.inputFill, color: tournamentColors.textMuted }]}
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
            }
            right={
              <View style={{ gap: 14 }}>
                {showUsernameChange ? (
                  <SectionCard
                    title="Username"
                    subtitle={`You can change your username ${usernameChangesRemaining} more time${usernameChangesRemaining === 1 ? '' : 's'}. Tournament guest invites with a matching username will link automatically.`}
                  >
                    {Boolean(usernameSuccessText) && (
                      <View
                        style={{
                          padding: 12,
                          borderRadius: 12,
                          backgroundColor: tournamentColors.successSurface,
                          borderWidth: 1,
                          borderColor: tournamentColors.successBorder,
                          marginBottom: 14,
                        }}
                      >
                        <Text style={{ color: tournamentColors.statusSuccessText, fontSize: 13, lineHeight: 18 }}>{usernameSuccessText}</Text>
                      </View>
                    )}

                    <AuthUsernameField
                      label="Username"
                      placeholder="Enter username"
                      value={usernameInput}
                      onChangeText={(value) => {
                        setUsernameInput(value);
                        setUsernameFieldError('');
                        setSaveErrorText('');
                        setUsernameSuccessText('');
                      }}
                      error={usernameFieldError}
                      availabilityStatus={resolvedUsernameAvailabilityStatus}
                      availabilityReason={usernameAvailabilityReason}
                      helperText="Lowercase letters, numbers, and underscores only."
                    />

                    <View style={{ marginTop: 10 }}>
                      <ActionButton
                        label={isSavingUsername ? 'Saving…' : 'Update username'}
                        onPress={async () => {
                          const normalized = normalizeUsername(usernameInput);
                          const formatError = validateUsernameFormat(normalized);
                          setUsernameFieldError(formatError);

                          if (formatError) {
                            setSaveErrorText('Choose a valid username.');
                            return;
                          }

                          if (!usernameChanged) {
                            setSaveErrorText('Enter a different username to update.');
                            return;
                          }

                          if (!isUsernameAvailable) {
                            setSaveErrorText('Choose an available username.');
                            return;
                          }

                          try {
                            setIsSavingUsername(true);
                            setSaveErrorText('');
                            setUsernameSuccessText('');
                            const result = await changeMyUsername(normalized);
                            updateCurrentUser(result.user);
                            queryClient.setQueryData(queryKeys.profile(), (current) =>
                              current ? { ...current, user: result.user } : current
                            );
                            setUsernameSuccessText(
                              `Username updated to @${result.user?.username || normalized}. ${result.usernameChangesRemaining} change${result.usernameChangesRemaining === 1 ? '' : 's'} remaining.`
                            );
                          } catch (error) {
                            setSaveErrorText(getAuthErrorMessage(error, 'Unable to update username.'));
                          } finally {
                            setIsSavingUsername(false);
                          }
                        }}
                        disabled={!canSubmitUsernameChange}
                        variant={canSubmitUsernameChange ? 'primary' : 'muted'}
                        fullWidth
                      />
                    </View>
                  </SectionCard>
                ) : null}
              </View>
            }
          />
        )}
      </ScrollView>
    </View>
  );
}
