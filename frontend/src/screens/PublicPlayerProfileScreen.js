import React from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { useTheme } from '../context/ThemeContext';
import { usePublicProfile } from '../hooks/queries/usePublicProfile';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { useResponsiveLayout, centeredContentStyle } from '../utils/responsive';
import { AppIcon } from '../components/ui/AppIcon';

function PublicStat({ label, value, colors }) {
  return (
    <View style={{ flex: 1, minWidth: '46%', padding: 12, borderRadius: 12, backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.borderLight }}>
      <Text style={{ fontSize: 12, color: colors.textMuted }}>{label}</Text>
      <Text style={{ marginTop: 4, fontSize: 22, fontWeight: '800', color: colors.text }}>{value}</Text>
    </View>
  );
}

export function PublicPlayerProfileScreen({ route }) {
  const { colors } = useTheme();
  const { scrollPaddingBottom } = useScreenInsets();
  const { contentMaxWidth, horizontalPadding, isDesktopWeb } = useResponsiveLayout();
  const username = route.params?.username;
  const { data, isLoading, error } = usePublicProfile(username);

  if (isLoading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, backgroundColor: colors.background }}>
        <AppIcon name="person" size={40} color={colors.textMuted} />
        <Text style={{ marginTop: 12, fontSize: 18, fontWeight: '800', color: colors.text }}>Player not found</Text>
        <Text style={{ marginTop: 6, color: colors.textMuted, textAlign: 'center' }}>
          This player card is unavailable or the username does not exist.
        </Text>
      </View>
    );
  }

  const { user, stats } = data;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDesktopWeb ? colors.backgroundAlt : colors.background }}
      contentContainerStyle={[
        { padding: horizontalPadding, paddingBottom: scrollPaddingBottom },
        centeredContentStyle(Math.min(contentMaxWidth, 560)),
      ]}
    >
      <View style={{ alignItems: 'center', marginBottom: 20, gap: 6 }}>
        <View style={{ width: 88, height: 88, borderRadius: 44, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: colors.white, fontSize: 34, fontWeight: '800' }}>{String(user.name || user.username).charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={{ fontSize: 28, fontWeight: '800', color: colors.text }}>{user.name}</Text>
        <Text style={{ fontSize: 16, color: colors.textMuted }}>@{user.username}</Text>
        <Text style={{ fontSize: 14, color: colors.textMuted }}>Handicap {user.handicap ?? 0}</Text>
      </View>

      <View
        style={{
          borderRadius: 20,
          padding: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          gap: 14,
        }}
      >
        <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }}>Player stats</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <PublicStat label="Tournaments joined" value={String(stats.tournamentsJoined ?? 0)} colors={colors} />
          <PublicStat label="Tournaments hosted" value={String(stats.tournamentsHosted ?? 0)} colors={colors} />
          <PublicStat label="Matches played" value={String(stats.matchesPlayed ?? 0)} colors={colors} />
          <PublicStat label="Win rate" value={stats.winRate == null ? '—' : `${stats.winRate}%`} colors={colors} />
        </View>
      </View>

      <Text style={{ marginTop: 16, textAlign: 'center', fontSize: 12, color: colors.textMuted }}>
        Rack-N-Roll player card
      </Text>
    </ScrollView>
  );
}
