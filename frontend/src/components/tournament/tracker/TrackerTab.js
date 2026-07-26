import React, { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { EmptyStateCard, SectionCard, TabStatsRow, ActionButton } from '../TournamentChrome';
import { ChipSelector } from '../chrome/ChipSelector';
import { useTheme } from '../../../context/ThemeContext';
import { tournamentColors } from '../../../styles/tournamentUi';
import { TournamentProgressChart } from './TournamentProgressChart';
import { TournamentTrackerGrid } from './TournamentTrackerGrid';
import { TrackerStandingsTable } from './TrackerStandingsTable';

export function TrackerTab({
  trackerData,
  isLoading = false,
  isError = false,
  errorMessage = '',
  onRetry,
}) {
  const { colors } = useTheme();
  const [selectedGroupId, setSelectedGroupId] = useState('all');

  const groups = trackerData?.groups || [];
  const participantGameStats = trackerData?.participantGameStats || {};
  const isDoubles = trackerData?.format === 'doubles';
  const progress = trackerData?.progress || trackerData?.tracker?.progress || null;

  const groupOptions = useMemo(
    () => [
      { value: 'all', label: 'All groups' },
      ...groups.map((group) => ({
        value: String(group.divisionId),
        label: group.divisionName,
      })),
    ],
    [groups]
  );

  const visibleGroups = useMemo(() => {
    if (selectedGroupId === 'all') {
      return groups;
    }

    return groups.filter((group) => String(group.divisionId) === String(selectedGroupId));
  }, [groups, selectedGroupId]);

  const resolveParticipantStats = (participantId) =>
    participantGameStats[String(participantId)] || { gamesPlayed: 0, gamesRemaining: 0, totalGames: 0 };

  if (isLoading && !trackerData) {
    return (
      <View style={{ paddingVertical: 32, alignItems: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (isError) {
    return (
      <View style={{ gap: 12 }}>
        <EmptyStateCard
          icon="warning"
          title="Unable to load tracker"
          message={errorMessage || 'Try again in a moment.'}
        />
        {onRetry ? <ActionButton label="Retry" onPress={onRetry} variant="secondary" fullWidth /> : null}
      </View>
    );
  }

  const summaryStats = [
    {
      label: 'COMPLETED',
      value: String(progress?.completedGames ?? 0),
      accent: colors.primary,
    },
    {
      label: 'PENDING',
      value: String(progress?.pendingGames ?? 0),
      accent: tournamentColors.statusWarning,
    },
    {
      label: 'PROGRESS',
      value: `${progress?.percentComplete ?? 0}%`,
    },
  ];

  return (
    <View style={{ gap: 16 }}>
      <TabStatsRow stats={summaryStats} />

      <SectionCard title="Tournament progress" subtitle="Completed vs pending group-stage matches.">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'center' }}>
          <TournamentProgressChart progress={progress} />
        </View>
      </SectionCard>

      <SectionCard
        title="Tournament tracker"
        subtitle="Remaining games by round and group. Row and column totals show pending matches."
      >
        <TournamentTrackerGrid tracker={trackerData?.tracker} />
      </SectionCard>

      <SectionCard title="Standings" subtitle="Position, games played/remaining, wins, draws, losses, and points.">
        {groups.length > 1 ? (
          <ChipSelector
            label="Group"
            options={groupOptions}
            value={selectedGroupId}
            onChange={setSelectedGroupId}
          />
        ) : null}

        <View style={{ gap: 16 }}>
          {visibleGroups.length === 0 ? (
            <EmptyStateCard
              icon="users"
              title="No groups yet"
              message="Standings will appear once players are assigned to groups."
            />
          ) : (
            visibleGroups.map((group) => {
              const standings = isDoubles ? group.teamStandings || [] : group.standings || [];

              return (
                <View key={group.divisionId} style={{ gap: 8 }}>
                  {selectedGroupId === 'all' ? (
                    <>
                      <Text style={{ fontSize: 15, fontWeight: '800', color: colors.text }}>{group.divisionName}</Text>
                      <TrackerStandingsTable
                        standings={standings}
                        resolveParticipantStats={resolveParticipantStats}
                        entityLabel={isDoubles ? 'Team' : 'Player'}
                      />
                    </>
                  ) : (
                    <TrackerStandingsTable
                      standings={standings}
                      resolveParticipantStats={resolveParticipantStats}
                      entityLabel={isDoubles ? 'Team' : 'Player'}
                    />
                  )}
                </View>
              );
            })
          )}
        </View>
      </SectionCard>
    </View>
  );
}
