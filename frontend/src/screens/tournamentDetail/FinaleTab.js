import React, { useMemo } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { LoadingPlaceholder } from '../../components/ui/LoadingPlaceholder';
import { TournamentMatchScoringPanel } from '../../components/TournamentMatchScoringPanel';
import {
  ActionButton,
  EmptyStateCard,
  FixtureSummaryBar,
  InfoBanner,
  SectionCard,
  TabStatsRow,
  ToolbarIconButton,
} from '../../components/tournament/TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';

export function FinaleTab({
  canEditFinalScores,
  isLoadingFinaleTab,
  onLoadFinaleTab,
  finalDisplaySections,
  finalFixtureSummaryText,
  expandedSectionId,
  onToggleSection,
  expandedRoundKey,
  onToggleRound,
  scoreInputsByGameId,
  onChangeScoreInput,
  configuredFinalStageBestOf,
  savingGameId,
  onSaveMatchScores,
  activeFinalRoundKey,
  isProgressing,
  hasFinalStageStarted,
  onCompleteWithFinale,
  onStartGame,
  finalStageProctored = false,
}) {
  const matchCount = useMemo(
    () =>
      finalDisplaySections.reduce(
        (total, section) => total + Number(section.matchCount || 0),
        0
      ),
    [finalDisplaySections]
  );

  const roundCount = useMemo(
    () =>
      finalDisplaySections.reduce((total, section) => total + (section.rounds || []).length, 0),
    [finalDisplaySections]
  );

  return (
    <View>
      {hasFinalStageStarted && (
        <View style={{ marginBottom: 14 }}>
          <InfoBanner
            icon="trophy"
            tone="success"
            title="Finale in progress"
            message={
              canEditFinalScores
                ? 'Score knockout matches below, then end the tournament when the bracket is complete.'
                : 'You can view finale results here. Only the host can enter scores.'
            }
          />
        </View>
      )}

      <SectionCard
        title="Knockout bracket"
        subtitle={
          canEditFinalScores
            ? 'Finale rounds and championship matches.'
            : 'View-only finale results.'
        }
        headerAction={
          <ToolbarIconButton
            label={isLoadingFinaleTab ? '…' : 'Refresh'}
            onPress={onLoadFinaleTab}
            disabled={isLoadingFinaleTab}
          />
        }
      >
        {matchCount > 0 && (
          <View style={{ marginBottom: 12 }}>
            <TabStatsRow
              stats={[
                { label: 'ROUNDS', value: String(roundCount) },
                { label: 'MATCHES', value: String(matchCount) },
                {
                  label: 'SERIES',
                  value: `Bo${configuredFinalStageBestOf || 1}`,
                  accent: tournamentColors.primary,
                },
              ]}
            />
          </View>
        )}

        {Boolean(finalFixtureSummaryText) && (
          <View style={{ marginBottom: 12 }}>
            <FixtureSummaryBar text={finalFixtureSummaryText} />
          </View>
        )}

        {isLoadingFinaleTab && matchCount === 0 && (
          <LoadingPlaceholder message="Loading finale matches…" compact />
        )}

        {!isLoadingFinaleTab && finalDisplaySections.length === 0 && (
          <EmptyStateCard
            icon="trophy"
            title="No finale matches yet"
            message="Start the final stage from the Games tab when group play is wrapping up."
          />
        )}

        <TournamentMatchScoringPanel
          displaySections={finalDisplaySections}
          fixtureSummaryText=""
          expandedSectionId={expandedSectionId}
          onToggleSection={onToggleSection}
          expandedRoundKey={expandedRoundKey}
          onToggleRound={onToggleRound}
          scoreInputsByGameId={scoreInputsByGameId}
          onChangeScoreInput={onChangeScoreInput}
          defaultSeriesMaxGames={configuredFinalStageBestOf}
          savingGameId={savingGameId}
          onSaveMatchScores={onSaveMatchScores}
          canEdit={canEditFinalScores}
          filteredActiveRoundNumber={activeFinalRoundKey}
          canShowFinalStageStep={false}
          isProgressing={isProgressing}
          showFinaleActions={false}
          isLoading={isLoadingFinaleTab}
          useLiveSessionScoring={finalStageProctored}
          onStartGame={onStartGame}
          showSaveButton={!finalStageProctored}
        />
      </SectionCard>

      {hasFinalStageStarted && finalDisplaySections.length > 0 && (
        <View style={{ marginTop: 14 }}>
          <SectionCard title="Complete tournament" subtitle="Mark the event finished after the finale is decided.">
            <ActionButton
              label={isProgressing ? 'Working…' : 'End tournament'}
              onPress={onCompleteWithFinale}
              disabled={isProgressing || isLoadingFinaleTab}
              fullWidth
            />
          </SectionCard>
        </View>
      )}
    </View>
  );
}
