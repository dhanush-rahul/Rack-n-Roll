import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { discoverUi, tournamentColors } from '../../../styles/tournamentUi';

export function TournamentSegmentTabs({ tabs, activeTab, onSelectTab, layout = 'horizontal' }) {
  const { sp, isWide, isDesktopWeb } = useTypography();
  const isVertical = layout === 'vertical' && isDesktopWeb;

  return (
    <View
      style={[
        discoverUi.surfaceCard,
        isVertical
          ? { padding: 8, gap: 6 }
          : { padding: isWide ? sp(8) : 6, flexDirection: 'row', gap: isWide ? sp(8) : 6 },
      ]}
    >
      {tabs.map((tab) => {
        const selected = activeTab === tab.id;

        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelectTab(tab.id)}
            style={({ pressed }) => ({
              flex: isVertical ? undefined : 1,
              width: isVertical ? '100%' : undefined,
              paddingVertical: isVertical ? 12 : isWide ? sp(13) : 11,
              paddingHorizontal: isVertical ? 14 : isWide ? sp(8) : 6,
              borderRadius: 10,
              alignItems: isVertical ? 'flex-start' : 'center',
              justifyContent: 'center',
              backgroundColor: selected ? tournamentColors.primary : '#f8fafc',
              borderWidth: 1,
              borderColor: selected ? tournamentColors.primary : tournamentColors.borderLight,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? tournamentColors.white : tournamentColors.textMuted,
                fontWeight: '700',
                fontSize: 13,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
