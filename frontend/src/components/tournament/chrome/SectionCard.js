import React, { useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { discoverUi, tournamentColors } from '../../../styles/tournamentUi';

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
  headerAction,
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <SectionCard
      title={title}
      subtitle={expanded ? subtitle : undefined}
      headerAction={
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {headerAction}
          <Pressable
            onPress={() => setExpanded((current) => !current)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={expanded ? 'Collapse section' : 'Expand section'}
          >
            <Text style={{ fontSize: 14, fontWeight: '700', color: tournamentColors.primary }}>
              {expanded ? 'Hide' : 'Show'}
            </Text>
          </Pressable>
        </View>
      }
    >
      {expanded ? children : null}
    </SectionCard>
  );
}
