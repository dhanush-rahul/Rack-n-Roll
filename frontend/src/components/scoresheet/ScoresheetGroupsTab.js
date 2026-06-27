import React from 'react';
import { View } from 'react-native';
import { EmptyStateCard, GroupStandingsCard, SectionCard, ToolbarIconButton } from '../tournament/TournamentChrome';

export function ScoresheetGroupsTab({
  isLoadingGroupsTab,
  groupsTabItems,
  resolveGroupPlayerGameStats,
  handicapEnabled,
  onLoadGroupsTab,
}) {
  return (
    <SectionCard
      title="Group standings"
      subtitle="Rankings update as group-stage matches are completed."
      headerAction={
        <ToolbarIconButton
          label={isLoadingGroupsTab ? '…' : 'Refresh'}
          onPress={onLoadGroupsTab}
          disabled={isLoadingGroupsTab}
        />
      }
    >
      {!isLoadingGroupsTab && groupsTabItems.length === 0 && (
        <EmptyStateCard
          icon="clipboardList"
          title="No groups yet"
          message="Standings appear after the host closes registration and assigns players to groups."
        />
      )}

      {groupsTabItems.map((group) => (
        <View key={group.divisionId} style={{ marginBottom: 12 }}>
          <GroupStandingsCard
            groupName={group.divisionName}
            standings={group.standings || []}
            resolvePlayerGameStats={resolveGroupPlayerGameStats}
            showScoresheetStats
            handicapEnabled={handicapEnabled}
          />
        </View>
      ))}
    </SectionCard>
  );
}
