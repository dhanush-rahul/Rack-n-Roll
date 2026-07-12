import React from 'react';
import { LoadingPlaceholder } from './ui/LoadingPlaceholder';
import { RoundMatchesDisplay } from './RoundMatchesDisplay';

export function TournamentMatchScoringPanel({
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
  canEdit,
  filteredActiveRoundNumber,
  canShowFinalStageStep,
  isProgressing,
  isLoadingFinaleCandidates,
  onOpenFinaleModal,
  onCompleteWithoutFinals,
  onAddSeriesGame,
  showSaveButton = true,
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
}) {
  return (
    <>
      {filterToolbar}
      {emptyFilterMessage}
      {isLoading && <LoadingPlaceholder message="Loading matches…" />}
      {!isLoading && (
        <RoundMatchesDisplay
          displaySections={displaySections}
          fixtureSummaryText={fixtureSummaryText}
          expandedSectionId={expandedSectionId}
          onToggleSection={onToggleSection}
          collapsibleSections={collapsibleSections}
          expandedRoundKey={expandedRoundKey}
          onToggleRound={onToggleRound}
          scoreInputsByGameId={scoreInputsByGameId}
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
        />
      )}
    </>
  );
}
