import React from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { useTypography } from '../../../context/TypographyContext';
import { discoverUi, tournamentColors } from '../../../styles/tournamentUi';

function Badge({ label, tone = 'neutral', sp, fs }) {
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
        paddingHorizontal: sp(7),
        paddingVertical: sp(3),
        borderRadius: 999,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <Text style={{ fontSize: fs(11), fontWeight: '700', color: palette.text }}>{label}</Text>
    </View>
  );
}

export function TournamentScreenHero({ eyebrow, title, subtitle, badges = [], stats = [], onPress }) {
  const { sp, fs } = useTypography();

  const content = (
    <View style={[discoverUi.hero, { padding: sp(14), borderRadius: sp(14) }]}>
      <View style={[discoverUi.heroGlow, { top: -40, right: -30, width: sp(120), height: sp(120), borderRadius: sp(60) }]} />
      <View
        style={[
          discoverUi.heroGlow,
          { bottom: -50, left: -20, backgroundColor: tournamentColors.heroGlowAlt, width: sp(120), height: sp(120), borderRadius: sp(60) },
        ]}
      />

      <View style={{ gap: sp(10) }}>
        {Boolean(eyebrow) && (
          <Text style={{ color: tournamentColors.heroSubtext, fontSize: fs(12), fontWeight: '700', letterSpacing: 1.1 }}>{eyebrow}</Text>
        )}
        <Text style={{ color: tournamentColors.heroText, fontSize: fs(20), fontWeight: '800', lineHeight: fs(26) }}>{title}</Text>
        {Boolean(subtitle) && (
          <Text style={{ color: tournamentColors.heroSubtext, fontSize: fs(14), lineHeight: fs(20) }}>{subtitle}</Text>
        )}

        {badges.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp(6) }}>
            {badges.map((badge) => (
              <Badge key={badge.label} label={badge.label} tone={badge.tone} sp={sp} fs={fs} />
            ))}
          </View>
        )}

        {stats.length > 0 && (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: sp(8) }}>
            {stats.map((stat) => (
              <View
                key={stat.label}
                style={{
                  flexGrow: 1,
                  minWidth: '30%',
                  paddingVertical: sp(10),
                  paddingHorizontal: sp(12),
                  borderRadius: sp(12),
                  backgroundColor: tournamentColors.heroStatBg,
                  borderWidth: 1,
                  borderColor: tournamentColors.heroDivider,
                }}
              >
                <Text style={{ color: tournamentColors.heroSubtext, fontSize: fs(11), fontWeight: '700', letterSpacing: 0.6 }}>
                  {stat.label}
                </Text>
                <Text
                  style={{
                    color: stat.accent || tournamentColors.heroText,
                    fontSize: fs(20),
                    fontWeight: '800',
                    marginTop: sp(3),
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
