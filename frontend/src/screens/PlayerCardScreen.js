import React from 'react';
import { Platform, Pressable, ScrollView, Share, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';
import * as Clipboard from 'expo-clipboard';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { AppIcon } from '../components/ui/AppIcon';
import { useTheme } from '../context/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { useMyProfile } from '../hooks/queries/useMyProfile';
import { useTabScreenInsets } from '../hooks/useTabScreenInsets';
import { useResponsiveLayout, centeredContentStyle } from '../utils/responsive';
import { getPublicProfileUrl } from '../utils/publicProfileUrl';
import { ActionButton, SectionCard } from '../components/tournament/TournamentChrome';

function StatPill({ label, value, colors }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '46%',
        padding: 12,
        borderRadius: 12,
        backgroundColor: colors.surfaceMuted,
        borderWidth: 1,
        borderColor: colors.borderLight,
      }}
    >
      <Text style={{ fontSize: 12, color: colors.textMuted, fontWeight: '600' }}>{label}</Text>
      <Text style={{ marginTop: 4, fontSize: 22, fontWeight: '800', color: colors.text }}>{value}</Text>
    </View>
  );
}

export function PlayerCardScreen({ navigation }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { scrollPaddingBottom } = useTabScreenInsets();
  const { contentMaxWidth, horizontalPadding, isDesktopWeb } = useResponsiveLayout();
  const { data: profile, isLoading } = useMyProfile({ enabled: Boolean(currentUser?.id) });

  const username = profile?.user?.username || currentUser?.username || 'player';
  const displayName = profile?.user?.name || currentUser?.name || 'Player';
  const stats = profile?.stats || {};
  const profileUrl = getPublicProfileUrl(username);

  const onShare = async () => {
    try {
      await Share.share({
        message: `Check out my Rack-N-Roll player card: ${profileUrl}`,
        url: Platform.OS === 'ios' ? profileUrl : undefined,
        title: `${displayName} on Rack-N-Roll`,
      });
    } catch {
      // user dismissed
    }
  };

  const onCopyLink = async () => {
    await Clipboard.setStringAsync(profileUrl);
  };

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDesktopWeb ? colors.backgroundAlt : colors.background }}
      contentContainerStyle={[
        { padding: horizontalPadding, paddingBottom: scrollPaddingBottom },
        centeredContentStyle(contentMaxWidth),
      ]}
    >
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16 }}>Player Card</Text>

      <View
        style={{
          borderRadius: 20,
          padding: 20,
          backgroundColor: colors.surface,
          borderWidth: 1,
          borderColor: colors.borderLight,
          gap: 16,
        }}
      >
        <View style={{ alignItems: 'center', gap: 6 }}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              backgroundColor: colors.primary,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Text style={{ color: colors.white, fontSize: 28, fontWeight: '800' }}>{displayName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={{ fontSize: 22, fontWeight: '800', color: colors.text }}>{displayName}</Text>
          <Text style={{ fontSize: 14, color: colors.textMuted }}>@{username}</Text>
          <Text style={{ fontSize: 13, color: colors.textMuted }}>Handicap {profile?.user?.handicap ?? 0}</Text>
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          <StatPill label="Matches" value={String(stats.matchesPlayed ?? 0)} colors={colors} />
          <StatPill label="Wins" value={String(stats.matchesWon ?? 0)} colors={colors} />
          <StatPill label="Losses" value={String(stats.matchesLost ?? 0)} colors={colors} />
          <StatPill
            label="Win rate"
            value={stats.winRate == null ? '—' : `${stats.winRate}%`}
            colors={colors}
          />
        </View>

        <View style={{ alignItems: 'center', paddingVertical: 8 }}>
          {!isLoading ? <QRCode value={profileUrl} size={160} backgroundColor={colors.surface} color={colors.text} /> : null}
          <Text style={{ marginTop: 10, fontSize: 12, color: colors.textMuted, textAlign: 'center' }}>{profileUrl}</Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 10 }}>
          <View style={{ flex: 1 }}>
            <ActionButton label="Share" onPress={onShare} fullWidth />
          </View>
          <Pressable
            onPress={onCopyLink}
            style={{
              width: 52,
              borderRadius: 12,
              borderWidth: 1,
              borderColor: colors.border,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surfaceMuted,
            }}
          >
            <AppIcon name="clipboardList" size={20} color={colors.text} />
          </Pressable>
        </View>

        <ActionButton
          label="Preview public page"
          variant="secondary"
          fullWidth
          onPress={() => navigation.navigate('PublicPlayerProfile', { username })}
        />
      </View>
    </ScrollView>
  );
}
