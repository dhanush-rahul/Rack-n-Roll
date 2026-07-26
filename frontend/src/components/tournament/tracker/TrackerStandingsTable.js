import React, { useState } from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { FeedbackModal } from '../../FeedbackModal';
import { useTheme } from '../../../context/ThemeContext';
import { STANDINGS_STAT_HELP, StandingsStatHeaderCell } from '../chrome/standingsStatHelp';

const RANK_WIDTH = 36;

export function TrackerStandingsTable({ standings = [], resolveParticipantStats, entityLabel = 'Player' }) {
  const { colors } = useTheme();
  const [activeStatHelp, setActiveStatHelp] = useState(null);

  if (standings.length === 0) {
    return <Text style={{ fontSize: 13, color: colors.textMuted }}>No standings yet.</Text>;
  }

  const headerStyle = {
    fontWeight: '700',
    fontSize: 11,
    color: colors.textMuted,
  };

  const cellStyle = {
    fontSize: 13,
    color: colors.text,
  };

  const openHelp = (key) => () => setActiveStatHelp(key);

  const rowStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    paddingHorizontal: 10,
    paddingVertical: 10,
  };

  const statCellStyle = {
    flex: 1,
    minWidth: 0,
    textAlign: 'right',
  };

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
        <View
          style={{
            ...rowStyle,
            backgroundColor: colors.borderLight,
            borderBottomWidth: 1,
            borderBottomColor: colors.border,
          }}
        >
          <Text style={{ ...headerStyle, width: RANK_WIDTH, flexShrink: 0 }}>#</Text>
          <Text style={{ ...headerStyle, flex: 2, minWidth: 0 }}>{entityLabel}</Text>
          <StandingsStatHeaderCell
            label="GP"
            flex={1}
            textAlign="right"
            headerCell={headerStyle}
            accentColor={colors.primary}
            onPress={openHelp('GP')}
          />
          <StandingsStatHeaderCell
            label="GR"
            flex={1}
            textAlign="right"
            headerCell={headerStyle}
            accentColor={colors.primary}
            onPress={openHelp('GR')}
          />
          <StandingsStatHeaderCell
            label="W"
            flex={1}
            textAlign="right"
            headerCell={headerStyle}
            accentColor={colors.primary}
            onPress={openHelp('W')}
          />
          <StandingsStatHeaderCell
            label="D"
            flex={1}
            textAlign="right"
            headerCell={headerStyle}
            accentColor={colors.primary}
            onPress={openHelp('Draw')}
          />
          <StandingsStatHeaderCell
            label="L"
            flex={1}
            textAlign="right"
            headerCell={headerStyle}
            accentColor={colors.primary}
            onPress={openHelp('L')}
          />
          <StandingsStatHeaderCell
            label="Pts"
            flex={1}
            textAlign="right"
            headerCell={headerStyle}
            accentColor={colors.primary}
            onPress={openHelp('Pts')}
          />
        </View>

        {standings.map((entry, index) => {
          const participantId = String(entry.playerId || entry.teamId || '');
          const stats = resolveParticipantStats
            ? resolveParticipantStats(participantId)
            : { gamesPlayed: 0, gamesRemaining: 0 };
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
              <Text style={{ ...cellStyle, width: RANK_WIDTH, flexShrink: 0, fontWeight: '700' }}>
                {entry.rank || index + 1}
              </Text>
              <Text style={{ ...cellStyle, flex: 2, minWidth: 0, fontWeight: '600' }} numberOfLines={2}>
                {label}
              </Text>
              <Text style={{ ...cellStyle, ...statCellStyle }}>{stats.gamesPlayed || 0}</Text>
              <Text style={{ ...cellStyle, ...statCellStyle }}>{stats.gamesRemaining || 0}</Text>
              <Text style={{ ...cellStyle, ...statCellStyle }}>{entry.wins || 0}</Text>
              <Text style={{ ...cellStyle, ...statCellStyle }}>{entry.draws || 0}</Text>
              <Text style={{ ...cellStyle, ...statCellStyle }}>{entry.losses || 0}</Text>
              <Text style={{ ...cellStyle, ...statCellStyle, fontWeight: '800' }}>{entry.points || 0}</Text>
            </View>
          );
        })}
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
