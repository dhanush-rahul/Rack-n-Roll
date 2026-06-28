import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { discoverUi, tournamentColors } from '../../styles/tournamentUi';

const heroStatTile = {
  flex: 1,
  paddingVertical: 12,
  paddingHorizontal: 14,
  borderRadius: 14,
  backgroundColor: 'rgba(255,255,255,0.08)',
  borderWidth: 1,
  borderColor: 'rgba(255,255,255,0.12)',
};

const heroStatLabel = { color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 };
const heroStatValue = { fontSize: 24, fontWeight: '800', marginTop: 4 };

export function DiscoverHero({ total, openCount, myCount, onCreate }) {
  return (
    <View style={discoverUi.hero}>
      <View style={[discoverUi.heroGlow, { top: -40, right: -30 }]} />
      <View style={[discoverUi.heroGlow, { bottom: -50, left: -20, backgroundColor: 'rgba(124, 58, 237, 0.28)' }]} />

      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>DISCOVER</Text>
          <Text style={{ color: '#f8fafc', fontSize: 22, fontWeight: '800', lineHeight: 28 }}>Find your next table</Text>
          <Text style={{ color: '#94a3b8', fontSize: 14, lineHeight: 20 }}>
            Browse tournaments, join open events, or host your own.
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
          <View style={heroStatTile}>
            <Text style={heroStatLabel}>TOTAL</Text>
            <Text style={[heroStatValue, { color: '#f8fafc' }]}>{total}</Text>
          </View>
          <View style={heroStatTile}>
            <Text style={heroStatLabel}>OPEN</Text>
            <Text style={[heroStatValue, { color: '#86efac' }]}>{openCount}</Text>
          </View>
          <View style={heroStatTile}>
            <Text style={heroStatLabel}>YOURS</Text>
            <Text style={[heroStatValue, { color: '#c4b5fd' }]}>{myCount}</Text>
          </View>
        </View>

        <Pressable
          onPress={onCreate}
          style={({ pressed }) => ({
            backgroundColor: tournamentColors.primary,
            borderRadius: 12,
            paddingVertical: 13,
            alignItems: 'center',
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <Text style={{ color: tournamentColors.white, fontWeight: '800', fontSize: 15 }}>+ Host a tournament</Text>
        </Pressable>
      </View>
    </View>
  );
}
