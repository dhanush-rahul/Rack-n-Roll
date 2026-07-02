import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, InteractionManager, Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { AppIcon } from '../components/ui/AppIcon';
import {
  CREATE_TOURNAMENT_WALKTHROUGH_STEPS,
  SECTION_FIRST_STEP_INDEX,
  WALKTHROUGH_SECTION_ORDER,
} from '../config/createTournamentWalkthrough';
import { setCreateTournamentWalkthroughCompleted } from '../utils/onboardingStore';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { centeredContentStyle, useResponsiveLayout } from '../utils/responsive';

const SLIDE_DURATION_MS = 480;

function WalkthroughSectionCard({ title, subtitle, highlighted, children }) {
  return (
    <View
      style={[
        tournamentUi.card,
        {
          gap: 12,
          borderColor: highlighted ? tournamentColors.primary : tournamentColors.border,
          borderWidth: highlighted ? 2 : 1,
        },
      ]}
    >
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: tournamentColors.text }}>{title}</Text>
        {Boolean(subtitle) && (
          <Text style={{ fontSize: 13, lineHeight: 18, color: tournamentColors.textMuted }}>{subtitle}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

function MockLabel({ children }) {
  return <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>{children}</Text>;
}

function MockInput({ placeholder, value }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: tournamentColors.border,
        borderRadius: 8,
        paddingVertical: 12,
        paddingHorizontal: 14,
        backgroundColor: tournamentColors.white,
      }}
    >
      <Text style={{ fontSize: 16, color: value ? tournamentColors.text : tournamentColors.placeholder }}>
        {value || placeholder}
      </Text>
    </View>
  );
}

function MockChip({ label, selected }) {
  return (
    <View
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? tournamentColors.primary : tournamentColors.border,
        backgroundColor: selected ? '#dbeafe' : tournamentColors.white,
      }}
    >
      <Text style={{ fontWeight: '600', color: selected ? tournamentColors.primary : tournamentColors.text }}>
        {label}
      </Text>
    </View>
  );
}

function MockModeOption({ label, description, selected }) {
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 2,
        borderColor: selected ? tournamentColors.primary : tournamentColors.border,
        borderRadius: 12,
        padding: 12,
        backgroundColor: selected ? '#eff6ff' : tournamentColors.white,
        gap: 4,
      }}
    >
      <Text style={{ fontWeight: '700', color: selected ? tournamentColors.primary : tournamentColors.text }}>
        {label}
      </Text>
      <Text style={{ fontSize: 12, lineHeight: 16, color: tournamentColors.textMuted }}>{description}</Text>
    </View>
  );
}

function MockPickerField({ label, value }) {
  return (
    <View
      style={{
        flex: 1,
        borderWidth: 1,
        borderColor: tournamentColors.border,
        borderRadius: 10,
        padding: 12,
        backgroundColor: tournamentColors.white,
        gap: 6,
      }}
    >
      <MockLabel>{label}</MockLabel>
      <Text style={{ fontSize: 15, fontWeight: '600', color: tournamentColors.text }}>{value}</Text>
    </View>
  );
}

function DetailsSection({ highlighted }) {
  return (
    <WalkthroughSectionCard
      title="Tournament details"
      subtitle="What players will see first on Discover."
      highlighted={highlighted}
    >
      <View style={{ gap: 6 }}>
        <MockLabel>Tournament name</MockLabel>
        <MockInput placeholder="e.g. Friday Night 9-Ball Open" value="Friday Night 9-Ball Open" />
      </View>
      <View style={{ gap: 8 }}>
        <MockLabel>Number of players</MockLabel>
        <MockInput placeholder="16" value="16" />
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <MockChip label="8 players" selected={false} />
          <MockChip label="16 players" selected />
          <MockChip label="32 players" selected={false} />
        </View>
      </View>
      <View style={{ gap: 6 }}>
        <MockLabel>Tournament held at</MockLabel>
        <MockInput placeholder="e.g. Rack House Billiards, 120 Main St, Toronto" value="Rack House Billiards, Toronto" />
      </View>
    </WalkthroughSectionCard>
  );
}

function FormatSection({ highlighted, formatMode = 'singles', onTeamFormationLayout }) {
  const isSingles = formatMode === 'singles';

  return (
    <WalkthroughSectionCard
      title="Competition format"
      subtitle="Singles or doubles for the entire tournament."
      highlighted={highlighted}
    >
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <MockModeOption
          label="Singles"
          description="One player per side. Handicap and proctored scoring available."
          selected={isSingles}
        />
        <MockModeOption
          label="Doubles"
          description="Two players per team. Manual team scoring only; handicap is off."
          selected={!isSingles}
        />
      </View>

      {formatMode === 'doubles' ? (
        <View
          style={{ marginTop: 4, gap: 8 }}
          onLayout={(event) => {
            onTeamFormationLayout?.(event.nativeEvent.layout.y);
          }}
        >
          <MockLabel>How teams form</MockLabel>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <MockModeOption
              label="Players pick"
              description="Approved players choose a solo partner after joining."
              selected
            />
            <MockModeOption
              label="Host assigns"
              description="You form or break teams from the Players tab."
              selected={false}
            />
          </View>
        </View>
      ) : null}
    </WalkthroughSectionCard>
  );
}

function MatchSection({ highlighted }) {
  return (
    <WalkthroughSectionCard
      title="Match format"
      subtitle="Group-stage series length before the finale (finale configured later)."
      highlighted={highlighted}
    >
      <View style={{ gap: 8 }}>
        <MockLabel>Games per match (group stage)</MockLabel>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <MockChip label="Best of 1" selected={false} />
          <MockChip label="Best of 3" selected />
          <MockChip label="Best of 5" selected={false} />
        </View>
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          padding: 12,
          borderRadius: 10,
          borderWidth: 1,
          borderColor: tournamentColors.border,
          backgroundColor: tournamentColors.white,
        }}
      >
        <AppIcon name="checkboxOff" size={22} color={tournamentColors.textMuted} />
        <View style={{ flex: 1 }}>
          <Text style={{ fontWeight: '700', color: tournamentColors.text }}>Use handicap in standings</Text>
          <Text style={{ fontSize: 12, color: tournamentColors.textMuted, marginTop: 2 }}>
            Optional for singles — copies profile handicap when players join.
          </Text>
        </View>
      </View>
      <View style={{ gap: 8 }}>
        <MockLabel>Group-stage scoring</MockLabel>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <MockModeOption
            label="Manual"
            description="Players and host enter scores on the Games tab."
            selected
          />
          <MockModeOption
            label="Proctored"
            description="Assigned proctors run live match scoring."
            selected={false}
          />
        </View>
      </View>
    </WalkthroughSectionCard>
  );
}

function RegistrationSection({ highlighted }) {
  return (
    <WalkthroughSectionCard title="Registration" subtitle="Choose who can request a spot." highlighted={highlighted}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <MockModeOption label="Public" description="Anyone on Discover can request to join." selected />
        <MockModeOption label="Invite only" description="Players need your invite code to register." selected={false} />
      </View>
    </WalkthroughSectionCard>
  );
}

function ScheduleSection({ highlighted }) {
  return (
    <WalkthroughSectionCard title="Schedule" subtitle="Tap to pick when play begins." highlighted={highlighted}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <MockPickerField label="Start date" value="Fri, Jul 8, 2026" />
        <MockPickerField label="Start time" value="6:00 PM" />
      </View>
    </WalkthroughSectionCard>
  );
}

function LaunchSection({ highlighted }) {
  return (
    <View style={{ gap: 14 }}>
      <View
        style={[
          {
            borderRadius: 14,
            borderWidth: 1,
            borderColor: highlighted ? tournamentColors.primary : '#bfdbfe',
            backgroundColor: '#f8fafc',
            padding: 14,
            gap: 6,
          },
          highlighted ? { borderWidth: 2 } : null,
        ]}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: tournamentColors.textMuted }}>Preview</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: tournamentColors.text }}>Friday Night 9-Ball Open</Text>
        <Text style={{ color: tournamentColors.textMuted }}>16 players · Fri, Jul 8, 6:00 PM</Text>
        <Text style={{ color: tournamentColors.textMuted }}>Rack House Billiards, Toronto</Text>
      </View>
      <View
        style={{
          borderRadius: 12,
          paddingVertical: 16,
          alignItems: 'center',
          backgroundColor: tournamentColors.primary,
          borderWidth: highlighted ? 2 : 0,
          borderColor: highlighted ? '#1d4ed8' : 'transparent',
        }}
      >
        <Text style={{ color: tournamentColors.white, fontSize: 16, fontWeight: '700' }}>Launch tournament</Text>
      </View>
    </View>
  );
}

const SECTION_COMPONENTS = {
  details: DetailsSection,
  format: FormatSection,
  match: MatchSection,
  registration: RegistrationSection,
  schedule: ScheduleSection,
  launch: LaunchSection,
};

function useSectionAnimations() {
  const translateX = useRef(WALKTHROUGH_SECTION_ORDER.map(() => new Animated.Value(400))).current;
  const opacity = useRef(WALKTHROUGH_SECTION_ORDER.map(() => new Animated.Value(0))).current;
  const revealedRef = useRef(new Set());

  const revealSection = useCallback(
    (index) => {
      if (revealedRef.current.has(index)) {
        return;
      }

      revealedRef.current.add(index);
      translateX[index].setValue(400);
      opacity[index].setValue(0);
      Animated.parallel([
        Animated.timing(translateX[index], {
          toValue: 0,
          duration: SLIDE_DURATION_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: false,
        }),
        Animated.timing(opacity[index], {
          toValue: 1,
          duration: SLIDE_DURATION_MS,
          useNativeDriver: false,
        }),
      ]).start();
    },
    [opacity, translateX]
  );

  return { translateX, opacity, revealSection };
}

export function CreateTournamentWalkthroughScreen({ navigation }) {
  const { scrollPaddingBottom } = useScreenInsets();
  const { contentMaxWidth, horizontalPadding } = useResponsiveLayout();
  const [stepIndex, setStepIndex] = useState(0);
  const isExitingRef = useRef(false);
  const scrollRef = useRef(null);
  const sectionOffsetsRef = useRef([]);
  const sectionAnchorOffsetsRef = useRef({});
  const { translateX, opacity, revealSection } = useSectionAnimations();

  const step = CREATE_TOURNAMENT_WALKTHROUGH_STEPS[stepIndex];
  const isLastStep = stepIndex >= CREATE_TOURNAMENT_WALKTHROUGH_STEPS.length - 1;
  const highlightSection = step.highlightSection || null;

  const scrollToSection = useCallback((index, scrollAnchor) => {
    const isLaunchStep = index === WALKTHROUGH_SECTION_ORDER.length - 1;

    const attemptScroll = (retriesLeft = 12) => {
      requestAnimationFrame(() => {
        const sectionY = sectionOffsetsRef.current[index];
        if (typeof sectionY !== 'number') {
          if (retriesLeft > 0) {
            attemptScroll(retriesLeft - 1);
          }
          return;
        }

        let scrollY = sectionY - 12;

        if (scrollAnchor === 'teamFormation') {
          const anchorY = sectionAnchorOffsetsRef.current.teamFormation;
          if (typeof anchorY !== 'number') {
            if (retriesLeft > 0) {
              attemptScroll(retriesLeft - 1);
            }
            return;
          }
          scrollY = sectionY + anchorY - 12;
        }

        scrollRef.current?.scrollTo({
          y: Math.max(0, scrollY),
          animated: true,
        });

        if (isLaunchStep) {
          setTimeout(() => {
            scrollRef.current?.scrollToEnd({ animated: true });
          }, 320);
        }
      });
    };

    attemptScroll();
  }, []);

  const finishWalkthrough = useCallback(async () => {
    if (isExitingRef.current) {
      return;
    }

    isExitingRef.current = true;
    await setCreateTournamentWalkthroughCompleted(true);

    InteractionManager.runAfterInteractions(() => {
      navigation.replace('CreateTournament');
    });
  }, [navigation]);

  useEffect(() => {
    if (stepIndex < 1 || !step.highlightSection) {
      return undefined;
    }

    const sectionIndex = WALKTHROUGH_SECTION_ORDER.indexOf(step.highlightSection);
    if (sectionIndex < 0) {
      return undefined;
    }

    revealSection(sectionIndex);

    const scrollDelay = step.scrollAnchor ? SLIDE_DURATION_MS * 0.55 : SLIDE_DURATION_MS * 0.4;
    const timer = setTimeout(() => {
      InteractionManager.runAfterInteractions(() => {
        scrollToSection(sectionIndex, step.scrollAnchor);
      });
    }, scrollDelay);

    return () => clearTimeout(timer);
  }, [revealSection, scrollToSection, step.highlightSection, step.scrollAnchor, stepIndex]);

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

    setStepIndex((current) => current - 1);
  }, [stepIndex]);

  const navButtonBase = {
    alignItems: 'center',
    justifyContent: 'center',
    width: 42,
    height: 42,
    borderRadius: 10,
  };

  const stepNavigation = (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
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
        accessibilityLabel={isLastStep ? 'Start creating' : 'Next step'}
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
            {stepIndex + 1} / {CREATE_TOURNAMENT_WALKTHROUGH_STEPS.length}
          </Text>
        ) : (
          <View />
        )}
        {stepNavigation}
      </View>
    </>
  );

  const renderSectionContent = (sectionId, highlighted) => {
    switch (sectionId) {
      case 'format':
        return (
          <FormatSection
            highlighted={highlighted}
            formatMode={step.formatMode || 'singles'}
            onTeamFormationLayout={(y) => {
              sectionAnchorOffsetsRef.current.teamFormation = y;
            }}
          />
        );
      case 'launch':
        return <LaunchSection highlighted={highlighted} />;
      default: {
        const SectionComponent = SECTION_COMPONENTS[sectionId];
        return SectionComponent ? <SectionComponent highlighted={highlighted} /> : null;
      }
    }
  };

  const stageContent = (
    <View style={{ gap: 14 }}>
      {WALKTHROUGH_SECTION_ORDER.map((sectionId, index) => {
        const firstStepIndex = SECTION_FIRST_STEP_INDEX[sectionId];
        const isVisible = firstStepIndex >= 0 && stepIndex >= firstStepIndex;
        const highlighted = highlightSection === sectionId;

        const animatedStyle = {
          opacity: isVisible ? opacity[index] : 0,
          transform: [{ translateX: translateX[index] }],
          height: isVisible ? undefined : 0,
          overflow: isVisible ? 'visible' : 'hidden',
          marginBottom: isVisible ? undefined : 0,
        };

        return (
          <Animated.View
            key={sectionId}
            style={animatedStyle}
            pointerEvents={isVisible ? 'auto' : 'none'}
            onLayout={(event) => {
              sectionOffsetsRef.current[index] = event.nativeEvent.layout.y;
            }}
          >
            {renderSectionContent(sectionId, highlighted)}
          </Animated.View>
        );
      })}
    </View>
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
