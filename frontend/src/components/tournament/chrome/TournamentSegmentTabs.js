import React, { useEffect, useRef } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { discoverUi, tournamentColors } from '../../../styles/tournamentUi';

/** When tab count exceeds this, horizontal tabs scroll instead of shrinking. */
export const SCROLLABLE_TAB_THRESHOLD = 3;

const SCROLL_END_PADDING = 12;

function TabButton({ tab, selected, isVertical, isScrollable, isWide, sp, onSelectTab, onLayout }) {
  const isMuted = Boolean(tab.muted) && !selected;

  return (
    <Pressable
      onPress={() => onSelectTab(tab.id)}
      onLayout={onLayout}
      style={({ pressed }) => ({
        flex: isVertical || isScrollable ? undefined : 1,
        width: isVertical ? '100%' : undefined,
        minWidth: isScrollable ? 96 : undefined,
        maxWidth: isScrollable ? 168 : undefined,
        paddingVertical: isVertical ? 12 : isWide ? sp(13) : 11,
        paddingHorizontal: isVertical ? 14 : isWide ? sp(12) : isScrollable ? 14 : 6,
        borderRadius: 10,
        alignItems: isVertical ? 'flex-start' : 'center',
        justifyContent: 'center',
        backgroundColor: selected ? tournamentColors.primary : tournamentColors.surfaceRaised,
        borderWidth: 1,
        borderColor: selected ? tournamentColors.primary : tournamentColors.borderLight,
        opacity: pressed ? 0.88 : isMuted ? 0.72 : 1,
      })}
    >
      <Text
        numberOfLines={isScrollable ? 2 : 1}
        ellipsizeMode="tail"
        style={{
          color: selected ? tournamentColors.onPrimary || '#ffffff' : isMuted ? tournamentColors.placeholder : tournamentColors.textMuted,
          fontWeight: '700',
          fontSize: 13,
          textAlign: isVertical ? 'left' : 'center',
        }}
      >
        {tab.label}
      </Text>
    </Pressable>
  );
}

export function TournamentSegmentTabs({ tabs, activeTab, onSelectTab, layout = 'horizontal' }) {
  const { sp, isWide, isDesktopWeb } = useTypography();
  const isVertical = layout === 'vertical' && isDesktopWeb;
  const isScrollable = !isVertical && tabs.length > SCROLLABLE_TAB_THRESHOLD;
  const scrollRef = useRef(null);
  const tabOffsetsRef = useRef({});

  useEffect(() => {
    if (!isScrollable) {
      return;
    }

    const activeOffset = tabOffsetsRef.current[activeTab];
    if (activeOffset === undefined || !scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({
      x: Math.max(0, activeOffset - SCROLL_END_PADDING),
      animated: true,
    });
  }, [activeTab, isScrollable, tabs.length]);

  const recordTabOffset = (tabId) => (event) => {
    const offsetX = event.nativeEvent.layout.x;
    tabOffsetsRef.current[tabId] = offsetX;

    if (tabId !== activeTab || !scrollRef.current) {
      return;
    }

    scrollRef.current.scrollTo({
      x: Math.max(0, offsetX - SCROLL_END_PADDING),
      animated: false,
    });
  };

  const containerPadding = isVertical ? 8 : isWide ? sp(8) : 6;
  const tabGap = isVertical ? 6 : isWide ? sp(8) : 6;

  const tabNodes = tabs.map((tab) => (
    <TabButton
      key={tab.id}
      tab={tab}
      selected={activeTab === tab.id}
      isVertical={isVertical}
      isScrollable={isScrollable}
      isWide={isWide}
      sp={sp}
      onSelectTab={onSelectTab}
      onLayout={isScrollable ? recordTabOffset(tab.id) : undefined}
    />
  ));

  if (isScrollable) {
    return (
      <View
        style={[
          discoverUi.surfaceCard,
          {
            paddingVertical: containerPadding,
            paddingHorizontal: 0,
            overflow: 'hidden',
          },
        ]}
      >
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            flexDirection: 'row',
            alignItems: 'stretch',
            gap: tabGap,
            paddingHorizontal: containerPadding,
            paddingRight: containerPadding + SCROLL_END_PADDING,
          }}
        >
          {tabNodes}
        </ScrollView>
      </View>
    );
  }

  return (
    <View
      style={[
        discoverUi.surfaceCard,
        isVertical
          ? { padding: containerPadding, gap: tabGap }
          : { padding: containerPadding, flexDirection: 'row', gap: tabGap },
      ]}
    >
      {tabNodes}
    </View>
  );
}
