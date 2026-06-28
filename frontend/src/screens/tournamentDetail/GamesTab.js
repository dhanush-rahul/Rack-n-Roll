import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { TournamentMatchScoringPanel } from '../../components/TournamentMatchScoringPanel';
import {
  ActionButton,
  EmptyStateCard,
  FixtureFilterPanel,
  FixtureSummaryBar,
  InfoBanner,
  SectionCard,
  TabStatsRow,
  ToolbarIconButton,
} from '../../components/tournament/TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';

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
  canShowFinalStageStep,
  isProgressing,
  isLoadingFinaleCandidates,
  onRequestStartFinale,
  onRequestSkipFinale,
  onAddSeriesGame,
  onStartGame,
  onScheduleMatch,
  groupStageProctored = false,
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

  const matchCount = displaySections.reduce(
    (total, section) => total + Number(section.matchCount || 0),
    0
  );

  return (
    <View>
      <SectionCard
        title="Group-stage fixtures"
        subtitle={
          canEditGamesScores
            ? 'Tap Start game on a match to run the live proctor session.'
            : 'Browse schedules and results by group and round.'
        }
        headerAction={
          <View style={{ flexDirection: 'row', gap: 6 }}>
            <ToolbarIconButton
              label="Filter"
              active={isGamesFilterExpanded}
              onPress={onToggleGamesFilter}
            />
            <ToolbarIconButton label={isLoadingGames ? '…' : 'Refresh'} onPress={onRefreshGames} disabled={isLoadingGames} />
          </View>
        }
      >
        {Boolean(fixtureSummaryText) && (
          <View style={{ marginBottom: 12 }}>
            <FixtureSummaryBar text={fixtureSummaryText} />
          </View>
        )}

        {!isLoadingGames && matchCount > 0 && (
          <View style={{ marginBottom: 12 }}>
            <TabStatsRow
              stats={[
                { label: 'GROUPS', value: String(displaySections.length) },
                { label: 'MATCHES', value: String(matchCount) },
                {
                  label: 'SERIES',
                  value: `Bo${defaultSeriesMaxGames || 1}`,
                  accent: tournamentColors.primary,
                },
              ]}
            />
          </View>
        )}

        {isGamesFilterExpanded && (
          <FixtureFilterPanel
            playerFilterInput={playerFilterInput}
            onPlayerFilterInputChange={onPlayerFilterInputChange}
            opponentFilterInput={opponentFilterInput}
            onOpponentFilterInputChange={onOpponentFilterInputChange}
            onClearFilter={onClearGamesFilter}
            onApplyFilter={onApplyGamesFilter}
            isLoading={isLoadingGames}
          />
        )}

        {hasActiveGamesFilter && (
          <View style={{ marginBottom: 12 }}>
            <InfoBanner
              tone="neutral"
              title="Filter active"
              message="Showing matches that match your player search."
            />
          </View>
        )}

        {isLoadingGames && matchCount === 0 && (
          <Text style={{ color: tournamentColors.textMuted, fontSize: 13, marginBottom: 12 }}>Loading fixtures…</Text>
        )}

        {hasActiveGamesFilter && displaySections.length === 0 && !isLoadingGames && (
          <EmptyStateCard icon="search" title="No matches found" message="Try different player names in the filter." />
        )}

        {!hasActiveGamesFilter && displaySections.length === 0 && !isLoadingGames && (
          <EmptyStateCard
            icon="pool"
            title="No group-stage games"
            message="Fixtures appear here after groups are assigned."
          />
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
          canEdit={canEditGamesScores}
          filteredActiveRoundNumber={activeRoundKey}
          canShowFinalStageStep={false}
          isProgressing={isProgressing}
          isLoadingFinaleCandidates={isLoadingFinaleCandidates}
          onOpenFinaleModal={() => {}}
          onCompleteWithoutFinals={() => {}}
          onAddSeriesGame={onAddSeriesGame}
          showFinaleActions={false}
          isLoading={isLoadingGames}
          useLiveSessionScoring={groupStageProctored}
          onStartGame={onStartGame}
          onScheduleMatch={onScheduleMatch}
          showSaveButton={!groupStageProctored}
          showAddSeriesButton={false}
        />
      </SectionCard>

      {canShowFinalStageStep && (
        <View style={{ marginTop: 14 }}>
          <SectionCard
            title="Ready for finale?"
            subtitle="When group-stage matches are done, pick finalists or skip straight to completing the event."
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <ActionButton
                  label={isLoadingFinaleCandidates ? 'Loading…' : 'Start finale'}
                  onPress={onRequestStartFinale}
                  disabled={isProgressing || isLoadingFinaleCandidates}
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <ActionButton
                  label={isProgressing ? 'Working…' : 'Skip finale'}
                  onPress={onRequestSkipFinale}
                  disabled={isProgressing}
                  variant="ghost"
                  fullWidth
                />
              </View>
            </View>
          </SectionCard>
        </View>
      )}
    </View>
  );
}
