import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ui/ScaledTextInput';
import {
  ActionButton,
  CollapsibleSectionCard,
  EmptyStateCard,
  ListRowCard,
  SectionCard,
} from '../../components/tournament/TournamentChrome';
import { tournamentColors, tournamentUi } from '../../styles/tournamentUi';
import { ProctorsSection } from './ProctorsSection';
import { TeamsSection } from './TeamsSection';

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
  proctorProps = null,
  isDoubles = false,
  isHost = false,
  tournamentId = null,
  pairFormationMode = 'playerPicksPartner',
  groupsLocked = false,
  currentUserId = null,
  onTeamsChanged,
  onTeamsError,
}) {
  return (
    <View style={{ gap: 14 }}>
      {isRegistrationClosed && (
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
      )}

      {!isRegistrationClosed && (
        <CollapsibleSectionCard
          title={`Pending requests (${pendingItems.length})`}
          subtitle="Approve or reject join requests."
          defaultExpanded={pendingItems.length > 0}
        >
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
        </CollapsibleSectionCard>
      )}

      <CollapsibleSectionCard
        title="Target roster size"
        subtitle="Soft limit for planning. Approvals and manual adds are not blocked when you go over this number."
        defaultExpanded={false}
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
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title={`Approved roster (${approvedItems.length})`}
        subtitle="Everyone in the tournament. Search below to add players manually."
        defaultExpanded
      >
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

        <View style={{ marginTop: approvedItems.length > 0 ? 12 : 0, gap: 8 }}>
          <Text style={{ fontSize: 13, fontWeight: '700', color: tournamentColors.text }}>Add players manually</Text>
          <Text style={{ fontSize: 12, lineHeight: 17, color: tournamentColors.textMuted }}>
            {isRegistrationClosed
              ? 'Host override: search and add players even after registration is closed.'
              : 'Search by name or email and approve them directly.'}
          </Text>
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
        </View>
      </CollapsibleSectionCard>

      {isDoubles && tournamentId && (
        <TeamsSection
          tournamentId={tournamentId}
          isHost={isHost}
          pairFormationMode={pairFormationMode}
          groupsLocked={groupsLocked}
          currentUserId={currentUserId}
          onTeamsChanged={onTeamsChanged}
          onError={onTeamsError}
        />
      )}

      {proctorProps && <ProctorsSection {...proctorProps} />}

      {!isRegistrationClosed && (
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
            <Text style={{ color: tournamentColors.textMuted, fontSize: 13, lineHeight: 18, marginTop: 8 }}>
              Approve at least 2 players before closing registration.
            </Text>
          )}
        </SectionCard>
      )}
    </View>
  );
}
