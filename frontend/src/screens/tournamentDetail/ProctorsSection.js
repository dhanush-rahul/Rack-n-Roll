import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ui/ScaledTextInput';
import {
  ActionButton,
  InfoBanner,
  ListRowCard,
  SectionCard,
} from '../../components/tournament/TournamentChrome';
import { tournamentColors, tournamentUi } from '../../styles/tournamentUi';

function resolveRegistrationUserId(item) {
  return String(item?.user?.id || item?.userId || '').trim();
}

export function ProctorsSection({
  hostUserId,
  proctorUserIds = [],
  approvedRoster = [],
  proctorTransferRequest,
  currentUserId,
  searchQuery,
  onSearchQueryChange,
  onSearchUsers,
  isSearchingUsers,
  userSearchResults,
  busyProctorUserId,
  onAssignProctor,
  onAssignProctors,
  onRemoveProctor,
  onRequestTransfer,
  onAcceptTransfer,
  onDeclineTransfer,
  isProgressing,
}) {
  const [selectedUserIds, setSelectedUserIds] = useState([]);

  const pendingForMe =
    proctorTransferRequest?.toUserId &&
    String(proctorTransferRequest.toUserId) === String(currentUserId);

  const normalizedHostUserId = String(hostUserId || '').trim();

  const proctorIdSet = useMemo(
    () => new Set(proctorUserIds.map((id) => String(id))),
    [proctorUserIds]
  );

  const rosterDisplayEntries = useMemo(() => {
    const entriesByUserId = new Map();

    approvedRoster.forEach((item) => {
      const userId = resolveRegistrationUserId(item);
      if (!userId || (normalizedHostUserId && userId === normalizedHostUserId)) {
        return;
      }
      entriesByUserId.set(userId, {
        userId,
        name: item.user?.name || item.user?.email || userId,
        email: item.user?.email || '',
        isAssigned: proctorIdSet.has(userId),
      });
    });

    proctorUserIds.forEach((userId) => {
      const normalizedUserId = String(userId);
      if (normalizedHostUserId && normalizedUserId === normalizedHostUserId) {
        return;
      }
      if (!entriesByUserId.has(normalizedUserId)) {
        entriesByUserId.set(normalizedUserId, {
          userId: normalizedUserId,
          name: `Proctor · ${normalizedUserId.slice(-6)}`,
          email: '',
          isAssigned: true,
        });
      }
    });

    return [...entriesByUserId.values()].sort((left, right) => {
      if (left.isAssigned !== right.isAssigned) {
        return left.isAssigned ? -1 : 1;
      }
      return left.name.localeCompare(right.name);
    });
  }, [approvedRoster, normalizedHostUserId, proctorIdSet, proctorUserIds]);

  const assignableFromRoster = useMemo(
    () => rosterDisplayEntries.filter((entry) => !entry.isAssigned),
    [rosterDisplayEntries]
  );

  const toggleSelected = (userId, isAssigned) => {
    if (isAssigned) {
      return;
    }
    setSelectedUserIds((current) => {
      const normalized = String(userId);
      if (current.includes(normalized)) {
        return current.filter((id) => id !== normalized);
      }
      return [...current, normalized];
    });
  };

  const onAssignSelected = async () => {
    if (selectedUserIds.length === 0 || !onAssignProctors) {
      return;
    }
    await onAssignProctors(selectedUserIds);
    setSelectedUserIds([]);
  };

  const onAssignAllApproved = async () => {
    if (!onAssignProctors || assignableFromRoster.length === 0) {
      return;
    }
    await onAssignProctors(assignableFromRoster.map((entry) => entry.userId));
    setSelectedUserIds([]);
  };

  return (
    <SectionCard
      title="Proctors"
      subtitle="Assign any number of approved players. Only one person scores a live match at a time; the host can take over immediately."
    >
      {pendingForMe && (
        <View style={{ marginBottom: 12, gap: 8 }}>
          <InfoBanner
            icon="target"
            tone="warning"
            title="Proctor handoff requested"
            message="Another proctor asked you to take over scoring for this tournament."
          />
          <ActionButton
            label={isProgressing ? 'Working…' : 'Accept takeover'}
            onPress={onAcceptTransfer}
            disabled={isProgressing}
            fullWidth
          />
          <ActionButton
            label="Decline"
            onPress={onDeclineTransfer}
            disabled={isProgressing}
            variant="ghost"
            fullWidth
          />
        </View>
      )}

      {rosterDisplayEntries.length > 0 && (
        <View style={{ gap: 10, marginBottom: 14 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: tournamentColors.text }}>
            From approved roster
          </Text>
          {rosterDisplayEntries.map((entry) => {
            const isSelected = selectedUserIds.includes(entry.userId);
            const isDisabled = entry.isAssigned;
            return (
              <Pressable
                key={entry.userId}
                onPress={() => toggleSelected(entry.userId, entry.isAssigned)}
                disabled={isDisabled}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 8,
                  paddingHorizontal: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: isDisabled
                    ? tournamentColors.borderLight
                    : isSelected
                      ? tournamentColors.primary
                      : tournamentColors.borderLight,
                  backgroundColor: isDisabled
                    ? '#f8fafc'
                    : isSelected
                      ? 'rgba(37, 99, 235, 0.08)'
                      : tournamentColors.white,
                  opacity: isDisabled ? 0.85 : 1,
                }}
              >
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 6,
                    borderWidth: 2,
                    borderColor: isDisabled
                      ? tournamentColors.borderLight
                      : isSelected
                        ? tournamentColors.primary
                        : tournamentColors.border,
                    backgroundColor: isDisabled
                      ? '#e2e8f0'
                      : isSelected
                        ? tournamentColors.primary
                        : 'transparent',
                  }}
                />
                <View style={{ flex: 1 }}>
                  <Text
                    style={{
                      fontSize: 14,
                      fontWeight: '700',
                      color: isDisabled ? tournamentColors.textMuted : tournamentColors.text,
                    }}
                  >
                    {entry.name}
                  </Text>
                  {entry.isAssigned ? (
                    <Text style={{ fontSize: 12, color: '#166534', fontWeight: '600' }}>Already assigned</Text>
                  ) : (
                    Boolean(entry.email) && (
                      <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>{entry.email}</Text>
                    )
                  )}
                </View>
                {entry.isAssigned && (
                  <ActionButton
                    label={busyProctorUserId === entry.userId ? '…' : 'Remove'}
                    onPress={() => onRemoveProctor(entry.userId)}
                    disabled={busyProctorUserId === entry.userId || isProgressing}
                    variant="ghost"
                  />
                )}
              </Pressable>
            );
          })}
          {assignableFromRoster.length > 0 && (
            <>
              <ActionButton
                label={
                  isProgressing
                    ? 'Working…'
                    : `Assign selected (${selectedUserIds.length})`
                }
                onPress={onAssignSelected}
                disabled={isProgressing || selectedUserIds.length === 0}
                fullWidth
              />
              <ActionButton
                label={
                  isProgressing
                    ? 'Working…'
                    : `Assign all approved (${assignableFromRoster.length})`
                }
                onPress={onAssignAllApproved}
                disabled={isProgressing}
                variant="secondary"
                fullWidth
              />
            </>
          )}
        </View>
      )}

      {rosterDisplayEntries.length === 0 && proctorUserIds.length === 0 && (
        <Text style={{ color: tournamentColors.textMuted, fontSize: 13, marginBottom: 10 }}>
          No proctors assigned yet. Assign from the roster below or search for users.
        </Text>
      )}

      <View style={{ gap: 8 }}>
        <Text style={{ fontSize: 13, fontWeight: '700', color: tournamentColors.text }}>Search users</Text>
        <TextInput
          style={tournamentUi.input}
          placeholder="Search players by name or email"
          value={searchQuery}
          onChangeText={onSearchQueryChange}
        />
        <ActionButton
          label={isSearchingUsers ? 'Searching…' : 'Search'}
          onPress={onSearchUsers}
          disabled={isSearchingUsers || !searchQuery.trim()}
          variant="secondary"
          fullWidth
        />
        {userSearchResults.map((user) => {
          const userId = String(user.id);
          const isHostPlayer = normalizedHostUserId && userId === normalizedHostUserId;
          if (isHostPlayer) {
            return null;
          }
          const alreadyAssigned = proctorIdSet.has(userId);
          return (
            <ListRowCard
              key={user.id}
              title={user.name || user.email}
              subtitle={alreadyAssigned ? 'Already a proctor' : user.email}
              trailing={
                <ActionButton
                  label={busyProctorUserId === user.id ? '…' : 'Assign'}
                  onPress={() => onAssignProctor(user.id)}
                  disabled={alreadyAssigned || busyProctorUserId === user.id || isProgressing}
                />
              }
            />
          );
        })}
      </View>

      {proctorUserIds.includes(String(currentUserId)) &&
        userSearchResults.map((user) => (
          <View key={`transfer-${user.id}`} style={{ marginTop: 8 }}>
            <ActionButton
              label={`Request handoff to ${user.name || user.email}`}
              onPress={() => onRequestTransfer(user.id)}
              disabled={isProgressing || proctorUserIds.includes(String(user.id))}
              variant="secondary"
              fullWidth
            />
          </View>
        ))}
    </SectionCard>
  );
}
