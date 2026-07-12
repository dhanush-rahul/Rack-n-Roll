import React from 'react';
import { View } from 'react-native';
import { LoadingPlaceholder } from '../../components/ui/LoadingPlaceholder';
import { FixturesTabPanel } from '../../components/tournament/FixturesTabPanel';
import { StagePendingTabView } from './StagePendingTabView';
import { StageToStageProgressionPanel } from '../../components/tournament/StageToStageProgressionPanel';

export function StageTabView({
  stage,
  isLoading,
  games = [],
  displaySections = [],
  scoreInputsByGameId,
  onChangeScoreInput,
  savingGameId,
  onSaveMatchScores,
  canEdit,
  expandedSectionId = null,
  onToggleSection = () => {},
  expandedRoundKey = null,
  onToggleRound = () => {},
  defaultSeriesMaxGames = 3,
  participantNameById = new Map(),
  expectedCount = 0,
  showStageProgressionPanel = false,
  stageParticipantCount = 0,
  onContinueToNextStage,
  onEndTournament,
  nextStageName = null,
  isLastConfiguredStage = false,
  isProgressing = false,
  showSaveButton = true,
  viewOnly = false,
  isFilterExpanded = false,
  onToggleFilter,
  onRefresh,
  playerFilterInput = '',
  onPlayerFilterInputChange,
  opponentFilterInput = '',
  onOpponentFilterInputChange,
  onClearFilter,
  onApplyFilter,
  hasActiveFilter = false,
  fixtureSummaryText = '',
  activeRoundKey = null,
  useLiveSessionScoring = false,
  onStartGame,
  onScheduleMatch,
  showMyGamesToggle = false,
  isMyGamesView = false,
  onSetGamesView,
}) {
  if (stage?.status === 'preview' || stage?.isBypassPreview) {
    return (
      <StagePendingTabView
        stage={stage}
        bypassParticipantIds={stage.bypassParticipantIds || []}
        expectedCount={expectedCount}
        participantNameById={participantNameById}
      />
    );
  }

  if (stage?.status === 'locked') {
    return <LoadingPlaceholder message={`${stage.name} unlocks when the previous stage is complete.`} />;
  }

  if (stage?.status === 'ready') {
    return <LoadingPlaceholder message={`Ready to start ${stage.name}. Use the button above.`} />;
  }

  const stageName = stage?.name || 'Stage';

  return (
    <FixturesTabPanel
      title={`${stageName} fixtures`}
      subtitle={
        viewOnly
          ? 'Browse schedules and results for this round. Scores are read-only here.'
          : canEdit
            ? 'Tap Start game on a match to run the live proctor session.'
            : 'Browse schedules and results for this round.'
      }
      isLoading={isLoading && !games.length && !displaySections.length}
      isFilterExpanded={isFilterExpanded}
      onToggleFilter={onToggleFilter}
      onRefresh={onRefresh}
      playerFilterInput={playerFilterInput}
      onPlayerFilterInputChange={onPlayerFilterInputChange}
      opponentFilterInput={opponentFilterInput}
      onOpponentFilterInputChange={onOpponentFilterInputChange}
      onClearFilter={onClearFilter}
      onApplyFilter={onApplyFilter}
      hasActiveFilter={hasActiveFilter}
      displaySections={displaySections}
      fixtureSummaryText={fixtureSummaryText}
      defaultSeriesMaxGames={defaultSeriesMaxGames}
      showMyGamesToggle={showMyGamesToggle}
      isMyGamesView={isMyGamesView}
      onSetGamesView={onSetGamesView}
      expandedSectionId={expandedSectionId}
      onToggleSection={onToggleSection}
      expandedRoundKey={expandedRoundKey}
      onToggleRound={onToggleRound}
      scoreInputsByGameId={scoreInputsByGameId}
      onChangeScoreInput={onChangeScoreInput}
      savingGameId={savingGameId}
      onSaveMatchScores={onSaveMatchScores}
      canEdit={canEdit}
      activeRoundKey={activeRoundKey}
      useLiveSessionScoring={useLiveSessionScoring}
      onStartGame={onStartGame}
      onScheduleMatch={onScheduleMatch}
      showSaveButton={showSaveButton}
      viewOnly={viewOnly}
      isProgressing={isProgressing}
      emptyTitle={`No ${stageName} fixtures yet`}
      emptyMessage={`Matches for ${stageName} appear here once the round starts.`}
      myGamesEmptyTitle="No matches for you yet"
      myGamesEmptyMessage={`Your ${stageName} fixtures will appear here once this round starts.`}
      footer={
        showStageProgressionPanel ? (
          <View style={{ marginTop: 14 }}>
            <StageToStageProgressionPanel
              sourceStageName={stage.name}
              participantCount={stageParticipantCount}
              defaultBestOf={String(stage.bestOf || 3)}
              isProgressing={isProgressing}
              onContinue={onContinueToNextStage}
              onEndTournament={onEndTournament}
              existingStageName={nextStageName}
              isLastConfiguredStage={isLastConfiguredStage}
            />
          </View>
        ) : null
      }
    />
  );
}
