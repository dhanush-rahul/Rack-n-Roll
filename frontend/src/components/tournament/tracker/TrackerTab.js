import React, { useMemo, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { EmptyStateCard, SectionCard, TabStatsRow, ActionButton } from '../TournamentChrome';
import { ChipSelector } from '../chrome/ChipSelector';
import { useTheme } from '../../../context/ThemeContext';
import { useTypography } from '../../../context/TypographyContext';
import { tournamentColors } from '../../../styles/tournamentUi';
import { buildParticipantGameStatsFromGames, buildStageMatchProgress } from '../../../utils/trackerStats';
import { TournamentProgressChart } from './TournamentProgressChart';
import { TournamentTrackerGrid } from './TournamentTrackerGrid';
import { TrackerStandingsTable } from './TrackerStandingsTable';

function renderGroupStandingsBlock({
  groups,
  visibleGroups,
  selectedGroupId,
  isDoubles,
  resolveGroupParticipantStats,
  colors,
  fs,
}) {
  if (visibleGroups.length === 0) {
    return (
      <EmptyStateCard
        icon="users"
        title="No groups yet"
        message="Standings will appear once players are assigned to groups."
      />
    );
  }

  return visibleGroups.map((group) => {
    const standings = isDoubles ? group.teamStandings || [] : group.standings || [];

    return (
      <View key={group.divisionId} style={{ gap: 8 }}>
        {selectedGroupId === 'all' && groups.length > 1 ? (
          <>
            <Text style={{ fontSize: fs(15), fontWeight: '800', color: colors.text }}>{group.divisionName}</Text>
            <TrackerStandingsTable
              standings={standings}
              resolveParticipantStats={resolveGroupParticipantStats}
              entityLabel={isDoubles ? 'Team' : 'Player'}
            />
          </>
        ) : (
          <TrackerStandingsTable
            standings={standings}
            resolveParticipantStats={resolveGroupParticipantStats}
            entityLabel={isDoubles ? 'Team' : 'Player'}
          />
        )}
      </View>
    );
  });
}

export function TrackerTab({
  trackerData,
  progressionStandingsSections = [],
  stageGamesById = {},
  currentProgressionFocus = null,
  isLoading = false,
  isError = false,
  errorMessage = '',
  onRetry,
}) {
  const { colors } = useTheme();
  const { fs } = useTypography();
  const [selectedGroupId, setSelectedGroupId] = useState('all');

  const groups = trackerData?.groups || [];
  const participantGameStats = trackerData?.participantGameStats || {};
  const isDoubles = trackerData?.format === 'doubles';
  const groupProgress = trackerData?.progress || trackerData?.tracker?.progress || null;

  const focus =
    currentProgressionFocus || {
      kind: 'groups',
      label: 'Group stage',
      heroLabel: 'Group stage',
      stageId: null,
    };

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

  const resolveGroupParticipantStats = (participantId) =>
    participantGameStats[String(participantId)] || { gamesPlayed: 0, gamesRemaining: 0, totalGames: 0 };

  const progressionSections = useMemo(
    () =>
      progressionStandingsSections.map((section) => {
        const standings = isDoubles ? section.teamStandings || [] : section.standings || [];
        const stageGames = stageGamesById[section.stageId] || [];
        const participantStats = buildParticipantGameStatsFromGames(stageGames, isDoubles);

        return {
          ...section,
          standings,
          resolveParticipantStats: (participantId) =>
            participantStats[String(participantId)] || { gamesPlayed: 0, gamesRemaining: 0, totalGames: 0 },
        };
      }),
    [isDoubles, progressionStandingsSections, stageGamesById]
  );

  const visibleProgressionSections = useMemo(() => {
    const sectionsByStageId = new Map(
      progressionSections.map((section) => [String(section.stageId), section])
    );

    if (focus.kind === 'stage' && focus.stageId && !sectionsByStageId.has(String(focus.stageId))) {
      const stageGames = stageGamesById[focus.stageId] || [];
      const hasCompletedGame = stageGames.some((game) => game.status === 'completed');
      if (hasCompletedGame) {
        const participantStats = buildParticipantGameStatsFromGames(stageGames, isDoubles);
        sectionsByStageId.set(String(focus.stageId), {
          stageId: focus.stageId,
          stageName: focus.label,
          stageOrder: Number.MAX_SAFE_INTEGER,
          standings: [],
          resolveParticipantStats: (participantId) =>
            participantStats[String(participantId)] || { gamesPlayed: 0, gamesRemaining: 0, totalGames: 0 },
        });
      }
    }

    return [...sectionsByStageId.values()]
      .filter((section) => {
        const stageGames = stageGamesById[section.stageId] || [];
        const hasCompletedGame = stageGames.some((game) => game.status === 'completed');
        return section.standings.length > 0 || hasCompletedGame;
      })
      .sort((left, right) => Number(right.stageOrder || 0) - Number(left.stageOrder || 0));
  }, [focus, isDoubles, progressionSections, stageGamesById]);

  const stageProgress = useMemo(() => {
    if (focus.kind !== 'stage' || !focus.stageId) {
      return null;
    }

    return buildStageMatchProgress(stageGamesById[focus.stageId] || []);
  }, [focus, stageGamesById]);

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

  const activeProgress =
    focus.kind === 'stage' && stageProgress ? stageProgress : groupProgress;

  const summaryStats =
    focus.kind === 'stage' && stageProgress
      ? [
          {
            label: 'COMPLETED',
            value: String(stageProgress.completedGames ?? 0),
            accent: colors.primary,
          },
          {
            label: 'PENDING',
            value: String(stageProgress.pendingGames ?? 0),
            accent: tournamentColors.statusWarning,
          },
          {
            label: 'PROGRESS',
            value: `${stageProgress.percentComplete ?? 0}%`,
          },
        ]
      : [
          {
            label: 'COMPLETED',
            value: String(groupProgress?.completedGames ?? 0),
            accent: colors.primary,
          },
          {
            label: 'PENDING',
            value: String(groupProgress?.pendingGames ?? 0),
            accent: tournamentColors.statusWarning,
          },
          {
            label: 'PROGRESS',
            value: `${groupProgress?.percentComplete ?? 0}%`,
          },
        ];

  const progressSectionTitle =
    focus.kind === 'stage' ? `${focus.label} progress` : 'Tournament progress';
  const progressSectionSubtitle =
    focus.kind === 'stage'
      ? `Completed vs pending matches in ${focus.label}.`
      : 'Completed vs pending group-stage matches.';

  const currentStageId = focus.kind === 'stage' ? String(focus.stageId || '') : '';

  return (
    <View style={{ gap: 16 }}>
      <TabStatsRow stats={summaryStats} />

      {visibleProgressionSections.map((section) => {
        const isCurrentStage = currentStageId && String(section.stageId) === currentStageId;

        return (
          <SectionCard
            key={section.stageId}
            title={`${section.stageName} standings`}
            subtitle={
              isCurrentStage && focus.awaitingStart
                ? 'Group stage is complete. Standings appear here once this round begins.'
                : isCurrentStage
                  ? 'Current round — points, record, games played/remaining, and APA-style stats.'
                  : 'Standings from completed matches in this round.'
            }
          >
            {section.standings?.length ? (
              <TrackerStandingsTable
                standings={section.standings}
                resolveParticipantStats={section.resolveParticipantStats}
                entityLabel={isDoubles ? 'Team' : 'Player'}
              />
            ) : (
              <EmptyStateCard
                icon="users"
                title={isCurrentStage && focus.awaitingStart ? 'Round not started yet' : 'No standings yet'}
                message={
                  isCurrentStage && focus.awaitingStart
                    ? 'The host starts this round after group-stage matches are all complete.'
                    : 'Standings will appear once matches in this round are completed.'
                }
              />
            )}
          </SectionCard>
        );
      })}

      <SectionCard title={progressSectionTitle} subtitle={progressSectionSubtitle}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 24, alignItems: 'center', justifyContent: 'center' }}>
          <TournamentProgressChart progress={activeProgress} />
        </View>
      </SectionCard>

      <SectionCard
        title="Tournament tracker"
        subtitle="Remaining games by round and group. Row and column totals show pending matches."
      >
        <TournamentTrackerGrid tracker={trackerData?.tracker} />
      </SectionCard>

      <SectionCard title="Group standings" subtitle="Group stage points, record, games played/remaining, and APA-style stats.">
        {groups.length > 1 ? (
          <ChipSelector
            label="Group"
            options={groupOptions}
            value={selectedGroupId}
            onChange={setSelectedGroupId}
          />
        ) : null}

        <View style={{ gap: 16 }}>
          {renderGroupStandingsBlock({
            groups,
            visibleGroups,
            selectedGroupId,
            isDoubles,
            resolveGroupParticipantStats,
            colors,
            fs,
          })}
        </View>
      </SectionCard>
    </View>
  );
}
