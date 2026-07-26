import React from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTheme } from '../../../context/ThemeContext';
import { tournamentColors } from '../../../styles/tournamentUi';

export function TournamentProgressChart({ progress }) {
  const { colors } = useTheme();
  const totalGames = Number(progress?.totalGames || 0);
  const completedGames = Number(progress?.completedGames || 0);
  const pendingGames = Number(progress?.pendingGames || 0);
  const percentComplete = totalGames > 0 ? Math.round((completedGames / totalGames) * 100) : 0;
  const size = 168;
  const strokeWidth = 22;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const completedStroke = (percentComplete / 100) * circumference;

  return (
    <View style={{ alignItems: 'center', gap: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Progress tracker</Text>
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={size} height={size}>
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.borderLight}
            strokeWidth={strokeWidth}
            fill="none"
          />
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.primary}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={`${completedStroke} ${circumference}`}
            strokeLinecap="round"
            rotation="-90"
            origin={`${size / 2}, ${size / 2}`}
          />
        </Svg>
        <View style={{ position: 'absolute', alignItems: 'center' }}>
          <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{percentComplete}%</Text>
          <Text style={{ fontSize: 12, color: colors.textMuted, marginTop: 2 }}>complete</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 16 }}>
        <LegendSwatch color={colors.primary} label={`Completed (${completedGames})`} textColor={colors.textMuted} />
        <LegendSwatch color={tournamentColors.statusWarning} label={`Pending (${pendingGames})`} textColor={colors.textMuted} />
      </View>
    </View>
  );
}

function LegendSwatch({ color, label, textColor }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
      <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: color }} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: textColor }}>{label}</Text>
    </View>
  );
}
