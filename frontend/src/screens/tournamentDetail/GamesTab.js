import React from 'react';
import { View } from 'react-native';
import { EmptyStateCard } from '../../components/tournament/TournamentChrome';
import { GroupStageProgressionPanel } from '../../components/tournament/GroupStageProgressionPanel';
import { FixturesTabPanel } from '../../components/tournament/FixturesTabPanel';

export function GamesTab({
  isRegistrationClosed,
  hasGroupFixtures,
  isLoadingGames,
  isGamesFilterExpanded,
  onToggleGamesFilter,
  onRefreshGames,
  playerFilterInput,
  onPlayerFilterInputChange,
  opponentFilterInput,
  onOpponentFilterInputChange,
  onClearGamesFilter,
  onApplyGamesFilter,
  hasActiveGamesFilter,
  displaySections,
  fixtureSummaryText,
  expandedSectionId,
  onToggleSection,
  expandedRoundKey,
  onToggleRound,
  scoreInputsByGameId,
  onChangeScoreInput,
  defaultSeriesMaxGames,
  savingGameId,
  onSaveMatchScores,
  canEditGamesScores,
  activeRoundKey,
  isProgressing,
  onAddSeriesGame,
  onStartGame,
  onScheduleMatch,
  groupStageProctored = false,
  showProgressionConfigurator = false,
  groupCount = 0,
  groupLabels = [],
  isDoubles = false,
  progressionPreview = null,
  isLoadingProgressionPreview = false,
  onPreviewProgression,
  onConfigureProgression,
  onEndAfterGroups,
  nextStageName = null,
}) {
  if (!isRegistrationClosed) {
    return (
      <EmptyStateCard
        icon="registration"
        title="Registration still open"
        message="Close registration on the Players tab, then assign groups to generate fixtures."
      />
    );
  }

  if (!hasGroupFixtures && !isLoadingGames) {
    return (
      <EmptyStateCard
        icon="calendar"
        title="No fixtures yet"
        message="Head to the Groups tab to assign players and create the group-stage schedule."
      />
    );
  }

  return (
    <FixturesTabPanel
      title="Group-stage fixtures"
      subtitle={
        canEditGamesScores
          ? 'Tap Start game on a match to run the live proctor session.'
          : 'Browse schedules and results by group and round.'
      }
      isLoading={isLoadingGames}
      isFilterExpanded={isGamesFilterExpanded}
      onToggleFilter={onToggleGamesFilter}
      onRefresh={onRefreshGames}
      playerFilterInput={playerFilterInput}
      onPlayerFilterInputChange={onPlayerFilterInputChange}
      opponentFilterInput={opponentFilterInput}
      onOpponentFilterInputChange={onOpponentFilterInputChange}
      onClearFilter={onClearGamesFilter}
      onApplyFilter={onApplyGamesFilter}
      hasActiveFilter={hasActiveGamesFilter}
      displaySections={displaySections}
      fixtureSummaryText={fixtureSummaryText}
      defaultSeriesMaxGames={defaultSeriesMaxGames}
      showGroupStats
      expandedSectionId={expandedSectionId}
      onToggleSection={onToggleSection}
      expandedRoundKey={expandedRoundKey}
      onToggleRound={onToggleRound}
      scoreInputsByGameId={scoreInputsByGameId}
      onChangeScoreInput={onChangeScoreInput}
      savingGameId={savingGameId}
      onSaveMatchScores={onSaveMatchScores}
      canEdit={canEditGamesScores}
      activeRoundKey={activeRoundKey}
      useLiveSessionScoring={groupStageProctored}
      onStartGame={onStartGame}
      onScheduleMatch={onScheduleMatch}
      showSaveButton={!groupStageProctored}
      isProgressing={isProgressing}
      emptyTitle="No group-stage games"
      emptyMessage="Fixtures appear here after groups are assigned."
      footer={
        showProgressionConfigurator ? (
          <View style={{ marginTop: 14 }}>
            <GroupStageProgressionPanel
              groupCount={groupCount}
              groupLabels={groupLabels}
              isDoubles={isDoubles}
              isProgressing={isProgressing}
              isLoadingPreview={isLoadingProgressionPreview}
              preview={progressionPreview}
              onPreview={onPreviewProgression}
              onContinue={onConfigureProgression}
              onEndAfterGroups={onEndAfterGroups}
              existingStageName={nextStageName}
            />
          </View>
        ) : null
      }
    />
  );
}
