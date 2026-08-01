import React, { useEffect, useRef, useState } from 'react';
import { Animated, LayoutAnimation, Platform, Pressable, UIManager, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { AppIcon } from '../../ui/AppIcon';
import { useDiscoverSurfaceCard } from '../../../hooks/useDiscoverSurfaceCard';
import { useTheme } from '../../../context/ThemeContext';
import { useTypography } from '../../../context/TypographyContext';

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
  const { colors } = useTheme();
  const { sp, fs } = useTypography();
  const surfaceCardStyle = useDiscoverSurfaceCard();

  return (
    <View style={surfaceCardStyle}>
      {(Boolean(title) || headerAction) && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: sp(10) }}>
          <View style={{ flex: 1, gap: sp(4) }}>
            {Boolean(title) && (
              <Text style={{ fontSize: fs(16), fontWeight: '800', color: colors.text }}>{title}</Text>
            )}
            {Boolean(subtitle) && (
              <Text style={{ fontSize: fs(13), lineHeight: fs(18), color: colors.textMuted }}>{subtitle}</Text>
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
  const { colors } = useTheme();
  const { sp, fs } = useTypography();
  const surfaceCardStyle = useDiscoverSurfaceCard();
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
    outputRange: [colors.cardBorder, colors.primary],
  });

  const cardPadding = sp(12);

  return (
    <Animated.View
      ref={sectionRef}
      style={[
        surfaceCardStyle[0],
        surfaceCardStyle[1],
        {
          padding: 0,
          overflow: 'hidden',
          borderWidth: highlighted ? 2 : 1,
          borderColor: highlighted ? borderColor : expanded ? colors.primaryTint : colors.cardBorder,
          backgroundColor: highlighted ? colors.primarySoft : colors.surface,
        },
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: sp(10), padding: cardPadding }}>
        <Pressable
          onPress={toggleExpanded}
          style={({ pressed }) => ({ flex: 1, opacity: pressed ? 0.88 : 1, gap: sp(4) })}
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          accessibilityLabel={expanded ? `Collapse ${title}` : `Expand ${title}`}
        >
          {Boolean(title) && (
            <Text style={{ fontSize: fs(16), fontWeight: '800', color: colors.text }}>{title}</Text>
          )}
          {Boolean(subtitle) && (
            <Text style={{ fontSize: fs(13), lineHeight: fs(18), color: colors.textMuted }} numberOfLines={expanded ? 3 : 2}>
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
            width: sp(30),
            height: sp(30),
            borderRadius: sp(15),
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: expanded ? colors.chipSelectedBg : colors.inputFill,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <Animated.View style={{ transform: [{ rotate: chevronRotation }] }}>
            <AppIcon name="chevronDown" size={sp(15)} color={colors.primary} />
          </Animated.View>
        </Pressable>
      </View>

      {expanded ? (
        <View
          style={{
            gap: sp(12),
            paddingHorizontal: cardPadding,
            paddingBottom: cardPadding,
            borderTopWidth: 1,
            borderTopColor: colors.borderLight,
            paddingTop: cardPadding,
          }}
        >
          {children}
        </View>
      ) : null}
    </Animated.View>
  );
}
