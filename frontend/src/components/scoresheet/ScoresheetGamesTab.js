import React from 'react';
import { FixturesTabPanel } from '../tournament/FixturesTabPanel';

export function ScoresheetGamesTab({
  isLoadingGamesTab,
  displaySections,
  fixtureSummaryText,
  scoresByGameId,
  expandedSectionId,
  onToggleSection,
  expandedRoundKey,
  onToggleRound,
  onLoadGamesTab,
  isFilterExpanded,
  onToggleFilter,
  playerFilterInput,
  onPlayerFilterInputChange,
  opponentFilterInput,
  onOpponentFilterInputChange,
  onClearFilter,
  onApplyFilter,
  hasActiveFilter,
  activeRoundKey,
  defaultSeriesMaxGames = 1,
  showMyGamesToggle = false,
  isMyGamesView = false,
  onSetGamesView,
}) {
  return (
    <FixturesTabPanel
      title="Group-stage fixtures"
      subtitle="Browse rounds and match results. Scores are read-only here."
      isLoading={isLoadingGamesTab}
      isFilterExpanded={isFilterExpanded}
      onToggleFilter={onToggleFilter}
      onRefresh={onLoadGamesTab}
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
      showGroupStats
      showMyGamesToggle={showMyGamesToggle}
      isMyGamesView={isMyGamesView}
      onSetGamesView={onSetGamesView}
      expandedSectionId={expandedSectionId}
      onToggleSection={onToggleSection}
      expandedRoundKey={expandedRoundKey}
      onToggleRound={onToggleRound}
      scoreInputsByGameId={scoresByGameId}
      onChangeScoreInput={() => {}}
      savingGameId={null}
      onSaveMatchScores={() => {}}
      canEdit={false}
      activeRoundKey={activeRoundKey}
      showSaveButton={false}
      viewOnly
      emptyTitle="No group-stage games"
      emptyMessage="Fixtures will show here once the host generates the schedule."
    />
  );
}
