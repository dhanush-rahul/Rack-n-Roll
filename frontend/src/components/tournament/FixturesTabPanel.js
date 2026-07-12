import React from 'react';
import { View } from 'react-native';
import { LoadingPlaceholder } from '../ui/LoadingPlaceholder';
import { TournamentMatchScoringPanel } from '../TournamentMatchScoringPanel';
import {
  EmptyStateCard,
  FixtureFilterPanel,
  FixtureSummaryBar,
  InfoBanner,
  SectionCard,
  TabStatsRow,
  ToolbarIconButton,
} from './TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';

export function FixturesTabPanel({
  title,
  subtitle,
  isLoading = false,
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
  displaySections = [],
  fixtureSummaryText = '',
  defaultSeriesMaxGames = 1,
  showGroupStats = false,
  showMyGamesToggle = false,
  isMyGamesView = false,
  onSetGamesView,
  expandedSectionId = null,
  onToggleSection,
  expandedRoundKey = null,
  onToggleRound,
  scoreInputsByGameId = {},
  onChangeScoreInput,
  savingGameId = null,
  onSaveMatchScores,
  canEdit = false,
  activeRoundKey = null,
  useLiveSessionScoring = false,
  onStartGame,
  onScheduleMatch,
  showSaveButton = true,
  showAddSeriesButton = false,
  viewOnly = false,
  isProgressing = false,
  emptyIcon = 'pool',
  emptyTitle = 'No fixtures yet',
  emptyMessage = 'Fixtures will appear here once this round is set up.',
  filteredEmptyTitle = 'No matches found',
  filteredEmptyMessage = 'Try different player names in the filter.',
  myGamesEmptyTitle = 'No matches for you yet',
  myGamesEmptyMessage = 'Your fixtures will appear here once this round starts.',
  footer = null,
}) {
  const matchCount = displaySections.reduce(
    (total, section) => total + Number(section.matchCount || 0),
    0
  );

  const stats = showGroupStats
    ? [
        { label: 'GROUPS', value: String(displaySections.length) },
        { label: 'MATCHES', value: String(matchCount) },
        {
          label: 'SERIES',
          value: `Bo${defaultSeriesMaxGames || 1}`,
          accent: tournamentColors.primary,
        },
      ]
    : [
        { label: 'MATCHES', value: String(matchCount) },
        {
          label: 'SERIES',
          value: `Bo${defaultSeriesMaxGames || 1}`,
          accent: tournamentColors.primary,
        },
      ];

  return (
    <View>
      <SectionCard
        title={title}
        subtitle={subtitle}
        headerAction={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            {onToggleFilter ? (
              <ToolbarIconButton label="Filter" active={isFilterExpanded} onPress={onToggleFilter} />
            ) : null}
            {onRefresh ? (
              <ToolbarIconButton
                label={isLoading ? '…' : 'Refresh'}
                onPress={onRefresh}
                disabled={isLoading}
              />
            ) : null}
          </View>
        }
      >
        {showMyGamesToggle ? (
          <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
            <ToolbarIconButton
              label="My games"
              active={isMyGamesView}
              onPress={() => onSetGamesView?.('mine')}
              disabled={isLoading}
              fullWidth
            />
            <ToolbarIconButton
              label="All games"
              active={!isMyGamesView}
              onPress={() => onSetGamesView?.('all')}
              disabled={isLoading}
              fullWidth
            />
          </View>
        ) : null}

        {Boolean(fixtureSummaryText) && (
          <View style={{ marginBottom: 12 }}>
            <FixtureSummaryBar text={fixtureSummaryText} />
          </View>
        )}

        {!isLoading && matchCount > 0 && (
          <View style={{ marginBottom: 12 }}>
            <TabStatsRow stats={stats} />
          </View>
        )}

        {isFilterExpanded && onApplyFilter ? (
          <FixtureFilterPanel
            playerFilterInput={playerFilterInput}
            onPlayerFilterInputChange={onPlayerFilterInputChange}
            opponentFilterInput={opponentFilterInput}
            onOpponentFilterInputChange={onOpponentFilterInputChange}
            onClearFilter={onClearFilter}
            onApplyFilter={onApplyFilter}
            isLoading={isLoading}
          />
        ) : null}

        {hasActiveFilter && (
          <View style={{ marginBottom: 12 }}>
            <InfoBanner
              tone="neutral"
              title="Filter active"
              message="Showing matches that match your player search."
            />
          </View>
        )}

        {isLoading && matchCount === 0 && (
          <LoadingPlaceholder message="Loading fixtures…" compact />
        )}

        {hasActiveFilter && displaySections.length === 0 && !isLoading && (
          <EmptyStateCard
            icon="search"
            title={filteredEmptyTitle}
            message={filteredEmptyMessage}
          />
        )}

        {isMyGamesView && displaySections.length === 0 && !isLoading && !hasActiveFilter && (
          <EmptyStateCard icon={emptyIcon} title={myGamesEmptyTitle} message={myGamesEmptyMessage} />
        )}

        {!isMyGamesView && !hasActiveFilter && displaySections.length === 0 && !isLoading && (
          <EmptyStateCard icon={emptyIcon} title={emptyTitle} message={emptyMessage} />
        )}

        <TournamentMatchScoringPanel
          displaySections={displaySections}
          fixtureSummaryText=""
          expandedSectionId={expandedSectionId}
          onToggleSection={onToggleSection}
          expandedRoundKey={expandedRoundKey}
          onToggleRound={onToggleRound}
          scoreInputsByGameId={scoreInputsByGameId}
          onChangeScoreInput={onChangeScoreInput}
          defaultSeriesMaxGames={defaultSeriesMaxGames}
          savingGameId={savingGameId}
          onSaveMatchScores={onSaveMatchScores}
          canEdit={canEdit}
          filteredActiveRoundNumber={activeRoundKey}
          canShowFinalStageStep={false}
          isProgressing={isProgressing}
          isLoadingFinaleCandidates={false}
          onOpenFinaleModal={() => {}}
          onCompleteWithoutFinals={() => {}}
          showFinaleActions={false}
          isLoading={isLoading}
          useLiveSessionScoring={useLiveSessionScoring}
          onStartGame={onStartGame}
          onScheduleMatch={onScheduleMatch}
          showSaveButton={showSaveButton}
          showAddSeriesButton={showAddSeriesButton}
          viewOnly={viewOnly}
        />
      </SectionCard>

      {footer}
    </View>
  );
}
