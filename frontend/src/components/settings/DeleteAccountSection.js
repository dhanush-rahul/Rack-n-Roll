import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ActionButton, SectionCard } from '../tournament/TournamentChrome';
import { AuthField } from '../auth/AuthChrome';
import { ChipSelector } from '../tournament/chrome/ChipSelector';
import { useTheme } from '../../context/ThemeContext';
import { deleteMyAccount, fetchAccountDeletionPreview } from '../../services/userService';
import { getAuthErrorMessage } from '../../utils/authErrors';
import { normalizeUsername } from '../../utils/usernameUtils';

export function DeleteAccountSection({ onDeleted }) {
  const { colors } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [preview, setPreview] = useState(null);
  const [transfers, setTransfers] = useState({});
  const [password, setPassword] = useState('');
  const [usernameConfirmation, setUsernameConfirmation] = useState('');
  const [errorText, setErrorText] = useState('');

  const hostedTournaments = preview?.hostedTournaments || [];

  const transfersReady = useMemo(
    () =>
      hostedTournaments.every((tournament) => {
        const choice = transfers[tournament.id] || {};
        return Boolean(choice.userId) || normalizeUsername(choice.username).length >= 3;
      }),
    [hostedTournaments, transfers]
  );

  const confirmationReady = preview?.requiresPassword
    ? password.length > 0
    : normalizeUsername(usernameConfirmation).length >= 3;

  const openForm = async () => {
    try {
      setErrorText('');
      setIsLoadingPreview(true);
      const nextPreview = await fetchAccountDeletionPreview();
      setPreview(nextPreview);
      setTransfers({});
      setIsOpen(true);
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, 'Unable to prepare account deletion.'));
    } finally {
      setIsLoadingPreview(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!preview) {
      return;
    }

    try {
      setErrorText('');
      setIsDeleting(true);
      await deleteMyAccount({
        password: preview.requiresPassword ? password : undefined,
        usernameConfirmation: preview.requiresPassword ? undefined : normalizeUsername(usernameConfirmation),
        hostTransfers: hostedTournaments.map((tournament) => {
          const choice = transfers[tournament.id] || {};

          if (choice.userId) {
            return { tournamentId: tournament.id, newHostUserId: choice.userId };
          }

          return { tournamentId: tournament.id, newHostUsername: normalizeUsername(choice.username) };
        }),
      });
      await onDeleted?.();
    } catch (error) {
      setErrorText(getAuthErrorMessage(error, error?.message || 'Unable to delete this account.'));
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <SectionCard title="Delete account" subtitle="Remove your login and hand hosting to another player.">
      <Text style={{ color: colors.textMuted, fontSize: 13, marginBottom: 12 }}>
        Tournament results stay on the books. Your name on those rosters becomes &quot;Deleted player.&quot; If you host
        an event, pick another registered player to take over before the account is deleted. A player who is not on the
        roster yet is added when you assign them.
      </Text>
      {Boolean(errorText) && (
        <Text style={{ color: colors.error, fontSize: 13, marginBottom: 10 }}>{errorText}</Text>
      )}
      {!isOpen ? (
        <ActionButton
          label={isLoadingPreview ? 'Loading…' : 'Delete account'}
          onPress={openForm}
          disabled={isLoadingPreview}
          variant="danger"
          fullWidth
        />
      ) : (
        <View style={{ gap: 12 }}>
          {hostedTournaments.map((tournament) => {
            const choice = transfers[tournament.id] || { userId: '', username: '' };

            return (
              <View key={tournament.id} style={{ gap: 8 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{tournament.name}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  Assign a new host before this account can be deleted.
                </Text>
                {tournament.candidates?.length ? (
                  <ChipSelector
                    label="Players in this tournament"
                    options={tournament.candidates.map((candidate) => ({
                      value: candidate.userId,
                      label: candidate.name || candidate.username,
                    }))}
                    value={choice.userId}
                    onChange={(userId) =>
                      setTransfers((current) => ({
                        ...current,
                        [tournament.id]: { userId, username: '' },
                      }))
                    }
                  />
                ) : (
                  <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                    No other registered players are on this roster yet. Enter a username to add one and make them host.
                  </Text>
                )}
                <AuthField
                  label="Or assign by username"
                  placeholder="username"
                  value={choice.username}
                  onChangeText={(value) =>
                    setTransfers((current) => ({
                      ...current,
                      [tournament.id]: { userId: '', username: value },
                    }))
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            );
          })}
          {preview?.requiresPassword ? (
            <AuthField
              label="Current password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
            />
          ) : (
            <AuthField
              label="Type your username to confirm"
              placeholder={preview?.username || 'username'}
              value={usernameConfirmation}
              onChangeText={setUsernameConfirmation}
              autoCapitalize="none"
              autoCorrect={false}
            />
          )}
          <ActionButton
            label={isDeleting ? 'Deleting…' : 'Confirm delete account'}
            onPress={onConfirmDelete}
            disabled={isDeleting || !transfersReady || !confirmationReady}
            variant="danger"
            fullWidth
          />
          <ActionButton label="Cancel" onPress={() => setIsOpen(false)} variant="ghost" fullWidth />
        </View>
      )}
    </SectionCard>
  );
}
