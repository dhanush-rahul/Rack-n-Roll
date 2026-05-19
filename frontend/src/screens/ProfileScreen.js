import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { ActionButton, SectionCard } from '../components/tournament/TournamentChrome';
import { useAuth } from '../context/AuthContext';
import { fetchMyProfile } from '../services/userService';
import { discoverUi, tournamentColors, tournamentUi } from '../styles/tournamentUi';

function StatCard({ label, value, accent }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '46%',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        backgroundColor: '#fafbfc',
      }}
    >
      <Text style={{ fontSize: 12, fontWeight: '600', color: tournamentColors.textMuted }}>{label}</Text>
      <Text
        style={{
          marginTop: 6,
          fontSize: 24,
          fontWeight: '800',
          color: accent || tournamentColors.text,
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function formatMemberSince(value) {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function ProfileScreen({ navigation }) {
  const { signOut, currentUser } = useAuth();
  const [profile, setProfile] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');

  const loadProfile = useCallback(async ({ refreshing = false } = {}) => {
    try {
      if (refreshing) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }

      setErrorText('');
      const data = await fetchMyProfile();
      setProfile(data);
    } catch (error) {
      setErrorText(error.message || 'Unable to load your profile.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const displayName = profile?.user?.name || currentUser?.name || 'Player';
  const initial = displayName.charAt(0).toUpperCase();
  const stats = profile?.stats || {};

  return (
    <View style={tournamentUi.screen}>
      <ScrollView
        contentContainerStyle={[tournamentUi.content, { paddingBottom: 32 }]}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={() => loadProfile({ refreshing: true })} />}
        showsVerticalScrollIndicator={false}
      >
        <View style={[discoverUi.hero, { marginBottom: 16 }]}>
          <View style={[discoverUi.heroGlow, { top: -40, right: -30 }]} />
          <View style={{ alignItems: 'center', paddingVertical: 8 }}>
            <View
              style={{
                width: 72,
                height: 72,
                borderRadius: 36,
                backgroundColor: 'rgba(37, 99, 235, 0.35)',
                borderWidth: 2,
                borderColor: 'rgba(191, 219, 254, 0.6)',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <Text style={{ color: '#f8fafc', fontSize: 30, fontWeight: '800' }}>{initial}</Text>
            </View>
            <Text style={{ color: '#f8fafc', fontSize: 22, fontWeight: '800' }}>{displayName}</Text>
            <Text style={{ color: '#94a3b8', fontSize: 14, marginTop: 4 }}>{profile?.user?.email || '—'}</Text>
            <Text style={{ color: '#64748b', fontSize: 12, marginTop: 6 }}>
              Member since {formatMemberSince(profile?.user?.memberSince)}
            </Text>
          </View>
        </View>

        {isLoading && (
          <View style={{ paddingVertical: 24, alignItems: 'center' }}>
            <ActivityIndicator color={tournamentColors.primary} />
          </View>
        )}

        {Boolean(errorText) && !isLoading && (
          <View
            style={{
              padding: 14,
              borderRadius: 12,
              backgroundColor: '#fef2f2',
              borderWidth: 1,
              borderColor: '#fecaca',
              marginBottom: 14,
            }}
          >
            <Text style={{ color: '#b91c1c', fontSize: 13, lineHeight: 18 }}>{errorText}</Text>
            <View style={{ marginTop: 10 }}>
              <ActionButton label="Try again" onPress={() => loadProfile()} variant="secondary" fullWidth />
            </View>
          </View>
        )}

        {!isLoading && !errorText && (
          <>
            <SectionCard title="Tournament activity" subtitle="Events you host and join">
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                <StatCard label="Hosted" value={String(stats.tournamentsHosted ?? 0)} accent="#7c3aed" />
                <StatCard label="Joined" value={String(stats.tournamentsJoined ?? 0)} accent="#2563eb" />
                <StatCard label="Pending" value={String(stats.registrationsPending ?? 0)} accent="#b45309" />
              </View>
            </SectionCard>

            <View style={{ marginTop: 14 }}>
              <SectionCard title="Match record" subtitle="Completed matches across your tournaments">
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  <StatCard label="Played" value={String(stats.matchesPlayed ?? 0)} />
                  <StatCard label="Wins" value={String(stats.matchesWon ?? 0)} accent="#166534" />
                  <StatCard label="Losses" value={String(stats.matchesLost ?? 0)} accent="#b91c1c" />
                  <StatCard
                    label="Win rate"
                    value={stats.winRate === null || stats.winRate === undefined ? '—' : `${stats.winRate}%`}
                    accent="#2563eb"
                  />
                </View>
              </SectionCard>
            </View>
          </>
        )}

        <View style={{ marginTop: 20, gap: 10 }}>
          <ActionButton label="Sign out" onPress={signOut} variant="danger" fullWidth />
          <ActionButton label="Back" onPress={() => navigation.goBack()} variant="ghost" fullWidth />
        </View>
      </ScrollView>
    </View>
  );
}
