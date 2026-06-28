import React, { useCallback } from 'react';
import { Button, Pressable, View } from 'react-native';
import { ScaledText as Text } from './ui/ScaledText';
import { ScaledTextInput as TextInput } from './ui/ScaledTextInput';
import { AppIcon } from './ui/AppIcon';

export const isPlayedScoreEntry = (entry) => {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);

  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) {
    return false;
  }

  return !(playerAScore === 0 && playerBScore === 0);
};

/**
 * MatchCard
 *
 * Shared between ScoresheetScreen (editable=false) and TournamentDetailScreen (editable=true).
 *
 * Props:
 *   game            – the raw game object (needs .id, .bestOf, .status, .playerA, .playerB, .scoreEntries)
 *   matchNumber     – display index (1-based)
 *   roundNumber     – used when upserting a game that has no id yet
 *   scoreInputState – { status, entries: [{ gameNumber, playerAScore, playerBScore }] }
 *                     Pass undefined/null when read-only; the component will derive display values
 *                     from game.scoreEntries itself.
 *   editable        – boolean; when false the inputs are read-only and action buttons are hidden
 *   isSaving        – boolean; shows "Saving…" on the save button
 *   onChangeScore   – (gameId, bestOf, entryIndex, field, value) => void
 *   onAddSeriesRow  – (scoreStateKey) => void
 *   onSaveScores    – ({ gameId, roundNumber, playerAId, playerBId, scoreStateKey, bestOf }) => void
 */
export function MatchCard({
  game,
  matchNumber,
  roundNumber,
  scoreInputState,
  editable = false,
  isSaving = false,
  onChangeScore,
  onAddSeriesRow,
  onSaveScores,
}) {
  const playerAName = game.playerA?.displayName || game.playerAId;
  const playerBName = game.playerB?.displayName || game.playerBId;

  const scoreStateKey =
    game.id ||
    `pending-${roundNumber}-${matchNumber}-${game.playerA?.id || game.playerAId || 'a'}-${game.playerB?.id || game.playerBId || 'b'}`;

  // Build display entries: prefer live scoreInputState when present, otherwise fall back to
  // game.scoreEntries so the read-only scoresheet also shows persisted scores.
  const expectedEntriesCount = Math.max(Number(game.bestOf || 1), 1);

  const resolvedEntries = (() => {
    const sourceEntries = scoreInputState?.entries?.length
      ? scoreInputState.entries
      : (game.scoreEntries || []).map((e) => ({
          gameNumber: Number(e.gameNumber),
          playerAScore: String(e.playerAScore ?? ''),
          playerBScore: String(e.playerBScore ?? ''),
        }));

    return Array.from(
      { length: Math.max(sourceEntries.length, expectedEntriesCount) },
      (_, i) => {
        const entry = sourceEntries[i];
        return {
          gameNumber: Number(entry?.gameNumber || i + 1),
          playerAScore: String(entry?.playerAScore ?? ''),
          playerBScore: String(entry?.playerBScore ?? ''),
        };
      }
    );
  })();

  const completedGamesCount = resolvedEntries.filter((e) => isPlayedScoreEntry(e)).length;
  const currentStatus = scoreInputState?.status || game.status || 'scheduled';

  const handleChangeScore = useCallback(
    (entryIndex, field, value) => {
      onChangeScore?.(scoreStateKey, expectedEntriesCount, entryIndex, field, value);
    },
    [expectedEntriesCount, onChangeScore, scoreStateKey]
  );

  const handleAddRow = useCallback(() => {
    onAddSeriesRow?.(scoreStateKey, resolvedEntries, expectedEntriesCount);
  }, [expectedEntriesCount, onAddSeriesRow, resolvedEntries, scoreStateKey]);

  const handleSave = useCallback(() => {
    onSaveScores?.({
      gameId: game.id,
      roundNumber,
      playerAId: game.playerA?.id || game.playerAId,
      playerBId: game.playerB?.id || game.playerBId,
      scoreStateKey,
      bestOf: expectedEntriesCount,
    });
  }, [expectedEntriesCount, game.id, game.playerA, game.playerAId, game.playerB, game.playerBId, onSaveScores, roundNumber, scoreStateKey]);

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: 'transparent',
        borderTopColor: '#e5e7eb',
        borderRadius: 8,
        padding: 10,
        gap: 8,
        backgroundColor: '#f9fafb',
      }}
    >
      {/* Header */}
      <Text style={{ fontWeight: '600' }}>
        Match {matchNumber}: {playerAName} vs {playerBName}
      </Text>
      <Text style={{ color: '#4b5563' }}>
        Best of {game.bestOf} • Status: {currentStatus} • {completedGamesCount}/{expectedEntriesCount}
      </Text>

      {/* Score grid */}
      <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#fff' }}>
        {/* Column headers */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 8,
            paddingVertical: 6,
            borderBottomWidth: 1,
            borderBottomColor: '#e5e7eb',
          }}
        >
          <Text style={{ width: 48, fontWeight: '600', color: '#374151', fontSize: 12 }}>Game</Text>
          <Text style={{ flex: 1, fontWeight: '600', color: '#374151', fontSize: 12 }} numberOfLines={1}>
            {playerAName}
          </Text>
          <Text style={{ flex: 1, fontWeight: '600', color: '#374151', fontSize: 12 }} numberOfLines={1}>
            {playerBName}
          </Text>
        </View>

        {/* Score rows */}
        {resolvedEntries.map((entry, entryIndex) => {
          const isLastEntry = entryIndex === resolvedEntries.length - 1;
          return (
            <View
              key={`${scoreStateKey}-entry-${entryIndex}`}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 6,
                paddingHorizontal: 8,
                paddingVertical: 6,
                borderBottomWidth: isLastEntry ? 0 : 1,
                borderBottomColor: '#f3f4f6',
              }}
            >
              <Text style={{ width: 48, color: '#111827', fontWeight: '600', fontSize: 12 }}>
                G{entryIndex + 1}
              </Text>
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  backgroundColor: '#fff',
                  flex: 1,
                }}
                placeholder="0"
                value={entry.playerAScore}
                onChangeText={(value) => handleChangeScore(entryIndex, 'playerAScore', value)}
                keyboardType="numeric"
                editable={editable}
              />
              <TextInput
                style={{
                  borderWidth: 1,
                  borderColor: '#d1d5db',
                  borderRadius: 8,
                  paddingVertical: 6,
                  paddingHorizontal: 8,
                  backgroundColor: '#fff',
                  flex: 1,
                }}
                placeholder="0"
                value={entry.playerBScore}
                onChangeText={(value) => handleChangeScore(entryIndex, 'playerBScore', value)}
                keyboardType="numeric"
                editable={editable}
              />
            </View>
          );
        })}
      </View>

      {/* Host-only actions */}
      {editable && (
        <>
          <Pressable
            onPress={handleAddRow}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 10,
              paddingHorizontal: 14,
              borderRadius: 4,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#2563eb',
              borderWidth: 1,
              borderColor: '#2563eb',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text style={{ color: '#ffffff', fontWeight: '600', fontSize: 14 }}>
              Add Series Game Row
            </Text>
          </Pressable>

          <View style={{ borderTopWidth: 1, borderTopColor: '#e5e7eb', paddingTop: 8 }}>
            <Button
              title={isSaving ? 'Saving...' : 'Save Scores'}
              onPress={handleSave}
              disabled={isSaving}
            />
          </View>
        </>
      )}
    </View>
  );
}

/**
 * RoundSection
 *
 * Renders a collapsible round header + list of MatchCards.
 *
 * Props:
 *   round              – { roundNumber, matches: game[] }
 *   isOpen             – boolean
 *   isActiveRound      – boolean (shows "Current" badge)
 *   onToggle           – (roundNumber) => void
 *   // MatchCard forwarded props:
 *   editable, scoreInputsByGameId, savingGameId,
 *   onChangeScore, onAddSeriesRow, onSaveScores
 */
export function RoundSection({
  round,
  isOpen,
  isActiveRound,
  onToggle,
  editable = false,
  scoreInputsByGameId = {},
  savingGameId = null,
  onChangeScore,
  onAddSeriesRow,
  onSaveScores,
}) {
  const completedMatchesCount = (round.matches || []).filter(
    (m) => m.status === 'completed'
  ).length;
  const totalMatchesCount = (round.matches || []).length;
  const isRoundCompleted = totalMatchesCount > 0 && completedMatchesCount === totalMatchesCount;

  // For the group-stage pattern view, completedGamesCount tracks individual game entries rather
  // than match-level status, so we optionally use match.completedGamesCount if present.
  const completedGames = (round.matches || []).reduce(
    (acc, m) => acc + Number(m.completedGamesCount ?? (m.status === 'completed' ? 1 : 0)),
    0
  );
  const totalGames = (round.matches || []).reduce(
    (acc, m) => acc + Math.max(Number(m.bestOf || 1), 1),
    0
  );
  // Use per-game counts if they're available (TournamentDetailScreen pattern tab), otherwise
  // fall back to match-level counts (ScoresheetScreen).
  const hasPerGameCounts = (round.matches || []).some((m) => m.completedGamesCount !== undefined);
  const displayLeft = hasPerGameCounts ? completedGames : completedMatchesCount;
  const displayRight = hasPerGameCounts ? totalGames : totalMatchesCount;

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#e5e7eb',
        borderRadius: 8,
        padding: 8,
        gap: 8,
      }}
    >
      <Pressable
        onPress={() => onToggle(round.roundNumber)}
        style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Text style={{ fontWeight: '600' }}>
            Round {round.roundNumber} {isRoundCompleted ? '• Completed' : ''}
          </Text>
          {isActiveRound && (
            <View
              style={{
                backgroundColor: '#dcfce7',
                borderRadius: 999,
                paddingHorizontal: 8,
                paddingVertical: 2,
              }}
            >
              <Text style={{ color: '#166534', fontWeight: '600', fontSize: 12 }}>Current</Text>
            </View>
          )}
        </View>
        <Text style={{ color: '#4b5563', marginLeft: 8 }}>
          {displayLeft}/{displayRight}
        </Text>
        <AppIcon name={isOpen ? 'chevronUp' : 'chevronDown'} size={20} color="#4b5563" />
      </Pressable>

      {isOpen &&
        (round.matches || []).map((match, matchIndex) => {
          // Support both raw game objects (scoresheet) and the merged pattern-match objects
          // (TournamentDetailScreen) which carry extra fields like playerA.id, gameId, etc.
          const gameId = match.id || match.gameId;
          const scoreStateKey =
            gameId ||
            `pending-${round.roundNumber}-${match.matchNumber || matchIndex + 1}-${
              match.playerA?.id || match.playerAId || 'a'
            }-${match.playerB?.id || match.playerBId || 'b'}`;

          const scoreInputState = scoreInputsByGameId[scoreStateKey];
          const isSavingThisMatch =
            savingGameId === scoreStateKey ||
            (Boolean(gameId) && savingGameId === gameId);

          // Normalise the game shape so MatchCard always gets consistent fields
          const normalisedGame = {
            id: gameId,
            bestOf: match.bestOf || 1,
            status: match.status || 'scheduled',
            scoreEntries: match.scoreEntries || [],
            playerA: match.playerA || { id: match.playerAId, displayName: match.playerAId },
            playerB: match.playerB || { id: match.playerBId, displayName: match.playerBId },
            playerAId: match.playerAId || match.playerA?.id,
            playerBId: match.playerBId || match.playerB?.id,
          };

          return (
            <MatchCard
              key={`round-${round.roundNumber}-match-${scoreStateKey}-${matchIndex}`}
              game={normalisedGame}
              matchNumber={match.matchNumber || matchIndex + 1}
              roundNumber={round.roundNumber}
              scoreInputState={scoreInputState}
              editable={editable}
              isSaving={isSavingThisMatch}
              onChangeScore={onChangeScore}
              onAddSeriesRow={onAddSeriesRow}
              onSaveScores={onSaveScores}
            />
          );
        })}
    </View>
  );
}