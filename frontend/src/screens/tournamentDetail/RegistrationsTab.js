import React, { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '../../components/ui/ScaledTextInput';
import { AppIcon } from '../../components/ui/AppIcon';
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

function ReplaceBanner({ replaceTarget, onCancelReplace }) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(-8)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, slideAnim]);

  return (
    <Animated.View
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }],
        padding: 14,
        borderRadius: 12,
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#93c5fd',
        gap: 8,
      }}
    >
      <Text style={{ fontWeight: '800', color: '#1e40af', fontSize: 15 }}>
        Replacing {formatRosterRowTitle(replaceTarget)}
      </Text>
      <Text style={{ color: '#1d4ed8', fontSize: 13, lineHeight: 18 }}>
        Use Search & add players below to find a registered user or add a guest. Scheduled group matches will carry
        over to the replacement.
      </Text>
      {onCancelReplace ? (
        <ActionButton label="Cancel replace" onPress={onCancelReplace} variant="ghost" fullWidth />
      ) : null}
    </Animated.View>
  );
}

function ApprovedRosterRow({ item, onRequestRemoveParticipant, removeDisabled }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        borderRadius: 12,
        padding: 12,
        backgroundColor: '#fafbfc',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
          <Text style={{ fontWeight: '700', fontSize: 15, color: tournamentColors.text }}>
            {formatRosterRowTitle(item)}
          </Text>
          <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>{formatRosterRowSubtitle(item)}</Text>
          {item.isGuest ? (
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
          ) : null}
        </View>
        {onRequestRemoveParticipant ? (
          <Pressable
            onPress={() => onRequestRemoveParticipant(item)}
            disabled={removeDisabled}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${formatRosterRowTitle(item)}`}
            style={({ pressed }) => ({
              padding: 6,
              borderRadius: 8,
              opacity: removeDisabled ? 0.35 : pressed ? 0.7 : 1,
            })}
          >
            <AppIcon name="trash" size={20} color={tournamentColors.error} />
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

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
  scrollRef = null,
}) {
  const [searchSectionExpanded, setSearchSectionExpanded] = useState(false);
  const searchSectionRef = useRef(null);
  const isReplaceMode = Boolean(replaceTarget);

  useEffect(() => {
    if (!isReplaceMode || !scrollRef?.current) {
      return;
    }

    setSearchSectionExpanded(true);

    const scrollTimer = setTimeout(() => {
      searchSectionRef.current?.measure((_x, _y, _width, _height, _pageX, pageY) => {
        const yOffset = Number(pageY);
        if (!Number.isFinite(yOffset)) {
          return;
        }
        scrollRef.current?.scrollTo?.({ y: Math.max(0, yOffset - 96), animated: true });
      });
    }, 320);

    return () => clearTimeout(scrollTimer);
  }, [isReplaceMode, replaceTarget?.id, scrollRef]);

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
        <View style={{ gap: 8 }}>
          {approvedItems.map((item) => (
            <ApprovedRosterRow
              key={item.id}
              item={item}
              onRequestRemoveParticipant={onRequestRemoveParticipant}
              removeDisabled={isReplaceMode}
            />
          ))}
        </View>
      </CollapsibleSectionCard>

      {isReplaceMode ? <ReplaceBanner replaceTarget={replaceTarget} onCancelReplace={onCancelReplace} /> : null}

      <View ref={searchSectionRef}>
        <CollapsibleSectionCard
          title="Search & add players"
          subtitle={
            isReplaceMode
              ? 'Search for a registered player or add a guest to complete the replacement.'
              : 'Find registered users by name or username, or add a guest without an account.'
          }
          expanded={isReplaceMode ? true : searchSectionExpanded}
          onExpandedChange={setSearchSectionExpanded}
          highlighted={isReplaceMode}
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
              <ActionButton
                label={isReplaceMode ? 'Add replacement guest' : 'Add guest'}
                onPress={onOpenAddGuestPlayer}
                variant="secondary"
                fullWidth
              />
            </View>
          </View>
        </CollapsibleSectionCard>
      </View>

      {userSearchResults.length > 0 && (
        <CollapsibleSectionCard
          title={`Search results (${userSearchResults.length})`}
          subtitle="Results from your latest search."
          defaultExpanded
          highlighted={isReplaceMode}
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
                    label={
                      isAdding
                        ? isReplaceMode
                          ? 'Replacing…'
                          : 'Adding…'
                        : isReplaceMode
                          ? 'Use as replacement'
                          : 'Add to roster'
                    }
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
