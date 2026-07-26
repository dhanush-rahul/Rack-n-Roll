import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../../ui/ScaledText';
import { AppIcon } from '../../ui/AppIcon';
import { tournamentColors } from '../../../styles/tournamentUi';

export function ReadOnlyBanner() {
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: tournamentColors.statusInfoBg,
        borderWidth: 1,
        borderColor: tournamentColors.primaryTint,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <AppIcon name="view" size={20} color={tournamentColors.statusInfoText} />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: '700', color: tournamentColors.statusInfoText, fontSize: 14 }}>View-only scoresheet</Text>
        <Text style={{ color: tournamentColors.textMuted, fontSize: 13, lineHeight: 18 }}>
          Browse groups, fixtures, and results. Scoring is managed by the host.
        </Text>
      </View>
    </View>
  );
}

export function SuccessBanner({ message }) {
  if (!message) {
    return null;
  }

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: tournamentColors.successSurface,
        borderWidth: 1,
        borderColor: tournamentColors.successBorder,
      }}
    >
      <Text style={{ color: tournamentColors.success, fontWeight: '600', fontSize: 14 }}>{message}</Text>
    </View>
  );
}

const infoBannerPalettes = () => ({
  info: {
    bg: tournamentColors.statusInfoBg,
    border: tournamentColors.primaryTint,
    title: tournamentColors.statusInfoText,
    body: tournamentColors.textMuted,
  },
  primary: {
    bg: tournamentColors.primarySoft,
    border: tournamentColors.primaryTint,
    title: tournamentColors.primary,
    body: tournamentColors.textMuted,
  },
  success: {
    bg: tournamentColors.successSurface,
    border: tournamentColors.successBorder,
    title: tournamentColors.statusSuccessText,
    body: tournamentColors.textMuted,
  },
  warning: {
    bg: tournamentColors.statusWarningBg,
    border: tournamentColors.warning,
    title: tournamentColors.statusWarningText,
    body: tournamentColors.textMuted,
  },
  neutral: {
    bg: tournamentColors.surfaceRaised,
    border: tournamentColors.borderLight,
    title: tournamentColors.text,
    body: tournamentColors.textMuted,
  },
});

export function InfoBanner({ title, message, tone = 'info', icon }) {
  const palette = infoBannerPalettes()[tone] || infoBannerPalettes().info;

  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
        flexDirection: 'row',
        gap: 10,
        alignItems: 'flex-start',
      }}
    >
      {Boolean(icon) && <AppIcon name={icon} size={20} color={palette.title} />}
      <View style={{ flex: 1, gap: 4 }}>
        {Boolean(title) && <Text style={{ fontWeight: '800', fontSize: 14, color: palette.title }}>{title}</Text>}
        {Boolean(message) && <Text style={{ fontSize: 13, lineHeight: 18, color: palette.body }}>{message}</Text>}
      </View>
    </View>
  );
}
