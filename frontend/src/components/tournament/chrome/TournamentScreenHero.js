import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { discoverUi, tournamentColors } from '../../../styles/tournamentUi';

function Badge({ label, tone = 'neutral' }) {
  const palette = {
    neutral: {
      bg: tournamentColors.statusNeutralBg,
      text: tournamentColors.statusNeutralText,
      border: tournamentColors.inputDisabled,
    },
    primary: {
      bg: tournamentColors.statusInfoBg,
      text: tournamentColors.statusInfoText,
      border: tournamentColors.previewBorder,
    },
    success: {
      bg: tournamentColors.statusSuccessBg,
      text: tournamentColors.statusSuccessText,
      border: tournamentColors.successBorder,
    },
    warning: {
      bg: tournamentColors.statusWarningBg,
      text: tournamentColors.statusWarningText,
      border: tournamentColors.accentSky,
    },
    host: {
      bg: tournamentColors.badgeHostBg,
      text: tournamentColors.badgeHostText,
      border: tournamentColors.badgeHostBorder,
    },
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
      <View style={[discoverUi.heroGlow, { bottom: -50, left: -20, backgroundColor: tournamentColors.heroGlowAlt }]} />

      <View style={{ gap: isWide ? sp(12) : 12 }}>
        {Boolean(eyebrow) && (
          <Text style={{ color: tournamentColors.heroSubtext, fontSize: 12, fontWeight: '700', letterSpacing: 1.1 }}>{eyebrow}</Text>
        )}
        <Text style={{ color: tournamentColors.heroText, fontSize: 22, fontWeight: '800', lineHeight: 28 }}>{title}</Text>
        {Boolean(subtitle) && (
          <Text style={{ color: tournamentColors.heroSubtext, fontSize: 14, lineHeight: 20 }}>{subtitle}</Text>
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
                  backgroundColor: tournamentColors.heroStatBg,
                  borderWidth: 1,
                  borderColor: tournamentColors.heroDivider,
                }}
              >
                <Text style={{ color: tournamentColors.heroSubtext, fontSize: 11, fontWeight: '700', letterSpacing: 0.6 }}>
                  {stat.label}
                </Text>
                <Text
                  style={{
                    color: stat.accent || tournamentColors.heroText,
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
