import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { discoverUi, tournamentColors } from '../../styles/tournamentUi';
import { useResponsiveLayout } from '../../utils/responsive';

function heroStatTileStyle() {
  return {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: tournamentColors.heroStatBg,
    borderWidth: 1,
    borderColor: tournamentColors.heroDivider,
  };
}

const heroStatLabelStyle = { fontSize: 11, fontWeight: '700', letterSpacing: 0.6 };
const heroStatValueStyle = { fontSize: 24, fontWeight: '800', marginTop: 4 };

export function MyEventsHero({ total, hostingCount, playingCount }) {
  const { isDesktopWeb } = useResponsiveLayout();
  const heroStatTile = heroStatTileStyle();
  const heroStatLabel = { ...heroStatLabelStyle, color: tournamentColors.heroSubtext };

  const statTiles = (
    <>
      <View style={[heroStatTile, isDesktopWeb && { minWidth: 88 }]}>
        <Text style={heroStatLabel}>TOTAL</Text>
        <Text style={[heroStatValueStyle, { color: tournamentColors.heroText }]}>{total}</Text>
      </View>
      <View style={[heroStatTile, isDesktopWeb && { minWidth: 88 }]}>
        <Text style={heroStatLabel}>HOSTING</Text>
        <Text style={[heroStatValueStyle, { color: tournamentColors.accentLavender }]}>{hostingCount}</Text>
      </View>
      <View style={[heroStatTile, isDesktopWeb && { minWidth: 88 }]}>
        <Text style={heroStatLabel}>PLAYING</Text>
        <Text style={[heroStatValueStyle, { color: tournamentColors.accentMint }]}>{playingCount}</Text>
      </View>
    </>
  );

  if (isDesktopWeb) {
    return (
      <View
        style={[
          discoverUi.hero,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 20,
            paddingVertical: 20,
            paddingHorizontal: 22,
            marginBottom: 16,
          },
        ]}
      >
        <View style={[discoverUi.heroGlow, { top: -40, right: -30 }]} />
        <View style={{ flex: 1, gap: 8, minWidth: 0 }}>
          <Text style={{ color: tournamentColors.heroSubtext, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>
            MY EVENTS
          </Text>
          <Text style={{ color: tournamentColors.heroText, fontSize: 20, fontWeight: '800', lineHeight: 26 }}>
            Your tournaments
          </Text>
          <Text style={{ color: tournamentColors.heroSubtext, fontSize: 14, lineHeight: 20 }}>
            Hosted and joined events, sorted by your most recent match activity.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexShrink: 0 }}>{statTiles}</View>
      </View>
    );
  }

  return (
    <View style={[discoverUi.hero, { marginBottom: 16 }]}>
      <View style={[discoverUi.heroGlow, { top: -40, right: -30 }]} />
      <View style={[discoverUi.heroGlow, { bottom: -50, left: -20, backgroundColor: tournamentColors.heroGlowAlt }]} />

      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ color: tournamentColors.heroSubtext, fontSize: 12, fontWeight: '700', letterSpacing: 1.2 }}>
            MY EVENTS
          </Text>
          <Text style={{ color: tournamentColors.heroText, fontSize: 22, fontWeight: '800', lineHeight: 28 }}>
            Your tournaments
          </Text>
          <Text style={{ color: tournamentColors.heroSubtext, fontSize: 14, lineHeight: 20 }}>
            Hosted and joined events, sorted by your most recent match activity.
          </Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>{statTiles}</View>
      </View>
    </View>
  );
}
