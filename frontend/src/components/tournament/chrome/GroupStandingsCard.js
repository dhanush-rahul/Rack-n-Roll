import React, { useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { FeedbackModal } from '../../FeedbackModal';
import { AppIcon, MEDAL_COLORS } from '../../ui/AppIcon';
import { useTypography } from '../../../context/TypographyContext';
import { useTheme } from '../../../context/ThemeContext';
import { discoverUi } from '../../../styles/tournamentUi';
import { STANDINGS_STAT_HELP, StandingsStatHeaderCell } from './standingsStatHelp';

const getMedalRowStyleByRank = (rank, colors) => {
  if (rank === 1) return { backgroundColor: colors.statusWarningBg };
  if (rank === 2) return { backgroundColor: colors.surfaceRaised };
  if (rank === 3) return { backgroundColor: colors.primarySoft };
  return null;
};

const STANDINGS_TABLE_TYPE = {
  header: 12,
  body: 14,
  player: 15,
  rank: 14,
  rowPadH: 10,
  rowPadV: 10,
  stat: 36,
  pts: 40,
  rankCol: 32,
  playerMin: 120,
};

function ScrollableTableFrame({ tableMinWidth, children }) {
  const { colors } = useTheme();

  return (
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
        <View style={{ width: '100%', minWidth: tableMinWidth }}>{children}</View>
      </ScrollView>
    </View>
  );
}

function BasicGroupStandingsTable({
  groupName,
  standings,
  resolvePlayerGameStats,
  showExtendedStats,
  showTopThreeMedals,
  medalCount,
  entityLabel,
  col,
}) {
  const { colors } = useTheme();
  const [activeStatHelp, setActiveStatHelp] = useState(null);
  const rankWidth = col(STANDINGS_TABLE_TYPE.rankCol);
  const playerMinWidth = col(STANDINGS_TABLE_TYPE.playerMin);
  const gpWidth = col(STANDINGS_TABLE_TYPE.stat);
  const statWidth = col(STANDINGS_TABLE_TYPE.stat);
  const drawWidth = col(52);
  const ptsWidth = col(STANDINGS_TABLE_TYPE.pts);
  const rowPaddingH = col(STANDINGS_TABLE_TYPE.rowPadH);
  const rowPaddingV = col(STANDINGS_TABLE_TYPE.rowPadV);
  const headerFontSize = col(STANDINGS_TABLE_TYPE.header);
  const bodyFontSize = col(STANDINGS_TABLE_TYPE.body);
  const playerFontSize = col(STANDINGS_TABLE_TYPE.player);
  const rankFontSize = col(STANDINGS_TABLE_TYPE.rank);
  const tableMinWidth = showExtendedStats
    ? rankWidth + playerMinWidth + gpWidth * 2 + statWidth * 2 + drawWidth + ptsWidth + rowPaddingH * 2
    : rankWidth + playerMinWidth + statWidth * 3 + drawWidth + ptsWidth + rowPaddingH * 2;

  const rowStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: rowPaddingH,
    paddingVertical: rowPaddingV,
    width: '100%',
    minWidth: tableMinWidth,
  };

  const headerCell = {
    fontWeight: '700',
    fontSize: headerFontSize,
    color: colors.textMuted,
  };

  const bodyCell = {
    fontSize: bodyFontSize,
    color: colors.text,
  };

  const openHelp = (key) => () => setActiveStatHelp(key);

  return (
    <>
    <ScrollableTableFrame tableMinWidth={tableMinWidth}>
      <View
        style={{
          ...rowStyle,
          backgroundColor: colors.surfaceRaised,
          borderBottomWidth: 1,
          borderBottomColor: colors.border,
        }}
      >
        <Text style={{ ...headerCell, width: rankWidth }}>#</Text>
        <Text style={{ ...headerCell, flex: 1, minWidth: playerMinWidth }}>{entityLabel}</Text>
        {showExtendedStats ? (
          <>
            <StandingsStatHeaderCell label="GP" width={gpWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('GP')} />
            <StandingsStatHeaderCell label="GR" width={gpWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('GR')} />
            <StandingsStatHeaderCell label="W" width={statWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('W')} />
            <StandingsStatHeaderCell label="D" width={drawWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('Draw')} />
            <StandingsStatHeaderCell label="L" width={statWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('L')} />
            <StandingsStatHeaderCell label="Pts" width={ptsWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('Pts')} />
          </>
        ) : (
          <>
            <StandingsStatHeaderCell label="W" width={statWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('W')} />
            <StandingsStatHeaderCell label="D" width={drawWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('Draw')} />
            <StandingsStatHeaderCell label="L" width={statWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('L')} />
            <StandingsStatHeaderCell label="Pts" width={ptsWidth} textAlign="right" headerCell={headerCell} onPress={openHelp('Pts')} />
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
              ...rowStyle,
              borderBottomWidth: isLastRow ? 0 : 1,
              borderBottomColor: colors.border,
              ...(hasMedal ? getMedalRowStyleByRank(rankNumber, colors) : null),
            }}
          >
            <Text style={{ width: rankWidth, color: colors.text, fontWeight: '700', fontSize: rankFontSize }}>
              {hasMedal ? <AppIcon name="medal" size={col(14)} color={MEDAL_COLORS[rankNumber]} /> : `#${rankNumber}`}
            </Text>
            <Text
              style={{
                flex: 1,
                minWidth: playerMinWidth,
                color: colors.text,
                fontWeight: hasMedal ? '700' : '500',
                fontSize: playerFontSize,
              }}
              numberOfLines={entityLabel === 'Team' ? 2 : 1}
            >
              {entry.player?.displayName || entry.playerName || entry.playerId}
            </Text>
            {showExtendedStats ? (
              <>
                <Text style={{ ...bodyCell, width: gpWidth, textAlign: 'right' }}>{playerGameStats.gamesPlayed}</Text>
                <Text style={{ ...bodyCell, width: gpWidth, textAlign: 'right' }}>{playerGameStats.gamesRemaining}</Text>
                <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.wins || 0}</Text>
                <Text style={{ ...bodyCell, width: drawWidth, textAlign: 'right' }}>{entry.draws || 0}</Text>
                <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.losses || 0}</Text>
                <Text style={{ ...bodyCell, width: ptsWidth, textAlign: 'right', fontWeight: '700' }}>
                  {entry.points || 0}
                </Text>
              </>
            ) : (
              <>
                <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.wins || 0}</Text>
                <Text style={{ ...bodyCell, width: drawWidth, textAlign: 'right' }}>{entry.draws || 0}</Text>
                <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.losses || 0}</Text>
                <Text style={{ ...bodyCell, width: ptsWidth, textAlign: 'right', fontWeight: '700' }}>
                  {entry.points || 0}
                </Text>
              </>
            )}
          </View>
        );
      })}
    </ScrollableTableFrame>

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

function ScoresheetStandingsTable({
  groupName,
  standings,
  handicapEnabled,
  showTopThreeMedals,
  medalCount,
  col,
}) {
  const { colors } = useTheme();
  const [activeStatHelp, setActiveStatHelp] = useState(null);
  const rankWidth = col(STANDINGS_TABLE_TYPE.rankCol);
  const playerWidth = col(STANDINGS_TABLE_TYPE.playerMin);
  const hcpWidth = col(48);
  const statWidth = col(STANDINGS_TABLE_TYPE.stat);
  const drawWidth = col(52);
  const winPctWidth = col(56);
  const ptsWidth = col(STANDINGS_TABLE_TYPE.pts);
  const headerFontSize = col(STANDINGS_TABLE_TYPE.header);
  const bodyFontSize = col(STANDINGS_TABLE_TYPE.body);
  const playerFontSize = col(STANDINGS_TABLE_TYPE.player);
  const rankFontSize = col(STANDINGS_TABLE_TYPE.rank);
  const rowPaddingH = col(STANDINGS_TABLE_TYPE.rowPadH);
  const rowPaddingV = col(STANDINGS_TABLE_TYPE.rowPadV);
  const tableMinWidth =
    rankWidth + playerWidth + (handicapEnabled ? hcpWidth : 0) + statWidth * 4 + drawWidth + winPctWidth + ptsWidth;

  const headerCell = {
    fontWeight: '700',
    fontSize: headerFontSize,
    color: colors.textMuted,
  };

  const bodyCell = {
    fontSize: bodyFontSize,
    color: colors.text,
  };

  const renderHeader = () => (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.surfaceRaised,
        borderBottomWidth: 1,
        borderBottomColor: colors.border,
        paddingHorizontal: rowPaddingH,
        paddingVertical: rowPaddingV,
        width: '100%',
        minWidth: tableMinWidth,
      }}
    >
      <Text style={{ ...headerCell, width: rankWidth }}>#</Text>
      <Text style={{ ...headerCell, flex: 1, minWidth: playerWidth }}>Player</Text>
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
        label="D"
        width={drawWidth}
        textAlign="right"
        headerCell={headerCell}
        onPress={() => setActiveStatHelp('Draw')}
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
      <StandingsStatHeaderCell
        label="Pts"
        width={ptsWidth}
        textAlign="right"
        headerCell={headerCell}
        onPress={() => setActiveStatHelp('Pts')}
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
          borderBottomColor: colors.border,
          width: '100%',
          minWidth: tableMinWidth,
          ...(hasMedal ? getMedalRowStyleByRank(rankNumber, colors) : null),
        }}
      >
        <Text style={{ width: rankWidth, color: colors.text, fontWeight: '700', fontSize: rankFontSize }}>
          {hasMedal ? <AppIcon name="medal" size={col(14)} color={MEDAL_COLORS[rankNumber]} /> : `#${rankNumber}`}
        </Text>
        <Text
          style={{
            flex: 1,
            minWidth: playerWidth,
            color: colors.text,
            fontWeight: hasMedal ? '700' : '500',
            fontSize: playerFontSize,
          }}
          numberOfLines={2}
        >
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
        <Text style={{ ...bodyCell, width: drawWidth, textAlign: 'right' }}>{entry.draws || 0}</Text>
        <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.losses || 0}</Text>
        <Text style={{ ...bodyCell, width: winPctWidth, textAlign: 'right' }}>
          {entry.stats?.winPct ?? 0}%
        </Text>
        <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.stats?.ppm ?? 0}</Text>
        <Text style={{ ...bodyCell, width: statWidth, textAlign: 'right' }}>{entry.stats?.paa ?? 0}</Text>
        <Text style={{ ...bodyCell, width: ptsWidth, textAlign: 'right', fontWeight: '700' }}>
          {entry.points || 0}
        </Text>
      </View>
    );
  };

  return (
    <>
      <ScrollableTableFrame tableMinWidth={tableMinWidth}>
        {renderHeader()}
        {standings.map(renderRow)}
      </ScrollableTableFrame>

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
  embedded = false,
}) {
  const { colors } = useTheme();
  const { sp, isWide } = useTypography();
  const col = (width) => (isWide ? sp(width) : width);

  const tableContent =
    standings.length === 0 ? (
      <Text style={{ color: colors.textMuted, fontSize: 13 }}>No players in this group yet.</Text>
    ) : showScoresheetStats ? (
      <ScoresheetStandingsTable
        groupName={groupName}
        standings={standings}
        handicapEnabled={handicapEnabled}
        showTopThreeMedals={showTopThreeMedals}
        medalCount={medalCount}
        col={col}
      />
    ) : (
      <BasicGroupStandingsTable
        groupName={groupName}
        standings={standings}
        resolvePlayerGameStats={resolvePlayerGameStats}
        showExtendedStats={showExtendedStats}
        showTopThreeMedals={showTopThreeMedals}
        medalCount={medalCount}
        entityLabel={entityLabel}
        col={col}
      />
    );

  const wrappedContent = <View style={{ width: '100%', alignSelf: 'stretch' }}>{tableContent}</View>;

  if (embedded) {
    return wrappedContent;
  }

  return (
    <View style={[discoverUi.listCard, { width: '100%', alignSelf: 'stretch' }]}>
      <View style={{ padding: isWide ? sp(12) : 12, gap: isWide ? sp(8) : 8, width: '100%' }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>{groupName}</Text>
        {wrappedContent}
      </View>
    </View>
  );
}
