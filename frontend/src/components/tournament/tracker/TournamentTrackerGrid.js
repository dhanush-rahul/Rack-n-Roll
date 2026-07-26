import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTheme } from '../../../context/ThemeContext';

const LABEL_WIDTH = 76;

export function TournamentTrackerGrid({ tracker }) {
  const { colors } = useTheme();
  const groups = tracker?.groups || [];
  const rounds = tracker?.rounds || [];
  const pendingByGroup = tracker?.pendingByGroup || {};

  if (groups.length === 0) {
    return (
      <Text style={{ fontSize: 13, color: colors.textMuted }}>
        Group fixtures are not available yet. Assign groups and generate games to see the tracker.
      </Text>
    );
  }

  if (rounds.length === 0) {
    return (
      <Text style={{ fontSize: 13, color: colors.textMuted }}>
        No group-stage rounds have been scheduled yet.
      </Text>
    );
  }

  const tableShellStyle = {
    width: '100%',
    alignSelf: 'stretch',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    overflow: 'hidden',
  };

  const labelCellStyle = {
    width: LABEL_WIDTH,
    flexShrink: 0,
    paddingHorizontal: 10,
    paddingVertical: 12,
    backgroundColor: colors.borderLight,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  };

  const centeredText = (extra = {}) => ({
    textAlign: 'center',
    alignSelf: 'stretch',
    ...extra,
  });

  const dataCellStyle = (highlight = false, isLast = false, isHeader = false) => ({
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    paddingVertical: 12,
    backgroundColor: isHeader ? colors.borderLight : highlight ? colors.primarySoft : colors.surface,
    borderRightWidth: isLast ? 0 : 1,
    borderRightColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  });

  const rowStyle = (isHeader = false) => ({
    flexDirection: 'row',
    width: '100%',
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: isHeader ? colors.borderLight : undefined,
  });

  const renderDataCells = (getValue, { highlight = false, emphasize = false, isHeader = false } = {}) =>
    groups.map((group) => {
      const value = getValue(group);
      const hasValue = Number(value) > 0;

      return (
        <View
          key={group.divisionId}
          style={dataCellStyle(isHeader ? false : highlight || hasValue, false, isHeader)}
        >
          <Text
            style={centeredText({
              fontWeight: emphasize ? '800' : '700',
              fontSize: 14,
              color: colors.text,
            })}
          >
            {value}
          </Text>
        </View>
      );
    });

  return (
    <View style={tableShellStyle}>
      <View style={rowStyle(true)}>
        <View style={labelCellStyle}>
          <Text style={centeredText({ fontWeight: '800', fontSize: 12, color: colors.textMuted })}>Round</Text>
        </View>
        {groups.map((group) => (
          <View key={group.divisionId} style={dataCellStyle(false, false, true)}>
            <Text
              style={centeredText({ fontWeight: '800', fontSize: 12, color: colors.text })}
              numberOfLines={2}
            >
              {group.divisionName}
            </Text>
          </View>
        ))}
        <View style={dataCellStyle(false, true, true)}>
          <Text style={centeredText({ fontWeight: '800', fontSize: 12, color: colors.text })}>Total</Text>
        </View>
      </View>

      {rounds.map((round) => (
        <View key={`round-${round.roundNumber}`} style={rowStyle(false)}>
          <View style={labelCellStyle}>
            <Text style={centeredText({ fontWeight: '700', fontSize: 13, color: colors.text })}>{round.roundNumber}</Text>
          </View>
          {renderDataCells((group) => Number(round.byGroup?.[group.divisionId] || 0))}
          <View style={dataCellStyle(Number(round.rowTotal || 0) > 0, true)}>
            <Text style={centeredText({ fontWeight: '800', fontSize: 14, color: colors.text })}>
              {round.rowTotal || 0}
            </Text>
          </View>
        </View>
      ))}

      <View style={{ ...rowStyle(false), borderBottomWidth: 0 }}>
        <View style={labelCellStyle}>
          <Text style={centeredText({ fontWeight: '800', fontSize: 12, color: colors.textMuted })}>Pending</Text>
        </View>
        {renderDataCells((group) => Number(pendingByGroup[group.divisionId] || 0), {
          highlight: true,
          emphasize: true,
        })}
        <View style={dataCellStyle(true, true)}>
          <Text style={centeredText({ fontWeight: '800', fontSize: 14, color: colors.text })}>
            {Number(tracker?.grandTotalPending || 0)}
          </Text>
        </View>
      </View>
    </View>
  );
}
