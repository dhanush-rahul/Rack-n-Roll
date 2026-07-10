import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { FeedbackModal } from '../../FeedbackModal';
import { AppIcon, MEDAL_COLORS } from '../../ui/AppIcon';
import { useTypography } from '../../../context/TypographyContext';
import { discoverUi, tournamentColors } from '../../../styles/tournamentUi';

const MEDAL_ROW_STYLE_BY_RANK = {
  1: { backgroundColor: '#fffbeb' },
  2: { backgroundColor: '#f8fafc' },
  3: { backgroundColor: '#fff7ed' },
};

const STANDINGS_STAT_HELP = {
  HCP: {
    title: 'HCP (Handicap)',
    message:
      'Skill rating for this player. A lower number means a stronger player. When handicap is enabled for the tournament, upsets can earn bonus standing points.',
    icon: 'target',
  },
  W: {
    title: 'W (Wins)',
    message: 'Number of matches won in this group.',
    icon: 'success',
  },
  L: {
    title: 'L (Losses)',
    message: 'Number of matches lost in this group.',
    icon: 'close-circle-outline',
  },
  'Win%': {
    title: 'Win%',
    message: 'Match win percentage: wins divided by total matches played in this group.',
    icon: 'chart',
  },
  PPM: {
    title: 'PPM (Points Per Match)',
    message:
      'Average match points scored per match — your offense. In APA-style scoring, this reflects balls/points earned across games in each series, not just whether you won.',
    icon: 'pool',
  },
  PAA: {
    title: 'PAA (Points Against Average)',
    message:
      'Average match points your opponents scored against you per match — your defense. Lower PAA usually means you give up fewer points.',
    icon: 'shield',
  },
};

function StandingsStatHeaderCell({ label, width, textAlign = 'left', headerCell, onPress }) {
  if (!onPress) {
    return <Text style={{ ...headerCell, width, textAlign }}>{label}</Text>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Tap for explanation.`}
      style={({ pressed }) => ({
        width,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          ...headerCell,
          textAlign,
          color: tournamentColors.primary,
          textDecorationLine: 'underline',
          textDecorationStyle: 'dotted',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function ScoresheetStandingsTable({
  groupName,
  standings,
  handicapEnabled,
  showTopThreeMedals,
  medalCount,
  col,
}) {
  const [activeStatHelp, setActiveStatHelp] = useState(null);
  const playerWidth = col(148);
  const hcpWidth = col(48);
  const statWidth = col(44);
  const winPctWidth = col(56);
  const headerFontSize = col(12);
  const bodyFontSize = col(14);
  const playerFontSize = col(15);
  const rowPaddingH = col(10);
  const rowPaddingV = col(10);
  const tableMinWidth =
    playerWidth + (handicapEnabled ? hcpWidth : 0) + statWidth * 4 + winPctWidth;

  const headerCell = {
    fontWeight: '700',
    fontSize: headerFontSize,
    color: tournamentColors.textMuted,
  };

  const bodyCell = {
    fontSize: bodyFontSize,
    color: tournamentColors.text,
  };

  const renderHeader = () => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#f8fafc',
        borderBottomWidth: 1,
        borderBottomColor: tournamentColors.borderLight,
        paddingHorizontal: rowPaddingH,
        paddingVertical: rowPaddingV,
        minWidth: tableMinWidth,
      }}
    >
      <Text style={{ ...headerCell, width: playerWidth }}>Player</Text>
      {handicapEnabled ? (
        <StandingsStatHeaderCell
          label="HCP"
          width={hcpWidth}
          textAlign="right"
          headerCell={headerCell}
          onPress={() => setActiveStatHelp('HCP')}
        />
      ) : null}
      <StandingsStatHeaderCell
        label="W"
        width={statWidth}
        textAlign="right"
        headerCell={headerCell}
        onPress={() => setActiveStatHelp('W')}
      />
      <StandingsStatHeaderCell
        label="L"
        width={statWidth}
        textAlign="right"
        headerCell={headerCell}
        onPress={() => setActiveStatHelp('L')}
      />
      <StandingsStatHeaderCell
        label="Win%"
        width={winPctWidth}
        textAlign="right"
        headerCell={headerCell}
        onPress={() => setActiveStatHelp('Win%')}
      />
      <StandingsStatHeaderCell
        label="PPM"
        width={statWidth}
        textAlign="right"
        headerCell={headerCell}
        onPress={() => setActiveStatHelp('PPM')}
      />
      <StandingsStatHeaderCell
        label="PAA"
        width={statWidth}
        textAlign="right"
        headerCell={headerCell}
        onPress={() => setActiveStatHelp('PAA')}
      />
    </View>
  );

  const renderRow = (entry, index) => {
    const isLastRow = index === standings.length - 1;
    const rankNumber = Number(entry.rank || index + 1);
    const hasMedal = showTopThreeMedals && rankNumber >= 1 && rankNumber <= medalCount;
    const playerName = entry.player?.displayName || entry.playerName || entry.playerId;

    return (
      <View
        key={`${groupName}-${entry.playerId}`}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingHorizontal: rowPaddingH,
          paddingVertical: rowPaddingV,
          borderBottomWidth: isLastRow ? 0 : 1,
          borderBottomColor: '#f1f5f9',
          minWidth: tableMinWidth,
          ...(hasMedal ? MEDAL_ROW_STYLE_BY_RANK[rankNumber] || null : null),
        }}
      >
        <Text
          style={{
            width: playerWidth,
            color: tournamentColors.text,
            fontWeight: hasMedal ? '700' : '500',
            fontSize: playerFontSize,
          }}
          numberOfLines={2}
        >
          {hasMedal ? (
            <AppIcon name="medal" size={playerFontSize} color={MEDAL_COLORS[rankNumber]} />
          ) : null}
          {hasMedal ? '  ' : ''}
          {playerName}
        </Text>
        {handicapEnabled ? (
          <Text style={{ ...bodyCell, width: hcpWidth, textAlign: 'right' }}>
            {entry.player?.handicapEnabled ? entry.player.handicapValue : '—'}
          </Text>
        ) : null}
        <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>
          {entry.stats?.matchesWon ?? entry.wins ?? 0}
        </Text>
        <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.losses || 0}</Text>
        <Text style={{ ...bodyCell, width: winPctWidth, textAlign: 'right' }}>
          {entry.stats?.winPct ?? 0}%
        </Text>
        <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.stats?.ppm ?? 0}</Text>
        <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.stats?.paa ?? 0}</Text>
      </View>
    );
  };

  return (
    <>
      <ScrollView horizontal showsHorizontalScrollIndicator nestedScrollEnabled bounces={false}>
        <View style={{ minWidth: tableMinWidth }}>
          {renderHeader()}
          {standings.map(renderRow)}
        </View>
      </ScrollView>

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

export function GroupStandingsCard({
  groupName,
  standings,
  resolvePlayerGameStats,
  showExtendedStats = false,
  showScoresheetStats = false,
  handicapEnabled = false,
  showTopThreeMedals = false,
  medalCount = 3,
  entityLabel = 'Player',
}) {
  const { sp, isWide } = useTypography();
  const col = (width) => (isWide ? sp(width) : width);

  return (
    <View style={discoverUi.listCard}>
      <View style={{ padding: isWide ? sp(14) : 14, gap: isWide ? sp(10) : 10 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: tournamentColors.text }}>{groupName}</Text>

        {standings.length === 0 ? (
          <Text style={{ color: tournamentColors.textMuted, fontSize: 13 }}>No players in this group yet.</Text>
        ) : showScoresheetStats ? (
          <View style={{ borderWidth: 1, borderColor: tournamentColors.borderLight, borderRadius: 10, overflow: 'hidden' }}>
            <ScoresheetStandingsTable
              groupName={groupName}
              standings={standings}
              handicapEnabled={handicapEnabled}
              showTopThreeMedals={showTopThreeMedals}
              medalCount={medalCount}
              col={col}
            />
          </View>
        ) : (
          <View style={{ borderWidth: 1, borderColor: tournamentColors.borderLight, borderRadius: 10, overflow: 'hidden' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                borderBottomWidth: 1,
                borderBottomColor: tournamentColors.borderLight,
                paddingHorizontal: 8,
                paddingVertical: 8,
              }}
            >
              <Text style={{ width: col(28), fontWeight: '700', fontSize: 10, color: tournamentColors.textMuted }}>#</Text>
              <Text style={{ flex: 1, minWidth: col(72), fontWeight: '700', fontSize: 10, color: tournamentColors.textMuted }}>
                {entityLabel}
              </Text>
              {showExtendedStats ? (
                <>
                  <Text style={{ width: col(34), textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>
                    GP
                  </Text>
                  <Text style={{ width: col(34), textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>
                    GR
                  </Text>
                  <Text style={{ width: col(30), textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>W</Text>
                  <Text style={{ width: col(30), textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>L</Text>
                  <Text style={{ width: col(36), textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>Pts</Text>
                </>
              ) : (
                <>
                  <Text style={{ width: col(30), textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>W</Text>
                  <Text style={{ width: col(30), textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>L</Text>
                  <Text style={{ width: col(36), textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>Pts</Text>
                </>
              )}
            </View>

            {standings.map((entry, index) => {
              const isLastRow = index === standings.length - 1;
              const rankNumber = Number(entry.rank || index + 1);
              const hasMedal = showTopThreeMedals && rankNumber >= 1 && rankNumber <= medalCount;
              const playerGameStats = resolvePlayerGameStats
                ? resolvePlayerGameStats(entry)
                : { gamesPlayed: 0, gamesRemaining: 0 };

              return (
                <View
                  key={`${groupName}-${entry.playerId}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 8,
                    paddingVertical: 8,
                    borderBottomWidth: isLastRow ? 0 : 1,
                    borderBottomColor: '#f1f5f9',
                    ...(hasMedal ? MEDAL_ROW_STYLE_BY_RANK[rankNumber] || null : null),
                  }}
                >
                  <Text style={{ width: col(28), color: tournamentColors.text, fontWeight: '700', fontSize: 12 }}>
                    {hasMedal ? (
                      <AppIcon name="medal" size={col(14)} color={MEDAL_COLORS[rankNumber]} />
                    ) : (
                      `#${rankNumber}`
                    )}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      minWidth: col(72),
                      color: tournamentColors.text,
                      fontWeight: hasMedal ? '700' : '400',
                      fontSize: 12,
                    }}
                    numberOfLines={entityLabel === 'Team' ? 2 : 1}
                  >
                    {entry.player?.displayName || entry.playerName || entry.playerId}
                  </Text>
                  {showExtendedStats ? (
                    <>
                      <Text style={{ width: col(34), textAlign: 'right', color: tournamentColors.text, fontSize: 12 }}>
                        {playerGameStats.gamesPlayed}
                      </Text>
                      <Text style={{ width: col(34), textAlign: 'right', color: tournamentColors.text, fontSize: 12 }}>
                        {playerGameStats.gamesRemaining}
                      </Text>
                      <Text style={{ width: col(30), textAlign: 'right', color: tournamentColors.text, fontSize: 12 }}>{entry.wins || 0}</Text>
                      <Text style={{ width: col(30), textAlign: 'right', color: tournamentColors.text, fontSize: 12 }}>{entry.losses || 0}</Text>
                      <Text style={{ width: col(36), textAlign: 'right', color: tournamentColors.text, fontWeight: '700', fontSize: 12 }}>
                        {entry.points || 0}
                      </Text>
                    </>
                  ) : (
                    <>
                      <Text style={{ width: col(30), textAlign: 'right', color: tournamentColors.text, fontSize: 12 }}>{entry.wins || 0}</Text>
                      <Text style={{ width: col(30), textAlign: 'right', color: tournamentColors.text, fontSize: 12 }}>{entry.losses || 0}</Text>
                      <Text style={{ width: col(36), textAlign: 'right', color: tournamentColors.text, fontWeight: '700', fontSize: 12 }}>
                        {entry.points || 0}
                      </Text>
                    </>
                  )}
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}
