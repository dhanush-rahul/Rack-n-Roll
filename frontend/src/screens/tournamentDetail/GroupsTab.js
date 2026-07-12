import React, { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { LoadingPlaceholder } from '../../components/ui/LoadingPlaceholder';
import {
  ActionButton,
  ChipSelector,
  EmptyStateCard,
  GroupStandingsCard,
  InfoBanner,
  SectionCard,
  TabStatsRow,
} from '../../components/tournament/TournamentChrome';
import { AppIcon } from '../../components/ui/AppIcon';
import { tournamentColors } from '../../styles/tournamentUi';

const GROUP_COUNT_OPTIONS = Array.from({ length: 8 }, (_, index) => ({
  value: String(index + 1),
  label: `${index + 1} group${index === 0 ? '' : 's'}`,
}));
const GROUP_STAGE_BEST_OF_OPTIONS = [
  { value: '1', label: 'Best of 1' },
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
];

export function GroupsTab({
  canShowGroupAssignmentStep,
  hasGroupFixtures,
  groupCountInput,
  onGroupCountChange,
  groupStageBestOfInput,
  onGroupStageBestOfChange,
  pairTeamsRandomInput = false,
  onPairTeamsRandomChange,
  soloPlayerCount = null,
  isDoubles = false,
  isProgressing,
  onAssignGroups,
  isLoadingGroupsTab,
  onLoadGroupsTab,
  finalStagePlayers,
  groupsTabItems,
  resolvePlayerGameStats,
  isHost,
  configuredGroupCount,
  groupStageBestOf,
  isTournamentCompleted,
  finalStageEnabled = false,
  finaleStandings = [],
  handicapEnabled = false,
  progressionStandingsSections = [],
}) {
  const [standingsView, setStandingsView] = useState('team');

  const finaleMode = Boolean(finalStageEnabled);

  const formatTeamRowLabel = (team) => {
    if (!team) {
      return '';
    }

    const playerOne = team.player1?.displayName;
    const playerTwo = team.player2?.displayName;

    if (playerOne && playerTwo) {
      return `${playerOne} · ${playerTwo}`;
    }

    return team.displayName || team.id || '';
  };

  const mapTeamStandingsForDisplay = (teamStandings = []) =>
    teamStandings.map((entry) => ({
      ...entry,
      playerId: entry.teamId,
      player: {
        displayName: formatTeamRowLabel(entry.team) || entry.teamId,
      },
    }));

  const mapPlayerStandingsForDisplay = (playerStandings = []) =>
    playerStandings.map((entry) => ({
      ...entry,
      playerId: entry.playerId,
      player: entry.player || (entry.playerName ? { displayName: entry.playerName } : null),
    }));

  const finaleDisplayStandings = useMemo(() => {
    if (!finaleMode) {
      return [];
    }

    const source = finaleStandings.length > 0 ? finaleStandings : finalStagePlayers;

    if (isDoubles && source.some((entry) => entry.teamId)) {
      return mapTeamStandingsForDisplay(source);
    }

    return mapPlayerStandingsForDisplay(source);
  }, [finaleMode, finaleStandings, finalStagePlayers, isDoubles]);

  const totalPlayers = useMemo(
    () =>
      groupsTabItems.reduce((sum, group) => sum + (group.standings || []).length, 0),
    [groupsTabItems]
  );

  const totalTeams = useMemo(
    () =>
      groupsTabItems.reduce((sum, group) => sum + (group.teamStandings || []).length, 0),
    [groupsTabItems]
  );

  const tabStats = useMemo(() => {
    const stats = [
      { label: 'GROUPS', value: String(groupsTabItems.length || configuredGroupCount || 0) },
      isDoubles
        ? { label: 'TEAMS', value: String(totalTeams) }
        : { label: 'PLAYERS', value: String(totalPlayers) },
    ];

    if (isDoubles) {
      stats.push({ label: 'PLAYERS', value: String(totalPlayers) });
    }

    if (groupStageBestOf) {
      stats.push({ label: 'SERIES', value: `Bo${groupStageBestOf}`, accent: tournamentColors.primary });
    }

    return stats;
  }, [configuredGroupCount, groupStageBestOf, groupsTabItems.length, isDoubles, totalPlayers, totalTeams]);

  return (
    <View>
      {tabStats.some((stat) => stat.value !== '0') && (
        <View style={{ marginBottom: 14 }}>
          <TabStatsRow stats={tabStats} />
        </View>
      )}

      {isHost && canShowGroupAssignmentStep && !hasGroupFixtures && (
        <View style={{ marginBottom: 14 }}>
          <SectionCard
            title="Create groups & fixtures"
            subtitle={
              isDoubles
                ? 'Teams are distributed evenly. Each group gets a double round-robin team schedule.'
                : 'Players are distributed evenly. Each group gets a double round-robin schedule.'
            }
          >
            {isDoubles && soloPlayerCount > 0 && (
              <Pressable
                onPress={() => onPairTeamsRandomChange?.(!pairTeamsRandomInput)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  padding: 12,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: pairTeamsRandomInput ? tournamentColors.primary : tournamentColors.border,
                  backgroundColor: pairTeamsRandomInput ? '#eff6ff' : tournamentColors.white,
                  marginBottom: 8,
                }}
              >
                <AppIcon
                  name={pairTeamsRandomInput ? 'checkboxOn' : 'checkboxOff'}
                  size={22}
                  color={pairTeamsRandomInput ? tournamentColors.primary : tournamentColors.textMuted}
                />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '700', color: tournamentColors.text }}>Random-pair solos first</Text>
                  <Text style={{ fontSize: 12, color: tournamentColors.textMuted, marginTop: 2 }}>
                    Pair unpartnered players automatically, or leave exactly one bye before assigning.
                  </Text>
                </View>
              </Pressable>
            )}
            <ChipSelector
              label="Number of groups"
              options={GROUP_COUNT_OPTIONS}
              value={groupCountInput}
              onChange={onGroupCountChange}
            />
            <ChipSelector
              label="Match series length"
              options={GROUP_STAGE_BEST_OF_OPTIONS}
              value={groupStageBestOfInput}
              onChange={onGroupStageBestOfChange}
            />
            <View style={{ marginTop: 8 }}>
              <ActionButton
                label={isProgressing ? 'Working…' : 'Assign groups & generate fixtures'}
                onPress={onAssignGroups}
                disabled={isProgressing}
                fullWidth
              />
            </View>
          </SectionCard>
        </View>
      )}

      {isTournamentCompleted && (
        <View style={{ marginBottom: 14 }}>
          <InfoBanner
            icon="trophy"
            tone="success"
            title="Tournament complete"
            message={
              finaleMode
                ? 'Top 3 finale places are medalled below. Group tables are for reference only.'
                : 'Top 3 players in each group are medalled below based on final group-stage standings.'
            }
          />
        </View>
      )}

      {isHost && hasGroupFixtures && !isTournamentCompleted && (
        <View style={{ marginBottom: 14 }}>
          <InfoBanner
            icon="lock"
            tone="info"
            title="Group setup complete"
            message="New players from the Players tab are auto-assigned to the smallest group with extra fixtures added."
          />
        </View>
      )}

      {progressionStandingsSections.map((section, index) => {
        const displayStandings =
          isDoubles && standingsView === 'team'
            ? mapTeamStandingsForDisplay(section.teamStandings || [])
            : section.standings || [];

        return (
          <View key={section.stageId} style={{ marginBottom: 14 }}>
            <SectionCard
              title={section.stageName}
              subtitle="Standings from completed matches in this round."
            >
              <GroupStandingsCard
                groupName={section.stageName}
                standings={displayStandings}
                showScoresheetStats={false}
                showTopThreeMedals={isTournamentCompleted && index === 0}
                medalCount={3}
              />
            </SectionCard>
          </View>
        );
      })}

      <SectionCard
        title="Standings by group"
        subtitle="Rankings refresh when you save scores on the Games tab."
        headerAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {isDoubles && (
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {['team', 'player'].map((view) => {
                  const selected = standingsView === view;
                  return (
                    <Pressable
                      key={view}
                      onPress={() => setStandingsView(view)}
                      style={{
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        borderWidth: 1,
                        borderColor: selected ? tournamentColors.primary : tournamentColors.border,
                        backgroundColor: selected ? '#eff6ff' : tournamentColors.white,
                      }}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '700', color: selected ? tournamentColors.primary : tournamentColors.textMuted }}>
                        {view === 'team' ? 'Teams' : 'Players'}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            )}
            <ActionButton
              label={isLoadingGroupsTab ? '…' : 'Refresh'}
              onPress={onLoadGroupsTab}
              disabled={isLoadingGroupsTab}
              variant="ghost"
            />
          </View>
        }
      >
        {isLoadingGroupsTab && groupsTabItems.length === 0 && (
          <LoadingPlaceholder message="Loading standings…" compact />
        )}

        {finaleMode && finaleDisplayStandings.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <GroupStandingsCard
              groupName={isTournamentCompleted ? 'Tournament results' : 'Finale standings'}
              standings={finaleDisplayStandings}
              entityLabel={isDoubles ? 'Team' : 'Player'}
              showTopThreeMedals
              medalCount={3}
            />
          </View>
        )}

        {!isLoadingGroupsTab && groupsTabItems.length === 0 && (
          <EmptyStateCard
            icon="clipboardList"
            title="No groups yet"
            message="Close registration on the Players tab, then assign groups here."
          />
        )}

        {groupsTabItems.map((group, index) => {
          const displayStandings =
            isDoubles && standingsView === 'team'
              ? mapTeamStandingsForDisplay(group.teamStandings || [])
              : group.standings || [];

          return (
          <View key={group.divisionId} style={{ marginBottom: index === groupsTabItems.length - 1 ? 0 : 12 }}>
            <GroupStandingsCard
              groupName={group.divisionName}
              standings={displayStandings}
              resolvePlayerGameStats={resolvePlayerGameStats}
              showScoresheetStats
              handicapEnabled={isDoubles ? false : handicapEnabled}
              showTopThreeMedals={isTournamentCompleted && !finaleMode}
              medalCount={3}
            />
          </View>
          );
        })}
      </SectionCard>
    </View>
  );
}
