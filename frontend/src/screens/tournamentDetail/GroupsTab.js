import React, { useMemo } from 'react';
import { Text, View } from 'react-native';
import {
  ActionButton,
  ChipSelector,
  EmptyStateCard,
  GroupStandingsCard,
  InfoBanner,
  SectionCard,
  TabStatsRow,
} from '../../components/tournament/TournamentChrome';
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
}) {
  const totalPlayers = useMemo(
    () =>
      groupsTabItems.reduce((sum, group) => sum + (group.standings || []).length, 0),
    [groupsTabItems]
  );

  const tabStats = useMemo(() => {
    const stats = [
      { label: 'GROUPS', value: String(groupsTabItems.length || configuredGroupCount || 0) },
      { label: 'PLAYERS', value: String(totalPlayers) },
    ];

    if (groupStageBestOf) {
      stats.push({ label: 'SERIES', value: `Bo${groupStageBestOf}`, accent: tournamentColors.primary });
    }

    return stats;
  }, [configuredGroupCount, groupStageBestOf, groupsTabItems.length, totalPlayers]);

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
            subtitle="Players are distributed evenly. Each group gets a double round-robin schedule."
          >
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
            emoji="🏆"
            tone="success"
            title="Tournament complete"
            message="Top 3 players in each group are medalled below based on final group-stage standings."
          />
        </View>
      )}

      {isHost && hasGroupFixtures && !isTournamentCompleted && (
        <View style={{ marginBottom: 14 }}>
          <InfoBanner
            emoji="🔒"
            tone="info"
            title="Group setup complete"
            message="New players from the Players tab are auto-assigned to the smallest group with extra fixtures added."
          />
        </View>
      )}

      <SectionCard
        title="Standings by group"
        subtitle="Rankings refresh when you save scores on the Games tab."
        headerAction={
          <ActionButton
            label={isLoadingGroupsTab ? '…' : 'Refresh'}
            onPress={onLoadGroupsTab}
            disabled={isLoadingGroupsTab}
            variant="ghost"
          />
        }
      >
        {isLoadingGroupsTab && groupsTabItems.length === 0 && (
          <Text style={{ color: tournamentColors.textMuted, fontSize: 13 }}>Loading standings…</Text>
        )}

        {finalStagePlayers.length > 0 && (
          <View style={{ marginBottom: 12 }}>
            <GroupStandingsCard
              groupName="Finale qualifiers"
              standings={finalStagePlayers.map((entry) => ({
                playerId: entry.playerId,
                rank: entry.rank,
                playerName: entry.playerName,
                wins: entry.wins,
                losses: entry.losses,
                points: entry.points,
              }))}
            />
          </View>
        )}

        {!isLoadingGroupsTab && groupsTabItems.length === 0 && (
          <EmptyStateCard
            emoji="📋"
            title="No groups yet"
            message="Close registration on the Players tab, then assign groups here."
          />
        )}

        {groupsTabItems.map((group, index) => (
          <View key={group.divisionId} style={{ marginBottom: index === groupsTabItems.length - 1 ? 0 : 12 }}>
            <GroupStandingsCard
              groupName={group.divisionName}
              standings={group.standings || []}
              resolvePlayerGameStats={resolvePlayerGameStats}
              showExtendedStats
              showTopThreeMedals={isTournamentCompleted}
              medalCount={3}
            />
          </View>
        ))}
      </SectionCard>
    </View>
  );
}
