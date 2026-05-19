import React from 'react';
import { Text, TextInput, View } from 'react-native';
import {
  ActionButton,
  EmptyStateCard,
  ListRowCard,
  SectionCard,
} from '../../components/tournament/TournamentChrome';
import { tournamentColors, tournamentUi } from '../../styles/tournamentUi';

export function RegistrationsTab({
  searchQuery,
  onSearchQueryChange,
  onSearchUsers,
  isSearchingUsers,
  userSearchResults,
  busyManualAddUserId,
  onManualAddParticipant,
  pendingItems,
  approvedItems,
  isLoadingRegistrations,
  busyRegistrationId,
  onReviewRegistration,
  isRegistrationClosed,
  isCloseDisabled,
  isProgressing,
  onCloseRegistration,
  onGoToGroupsTab,
  maxParticipantsInput,
  onMaxParticipantsInputChange,
  onSaveMaxParticipants,
  isSavingMaxParticipants,
}) {
  return (
    <View style={{ gap: 14 }}>
      {isRegistrationClosed ? (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: '#fff7ed',
            borderWidth: 1,
            borderColor: '#fed7aa',
          }}
        >
          <Text style={{ fontWeight: '800', color: '#9a3412', fontSize: 15 }}>Registration closed</Text>
          <Text style={{ color: '#c2410c', fontSize: 13, lineHeight: 18, marginTop: 4 }}>
            The roster is locked for players. You can still add participants manually as host and they will be placed
            into a group when fixtures exist.
          </Text>
        </View>
      ) : (
        <SectionCard
          title="Close registration"
          subtitle="Requires at least 2 approved players. You will configure groups next."
        >
          <ActionButton
            label={isProgressing ? 'Working…' : 'Close registration & go to groups'}
            onPress={async () => {
              await onCloseRegistration();
              onGoToGroupsTab();
            }}
            disabled={isCloseDisabled || isProgressing}
            variant={isCloseDisabled ? 'muted' : 'primary'}
            fullWidth
          />
          {isCloseDisabled && (
            <Text style={{ color: tournamentColors.textMuted, fontSize: 13, lineHeight: 18 }}>
              Approve at least 2 players before closing registration.
            </Text>
          )}
        </SectionCard>
      )}

      <SectionCard
        title="Target roster size"
        subtitle="Soft limit for planning. Approvals and manual adds are not blocked when you go over this number."
      >
        <TextInput
          style={tournamentUi.input}
          placeholder="Max participants"
          value={maxParticipantsInput}
          onChangeText={onMaxParticipantsInputChange}
          keyboardType="number-pad"
        />
        <ActionButton
          label={isSavingMaxParticipants ? 'Saving…' : 'Save target size'}
          onPress={onSaveMaxParticipants}
          disabled={isSavingMaxParticipants}
          variant="secondary"
          fullWidth
        />
      </SectionCard>

      <SectionCard title={`Approved roster (${approvedItems.length})`} subtitle="Everyone currently in the tournament.">
        {isLoadingRegistrations && <Text style={{ color: tournamentColors.textMuted }}>Loading registrations…</Text>}
        {!isLoadingRegistrations && approvedItems.length === 0 && (
          <EmptyStateCard
            emoji="👥"
            title="No approved players yet"
            message="Approve requests or add players manually to build the roster."
          />
        )}
        {approvedItems.map((item) => (
          <ListRowCard
            key={item.id}
            title={item.user?.name || item.user?.email || item.userId}
            subtitle={item.user?.email || item.userId}
          />
        ))}
      </SectionCard>

      <SectionCard
        title="Add players manually"
        subtitle={
          isRegistrationClosed
            ? 'Host override: search and add players even after registration is closed.'
            : 'Search by name or email and approve them directly.'
        }
      >
        <TextInput
          style={tournamentUi.input}
          placeholder="Search name or email"
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          autoCapitalize="none"
        />
        <ActionButton
          label={isSearchingUsers ? 'Searching…' : 'Search users'}
          onPress={onSearchUsers}
          disabled={isSearchingUsers}
          fullWidth
        />

        {userSearchResults.map((user) => {
          const isAlreadyApproved = user.registrationStatus === 'approved';

          return (
            <ListRowCard
              key={user.id}
              title={user.name || user.email || user.id}
              subtitle={user.email || 'No email on file'}
            >
              <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
                Status: {user.registrationStatus || 'none'}
              </Text>
              <ActionButton
                label={busyManualAddUserId === user.id ? 'Adding…' : 'Add to roster'}
                onPress={() => onManualAddParticipant(user.id)}
                disabled={isAlreadyApproved || busyManualAddUserId === user.id}
                variant={isAlreadyApproved ? 'muted' : 'secondary'}
                fullWidth
              />
            </ListRowCard>
          );
        })}
      </SectionCard>

      {!isRegistrationClosed && (
        <SectionCard title={`Pending requests (${pendingItems.length})`} subtitle="Approve or reject join requests.">
          {isLoadingRegistrations && (
            <Text style={{ color: tournamentColors.textMuted }}>Loading registrations…</Text>
          )}
          {!isLoadingRegistrations && pendingItems.length === 0 && (
            <EmptyStateCard emoji="✅" title="No pending requests" message="New requests will show up here." />
          )}
          {pendingItems.map((item) => (
            <ListRowCard
              key={item.id}
              title={item.user?.name || item.user?.email || item.userId}
              subtitle={item.user?.email || item.userId}
            >
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    label={busyRegistrationId === item.id ? 'Working…' : 'Approve'}
                    onPress={() => onReviewRegistration(item.id, 'approved')}
                    disabled={busyRegistrationId === item.id}
                    fullWidth
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <ActionButton
                    label={busyRegistrationId === item.id ? 'Working…' : 'Reject'}
                    onPress={() => onReviewRegistration(item.id, 'rejected')}
                    disabled={busyRegistrationId === item.id}
                    variant="danger"
                    fullWidth
                  />
                </View>
              </View>
            </ListRowCard>
          ))}
        </SectionCard>
      )}
    </View>
  );
}
