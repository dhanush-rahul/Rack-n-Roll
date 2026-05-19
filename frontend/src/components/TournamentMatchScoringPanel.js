import React from 'react';
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
}) {
  return (
    <>
      {filterToolbar}
      {emptyFilterMessage}
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
        />
      )}
    </>
  );
}
