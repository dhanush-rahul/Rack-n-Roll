import React from 'react';
import { Platform, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';

const isPlayedScoreEntry = (entry) => {
  const playerAScore = Number(entry?.playerAScore);
  const playerBScore = Number(entry?.playerBScore);
  if (!Number.isFinite(playerAScore) || !Number.isFinite(playerBScore)) return false;
  return !(playerAScore === 0 && playerBScore === 0);
};

export function ScoresheetMatchCard({ game, matchNumber, scoresByGameId }) {
  const scoreState = scoresByGameId[game.id] || {
    status: game.status || 'scheduled',
    entries: Array.from({ length: Math.max(Number(game.bestOf || 1), 1) }, (_, index) => ({
      gameNumber: String(index + 1),
      playerAScore: '',
      playerBScore: '',
    })),
  };

  const expectedEntriesCount = Math.max(Number(game.bestOf || 1), 1);
  const scoreInputEntries = Array.from(
    { length: Math.max((scoreState.entries || []).length, expectedEntriesCount) },
    (_, entryIndex) => {
      const currentEntry = scoreState.entries?.[entryIndex];
      return {
        gameNumber: Number(currentEntry?.gameNumber || entryIndex + 1),
        playerAScore: String(currentEntry?.playerAScore ?? ''),
        playerBScore: String(currentEntry?.playerBScore ?? ''),
      };
    }
  );

  const completedGamesCount = scoreInputEntries.filter((entry) => isPlayedScoreEntry(entry)).length;
  const playerAName = game.playerA?.displayName || game.playerAId;
  const playerBName = game.playerB?.displayName || game.playerBId;

  const scoreInputStyle = {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 8,
    backgroundColor: '#fff',
    flex: 1,
    minWidth: 0,
    maxWidth: Platform.OS === 'web' ? 72 : undefined,
    ...(Platform.OS === 'web' ? { boxSizing: 'border-box' } : null),
  };

  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: '#d1d5db',
        borderRadius: 8,
        padding: 10,
        gap: 8,
        backgroundColor: '#f9fafb',
      }}
    >
      <Text style={{ fontWeight: '600' }}>
        Match {matchNumber}: {playerAName} vs {playerBName}
      </Text>
      <Text style={{ color: '#4b5563' }}>
        Best of {game.bestOf} • Status: {game.status} • {completedGamesCount}/{expectedEntriesCount}
      </Text>

      <View style={{ borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, backgroundColor: '#fff' }}>
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

        {scoreInputEntries.map((entry, entryIndex) => {
          const isLastEntry = entryIndex === scoreInputEntries.length - 1;
          const safeEntry = entry || { gameNumber: entryIndex + 1, playerAScore: '', playerBScore: '' };

          return (
            <View
              key={`${game.id}-entry-${entryIndex}`}
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
              <View style={{ flex: 1, minWidth: 0 }}>
                <TextInput
                  style={scoreInputStyle}
                  placeholder="0"
                  value={safeEntry.playerAScore}
                  keyboardType="numeric"
                  editable={false}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <TextInput
                  style={scoreInputStyle}
                  placeholder="0"
                  value={safeEntry.playerBScore}
                  keyboardType="numeric"
                  editable={false}
                />
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}
