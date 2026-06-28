import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../../ui/ScaledTextInput';
import { tournamentColors, tournamentUi } from '../../../styles/tournamentUi';
import { ActionButton } from './ActionButton';

export function FixtureFilterPanel({
  playerFilterInput,
  onPlayerFilterInputChange,
  opponentFilterInput,
  onOpponentFilterInputChange,
  onClearFilter,
  onApplyFilter,
  isLoading,
}) {
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 13, color: tournamentColors.text, marginBottom: 10 }}>
        Filter matches by player
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <TextInput
          style={{ flex: 1, ...tournamentUi.input }}
          placeholder="Player 1"
          value={playerFilterInput}
          onChangeText={onPlayerFilterInputChange}
          onSubmitEditing={onApplyFilter}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <Text style={{ fontWeight: '700', color: tournamentColors.textMuted, fontSize: 13 }}>vs</Text>
        <TextInput
          style={{ flex: 1, ...tournamentUi.input }}
          placeholder="Player 2"
          value={opponentFilterInput}
          onChangeText={onOpponentFilterInputChange}
          onSubmitEditing={onApplyFilter}
          returnKeyType="search"
          autoCapitalize="none"
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ActionButton label="Clear" onPress={onClearFilter} variant="ghost" fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton
            label={isLoading ? 'Searching…' : 'Apply filter'}
            onPress={onApplyFilter}
            disabled={isLoading}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}
