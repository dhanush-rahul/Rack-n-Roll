import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { FeedbackModal } from '../../FeedbackModal';
import { useTheme } from '../../../context/ThemeContext';
import { useTypography } from '../../../context/TypographyContext';
import { STANDINGS_STAT_HELP, StandingsStatHeaderCell } from '../chrome/standingsStatHelp';

const BASE_RANK_WIDTH = 36;
const BASE_PTS_WIDTH = 44;
const BASE_WIN_LOSS_WIDTH = 32;
const BASE_DRAW_WIDTH = 36;
const BASE_STAT_WIDTH = 44;
const BASE_WIN_PCT_WIDTH = 52;
const BASE_PLAYER_MIN = 120;

function resolveExtendedStats(entry) {
  if (entry.stats) {
    return {
      winPct: entry.stats.winPct ?? 0,
      ppm: entry.stats.ppm ?? 0,
      paa: entry.stats.paa ?? 0,
    };
  }

  const wins = Number(entry.wins || 0);
  const losses = Number(entry.losses || 0);
  const draws = Number(entry.draws || 0);
  const matchesPlayed = wins + losses + draws;
  const scoreFor = Number(entry.scoreFor || 0);
  const scoreAgainst = Number(entry.scoreAgainst || 0);

  return {
    winPct: matchesPlayed > 0 ? Math.round((wins / matchesPlayed) * 100) : 0,
    ppm: matchesPlayed > 0 ? Number((scoreFor / matchesPlayed).toFixed(2)) : 0,
    paa: matchesPlayed > 0 ? Number((scoreAgainst / matchesPlayed).toFixed(2)) : 0,
  };
}

export function TrackerStandingsTable({ standings = [], resolveParticipantStats, entityLabel = 'Player' }) {
  const { colors } = useTheme();
  const { sp, fs } = useTypography();
  const [activeStatHelp, setActiveStatHelp] = useState(null);

  const rankWidth = sp(BASE_RANK_WIDTH);
  const ptsWidth = sp(BASE_PTS_WIDTH);
  const winLossWidth = sp(BASE_WIN_LOSS_WIDTH);
  const drawWidth = sp(BASE_DRAW_WIDTH);
  const statWidth = sp(BASE_STAT_WIDTH);
  const winPctWidth = sp(BASE_WIN_PCT_WIDTH);
  const playerMinWidth = sp(BASE_PLAYER_MIN);
  const tableMinWidth =
    rankWidth + playerMinWidth + ptsWidth + winLossWidth * 2 + drawWidth + statWidth * 2 + winPctWidth + statWidth * 2;

  if (standings.length === 0) {
    return <Text style={{ fontSize: fs(13), color: colors.textMuted }}>No standings yet.</Text>;
  }

  const headerStyle = {
    fontWeight: '700',
    fontSize: fs(11),
    color: colors.textMuted,
  };

  const cellStyle = {
    fontSize: fs(13),
    color: colors.text,
  };

  const openHelp = (key) => () => setActiveStatHelp(key);

  const rowStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    minWidth: tableMinWidth,
    paddingHorizontal: sp(10),
    paddingVertical: sp(9),
  };

  const statHeader = (label, key, width) => (
    <StandingsStatHeaderCell
      label={label}
      width={width}
      textAlign="right"
      headerCell={headerStyle}
      accentColor={colors.primary}
      onPress={openHelp(key)}
    />
  );

  return (
    <>
      <View
        style={{
          width: '100%',
          alignSelf: 'stretch',
          borderWidth: 1,
          borderColor: colors.border,
          borderRadius: 10,
          overflow: 'hidden',
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator
          nestedScrollEnabled
          bounces={false}
          style={{ width: '100%' }}
          contentContainerStyle={{ flexGrow: 1 }}
        >
          <View style={{ minWidth: tableMinWidth, width: '100%' }}>
            <View
              style={{
                ...rowStyle,
                backgroundColor: colors.borderLight,
                borderBottomWidth: 1,
                borderBottomColor: colors.border,
              }}
            >
              <Text style={{ ...headerStyle, width: rankWidth, flexShrink: 0 }}>#</Text>
              <Text style={{ ...headerStyle, flex: 1, minWidth: playerMinWidth }}>{entityLabel}</Text>
              {statHeader('Pts', 'Pts', ptsWidth)}
              {statHeader('W', 'W', winLossWidth)}
              {statHeader('L', 'L', winLossWidth)}
              {statHeader('D', 'Draw', drawWidth)}
              {statHeader('GP', 'GP', statWidth)}
              {statHeader('GR', 'GR', statWidth)}
              {statHeader('Win%', 'Win%', winPctWidth)}
              {statHeader('PPM', 'PPM', statWidth)}
              {statHeader('PAA', 'PAA', statWidth)}
            </View>

            {standings.map((entry, index) => {
              const participantId = String(entry.playerId || entry.teamId || '');
              const gameStats = resolveParticipantStats
                ? resolveParticipantStats(participantId)
                : { gamesPlayed: 0, gamesRemaining: 0 };
              const extendedStats = resolveExtendedStats(entry);
              const label =
                entry.displayName ||
                entry.player?.displayName ||
                entry.team?.displayName ||
                entry.player?.username ||
                participantId;

              return (
                <View
                  key={`${participantId}-${index}`}
                  style={{
                    ...rowStyle,
                    borderBottomWidth: index === standings.length - 1 ? 0 : 1,
                    borderBottomColor: colors.border,
                  }}
                >
                  <Text style={{ ...cellStyle, width: rankWidth, flexShrink: 0, fontWeight: '700' }}>
                    {entry.rank || index + 1}
                  </Text>
                  <Text style={{ ...cellStyle, flex: 1, minWidth: playerMinWidth, fontWeight: '600' }} numberOfLines={2}>
                    {label}
                  </Text>
                  <Text style={{ ...cellStyle, width: ptsWidth, textAlign: 'right', fontWeight: '800' }}>
                    {entry.points || 0}
                  </Text>
                  <Text style={{ ...cellStyle, width: winLossWidth, textAlign: 'right' }}>{entry.wins || 0}</Text>
                  <Text style={{ ...cellStyle, width: winLossWidth, textAlign: 'right' }}>{entry.losses || 0}</Text>
                  <Text style={{ ...cellStyle, width: drawWidth, textAlign: 'right' }}>{entry.draws || 0}</Text>
                  <Text style={{ ...cellStyle, width: statWidth, textAlign: 'right' }}>{gameStats.gamesPlayed || 0}</Text>
                  <Text style={{ ...cellStyle, width: statWidth, textAlign: 'right' }}>{gameStats.gamesRemaining || 0}</Text>
                  <Text style={{ ...cellStyle, width: winPctWidth, textAlign: 'right' }}>{extendedStats.winPct}%</Text>
                  <Text style={{ ...cellStyle, width: statWidth, textAlign: 'right' }}>{extendedStats.ppm}</Text>
                  <Text style={{ ...cellStyle, width: statWidth, textAlign: 'right' }}>{extendedStats.paa}</Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <FeedbackModal
        visible={Boolean(activeStatHelp && STANDINGS_STAT_HELP[activeStatHelp])}
        title={STANDINGS_STAT_HELP[activeStatHelp]?.title || ''}
        message={STANDINGS_STAT_HELP[activeStatHelp]?.message || ''}
        icon={STANDINGS_STAT_HELP[activeStatHelp]?.icon || 'info'}
        onDismiss={() => setActiveStatHelp(null)}
      />
    </>
  );
}
