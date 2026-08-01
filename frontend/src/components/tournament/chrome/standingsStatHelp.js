import React from 'react';
import { Pressable } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { tournamentColors } from '../../../styles/tournamentUi';

export const STANDINGS_STAT_HELP = {
  GP: {
    title: 'GP (Games Played)',
    message: 'Matches in this group that have been played or scored so far.',
    icon: 'pool',
  },
  GR: {
    title: 'GR (Games Remaining)',
    message: 'Matches in this group still left to play.',
    icon: 'calendar',
  },
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
  Draw: {
    title: 'D (Draw)',
    message: 'Number of drawn matches in this group.',
    icon: 'hand',
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
  Pts: {
    title: 'Pts (Points)',
    message: 'Standing points earned in this group.',
    icon: 'trophy',
  },
};

export function StandingsStatHeaderCell({ label, width, flex, textAlign = 'left', headerCell, onPress, accentColor }) {
  const layoutStyle = flex
    ? { flex, minWidth: 0, flexShrink: 0 }
    : { width, flexShrink: 0, flexGrow: 0 };

  const pressableStyle = {
    ...layoutStyle,
    ...(textAlign === 'right' ? { alignItems: 'flex-end' } : null),
  };

  if (!onPress) {
    return <Text style={{ ...headerCell, ...layoutStyle, textAlign }}>{label}</Text>;
  }

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}. Tap for explanation.`}
      style={({ pressed }) => ({
        ...pressableStyle,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text
        style={{
          ...headerCell,
          textAlign,
          color: accentColor || tournamentColors.primary,
          textDecorationLine: 'underline',
          textDecorationStyle: 'dotted',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}
