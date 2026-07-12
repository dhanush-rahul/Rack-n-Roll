import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { AppIcon } from '../ui/AppIcon';
import { EmptyStateCard, SectionCard, TabStatsRow, ToolbarIconButton } from '../tournament/TournamentChrome';
import { LoadingPlaceholder } from '../ui/LoadingPlaceholder';

export function ScoresheetFinaleTab({
  groupedFinaleRounds,
  isLoadingFinaleTab,
  activeFinalRoundNumber,
  expandedFinalRoundNumber,
  onToggleFinalRound,
  onLoadFinaleTab,
  onExpandToggle,
  scoresByGameId,
}) {
  return (
    <SectionCard
      title="Finale bracket"
      subtitle="Knockout rounds and championship matches."
      headerAction={
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <ToolbarIconButton
            label="Expand"
            onPress={onExpandToggle}
          />
          <ToolbarIconButton
            label={isLoadingFinaleTab ? '…' : 'Refresh'}
            onPress={onLoadFinaleTab}
            disabled={isLoadingFinaleTab}
          />
        </View>
      }
    >
      {isLoadingFinaleTab && groupedFinaleRounds.length === 0 && (
        <LoadingPlaceholder message="Loading finale matches…" compact />
      )}

      {groupedFinaleRounds.length === 0 && !isLoadingFinaleTab && (
        <EmptyStateCard
          icon="trophy"
          title="No finale matches yet"
          message="The bracket appears when the host starts the final stage."
        />
      )}

      {groupedFinaleRounds.length > 0 && (
        <TabStatsRow
          stats={[
            { label: 'ROUNDS', value: String(groupedFinaleRounds.length) },
            {
              label: 'MATCHES',
              value: String(
                groupedFinaleRounds.reduce((total, round) => total + (round.matches || []).length, 0)
              ),
            },
          ]}
        />
      )}

      {groupedFinaleRounds.map((round) => {
        const isRoundOpen = expandedFinalRoundNumber === round.roundNumber;
        const completedMatchesCount = (round.matches || []).filter((match) => match.status === 'completed').length;
        const totalMatchesCount = (round.matches || []).length;
        const isRoundCompleted = totalMatchesCount > 0 && completedMatchesCount === totalMatchesCount;

        return (
          <View
            key={`final-round-${round.roundNumber}`}
            style={{ marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, overflow: 'hidden' }}
          >
            <Pressable
              onPress={() => onToggleFinalRound(round.roundNumber)}
              style={({ pressed }) => ({
                flexDirection: 'row',
                justifyContent: 'space-between',
                alignItems: 'center',
                padding: 12,
                backgroundColor: isRoundOpen ? '#f8fafc' : '#ffffff',
                opacity: pressed ? 0.9 : 1,
              })}
            >
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={{ fontWeight: '800', fontSize: 15 }}>
                  Round {round.roundNumber} {isRoundCompleted ? '· Done' : ''}
                </Text>
                <Text style={{ color: '#64748b', fontSize: 12 }}>
                  {completedMatchesCount}/{totalMatchesCount} matches complete
                </Text>
              </View>
              {round.roundNumber === activeFinalRoundNumber && (
                <View
                  style={{
                    backgroundColor: '#dcfce7',
                    borderRadius: 999,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                    marginRight: 8,
                  }}
                >
                  <Text style={{ color: '#166534', fontWeight: '700', fontSize: 11 }}>Current</Text>
                </View>
              )}
              <AppIcon name={isRoundOpen ? 'chevronUp' : 'chevronDown'} size={22} color="#2563eb" />
            </Pressable>

            {isRoundOpen &&
              (round.matches || []).map((match, matchIndex) => (
                <ScoresheetMatchCard
                  key={match.id}
                  game={match}
                  matchNumber={matchIndex + 1}
                  scoresByGameId={scoresByGameId}
                />
              ))}
          </View>
        );
      })}
    </SectionCard>
  );
}
