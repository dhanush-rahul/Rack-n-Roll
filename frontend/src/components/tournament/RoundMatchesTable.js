import React, { useCallback, useMemo } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScoreBoxInput } from './ScoreBoxInput';
import { MatchDurationDisplay, formatMatchDuration } from './MatchDurationDisplay';
import { formatMatchScheduledAt } from './MatchScheduleModal';
import { getSeriesScoringMeta, getSeriesWinnerSide, isPlayedScoreEntry } from '../../utils/seriesScoring';
import { tournamentColors } from '../../styles/tournamentUi';
import { useDebouncedMatchSave } from '../../hooks/useDebouncedMatchSave';

const statusTone = (status) => {
  if (status === 'completed') {
    return { bg: tournamentColors.statusSuccessBg, text: tournamentColors.statusSuccessText, label: 'Completed' };
  }
  if (status === 'inProgress') {
    return { bg: tournamentColors.statusWarningBg, text: tournamentColors.statusWarningText, label: 'In progress' };
  }
  return { bg: tournamentColors.statusNeutralBg, text: tournamentColors.statusNeutralText, label: 'Not started' };
};

const CELL_HORIZONTAL_PAD = 12;
const SCORE_BOX_WIDTH = 40;
const SCORE_BOX_GAP = 4;
const SCORES_VS_WIDTH = 24;
const SCORES_COLUMN_MIN_WIDTH = 180;

function fontWeightScale(fontWeight) {
  if (fontWeight === '800' || fontWeight === '900') {
    return 0.65;
  }
  if (fontWeight === '700' || fontWeight === 'bold') {
    return 0.6;
  }
  if (fontWeight === '600') {
    return 0.58;
  }
  return 0.52;
}

function estimateTextWidth(text, fontSize, fontWeight = '400') {
  const value = String(text ?? '');
  if (!value) {
    return 0;
  }

  return Math.ceil(value.length * fontSize * fontWeightScale(fontWeight));
}

function withCellPadding(width, minWidth = 0) {
  return Math.max(minWidth, width + CELL_HORIZONTAL_PAD);
}

function getMatchPlayerName(match, side) {
  if (side === 'a') {
    return match.playerA?.name || match.playerA?.displayName || match.playerAName || 'Player A';
  }

  return match.playerB?.name || match.playerB?.displayName || match.playerBName || 'Player B';
}

function getScoresColumnWidth(boxCount) {
  const sideWidth = boxCount * SCORE_BOX_WIDTH + Math.max(0, boxCount - 1) * SCORE_BOX_GAP;
  return Math.max(SCORES_COLUMN_MIN_WIDTH, sideWidth + SCORES_VS_WIDTH + 16 + sideWidth);
}

function computeTableColumnWidths({
  matches,
  isTotalPoints,
  defaultSeriesMaxGames,
  useLiveSessionScoring,
  showActions,
}) {
  let matchNumberWidth = estimateTextWidth('M#', 11, '700');
  let player1Width = estimateTextWidth('Player 1', 11, '700');
  let player2Width = estimateTextWidth('Player 2', 11, '700');
  let durationWidth = estimateTextWidth('Duration', 11, '700');
  let scheduledWidth = estimateTextWidth('Scheduled', 11, '700');
  let statusWidth = Math.max(
    estimateTextWidth('Completed', 10, '700'),
    estimateTextWidth('In progress', 10, '700'),
    estimateTextWidth('Not started', 10, '700'),
    estimateTextWidth('Saving…', 10, '400')
  );
  let actionsWidth = 0;

  let maxScoreBoxes = Math.max(Number(defaultSeriesMaxGames) || 1, 1);
  let liveScoreTextWidth = estimateTextWidth('0–0', 11, '400');

  for (const match of matches) {
    matchNumberWidth = Math.max(matchNumberWidth, estimateTextWidth(String(match.matchNumber ?? ''), 13, '800'));
    player1Width = Math.max(player1Width, estimateTextWidth(getMatchPlayerName(match, 'a'), 13, '600'));
    player2Width = Math.max(player2Width, estimateTextWidth(getMatchPlayerName(match, 'b'), 13, '600'));

    const durationLabel =
      match.status === 'scheduled' || (!match.matchDurationMs && !match.matchStartedAt)
        ? '—'
        : formatMatchDuration(match.matchDurationMs);
    durationWidth = Math.max(durationWidth, estimateTextWidth(durationLabel, 12, '600'));

    const appointmentLabel = match.scheduledStartAt
      ? formatMatchScheduledAt(match.scheduledStartAt) || 'Not scheduled'
      : 'Not scheduled';
    scheduledWidth = Math.max(scheduledWidth, estimateTextWidth(appointmentLabel, 11, '400'));

    statusWidth = Math.max(statusWidth, estimateTextWidth(statusTone(match.status).label, 10, '700'));

    if (useLiveSessionScoring) {
      const liveScoreLabel = `${Number(match.playerASeriesWins || 0)}–${Number(match.playerBSeriesWins || 0)}`;
      liveScoreTextWidth = Math.max(liveScoreTextWidth, estimateTextWidth(liveScoreLabel, 11, '400'));
    } else {
      maxScoreBoxes = Math.max(maxScoreBoxes, Number(match.bestOf || 1) || 1);
    }

    if (showActions) {
      const actionLabels = [];
      if (useLiveSessionScoring && (match.gameId || match.id) && match.status !== 'completed') {
        actionLabels.push(match.status === 'inProgress' ? 'Resume' : 'Start');
      }
      if (match.canScheduleMatch !== false && (match.gameId || match.id)) {
        actionLabels.push(match.scheduledStartAt ? 'Reschedule' : 'Schedule');
      }
      for (const label of actionLabels) {
        actionsWidth = Math.max(actionsWidth, estimateTextWidth(label, 12, '700') + 22);
      }
    }
  }

  const boxScoresWidth = isTotalPoints ? getScoresColumnWidth(1) : getScoresColumnWidth(maxScoreBoxes);
  const scoresColumnWidth = useLiveSessionScoring
    ? Math.max(boxScoresWidth, withCellPadding(liveScoreTextWidth, SCORES_COLUMN_MIN_WIDTH))
    : boxScoresWidth;

  return {
    matchNumber: withCellPadding(matchNumberWidth, 28),
    player1: withCellPadding(player1Width, 72),
    player2: withCellPadding(player2Width, 72),
    scores: scoresColumnWidth,
    duration: withCellPadding(durationWidth, 48),
    scheduled: withCellPadding(scheduledWidth, 88),
    status: withCellPadding(statusWidth + 16, 72),
    actions: showActions ? withCellPadding(actionsWidth, 72) : 0,
  };
}

function TableHeaderCell({ label, width, align = 'left' }) {
  return (
    <View
      style={{
        width,
        flexShrink: 0,
        paddingHorizontal: 6,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: tournamentColors.textMuted, textAlign: align }}>
        {label}
      </Text>
    </View>
  );
}

function TableCell({ width, align = 'left', children, style }) {
  return (
    <View
      style={[
        {
          width,
          flexShrink: 0,
          paddingHorizontal: 6,
          alignItems: align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

function MatchScoresCell({
  match,
  scoreStateKey,
  displayEntries,
  boxCount,
  columnWidth,
  canEditThisMatch,
  isSaving,
  useLiveSessionScoring,
  handleScoreChange,
  seriesTargetBestOf,
  scoringStyle,
}) {
  const seriesWinnerSide = getSeriesWinnerSide({
    entries: displayEntries,
    bestOf: seriesTargetBestOf,
    scoringStyle,
    match,
  });

  if (useLiveSessionScoring) {
    const winsA = Number(match.playerASeriesWins || 0);
    const winsB = Number(match.playerBSeriesWins || 0);
    const liveSeriesWinner =
      seriesWinnerSide ||
      (winsA > winsB ? 'a' : winsB > winsA ? 'b' : null);

    return (
      <View style={{ width: columnWidth, flexShrink: 0, paddingHorizontal: 6, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 11, color: tournamentColors.textMuted, textAlign: 'center' }}>
          <Text style={liveSeriesWinner === 'a' ? { color: tournamentColors.statusSuccessText, fontWeight: '700' } : undefined}>
            {winsA}
          </Text>
          {'–'}
          <Text style={liveSeriesWinner === 'b' ? { color: tournamentColors.statusSuccessText, fontWeight: '700' } : undefined}>
            {winsB}
          </Text>
        </Text>
      </View>
    );
  }

  return (
    <View
      style={{
        width: columnWidth,
        flexShrink: 0,
        paddingHorizontal: 6,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
      }}
    >
      <View style={{ flexDirection: 'row', gap: SCORE_BOX_GAP }}>
        {Array.from({ length: boxCount }).map((_, boxIndex) => {
          const entry = displayEntries[boxIndex];
          const highlighted = seriesWinnerSide === 'a' && isPlayedScoreEntry(entry);

          return (
            <ScoreBoxInput
              key={`a-${scoreStateKey}-${boxIndex}`}
              value={entry?.playerAScore ?? ''}
              highlighted={highlighted}
              onChangeText={(value) =>
                handleScoreChange({
                  match,
                  scoreStateKey,
                  entryIndex: boxIndex,
                  field: 'playerAScore',
                  value,
                  seriesTargetBestOf,
                })
              }
              editable={canEditThisMatch}
              saving={isSaving}
            />
          );
        })}
      </View>
      <Text style={{ width: SCORES_VS_WIDTH, textAlign: 'center', fontSize: 12, color: tournamentColors.textMuted, fontWeight: '700' }}>
        vs
      </Text>
      <View style={{ flexDirection: 'row', gap: SCORE_BOX_GAP }}>
        {Array.from({ length: boxCount }).map((_, boxIndex) => {
          const entry = displayEntries[boxIndex];
          const highlighted = seriesWinnerSide === 'b' && isPlayedScoreEntry(entry);

          return (
            <ScoreBoxInput
              key={`b-${scoreStateKey}-${boxIndex}`}
              value={entry?.playerBScore ?? ''}
              highlighted={highlighted}
              onChangeText={(value) =>
                handleScoreChange({
                  match,
                  scoreStateKey,
                  entryIndex: boxIndex,
                  field: 'playerBScore',
                  value,
                  seriesTargetBestOf,
                })
              }
              editable={canEditThisMatch}
              saving={isSaving}
            />
          );
        })}
      </View>
    </View>
  );
}

function MatchActionButton({ label, onPress, disabled, variant = 'primary' }) {
  const isPrimary = variant === 'primary';
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: isPrimary ? tournamentColors.primary : tournamentColors.border,
        backgroundColor: isPrimary
          ? disabled
            ? tournamentColors.primaryMuted
            : tournamentColors.primary
          : tournamentColors.surfaceRaised,
        opacity: pressed || disabled ? 0.75 : 1,
      })}
    >
      <Text style={{ fontSize: 12, fontWeight: '700', color: isPrimary ? tournamentColors.onPrimary || '#ffffff' : tournamentColors.primary }}>
        {label}
      </Text>
    </Pressable>
  );
}

export function RoundMatchesTable({
  matches = [],
  scoringStyle = 'individualGames',
  scoreInputsByGameId = {},
  onChangeScoreInput,
  savingGameId = null,
  onSaveMatchScores,
  canEditPatternScores = false,
  defaultSeriesMaxGames = 1,
  useLiveSessionScoring = false,
  onStartGame,
  onScheduleMatch,
  viewOnly = false,
}) {
  const scheduleAutoSave = useDebouncedMatchSave((payload) => {
    onSaveMatchScores?.(payload);
  });

  const isTotalPoints = scoringStyle === 'totalPoints';
  const showActions = !viewOnly && (useLiveSessionScoring || onScheduleMatch);
  const columnWidths = useMemo(
    () =>
      computeTableColumnWidths({
        matches,
        isTotalPoints,
        defaultSeriesMaxGames,
        useLiveSessionScoring,
        showActions,
      }),
    [defaultSeriesMaxGames, isTotalPoints, matches, showActions, useLiveSessionScoring]
  );

  const minTableWidth =
    columnWidths.matchNumber +
    columnWidths.player1 +
    columnWidths.scores +
    columnWidths.player2 +
    columnWidths.duration +
    columnWidths.scheduled +
    columnWidths.status +
    columnWidths.actions +
    16;

  const handleScoreChange = useCallback(
    ({ match, scoreStateKey, entryIndex, field, value, seriesTargetBestOf }) => {
      onChangeScoreInput?.(scoreStateKey, entryIndex, field, value);

      if (viewOnly || !onSaveMatchScores) {
        return;
      }

      scheduleAutoSave(scoreStateKey, {
        gameId: match.gameId || match.id,
        roundNumber: match.roundNumber,
        playerAId: match.playerAId,
        playerBId: match.playerBId,
        scoreStateKey,
        bestOf: isTotalPoints ? 1 : seriesTargetBestOf,
      });
    },
    [isTotalPoints, onChangeScoreInput, onSaveMatchScores, scheduleAutoSave, viewOnly]
  );

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled keyboardShouldPersistTaps="handled">
      <View style={{ minWidth: minTableWidth, paddingBottom: 4 }}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 10,
            paddingHorizontal: 8,
            backgroundColor: tournamentColors.surfaceRaised,
            borderBottomWidth: 1,
            borderBottomColor: tournamentColors.borderLight,
          }}
        >
          <TableHeaderCell label="M#" width={columnWidths.matchNumber} align="center" />
          <TableHeaderCell label="Player 1" width={columnWidths.player1} />
          <TableHeaderCell label="Scores" width={columnWidths.scores} align="center" />
          <TableHeaderCell label="Player 2" width={columnWidths.player2} />
          <TableHeaderCell label="Duration" width={columnWidths.duration} align="center" />
          <TableHeaderCell label="Scheduled" width={columnWidths.scheduled} />
          <TableHeaderCell label="Status" width={columnWidths.status} align="center" />
          {showActions ? <TableHeaderCell label="" width={columnWidths.actions} /> : null}
        </View>

        {(matches || []).map((match, matchIndex) => {
          const matchId = match.gameId || match.id;
          const playerAKey = String(match.playerA?.id || match.playerAId || 'a');
          const playerBKey = String(match.playerB?.id || match.playerBId || 'b');
          const scoreStateKey =
            matchId || `pending-${match.roundNumber}-${match.matchNumber}-${playerAKey}-${playerBKey}`;
          const playerAName = getMatchPlayerName(match, 'a');
          const playerBName = getMatchPlayerName(match, 'b');
          const isSaving =
            savingGameId === scoreStateKey || (Boolean(matchId) && savingGameId === matchId);
          const defaultSeriesMax = Math.max(Number(match.bestOf || 1), Number(defaultSeriesMaxGames || 1), 1);
          const scoreInput = scoreInputsByGameId[scoreStateKey] || {
            status: match.status || 'scheduled',
            seriesMaxGames: defaultSeriesMax,
            entries: [{ gameNumber: 1, playerAScore: '', playerBScore: '' }],
          };
          const scoreInputEntries = (scoreInput.entries || []).map((entry, entryIndex) => ({
            gameNumber: Number(entry?.gameNumber || entryIndex + 1),
            playerAScore: String(entry?.playerAScore ?? ''),
            playerBScore: String(entry?.playerBScore ?? ''),
          }));
          const { seriesTargetBestOf } = getSeriesScoringMeta({
            scoreInput,
            matchBestOf: match.bestOf,
            configuredBestOf: defaultSeriesMaxGames,
            entryCount: scoreInputEntries.length,
          });
          while (!isTotalPoints && scoreInputEntries.length < seriesTargetBestOf) {
            scoreInputEntries.push({
              gameNumber: scoreInputEntries.length + 1,
              playerAScore: '',
              playerBScore: '',
            });
          }
          const displayEntries = isTotalPoints ? scoreInputEntries.slice(0, 1) : scoreInputEntries;
          const boxCount = isTotalPoints ? 1 : seriesTargetBestOf;
          const tone = statusTone(match.status);
          const canEditThisMatch = viewOnly ? false : (match.canEditMatch ?? canEditPatternScores);
          const appointmentLabel = match.scheduledStartAt
            ? formatMatchScheduledAt(match.scheduledStartAt)
            : 'Not scheduled';

          return (
            <View
              key={`table-match-${scoreStateKey}-${matchIndex}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 12,
                paddingHorizontal: 8,
                borderBottomWidth: 1,
                borderBottomColor: tournamentColors.borderLight,
                backgroundColor: matchIndex % 2 === 0 ? tournamentColors.white : tournamentColors.rowStripe,
              }}
            >
              <TableCell width={columnWidths.matchNumber} align="center">
                <Text style={{ fontWeight: '800', color: tournamentColors.text }}>{match.matchNumber}</Text>
              </TableCell>
              <TableCell width={columnWidths.player1}>
                <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.text }}>
                  {playerAName}
                </Text>
              </TableCell>
              <MatchScoresCell
                match={match}
                scoreStateKey={scoreStateKey}
                displayEntries={displayEntries}
                boxCount={boxCount}
                columnWidth={columnWidths.scores}
                canEditThisMatch={canEditThisMatch}
                isSaving={isSaving}
                useLiveSessionScoring={useLiveSessionScoring}
                handleScoreChange={handleScoreChange}
                seriesTargetBestOf={seriesTargetBestOf}
                scoringStyle={scoringStyle}
              />
              <TableCell width={columnWidths.player2}>
                <Text numberOfLines={2} style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.text }}>
                  {playerBName}
                </Text>
              </TableCell>
              <TableCell width={columnWidths.duration} align="center">
                <MatchDurationDisplay
                  durationMs={match.matchDurationMs}
                  startedAt={match.matchStartedAt}
                  status={match.status}
                />
              </TableCell>
              <TableCell width={columnWidths.scheduled}>
                <Text
                  numberOfLines={2}
                  style={{ fontSize: 11, color: match.scheduledStartAt ? tournamentColors.scheduleAccent : tournamentColors.textMuted }}
                >
                  {appointmentLabel}
                </Text>
              </TableCell>
              <TableCell width={columnWidths.status} align="center">
                <View style={{ backgroundColor: tone.bg, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4 }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: tone.text }}>{tone.label}</Text>
                </View>
                {isSaving ? (
                  <Text style={{ fontSize: 10, color: tournamentColors.primary, marginTop: 4 }}>Saving…</Text>
                ) : null}
              </TableCell>
              {showActions ? (
                <TableCell width={columnWidths.actions} style={{ gap: 6, paddingHorizontal: 4 }}>
                  {useLiveSessionScoring && onStartGame && matchId && match.status !== 'completed' ? (
                    <MatchActionButton
                      label={match.status === 'inProgress' ? 'Resume' : 'Start'}
                      onPress={() =>
                        onStartGame({
                          gameId: matchId,
                          tournamentId: match.tournamentId,
                          playerAName,
                          playerBName,
                        })
                      }
                      disabled={!canEditThisMatch}
                    />
                  ) : null}
                  {onScheduleMatch && match.canScheduleMatch !== false && matchId ? (
                    <MatchActionButton
                      label={match.scheduledStartAt ? 'Reschedule' : 'Schedule'}
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
                  ) : null}
                </TableCell>
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
