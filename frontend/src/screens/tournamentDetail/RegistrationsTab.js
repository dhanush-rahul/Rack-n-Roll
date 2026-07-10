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
import {
  formatPendingRowSubtitle,
  formatPendingRowTitle,
  formatRosterRowSubtitle,
  formatRosterRowTitle,
  formatSearchUserSubtitle,
} from '../../utils/rosterDisplay';
import { ProctorsSection } from './ProctorsSection';
import { TeamsSection } from './TeamsSection';

export function RegistrationsTab({
  searchQuery,
  onSearchQueryChange,
  onSearchUsers,
  onClearUserSearch,
  isSearchingUsers,
  userSearchResults,
  busyManualAddUserId,
  onManualAddParticipant,
  onOpenAddGuestPlayer,
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
  onRequestRemoveParticipant,
  replaceTarget = null,
  onCancelReplace,
}) {
  return (
    <View style={{ gap: 14 }}>
      {replaceTarget ? (
        <View
          style={{
            padding: 14,
            borderRadius: 12,
            backgroundColor: '#eff6ff',
            borderWidth: 1,
            borderColor: '#bfdbfe',
          }}
        >
          <Text style={{ fontWeight: '800', color: '#1e40af', fontSize: 15 }}>
            Replacing {formatRosterRowTitle(replaceTarget)}
          </Text>
          <Text style={{ color: '#1d4ed8', fontSize: 13, lineHeight: 18, marginTop: 4 }}>
            Search for a registered player or add a guest below. Scheduled group matches will carry over to the
            replacement.
          </Text>
          {onCancelReplace ? (
            <View style={{ marginTop: 10 }}>
              <ActionButton label="Cancel replace" onPress={onCancelReplace} variant="ghost" fullWidth />
            </View>
          ) : null}
        </View>
      ) : null}
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
            <EmptyStateCard icon="success" title="No pending requests" message="New requests will show up here." />
          )}
          {pendingItems.map((item) => (
            <ListRowCard
              key={item.id}
              title={formatPendingRowTitle(item)}
              subtitle={formatPendingRowSubtitle(item)}
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
        subtitle="Everyone currently in the tournament."
        defaultExpanded
      >
        {isLoadingRegistrations && <Text style={{ color: tournamentColors.textMuted }}>Loading registrations…</Text>}
        {!isLoadingRegistrations && approvedItems.length === 0 && (
          <EmptyStateCard
            icon="players"
            title="No approved players yet"
            message="Approve requests or add players manually to build the roster."
          />
        )}
        {approvedItems.map((item) => (
          <ListRowCard
            key={item.id}
            title={formatRosterRowTitle(item)}
            subtitle={formatRosterRowSubtitle(item)}
          >
            {item.isGuest && (
              <View
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderRadius: 999,
                  backgroundColor: '#fef3c7',
                }}
              >
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#92400e' }}>No account yet</Text>
              </View>
            )}
            {onRequestRemoveParticipant ? (
              <View style={{ marginTop: 8 }}>
                <ActionButton
                  label="Remove"
                  onPress={() => onRequestRemoveParticipant(item)}
                  variant="danger"
                  fullWidth
                />
              </View>
            ) : null}
          </ListRowCard>
        ))}
      </CollapsibleSectionCard>

      <CollapsibleSectionCard
        title="Search & add players"
        subtitle="Find registered users by name or username, or add a guest without an account."
        defaultExpanded={false}
      >
        <Text style={{ fontSize: 12, lineHeight: 17, color: tournamentColors.textMuted }}>
          {isRegistrationClosed
            ? 'Host override: search and add players even after registration is closed.'
            : 'Search by name or username and add them directly.'}
        </Text>
        <TextInput
          style={tournamentUi.input}
          placeholder="Search name or username"
          value={searchQuery}
          onChangeText={onSearchQueryChange}
          autoCapitalize="none"
        />
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={{ flex: 1 }}>
            <ActionButton
              label={isSearchingUsers ? 'Searching…' : 'Search users'}
              onPress={onSearchUsers}
              disabled={isSearchingUsers}
              fullWidth
            />
          </View>
          <View style={{ flex: 1 }}>
            <ActionButton label="Add guest" onPress={onOpenAddGuestPlayer} variant="secondary" fullWidth />
          </View>
        </View>
      </CollapsibleSectionCard>

      {userSearchResults.length > 0 && (
        <CollapsibleSectionCard
          title={`Search results (${userSearchResults.length})`}
          subtitle="Results from your latest search."
          defaultExpanded
        >
          {userSearchResults.map((user) => {
            const isAlreadyApproved = user.registrationStatus === 'approved';
            const isAdding = busyManualAddUserId === user.id;

            return (
              <ListRowCard
                key={user.id}
                title={user.name || user.username || 'Player'}
                subtitle={formatSearchUserSubtitle(user)}
              >
                {isAlreadyApproved ? (
                  <View
                    style={{
                      alignSelf: 'flex-start',
                      marginTop: 4,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                      borderRadius: 999,
                      backgroundColor: '#ecfdf5',
                    }}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#166534' }}>On roster</Text>
                  </View>
                ) : (
                  <ActionButton
                    label={isAdding ? 'Adding…' : 'Add to roster'}
                    onPress={() => onManualAddParticipant(user.id)}
                    disabled={isAdding}
                    variant="secondary"
                    fullWidth
                  />
                )}
              </ListRowCard>
            );
          })}
        </CollapsibleSectionCard>
      )}

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
