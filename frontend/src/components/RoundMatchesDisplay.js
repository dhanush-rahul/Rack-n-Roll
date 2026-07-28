import React, { memo } from 'react';
import { Pressable, View } from 'react-native';
import { useTypography } from '../context/TypographyContext';
import { ScaledText as Text } from './ui/ScaledText';
import { discoverUi, tournamentColors } from '../styles/tournamentUi';
import { AppIcon } from './ui/AppIcon';
import { RoundMatchesTable } from './tournament/RoundMatchesTable';

function MatchActionButton({ label, onPress, disabled, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  const isSecondary = variant === 'secondary';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: isPrimary ? tournamentColors.primary : isSecondary ? tournamentColors.primary : tournamentColors.border,
        backgroundColor: isPrimary
          ? disabled
            ? tournamentColors.primaryMuted
            : tournamentColors.primary
          : tournamentColors.white,
        alignItems: 'center',
        opacity: pressed || disabled ? 0.72 : 1,
      })}
    >
      <Text
        style={{
          fontWeight: '700',
          fontSize: 14,
          color: isPrimary ? tournamentColors.onPrimary || '#ffffff' : tournamentColors.primary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const FixtureRoundPanel = memo(function FixtureRoundPanel({
  round,
  expandedRoundKey,
  onToggleRound,
  scoreInputsByGameId,
  hydrateEpoch = 0,
  onChangeScoreInput,
  savingGameId,
  onSaveMatchScores,
  canEditPatternScores,
  filteredActiveRoundNumber,
  defaultSeriesMaxGames = 1,
  useLiveSessionScoring = false,
  onStartGame,
  onScheduleMatch,
  viewOnly = false,
  sp = (n) => n,
  isWide = false,
  scoringStyle = 'individualGames',
}) {
  const roundKey = round.roundKey || `round-${round.roundNumber}`;
  const isRoundOpen = expandedRoundKey === roundKey;
  const isRoundCompleted =
    (round.matches || []).length > 0 &&
    (round.matches || []).every((match) => match.status === 'completed');
  const completedGamesCount = (round.matches || []).reduce(
    (accumulator, match) => accumulator + Number(match.completedGamesCount || 0),
    0
  );
  const totalGamesCount = (round.matches || []).reduce(
    (accumulator, match) => accumulator + Math.max(Number(match.bestOf || 1), 1),
    0
  );
  const matchCount = (round.matches || []).length;

  return (
    <View key={roundKey} style={[discoverUi.listCard, { marginLeft: 4, marginBottom: 10 }]}>
      <Pressable
        onPress={() => onToggleRound(roundKey)}
        style={({ pressed }) => ({
          padding: 12,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isRoundOpen ? tournamentColors.surfaceRaised : tournamentColors.white,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: tournamentColors.text }}>
              Round {round.roundNumber}
            </Text>
            {isRoundCompleted && (
              <View style={{ backgroundColor: tournamentColors.statusSuccessBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: tournamentColors.statusSuccessText, fontWeight: '700', fontSize: 11 }}>Done</Text>
              </View>
            )}
            {round.roundKey === filteredActiveRoundNumber && (
              <View style={{ backgroundColor: tournamentColors.statusInfoBg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: tournamentColors.statusInfoText, fontWeight: '700', fontSize: 11 }}>Current</Text>
              </View>
            )}
          </View>
          <Text style={{ color: tournamentColors.textMuted, fontSize: 12 }}>
            {matchCount} {matchCount === 1 ? 'match' : 'matches'} · {completedGamesCount}/{totalGamesCount} games scored
          </Text>
        </View>
        <AppIcon
          name={isRoundOpen ? 'chevronUp' : 'chevronDown'}
          size={22}
          color={tournamentColors.primary}
          style={{ marginLeft: 8 }}
        />
      </Pressable>

      {isRoundOpen ? (
        <RoundMatchesTable
          matches={round.matches || []}
          scoringStyle={scoringStyle}
          scoreInputsByGameId={scoreInputsByGameId}
          hydrateEpoch={hydrateEpoch}
          onChangeScoreInput={onChangeScoreInput}
          savingGameId={savingGameId}
          onSaveMatchScores={onSaveMatchScores}
          canEditPatternScores={canEditPatternScores}
          defaultSeriesMaxGames={defaultSeriesMaxGames}
          useLiveSessionScoring={useLiveSessionScoring}
          onStartGame={onStartGame}
          onScheduleMatch={onScheduleMatch}
          viewOnly={viewOnly}
        />
      ) : null}
    </View>
  );
}, (previousProps, nextProps) =>
  previousProps.round === nextProps.round &&
  previousProps.expandedRoundKey === nextProps.expandedRoundKey &&
  previousProps.hydrateEpoch === nextProps.hydrateEpoch &&
  previousProps.savingGameId === nextProps.savingGameId &&
  previousProps.filteredActiveRoundNumber === nextProps.filteredActiveRoundNumber &&
  previousProps.defaultSeriesMaxGames === nextProps.defaultSeriesMaxGames &&
  previousProps.canEditPatternScores === nextProps.canEditPatternScores &&
  previousProps.viewOnly === nextProps.viewOnly &&
  previousProps.useLiveSessionScoring === nextProps.useLiveSessionScoring &&
  previousProps.scoringStyle === nextProps.scoringStyle
);

export const RoundMatchesDisplay = memo(function RoundMatchesDisplay({
  filteredDisplayRounds = [],
  displaySections = null,
  fixtureSummaryText = '',
  expandedRoundNumber,
  expandedRoundKey,
  expandedSectionId = null,
  onToggleSection = () => {},
  onToggleRound,
  scoreInputsByGameId,
  hydrateEpoch = 0,
  onChangeScoreInput = () => {},
  defaultSeriesMaxGames = 1,
  savingGameId,
  onSaveMatchScores,
  canEditPatternScores,
  filteredActiveRoundNumber,
  canShowFinalStageStep,
  isProgressing,
  isLoadingFinaleCandidates,
  onOpenFinaleModal,
  onCompleteWithoutFinals,
  onAddSeriesGame,
  showSaveButton = false,
  showAddSeriesButton = false,
  showFinaleActions = false,
  collapsibleSections = false,
  useLiveSessionScoring = false,
  onStartGame,
  onScheduleMatch,
  viewOnly = false,
  scoringStyle = 'individualGames',
}) {
  const resolvedExpandedRoundKey =
    expandedRoundKey !== undefined && expandedRoundKey !== null
      ? expandedRoundKey
      : expandedRoundNumber !== undefined && expandedRoundNumber !== null
        ? `round-${expandedRoundNumber}`
        : null;

  const { sp, isWide, isDesktopWeb } = useTypography();

  const handleToggleRound = (roundKey) => {
    if (typeof onToggleRound === 'function') {
      onToggleRound(roundKey);
    }
  };

  const roundRendererProps = {
    sp,
    isWide,
    isDesktopWeb,
    expandedRoundKey: resolvedExpandedRoundKey,
    onToggleRound: handleToggleRound,
    scoreInputsByGameId,
    hydrateEpoch,
    onChangeScoreInput,
    savingGameId,
    onSaveMatchScores,
    canEditPatternScores,
    filteredActiveRoundNumber,
    onAddSeriesGame,
    showSaveButton,
    showAddSeriesButton,
    defaultSeriesMaxGames,
    useLiveSessionScoring,
    onStartGame,
    onScheduleMatch,
    viewOnly,
    scoringStyle,
  };

  const sections =
    Array.isArray(displaySections) && displaySections.length > 0
      ? displaySections
      : [
          {
            sectionId: 'default',
            sectionName: '',
            matchCount: (filteredDisplayRounds || []).reduce(
              (total, round) => total + (round.matches || []).length,
              0
            ),
            rounds: (filteredDisplayRounds || []).map((round) => ({
              ...round,
              roundKey: round.roundKey || `round-${round.roundNumber}`,
            })),
          },
        ];

  const useCollapsibleSections = collapsibleSections && sections.some((section) => Boolean(section.sectionName));

  return (
    <View>
      {Boolean(fixtureSummaryText) && (
        <Text style={{ color: tournamentColors.textMuted, fontSize: 13, marginBottom: 10, lineHeight: 18 }}>
          {fixtureSummaryText}
        </Text>
      )}

      {sections.map((section) => {
        const isSectionOpen = !useCollapsibleSections || expandedSectionId === section.sectionId;
        const sectionMatchCount =
          Number(section.matchCount || 0) ||
          (section.rounds || []).reduce((total, round) => total + (round.matches || []).length, 0);

        return (
          <View key={`section-${section.sectionId}`} style={{ marginBottom: 12 }}>
            {section.sectionName ? (
              useCollapsibleSections ? (
                <Pressable
                  onPress={() => onToggleSection(section.sectionId)}
                  style={({ pressed }) => ({
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    borderRadius: 14,
                    paddingVertical: 14,
                    paddingHorizontal: 14,
                    backgroundColor: isSectionOpen ? tournamentColors.primary : tournamentColors.white,
                    borderWidth: 1,
                    borderColor: isSectionOpen ? tournamentColors.primary : tournamentColors.border,
                    marginBottom: isSectionOpen ? 10 : 0,
                    opacity: pressed ? 0.9 : 1,
                  })}
                >
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text
                      style={{
                        fontWeight: '800',
                        fontSize: 16,
                        color: isSectionOpen ? tournamentColors.onPrimary || '#ffffff' : tournamentColors.text,
                      }}
                    >
                      {section.sectionName}
                    </Text>
                    <Text
                      style={{
                        color: isSectionOpen ? tournamentColors.heroSubtext : tournamentColors.textMuted,
                        fontSize: 12,
                      }}
                    >
                      {sectionMatchCount} {sectionMatchCount === 1 ? 'match' : 'matches'}
                    </Text>
                  </View>
                  <AppIcon
                    name={isSectionOpen ? 'chevronUp' : 'chevronDown'}
                    size={22}
                    color={isSectionOpen ? tournamentColors.onPrimary || '#ffffff' : tournamentColors.primary}
                  />
                </Pressable>
              ) : (
                <Text style={{ fontWeight: '800', fontSize: 16, color: tournamentColors.text, marginBottom: 8 }}>
                  {section.sectionName}
                </Text>
              )
            ) : null}

            {isSectionOpen &&
              (section.rounds || []).map((round) => (
                <FixtureRoundPanel key={round.roundKey || `round-${round.roundNumber}`} round={round} {...roundRendererProps} />
              ))}
          </View>
        );
      })}

      {showFinaleActions && canShowFinalStageStep && (
        <View style={[discoverUi.surfaceCard, { marginTop: 4 }]}>
          <Text style={{ fontWeight: '800', fontSize: 15, color: tournamentColors.text, marginBottom: 10 }}>
            Finale actions
          </Text>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <View style={{ flex: 1 }}>
              <MatchActionButton
                label={isProgressing ? 'Working…' : 'Start finale'}
                onPress={onOpenFinaleModal}
                disabled={isProgressing || isLoadingFinaleCandidates}
              />
            </View>
            <View style={{ flex: 1 }}>
              <MatchActionButton
                label={isProgressing ? 'Working…' : 'Skip finale'}
                onPress={onCompleteWithoutFinals}
                disabled={isProgressing}
                variant="secondary"
              />
            </View>
          </View>
        </View>
      )}
    </View>
  );
});
