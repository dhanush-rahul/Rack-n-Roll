import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { LoadingPlaceholder } from '../ui/LoadingPlaceholder';
import { EmptyStateCard, GroupStandingsCard, SectionCard, ToolbarIconButton } from '../tournament/TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';

export function ScoresheetGroupsTab({
  isLoadingGroupsTab,
  groupsTabItems,
  resolveGroupPlayerGameStats,
  handicapEnabled,
  onLoadGroupsTab,
  progressionStandingsSections = [],
  isDoubles = false,
}) {
  const [standingsView, setStandingsView] = useState('team');

  const mapTeamStandingsForDisplay = (teamStandings = []) =>
    teamStandings.map((entry) => ({
      ...entry,
      playerId: entry.teamId,
      player: {
        displayName:
          entry.team?.displayName ||
          entry.displayName ||
          entry.teamId,
      },
    }));

  const hasProgressionStandings = progressionStandingsSections.length > 0;

  const standingsToggle = isDoubles ? (
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
            <Text
              style={{
                fontSize: 12,
                fontWeight: '700',
                color: selected ? tournamentColors.primary : tournamentColors.textMuted,
              }}
            >
              {view === 'team' ? 'Teams' : 'Players'}
            </Text>
          </Pressable>
        );
      })}
    </View>
  ) : null;

  return (
    <View style={{ gap: 14 }}>
      {hasProgressionStandings &&
        progressionStandingsSections.map((section) => {
          const displayStandings =
            isDoubles && standingsView === 'team'
              ? mapTeamStandingsForDisplay(section.teamStandings || [])
              : section.standings || [];

          return (
            <SectionCard
              key={section.stageId}
              title={section.stageName}
              subtitle="Standings from completed matches in this round."
            >
              <GroupStandingsCard
                groupName={section.stageName}
                standings={displayStandings}
                showScoresheetStats={false}
              />
            </SectionCard>
          );
        })}

      <SectionCard
        title="Group standings"
        subtitle="Rankings update as group-stage matches are completed."
        headerAction={
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {standingsToggle}
            <ToolbarIconButton
              label={isLoadingGroupsTab ? '…' : 'Refresh'}
              onPress={onLoadGroupsTab}
              disabled={isLoadingGroupsTab}
            />
          </View>
        }
      >
        {isLoadingGroupsTab && groupsTabItems.length === 0 && (
          <LoadingPlaceholder message="Loading standings…" compact />
        )}

        {!isLoadingGroupsTab && groupsTabItems.length === 0 && (
          <EmptyStateCard
            icon="clipboardList"
            title="No groups yet"
            message="Standings appear after the host closes registration and assigns players to groups."
          />
        )}

        {groupsTabItems.map((group) => {
          const displayStandings =
            isDoubles && standingsView === 'team'
              ? mapTeamStandingsForDisplay(group.teamStandings || [])
              : group.standings || [];

          return (
            <View key={group.divisionId} style={{ marginBottom: 12 }}>
              <GroupStandingsCard
                groupName={group.divisionName}
                standings={displayStandings}
                resolvePlayerGameStats={resolveGroupPlayerGameStats}
                showScoresheetStats
                handicapEnabled={isDoubles ? false : handicapEnabled}
              />
            </View>
          );
        })}
      </SectionCard>
    </View>
  );
}
