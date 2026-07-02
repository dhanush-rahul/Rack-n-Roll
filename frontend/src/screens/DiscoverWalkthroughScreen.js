import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Easing, InteractionManager, Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { AppIcon } from '../components/ui/AppIcon';
import { DiscoverHero } from '../components/discover/DiscoverHero';
import {
  DISCOVER_WALKTHROUGH_STEPS,
  WALKTHROUGH_MOCK_TOURNAMENTS,
} from '../config/discoverWalkthrough';
import { setDiscoverWalkthroughCompleted } from '../utils/onboardingStore';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { discoverUi, tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { centeredContentStyle, useResponsiveLayout } from '../utils/responsive';

const SLIDE_DURATION_MS = 480;

function formatStartsAt(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Date TBD';
  }

  return date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function WalkthroughTournamentCard({ item, highlighted }) {
  const monogram = String(item.name || '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join('')
    .toUpperCase();

  return (
    <View
      style={[
        discoverUi.listCard,
        {
          borderColor: highlighted ? tournamentColors.primary : tournamentColors.borderLight,
          borderWidth: highlighted ? 2 : 1,
          overflow: 'hidden',
        },
      ]}
    >
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 4, backgroundColor: tournamentColors.primary }} />
      <View style={{ padding: 14, paddingLeft: 16, gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12 }}>
          <View style={[discoverUi.monogram, { backgroundColor: '#dbeafe' }]}>
            <Text style={{ fontSize: 16, fontWeight: '800', color: tournamentColors.primary }}>{monogram}</Text>
          </View>
          <View style={{ flex: 1, gap: 6 }}>
            <Text style={{ fontSize: 17, fontWeight: '800', color: tournamentColors.text, lineHeight: 22 }}>
              {item.name}
            </Text>
            <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>{formatStartsAt(item.startsAt)}</Text>
            <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
              {item.location?.formattedAddress || 'Location TBD'}
            </Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export function DiscoverWalkthroughScreen({ navigation }) {
  const { scrollPaddingBottom } = useScreenInsets();
  const { contentMaxWidth, horizontalPadding } = useResponsiveLayout();
  const [stepIndex, setStepIndex] = useState(0);
  const isExitingRef = useRef(false);
  const scrollRef = useRef(null);

  const tournamentsTranslateX = useRef(new Animated.Value(400)).current;
  const heroTranslateY = useRef(new Animated.Value(-48)).current;
  const tournamentsOpacity = useRef(new Animated.Value(0)).current;
  const heroOpacity = useRef(new Animated.Value(0)).current;

  const step = DISCOVER_WALKTHROUGH_STEPS[stepIndex];
  const isLastStep = stepIndex >= DISCOVER_WALKTHROUGH_STEPS.length - 1;
  const highlightFirstCard = stepIndex === 2;

  const finishWalkthrough = useCallback(async () => {
    if (isExitingRef.current) {
      return;
    }

    isExitingRef.current = true;
    await setDiscoverWalkthroughCompleted(true);

    InteractionManager.runAfterInteractions(() => {
      navigation.replace('Home');
    });
  }, [navigation]);

  const runTournamentsIn = useCallback(() => {
    tournamentsTranslateX.setValue(400);
    tournamentsOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(tournamentsTranslateX, {
        toValue: 0,
        duration: SLIDE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(tournamentsOpacity, {
        toValue: 1,
        duration: SLIDE_DURATION_MS,
        useNativeDriver: false,
      }),
    ]).start();
  }, [tournamentsOpacity, tournamentsTranslateX]);

  const runHeroIn = useCallback(() => {
    heroTranslateY.setValue(-48);
    heroOpacity.setValue(0);
    Animated.parallel([
      Animated.timing(heroTranslateY, {
        toValue: 0,
        duration: SLIDE_DURATION_MS,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }),
      Animated.timing(heroOpacity, {
        toValue: 1,
        duration: SLIDE_DURATION_MS,
        useNativeDriver: false,
      }),
    ]).start();
  }, [heroOpacity, heroTranslateY]);

  useEffect(() => {
    if (stepIndex === 1) {
      runTournamentsIn();
      requestAnimationFrame(() => {
        scrollRef.current?.scrollTo({ y: 0, animated: false });
      });
    }

    if (stepIndex === 3) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
      runHeroIn();
    }

    return undefined;
  }, [runHeroIn, runTournamentsIn, stepIndex]);

  const goNext = useCallback(() => {
    if (isLastStep) {
      finishWalkthrough();
      return;
    }

    setStepIndex((current) => current + 1);
  }, [finishWalkthrough, isLastStep]);

  const goBack = useCallback(() => {
    if (stepIndex <= 0) {
      return;
    }

    if (stepIndex === 3) {
      scrollRef.current?.scrollTo({ y: 0, animated: false });
    }

    setStepIndex((current) => current - 1);
  }, [stepIndex]);

  const heroStats = useMemo(
    () => ({
      total: 12,
      openCount: 7,
      myCount: 0,
    }),
    []
  );

  const tournamentsStageStyle = {
    opacity: tournamentsOpacity,
    transform: [{ translateX: tournamentsTranslateX }],
  };

  const heroStageStyle = {
    opacity: heroOpacity,
    transform: [{ translateY: heroTranslateY }],
  };

  const navButtonBase = {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 10,
  };

  const stepNavigation = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
      }}
    >
      {stepIndex > 0 ? (
        <Pressable
          onPress={goBack}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Previous step"
          style={({ pressed }) => ({
            ...navButtonBase,
            borderWidth: 1,
            borderColor: tournamentColors.border,
            backgroundColor: tournamentColors.white,
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <AppIcon name="chevronLeft" size={22} color={tournamentColors.text} />
        </Pressable>
      ) : null}
      <Pressable
        onPress={goNext}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel={isLastStep ? 'Go to Discover' : 'Next step'}
        style={({ pressed }) => ({
          ...navButtonBase,
          backgroundColor: tournamentColors.primary,
          opacity: pressed ? 0.9 : 1,
        })}
      >
        <AppIcon
          name={isLastStep ? 'arrowRight' : 'chevronRight'}
          size={22}
          color={tournamentColors.white}
        />
      </Pressable>
    </View>
  );

  const instructionPanel = (
    <>
      <View style={{ gap: 10, alignItems: stepIndex === 0 ? 'center' : 'flex-start' }}>
        <Text
          style={{
            fontSize: stepIndex === 0 ? 24 : 20,
            fontWeight: '800',
            color: tournamentColors.text,
            textAlign: stepIndex === 0 ? 'center' : 'left',
            lineHeight: stepIndex === 0 ? 32 : 26,
          }}
        >
          {step.title}
        </Text>
        <Text
          style={{
            fontSize: 15,
            lineHeight: 23,
            color: tournamentColors.textMuted,
            textAlign: stepIndex === 0 ? 'center' : 'left',
          }}
        >
          {step.body}
        </Text>
      </View>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 22,
          width: '100%',
        }}
      >
        <Pressable onPress={finishWalkthrough} hitSlop={10}>
          <Text style={{ fontSize: 15, fontWeight: '600', color: tournamentColors.textMuted }}>Skip</Text>
        </Pressable>
        {stepIndex !== 0 ? (
          <Text style={{ fontSize: 13, fontWeight: '600', color: '#94a3b8' }}>
            {stepIndex + 1} / {DISCOVER_WALKTHROUGH_STEPS.length}
          </Text>
        ) : (
          <View />
        )}
        {stepNavigation}
      </View>
    </>
  );

  const heroCollapsed = stepIndex < 3;

  const stageContent = (
    <>
      <Animated.View
        style={[
          heroStageStyle,
          heroCollapsed
            ? { height: 0, overflow: 'hidden', opacity: 0, marginBottom: 0 }
            : { marginBottom: 16 },
        ]}
        pointerEvents={stepIndex >= 3 ? 'auto' : 'none'}
      >
        <DiscoverHero
          total={heroStats.total}
          openCount={heroStats.openCount}
          myCount={heroStats.myCount}
          onCreate={() => {}}
        />
      </Animated.View>

      <Animated.View style={[tournamentsStageStyle, { gap: 12 }]}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'baseline',
            justifyContent: 'space-between',
          }}
        >
          <Text style={{ fontSize: 16, fontWeight: '800', color: tournamentColors.text }}>Tournaments</Text>
          <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>
            {WALKTHROUGH_MOCK_TOURNAMENTS.length} shown
          </Text>
        </View>

        <View style={{ gap: 12 }}>
          {WALKTHROUGH_MOCK_TOURNAMENTS.map((item, index) => (
            <WalkthroughTournamentCard key={item.id} item={item} highlighted={highlightFirstCard && index === 0} />
          ))}
        </View>
      </Animated.View>
    </>
  );

  if (stepIndex === 0) {
    return (
      <View style={tournamentUi.screen}>
        <View
          style={[
            {
              flex: 1,
              justifyContent: 'center',
              paddingHorizontal: horizontalPadding,
            },
            centeredContentStyle(contentMaxWidth),
          ]}
        >
          {instructionPanel}
        </View>
      </View>
    );
  }

  return (
    <View style={tournamentUi.screen}>
      <View
        style={[
          {
            flexShrink: 0,
            zIndex: 2,
            backgroundColor: tournamentColors.background,
            paddingHorizontal: horizontalPadding,
            paddingTop: 28,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: tournamentColors.borderLight,
          },
          centeredContentStyle(contentMaxWidth),
        ]}
      >
        {instructionPanel}
      </View>

      <ScrollView
        ref={scrollRef}
        style={{ flex: 1, minHeight: 0 }}
        contentContainerStyle={[
          {
            flexGrow: 1,
            justifyContent: 'flex-start',
            paddingHorizontal: horizontalPadding,
            paddingTop: 16,
            paddingBottom: scrollPaddingBottom,
          },
          centeredContentStyle(contentMaxWidth),
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {stageContent}
      </ScrollView>
    </View>
  );
}
