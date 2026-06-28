import React from 'react';
import { View } from 'react-native';
import {
  EmptyStateCard,
  FixtureSummaryBar,
  SectionCard,
  ToolbarIconButton,
} from '../tournament/TournamentChrome';
import { RoundMatchesDisplay } from '../RoundMatchesDisplay';

export function ScoresheetGamesTab({
  groupFixtures,
  displaySections,
  fixtureSummaryText,
  isLoadingGamesTab,
  scoresByGameId,
  expandedSectionId,
  onToggleSection,
  expandedRoundKey,
  onToggleRound,
  canEditPatternScores,
  groupStageProctored,
  tournamentId,
  navigation,
  onScheduleMatch,
  onLoadGamesTab,
}) {
  return (
    <SectionCard
      title="Group-stage fixtures"
      subtitle="Browse rounds and match results. Scoring is managed by the host."
      headerAction={
        <ToolbarIconButton
          label={isLoadingGamesTab ? '…' : 'Refresh'}
          onPress={onLoadGamesTab}
          disabled={isLoadingGamesTab}
        />
      }
    >
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
        <ToolbarIconButton
          label="My games"
          active={groupFixtures.isMyGamesView}
          onPress={() => groupFixtures.setGamesView('mine')}
          disabled={isLoadingGamesTab}
          fullWidth
        />
        <ToolbarIconButton
          label="All games"
          active={!groupFixtures.isMyGamesView}
          onPress={() => groupFixtures.setGamesView('all')}
          disabled={isLoadingGamesTab}
          fullWidth
        />
      </View>

      {Boolean(fixtureSummaryText) && (
        <View style={{ marginBottom: 12 }}>
          <FixtureSummaryBar text={fixtureSummaryText} />
        </View>
      )}

      {groupFixtures.isMyGamesView && displaySections.length === 0 && !isLoadingGamesTab && (
        <EmptyStateCard
          icon="pool"
          title="No matches for you yet"
          message="Your team fixtures will appear here once groups are assigned."
        />
      )}

      {!groupFixtures.isMyGamesView && displaySections.length === 0 && !isLoadingGamesTab && (
        <EmptyStateCard
          icon="pool"
          title="No group-stage games"
          message="Fixtures will show here once the host generates the schedule."
        />
      )}

      {!isLoadingGamesTab && (
        <RoundMatchesDisplay
          displaySections={displaySections}
          fixtureSummaryText=""
          expandedSectionId={expandedSectionId}
          onToggleSection={onToggleSection}
          collapsibleSections
          expandedRoundKey={expandedRoundKey}
          onToggleRound={onToggleRound}
          scoreInputsByGameId={scoresByGameId}
          onChangeScoreInput={() => {}}
          savingGameId={null}
          canEditPatternScores={canEditPatternScores}
          filteredActiveRoundNumber={groupFixtures.activeRoundKey}
          canShowFinalStageStep={false}
          isProgressing={false}
          isLoadingFinaleCandidates={false}
          onOpenFinaleModal={() => {}}
          onCompleteWithoutFinals={() => {}}
          showSaveButton={false}
          showAddSeriesButton={false}
          showFinaleActions={false}
          useLiveSessionScoring={groupFixtures.groupStageProctored || groupStageProctored}
          onStartGame={({ gameId, tournamentId: matchTournamentId }) =>
            navigation.navigate('LiveMatchSession', {
              tournamentId: matchTournamentId || tournamentId,
              gameId,
              autoStart: true,
            })
          }
          onScheduleMatch={onScheduleMatch}
        />
      )}
    </SectionCard>
  );
}
