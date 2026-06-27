import React from 'react';
import { getSeriesScoringMeta } from '../utils/seriesScoring';
import { Pressable, View } from 'react-native';
import { useTypography } from '../context/TypographyContext';
import { ScaledText as Text } from './ui/ScaledText';
import { ScaledTextInput as TextInput } from './ui/ScaledTextInput';
import { discoverUi, tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { AppIcon } from './ui/AppIcon';
import { formatMatchScheduledAt } from './tournament/MatchScheduleModal';

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
          color: isPrimary ? tournamentColors.white : tournamentColors.primary,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const statusTone = (status) => {
  if (status === 'completed') {
    return { bg: '#dcfce7', text: '#166534', label: 'Completed' };
  }

  if (status === 'inProgress') {
    return { bg: '#fef3c7', text: '#b45309', label: 'In progress' };
  }

  return { bg: '#f1f5f9', text: '#475569', label: 'Not started' };
};

const renderRound = ({
  round,
  expandedRoundKey,
  onToggleRound,
  scoreInputsByGameId,
  onChangeScoreInput,
  savingGameId,
  onSaveMatchScores,
  canEditPatternScores,
  filteredActiveRoundNumber,
  onAddSeriesGame,
  showSaveButton,
  showAddSeriesButton,
  defaultSeriesMaxGames = 1,
  useLiveSessionScoring = false,
  onStartGame,
  onScheduleMatch,
  sp = (n) => n,
  isWide = false,
}) => {
  const roundKey = round.roundKey || `round-${round.roundNumber}`;
  const matchPad = isWide ? sp(14) : 12;
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
          backgroundColor: isRoundOpen ? '#f8fafc' : tournamentColors.white,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
            <Text style={{ fontWeight: '800', fontSize: 15, color: tournamentColors.text }}>
              Round {round.roundNumber}
            </Text>
            {isRoundCompleted && (
              <View style={{ backgroundColor: '#dcfce7', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#166534', fontWeight: '700', fontSize: 11 }}>Done</Text>
              </View>
            )}
            {round.roundKey === filteredActiveRoundNumber && (
              <View style={{ backgroundColor: '#dbeafe', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 }}>
                <Text style={{ color: '#1d4ed8', fontWeight: '700', fontSize: 11 }}>Current</Text>
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

      {isRoundOpen &&
        (round.matches || []).map((match, matchIndex) => {
          const matchId = match.gameId || match.id;
          const playerAKey = String(match.playerA?.id || match.playerAId || 'a');
          const playerBKey = String(match.playerB?.id || match.playerBId || 'b');
          const matchIdentityKey = matchId
            ? String(matchId)
            : `${playerAKey}::${playerBKey}::${String(match.matchNumber || 0)}`;
          const matchKey = `${roundKey}-match-${matchIdentityKey}-${matchIndex}`;
          const playerAName =
            match.playerA?.name ||
            match.playerA?.displayName ||
            match.playerA?.id ||
            match.playerAName ||
            match.playerAId ||
            'Player A';
          const playerBName =
            match.playerB?.name ||
            match.playerB?.displayName ||
            match.playerB?.id ||
            match.playerBName ||
            match.playerBId ||
            'Player B';
          const scoreStateKey =
            matchId || `pending-${round.roundNumber}-${match.matchNumber}-${playerAKey}-${playerBKey}`;
          const isSavingThisMatch =
            savingGameId === scoreStateKey || (Boolean(matchId) && savingGameId === matchId);
          const defaultSeriesMax = Math.max(
            Number(match.bestOf || 1),
            Number(defaultSeriesMaxGames || 1),
            1
          );
          const scoreInput = scoreInputsByGameId[scoreStateKey] || {
            status: match.status || 'scheduled',
            seriesMaxGames: defaultSeriesMax,
            entries: Array.from({ length: defaultSeriesMax }, (_, index) => ({
              gameNumber: index + 1,
              playerAScore: '',
              playerBScore: '',
            })),
          };
          const scoreInputEntries = (scoreInput.entries || []).map((entry, entryIndex) => ({
            gameNumber: Number(entry?.gameNumber || entryIndex + 1),
            playerAScore: String(entry?.playerAScore ?? ''),
            playerBScore: String(entry?.playerBScore ?? ''),
          }));
          const { seriesTargetBestOf, isSeriesAtLimit } = getSeriesScoringMeta({
            scoreInput,
            matchBestOf: match.bestOf,
            configuredBestOf: defaultSeriesMaxGames,
            entryCount: scoreInputEntries.length,
          });
          while (scoreInputEntries.length < seriesTargetBestOf) {
            scoreInputEntries.push({
              gameNumber: scoreInputEntries.length + 1,
              playerAScore: '',
              playerBScore: '',
            });
          }
          const tone = statusTone(match.status);
          const canEditThisMatch = match.canEditMatch ?? canEditPatternScores;
          const hasSavedScores =
            match.status === 'completed' ||
            match.status === 'inProgress' ||
            (Array.isArray(match.scoreEntries) &&
              match.scoreEntries.some((entry) => {
                const playerAScore = Number(entry?.playerAScore);
                const playerBScore = Number(entry?.playerBScore);
                return (
                  Number.isFinite(playerAScore) &&
                  Number.isFinite(playerBScore) &&
                  !(playerAScore === 0 && playerBScore === 0)
                );
              }));
          const showAppointmentInHeader =
            Boolean(onScheduleMatch) &&
            match.canScheduleMatch !== false &&
            matchId &&
            match.status === 'scheduled';
          const appointmentLabel = match.scheduledStartAt
            ? formatMatchScheduledAt(match.scheduledStartAt)
            : 'Not scheduled';

          return (
            <View
              key={matchKey}
              style={{
                borderTopWidth: 1,
                borderTopColor: tournamentColors.borderLight,
                padding: matchPad,
                backgroundColor: '#fafbfc',
              }}
            >
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: isWide ? sp(10) : 8 }}>
                <View style={{ flex: 1, gap: isWide ? sp(6) : 4 }}>
                  <Text style={{ fontWeight: '800', fontSize: 14, color: tournamentColors.text }}>
                    Match {match.matchNumber}
                  </Text>
                  <Text style={{ fontSize: 14, color: tournamentColors.text, lineHeight: 20 }}>
                    {playerAName}
                    <Text style={{ color: tournamentColors.textMuted }}> vs </Text>
                    {playerBName}
                  </Text>
                  <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>
                    {useLiveSessionScoring
                      ? `Best of ${seriesTargetBestOf} · Series ${Number(match.playerASeriesWins || 0)}–${Number(match.playerBSeriesWins || 0)}`
                      : `Best of ${seriesTargetBestOf} · ${scoreInputEntries.length}/${seriesTargetBestOf} games entered`}
                  </Text>
                </View>
                {showAppointmentInHeader ? (
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '600',
                      color: match.scheduledStartAt ? '#1d4ed8' : tournamentColors.textMuted,
                      textAlign: 'right',
                      maxWidth: '45%',
                    }}
                  >
                    {appointmentLabel}
                  </Text>
                ) : (
                  <View style={{ backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: tone.text }}>{tone.label}</Text>
                  </View>
                )}
              </View>

              {onScheduleMatch && match.canScheduleMatch !== false && matchId ? (
                <View style={{ marginTop: 10 }}>
                  <MatchActionButton
                    label={match.scheduledStartAt ? 'Reschedule' : 'Schedule match'}
                    onPress={() =>
                      onScheduleMatch({
                        gameId: matchId,
                        tournamentId: match.tournamentId,
                        playerAName,
                        playerBName,
                        scheduledStartAt: match.scheduledStartAt || null,
                      })
                    }
                    variant="secondary"
                  />
                </View>
              ) : null}

              {useLiveSessionScoring && onStartGame ? (
                <View style={{ marginTop: 10 }}>
                  {match.status === 'completed' ? (
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#166534' }}>
                      Series complete · {Number(match.playerASeriesWins || 0)}–{Number(match.playerBSeriesWins || 0)}
                    </Text>
                  ) : (
                    <MatchActionButton
                      label={match.status === 'inProgress' ? 'Resume game' : 'Start game'}
                      onPress={() =>
                        onStartGame({
                          gameId: matchId,
                          tournamentId: match.tournamentId,
                          playerAName,
                          playerBName,
                        })
                      }
                      disabled={!canEditPatternScores || !matchId}
                    />
                  )}
                </View>
              ) : (
              <>
              <View
                style={{
                  marginTop: 10,
                  borderWidth: 1,
                  borderColor: tournamentColors.borderLight,
                  borderRadius: 10,
                  overflow: 'hidden',
                  backgroundColor: tournamentColors.white,
                }}
              >
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 10,
                    paddingVertical: 8,
                    backgroundColor: '#f8fafc',
                    borderBottomWidth: 1,
                    borderBottomColor: tournamentColors.borderLight,
                  }}
                >
                  <Text style={{ width: 40, fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>G#</Text>
                  <Text style={{ flex: 1, fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }} numberOfLines={1}>
                    {playerAName}
                  </Text>
                  <Text style={{ flex: 1, fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }} numberOfLines={1}>
                    {playerBName}
                  </Text>
                </View>

                {scoreInputEntries.map((entry, entryIndex) => {
                  const safeEntry = entry || {
                    gameNumber: entryIndex + 1,
                    playerAScore: '',
                    playerBScore: '',
                  };
                  const isLastEntry = entryIndex === scoreInputEntries.length - 1;

                  return (
                    <View
                      key={`${scoreStateKey}-entry-${entryIndex}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 8,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        borderBottomWidth: isLastEntry ? 0 : 1,
                        borderBottomColor: '#f1f5f9',
                      }}
                    >
                      <Text style={{ width: 40, color: tournamentColors.text, fontWeight: '700', fontSize: 12 }}>
                        {entryIndex + 1}
                      </Text>
                      <TextInput
                        style={{ flex: 1, ...tournamentUi.input, paddingVertical: 8 }}
                        placeholder="0"
                        value={safeEntry.playerAScore}
                        onChangeText={(value) =>
                          onChangeScoreInput(scoreStateKey, entryIndex, 'playerAScore', value)
                        }
                        keyboardType="numeric"
                        editable={canEditThisMatch}
                      />
                      <TextInput
                        style={{ flex: 1, ...tournamentUi.input, paddingVertical: 8 }}
                        placeholder="0"
                        value={safeEntry.playerBScore}
                        onChangeText={(value) =>
                          onChangeScoreInput(scoreStateKey, entryIndex, 'playerBScore', value)
                        }
                        keyboardType="numeric"
                        editable={canEditThisMatch}
                      />
                    </View>
                  );
                })}
              </View>

              {showAddSeriesButton && onAddSeriesGame ? (
                <View style={{ marginTop: 10 }}>
                  <MatchActionButton
                    label="Add game to series"
                    onPress={() =>
                      onAddSeriesGame({ scoreStateKey, scoreInput, seriesMaxGames: seriesTargetBestOf })
                    }
                    disabled={!canEditThisMatch || isSeriesAtLimit}
                    variant="secondary"
                  />
                </View>
              ) : null}

              {showSaveButton && onSaveMatchScores ? (
                <View style={{ marginTop: 10 }}>
                  <MatchActionButton
                    label={
                      isSavingThisMatch
                        ? 'Saving…'
                        : hasSavedScores
                          ? 'Update scores'
                          : 'Save match scores'
                    }
                    onPress={() =>
                      onSaveMatchScores({
                        gameId: matchId,
                        roundNumber: round.roundNumber,
                        playerAId: match.playerA?.id || match.playerAId,
                        playerBId: match.playerB?.id || match.playerBId,
                        scoreStateKey,
                        bestOf: seriesTargetBestOf,
                      })
                    }
                    disabled={!canEditThisMatch || isSavingThisMatch}
                  />
                </View>
              ) : null}
              </>
              )}
            </View>
          );
        })}
    </View>
  );
};

export function RoundMatchesDisplay({
  filteredDisplayRounds = [],
  displaySections = null,
  fixtureSummaryText = '',
  expandedRoundNumber,
  expandedRoundKey,
  expandedSectionId = null,
  onToggleSection = () => {},
  onToggleRound,
  scoreInputsByGameId,
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
}) {
  const resolvedExpandedRoundKey =
    expandedRoundKey !== undefined && expandedRoundKey !== null
      ? expandedRoundKey
      : expandedRoundNumber !== undefined && expandedRoundNumber !== null
        ? `round-${expandedRoundNumber}`
        : null;

  const { sp, isWide } = useTypography();

  const handleToggleRound = (roundKey) => {
    if (typeof onToggleRound === 'function') {
      onToggleRound(roundKey);
    }
  };

  const roundRendererProps = {
    sp,
    isWide,
    expandedRoundKey: resolvedExpandedRoundKey,
    onToggleRound: handleToggleRound,
    scoreInputsByGameId,
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
                        color: isSectionOpen ? tournamentColors.white : tournamentColors.text,
                      }}
                    >
                      {section.sectionName}
                    </Text>
                    <Text style={{ color: isSectionOpen ? '#dbeafe' : tournamentColors.textMuted, fontSize: 12 }}>
                      {sectionMatchCount} {sectionMatchCount === 1 ? 'match' : 'matches'}
                    </Text>
                  </View>
                  <AppIcon
                    name={isSectionOpen ? 'chevronUp' : 'chevronDown'}
                    size={22}
                    color={isSectionOpen ? tournamentColors.white : tournamentColors.primary}
                  />
                </Pressable>
              ) : (
                <Text style={{ fontWeight: '800', fontSize: 16, color: tournamentColors.text, marginBottom: 8 }}>
                  {section.sectionName}
                </Text>
              )
            ) : null}

            {isSectionOpen &&
              (section.rounds || []).map((round) => renderRound({ round, ...roundRendererProps }))}
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
}
