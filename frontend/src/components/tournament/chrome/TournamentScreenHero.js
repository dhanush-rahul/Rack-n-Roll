import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { discoverUi } from '../../../styles/tournamentUi';

function Badge({ label, tone = 'neutral' }) {
  const palette = {
    neutral: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
    primary: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
    success: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
    warning: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
    host: { bg: '#ede9fe', text: '#6d28d9', border: '#ddd6fe' },
  }[tone];

  return (
    <View
      style={{
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 999,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '700', color: palette.text }}>{label}</Text>
    </View>
  );
}

export function TournamentScreenHero({ eyebrow, title, subtitle, badges = [], stats = [], onPress }) {
  const { sp, isWide } = useTypography();

  const content = (
    <View style={[discoverUi.hero, isWide && { padding: sp(18) }]}>
      <View style={[discoverUi.heroGlow, { top: -40, right: -30 }]} />
      <View style={[discoverUi.heroGlow, { bottom: -50, left: -20, backgroundColor: 'rgba(124, 58, 237, 0.28)' }]} />

      <View style={{ gap: isWide ? sp(12) : 12 }}>
        {Boolean(eyebrow) && (
          <Text style={{ color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 1.1 }}>{eyebrow}</Text>
        )}
        <Text style={{ color: '#f8fafc', fontSize: 22, fontWeight: '800', lineHeight: 28 }}>{title}</Text>
        {Boolean(subtitle) && (
          <Text style={{ color: '#94a3b8', fontSize: 14, lineHeight: 20 }}>{subtitle}</Text>
        )}

        {badges.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
            {badges.map((badge) => (
              <Badge key={badge.label} label={badge.label} tone={badge.tone} />
            ))}
          </View>
        )}

        {stats.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={{
                  flexGrow: 1,
                  minWidth: '30%',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 14,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  borderWidth: 1,
                  borderColor: 'rgba(255,255,255,0.12)',
                }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
                  {stat.label}
                </Text>
                <Text
                  style={{
                    color: stat.accent || '#f8fafc',
                    fontSize: 24,
                    fontWeight: '800',
                    marginTop: 4,
                  }}
                >
                  {stat.value}
                </Text>
              </View>
            ))}
          </View>
        )}
      </View>
    </View>
  );

  if (!onPress) {
    return content;
  }

  return (
    <Pressable onPress={onPress} style={({ pressed }) => ({ opacity: pressed ? 0.92 : 1 })}>
      {content}
    </Pressable>
  );
}
