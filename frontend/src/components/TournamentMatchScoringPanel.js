import React, { memo } from 'react';
import { LoadingPlaceholder } from './ui/LoadingPlaceholder';
import { RoundMatchesDisplay } from './RoundMatchesDisplay';

export const TournamentMatchScoringPanel = memo(function TournamentMatchScoringPanel({
  displaySections,
  fixtureSummaryText,
  expandedSectionId,
  onToggleSection,
  expandedRoundKey,
  onToggleRound,
  scoreInputsByGameId,
  hydrateEpoch = 0,
  onChangeScoreInput,
  defaultSeriesMaxGames,
  savingGameId,
  onSaveMatchScores,
  canEdit,
  filteredActiveRoundNumber,
  canShowFinalStageStep,
  isProgressing,
  isLoadingFinaleCandidates,
  onOpenFinaleModal,
  onCompleteWithoutFinals,
  onAddSeriesGame,
  showSaveButton = false,
  showAddSeriesButton = true,
  showFinaleActions = false,
  collapsibleSections = true,
  filterToolbar = null,
  isLoading = false,
  emptyFilterMessage = null,
  useLiveSessionScoring = false,
  onStartGame,
  onScheduleMatch,
  viewOnly = false,
  scoringStyle = 'individualGames',
}) {
  return (
    <>
      {filterToolbar}
      {emptyFilterMessage}
      {isLoading && displaySections.length === 0 ? (
        <LoadingPlaceholder message="Loading matches…" />
      ) : null}
      {displaySections.length > 0 || !isLoading ? (
        <RoundMatchesDisplay
          displaySections={displaySections}
          fixtureSummaryText={fixtureSummaryText}
          expandedSectionId={expandedSectionId}
          onToggleSection={onToggleSection}
          collapsibleSections={collapsibleSections}
          expandedRoundKey={expandedRoundKey}
          onToggleRound={onToggleRound}
          scoreInputsByGameId={scoreInputsByGameId}
          hydrateEpoch={hydrateEpoch}
          onChangeScoreInput={onChangeScoreInput}
          defaultSeriesMaxGames={defaultSeriesMaxGames}
          savingGameId={savingGameId}
          onSaveMatchScores={onSaveMatchScores}
          canEditPatternScores={canEdit}
          filteredActiveRoundNumber={filteredActiveRoundNumber}
          canShowFinalStageStep={canShowFinalStageStep}
          isProgressing={isProgressing}
          isLoadingFinaleCandidates={isLoadingFinaleCandidates}
          onOpenFinaleModal={onOpenFinaleModal}
          onCompleteWithoutFinals={onCompleteWithoutFinals}
          onAddSeriesGame={onAddSeriesGame}
          showSaveButton={showSaveButton}
          showAddSeriesButton={showAddSeriesButton}
          showFinaleActions={showFinaleActions}
          useLiveSessionScoring={useLiveSessionScoring}
          onStartGame={onStartGame}
          onScheduleMatch={onScheduleMatch}
          viewOnly={viewOnly}
          scoringStyle={scoringStyle}
        />
      ) : null}
    </>
  );
});
