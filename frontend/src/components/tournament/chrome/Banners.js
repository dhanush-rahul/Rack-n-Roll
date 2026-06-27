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
        backgroundColor: '#eff6ff',
        borderWidth: 1,
        borderColor: '#bfdbfe',
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
      }}
    >
      <AppIcon name="view" size={20} color="#1e40af" />
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={{ fontWeight: '700', color: '#1e40af', fontSize: 14 }}>View-only scoresheet</Text>
        <Text style={{ color: '#1d4ed8', fontSize: 13, lineHeight: 18 }}>
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
        backgroundColor: '#ecfdf5',
        borderWidth: 1,
        borderColor: '#bbf7d0',
      }}
    >
      <Text style={{ color: tournamentColors.success, fontWeight: '600', fontSize: 14 }}>{message}</Text>
    </View>
  );
}

const infoBannerPalettes = {
  info: { bg: '#eff6ff', border: '#bfdbfe', title: '#1e40af', body: '#1d4ed8' },
  success: { bg: '#ecfdf5', border: '#bbf7d0', title: '#166534', body: '#15803d' },
  warning: { bg: '#fff7ed', border: '#fed7aa', title: '#9a3412', body: '#c2410c' },
  neutral: { bg: '#f8fafc', border: tournamentColors.borderLight, title: tournamentColors.text, body: tournamentColors.textMuted },
};

export function InfoBanner({ title, message, tone = 'info', icon }) {
  const palette = infoBannerPalettes[tone] || infoBannerPalettes.info;

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
