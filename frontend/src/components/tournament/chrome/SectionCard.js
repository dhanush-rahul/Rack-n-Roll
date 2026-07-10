import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { AppIcon } from '../../ui/AppIcon';
import { useTypography } from '../../../context/TypographyContext';
import { discoverUi, tournamentColors } from '../../../styles/tournamentUi';

const EXPAND_ANIM_MS = 260;

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const configureExpandAnimation = () => {
  LayoutAnimation.configureNext({
    duration: EXPAND_ANIM_MS,
    update: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    create: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
    delete: {
      type: LayoutAnimation.Types.easeInEaseOut,
      property: LayoutAnimation.Properties.opacity,
    },
  });
};

export function SectionCard({ title, subtitle, children, headerAction }) {
  const { sp, isWide } = useTypography();

  return (
    <View style={[discoverUi.surfaceCard, { gap: isWide ? sp(14) : 12, padding: isWide ? sp(14) : 12 }]}>
      {(Boolean(title) || headerAction) && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: isWide ? sp(10) : 10 }}>
          <View style={{ flex: 1, gap: isWide ? sp(6) : 4 }}>
            {Boolean(title) && (
              <Text style={{ fontSize: 16, fontWeight: '800', color: tournamentColors.text }}>{title}</Text>
            )}
            {Boolean(subtitle) && (
              <Text style={{ fontSize: 13, lineHeight: 18, color: tournamentColors.textMuted }}>{subtitle}</Text>
            )}
          </View>
          {headerAction}
        </View>
      )}
      {children}
    </View>
  );
}

export function CollapsibleSectionCard({
  title,
  subtitle,
  children,
  defaultExpanded = false,
  expanded: expandedProp,
  onExpandedChange,
  highlighted = false,
  headerAction,
  sectionRef,
}) {
  const { sp, isWide } = useTypography();
  const [internalExpanded, setInternalExpanded] = useState(defaultExpanded);
  const isControlled = expandedProp !== undefined;
  const expanded = isControlled ? expandedProp : internalExpanded;
  const chevronAnimation = useRef(new Animated.Value(expanded ? 1 : 0)).current;
  const highlightAnimation = useRef(new Animated.Value(highlighted ? 1 : 0)).current;

  useEffect(() => {
    if (!isControlled) {
      setInternalExpanded(defaultExpanded);
    }
  }, [defaultExpanded, isControlled]);

  useEffect(() => {
    Animated.timing(chevronAnimation, {
      toValue: expanded ? 1 : 0,
      duration: EXPAND_ANIM_MS,
      useNativeDriver: true,
    }).start();
  }, [chevronAnimation, expanded]);

  useEffect(() => {
    Animated.timing(highlightAnimation, {
      toValue: highlighted ? 1 : 0,
      duration: EXPAND_ANIM_MS,
      useNativeDriver: false,
    }).start();
  }, [highlightAnimation, highlighted]);

  const toggleExpanded = () => {
    configureExpandAnimation();
    const nextExpanded = !expanded;

    if (isControlled) {
      onExpandedChange?.(nextExpanded);
    } else {
      setInternalExpanded(nextExpanded);
    }
  };

  const chevronRotation = chevronAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '180deg'],
  });

  const borderColor = highlightAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [tournamentColors.cardBorder, '#2563eb'],
  });

  const cardPadding = isWide ? sp(14) : 12;

  return (
    <Animated.View
      ref={sectionRef}
      style={[
        discoverUi.surfaceCard,
        {
          padding: 0,
          overflow: 'hidden',
          borderWidth: highlighted ? 2 : 1,
          borderColor: highlighted ? borderColor : expanded ? '#bfdbfe' : tournamentColors.cardBorder,
          backgroundColor: highlighted ? '#f8fbff' : tournamentColors.white,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: cardPadding }}>
        <Pressable
          onPress={toggleExpanded}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.88 : 1, gap: isWide ? sp(6) : 4 })}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? `Collapse ${title}` : `Expand ${title}`}
        >
          {Boolean(title) && (
            <Text style={{ fontSize: 16, fontWeight: '800', color: tournamentColors.text }}>{title}</Text>
          )}
          {Boolean(subtitle) && (
            <Text style={{ fontSize: 13, lineHeight: 18, color: tournamentColors.textMuted }} numberOfLines={expanded ? 3 : 2}>
              {subtitle}
            </Text>
          )}
        </Pressable>

        {headerAction ? <View style={{ alignSelf: 'flex-start' }}>{headerAction}</View> : null}

        <Pressable
          onPress={toggleExpanded}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Collapse section' : 'Expand section'}
          style={({ pressed }) => ({
            width: 32,
            height: 32,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: expanded ? '#eff6ff' : '#f1f5f9',
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <AppIcon name="chevronDown" size={16} color={tournamentColors.primary} />
          </Animated.View>
        </Pressable>
      </View>

      {expanded ? (
        <View
          style={{
            gap: isWide ? sp(14) : 12,
            paddingHorizontal: cardPadding,
            paddingBottom: cardPadding,
            borderTopWidth: 1,
            borderTopColor: tournamentColors.borderLight,
            paddingTop: cardPadding,
          }}
        >
          {children}
        </View>
      ) : null}
    </Animated.View>
  );
}
