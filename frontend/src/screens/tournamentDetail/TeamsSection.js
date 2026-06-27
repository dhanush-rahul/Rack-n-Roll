import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ui/ScaledTextInput';
import {
  ActionButton,
  CollapsibleSectionCard,
  EmptyStateCard,
  InfoBanner,
  ListRowCard,
  SectionCard,
} from '../../components/tournament/TournamentChrome';
import { ConfirmModal } from '../../components/ConfirmModal';
import {
  breakTournamentTeam,
  fetchTournamentSoloPlayers,
  fetchTournamentTeams,
  hostFormTournamentTeam,
  pickTournamentPartner,
  randomPairTournamentTeams,
  updateTournamentTeamDisplayName,
} from '../../services/tournamentService';
import { tournamentColors, tournamentUi } from '../../styles/tournamentUi';

export function TeamsSection({
  tournamentId,
  isHost = false,
  pairFormationMode = 'playerPicksPartner',
  groupsLocked = false,
  currentUserId = null,
  onTeamsChanged,
  onError,
}) {
  const [teams, setTeams] = useState([]);
  const [soloPlayers, setSoloPlayers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [busyTeamId, setBusyTeamId] = useState(null);
  const [busyAction, setBusyAction] = useState(null);
  const [hostForm, setHostForm] = useState({ player1Id: '', player2Id: '', customDisplayName: '' });
  const [renameDrafts, setRenameDrafts] = useState({});
  const [partnerConfirm, setPartnerConfirm] = useState(null);

  const normalizedCurrentUserId = String(currentUserId || '').trim();

  const loadTeams = useCallback(async () => {
    if (!tournamentId) {
      return;
    }

    setIsLoading(true);

    try {
      const teamsResponse = await fetchTournamentTeams(tournamentId);
      setTeams(teamsResponse?.items || []);

      const solosResponse = await fetchTournamentSoloPlayers(tournamentId);
      setSoloPlayers(solosResponse?.items || []);
    } catch (error) {
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  }, [onError, tournamentId]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  const refresh = useCallback(async () => {
    await loadTeams();
    onTeamsChanged?.();
  }, [loadTeams, onTeamsChanged]);

  const myTeam = useMemo(
    () =>
      teams.find(
        (team) =>
          String(team.player1?.userId || '') === normalizedCurrentUserId ||
          String(team.player2?.userId || '') === normalizedCurrentUserId
      ) || null,
    [normalizedCurrentUserId, teams]
  );

  const canPickPartner =
    pairFormationMode === 'playerPicksPartner' && !groupsLocked && !myTeam && Boolean(normalizedCurrentUserId);

  const partnerCandidates = useMemo(
    () => soloPlayers.filter((player) => String(player.userId || '') !== normalizedCurrentUserId),
    [normalizedCurrentUserId, soloPlayers]
  );

  const awaitingPartnerSolos = soloPlayers.filter((player) => player.awaitingPartner);
  const canManageTeamsAsHost = isHost && !groupsLocked;

  const runAction = async (actionKey, action) => {
    try {
      setBusyAction(actionKey);
      await action();
      await refresh();
    } catch (error) {
      onError?.(error);
    } finally {
      setBusyAction(null);
    }
  };

  const onPickPartner = (partnerPlayerId) =>
    runAction(`pick-${partnerPlayerId}`, () => pickTournamentPartner(tournamentId, partnerPlayerId));

  const onConfirmPartnerUp = async () => {
    if (!partnerConfirm?.id) {
      return;
    }

    const partnerId = partnerConfirm.id;
    setPartnerConfirm(null);
    await onPickPartner(partnerId);
  };

  const renderPartnerRow = (player, isLast = false) => (
    <View
      key={player.id}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: tournamentColors.borderLight,
      }}
    >
      <Text style={{ flex: 1, fontSize: 15, fontWeight: '600', color: tournamentColors.text }}>
        {player.displayName || player.id}
      </Text>
      <Pressable
        onPress={() => setPartnerConfirm(player)}
        disabled={Boolean(busyAction)}
        style={({ pressed }) => ({
          paddingHorizontal: 12,
          paddingVertical: 6,
          borderRadius: 999,
          borderWidth: 1,
          borderColor: tournamentColors.primary,
          backgroundColor: pressed ? '#eff6ff' : tournamentColors.white,
          opacity: busyAction ? 0.6 : 1,
        })}
      >
        <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.primary }}>Partner up</Text>
      </Pressable>
    </View>
  );

  const onRandomPair = () => runAction('random-pair', () => randomPairTournamentTeams(tournamentId));

  const onBreakTeam = async (teamId) => {
    try {
      setBusyTeamId(teamId);
      await breakTournamentTeam(tournamentId, teamId);
      await refresh();
    } catch (error) {
      onError?.(error);
    } finally {
      setBusyTeamId(null);
    }
  };

  const onHostFormTeam = () =>
    runAction('host-form', async () => {
      await hostFormTournamentTeam(tournamentId, {
        player1Id: hostForm.player1Id,
        player2Id: hostForm.player2Id,
        customDisplayName: hostForm.customDisplayName.trim() || undefined,
      });
      setHostForm({ player1Id: '', player2Id: '', customDisplayName: '' });
    });

  const onRenameTeam = async (teamId) => {
    try {
      setBusyTeamId(teamId);
      await updateTournamentTeamDisplayName(tournamentId, teamId, {
        customDisplayName: renameDrafts[teamId] || '',
      });
      await refresh();
    } catch (error) {
      onError?.(error);
    } finally {
      setBusyTeamId(null);
    }
  };

  const canRenameTeam = (team) => {
    if (isHost) {
      return true;
    }

    if (!normalizedCurrentUserId) {
      return false;
    }

    return (
      String(team.player1?.userId || '') === normalizedCurrentUserId ||
      String(team.player2?.userId || '') === normalizedCurrentUserId
    );
  };


  return (
    <View style={{ gap: 14 }}>
      <ConfirmModal
        visible={Boolean(partnerConfirm)}
        icon="teams"
        title="Partner up?"
        message={
          partnerConfirm
            ? `Form a team with ${partnerConfirm.displayName || 'this player'}? You can rename the team after pairing.`
            : ''
        }
        confirmLabel="Partner up"
        cancelLabel="Cancel"
        onConfirm={onConfirmPartnerUp}
        onCancel={() => setPartnerConfirm(null)}
        isLoading={Boolean(busyAction)}
      />

      {groupsLocked && (
        <InfoBanner
          icon="lock"
          tone="info"
          title="Teams are locked"
          message="Groups and fixtures are set. Completed matches keep their original teams."
        />
      )}

      {!isHost && canPickPartner && (
        <SectionCard
          title="Available partners"
          subtitle="Pick a solo player to form your team."
          headerAction={
            <ActionButton label={isLoading ? '…' : 'Refresh'} onPress={refresh} disabled={isLoading} variant="ghost" />
          }
        >
          {isLoading && partnerCandidates.length === 0 && (
            <Text style={{ color: tournamentColors.textMuted, fontSize: 13 }}>Loading players…</Text>
          )}
          {!isLoading && partnerCandidates.length === 0 && (
            <Text style={{ color: tournamentColors.textMuted, fontSize: 13 }}>
              No solo players are available to pair with right now.
            </Text>
          )}
          {partnerCandidates.map((player, index) =>
            renderPartnerRow(player, index === partnerCandidates.length - 1)
          )}
        </SectionCard>
      )}

      {!isHost && !myTeam && !canPickPartner && pairFormationMode === 'hostAssigns' && !groupsLocked && (
        <InfoBanner
          icon="teams"
          tone="info"
          title="Waiting for team assignment"
          message="The host will form teams for this tournament. Check back here once you are on a team."
        />
      )}

      {isHost && (
        <CollapsibleSectionCard
          title={`Teams (${teams.length})`}
          subtitle="Form teams before assigning groups. Either teammate can set a custom team name."
          defaultExpanded
          headerAction={
            <ActionButton label={isLoading ? '…' : 'Refresh'} onPress={refresh} disabled={isLoading} variant="ghost" />
          }
        >
          <View style={{ gap: 14 }}>
            {isLoading && teams.length === 0 && (
              <Text style={{ color: tournamentColors.textMuted, fontSize: 13 }}>Loading teams…</Text>
            )}

            {!isLoading && teams.length === 0 && (
              <EmptyStateCard
                icon="teams"
                title="No teams yet"
                message="Use the host team tools below to form teams before assigning groups."
              />
            )}

            {teams.map((team) => (
              <ListRowCard
                key={team.id}
                title={team.displayName}
                subtitle={`${team.player1?.displayName || 'Player 1'} · ${team.player2?.displayName || 'Player 2'}`}
              >
                {canRenameTeam(team) && (
                  <>
                    <TextInput
                      style={[tournamentUi.input, { marginTop: 8 }]}
                      placeholder="Custom team name (optional)"
                      value={renameDrafts[team.id] ?? team.customDisplayName ?? ''}
                      onChangeText={(value) =>
                        setRenameDrafts((current) => ({
                          ...current,
                          [team.id]: value,
                        }))
                      }
                    />
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                      <ActionButton
                        label={busyTeamId === team.id ? 'Saving…' : 'Save name'}
                        onPress={() => onRenameTeam(team.id)}
                        disabled={busyTeamId === team.id}
                        variant="secondary"
                      />
                      {canManageTeamsAsHost && (
                        <ActionButton
                          label={busyTeamId === team.id ? 'Working…' : 'Break team'}
                          onPress={() => onBreakTeam(team.id)}
                          disabled={busyTeamId === team.id}
                          variant="ghost"
                        />
                      )}
                    </View>
                  </>
                )}
              </ListRowCard>
            ))}

            {soloPlayers.length > 0 && (
              <SectionCard title={`Solo players (${soloPlayers.length})`} subtitle="Approved players not on a team yet.">
                {soloPlayers.map((player) => (
                  <ListRowCard
                    key={player.id}
                    title={player.displayName || player.id}
                    subtitle={player.awaitingPartner ? 'Awaiting partner (bye)' : 'Available to pair'}
                  />
                ))}
              </SectionCard>
            )}

            {awaitingPartnerSolos.length > 0 && (
              <SectionCard
                title="Awaiting partner"
                subtitle="Odd player out until paired or random-paired at group assign."
              >
                {awaitingPartnerSolos.map((player) => (
                  <ListRowCard key={player.id} title={player.displayName || player.id} subtitle="Solo · bye slot" />
                ))}
              </SectionCard>
            )}
          </View>
        </CollapsibleSectionCard>
      )}

      {!isHost && myTeam && (
        <SectionCard
          title="Your team"
          subtitle="Either teammate can set a custom team name."
          headerAction={
            <ActionButton label={isLoading ? '…' : 'Refresh'} onPress={refresh} disabled={isLoading} variant="ghost" />
          }
        >
          {isLoading && (
            <Text style={{ color: tournamentColors.textMuted, fontSize: 13 }}>Loading teams…</Text>
          )}

          {!isLoading && (
            <ListRowCard
              key={myTeam.id}
              title={myTeam.displayName}
              subtitle={`${myTeam.player1?.displayName || 'Player 1'} · ${myTeam.player2?.displayName || 'Player 2'}`}
            >
              {canRenameTeam(myTeam) && (
                <>
                  <TextInput
                    style={[tournamentUi.input, { marginTop: 8 }]}
                    placeholder="Custom team name (optional)"
                    value={renameDrafts[myTeam.id] ?? myTeam.customDisplayName ?? ''}
                    onChangeText={(value) =>
                      setRenameDrafts((current) => ({
                        ...current,
                        [myTeam.id]: value,
                      }))
                    }
                  />
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <ActionButton
                      label={busyTeamId === myTeam.id ? 'Saving…' : 'Save name'}
                      onPress={() => onRenameTeam(myTeam.id)}
                      disabled={busyTeamId === myTeam.id}
                      variant="secondary"
                    />
                  </View>
                </>
              )}
            </ListRowCard>
          )}
        </SectionCard>
      )}

      {canManageTeamsAsHost && (
        <CollapsibleSectionCard
          title="Host team tools"
          subtitle="Form, break, or random-pair teams before assigning groups."
          defaultExpanded={false}
        >
          <ActionButton
            label={busyAction === 'random-pair' ? 'Pairing…' : 'Random-pair all solos'}
            onPress={onRandomPair}
            disabled={Boolean(busyAction) || soloPlayers.length < 2}
            fullWidth
          />
          {soloPlayers.length < 2 && (
            <Text style={{ marginTop: 8, color: tournamentColors.textMuted, fontSize: 13 }}>
              Need at least 2 solo players to random-pair.
            </Text>
          )}

          <View style={{ marginTop: 12, gap: 8 }}>
            <Text style={{ fontWeight: '700', color: tournamentColors.text }}>Form team manually</Text>
            <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>
              Tap two solo players below, then create the team.
            </Text>
            {soloPlayers.length === 0 && (
              <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
                No solo players available. Break an existing team or approve more players first.
              </Text>
            )}
            {soloPlayers.map((player) => (
              <Pressable
                key={player.id}
                onPress={() =>
                  setHostForm((current) => ({
                    ...current,
                    player1Id: current.player1Id ? current.player1Id : player.id,
                    player2Id:
                      current.player1Id && current.player1Id !== player.id
                        ? player.id
                        : current.player2Id === player.id
                          ? ''
                          : current.player2Id,
                  }))
                }
                style={{
                  padding: 10,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor:
                    hostForm.player1Id === player.id || hostForm.player2Id === player.id
                      ? tournamentColors.primary
                      : tournamentColors.border,
                }}
              >
                <Text style={{ fontWeight: '600' }}>{player.displayName}</Text>
                <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>
                  {hostForm.player1Id === player.id
                    ? 'Player 1'
                    : hostForm.player2Id === player.id
                      ? 'Player 2'
                      : 'Tap to select'}
                </Text>
              </Pressable>
            ))}
            <TextInput
              style={tournamentUi.input}
              placeholder="Custom team name (optional)"
              value={hostForm.customDisplayName}
              onChangeText={(value) => setHostForm((current) => ({ ...current, customDisplayName: value }))}
            />
            <ActionButton
              label={busyAction === 'host-form' ? 'Creating…' : 'Create team'}
              onPress={onHostFormTeam}
              disabled={Boolean(busyAction) || !hostForm.player1Id || !hostForm.player2Id}
              fullWidth
            />
          </View>
        </CollapsibleSectionCard>
      )}
    </View>
  );
}
