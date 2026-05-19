import React from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { discoverUi, tournamentColors, tournamentUi } from '../../styles/tournamentUi';

export const formatProgressionLabel = (state) => {
  const labels = {
    registration: 'Registration',
    groupSetup: 'Group setup',
    groupStage: 'Group stage',
    finalStage: 'Finale',
    completed: 'Completed',
  };

  return labels[state] || 'In progress';
};

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
  const content = (
    <View style={discoverUi.hero}>
      <View style={[discoverUi.heroGlow, { top: -40, right: -30 }]} />
      <View style={[discoverUi.heroGlow, { bottom: -50, left: -20, backgroundColor: 'rgba(124, 58, 237, 0.28)' }]} />

      <View style={{ gap: 12 }}>
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
                  padding: 10,
                  borderRadius: 12,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                }}
              >
                <Text style={{ color: '#94a3b8', fontSize: 11, fontWeight: '600' }}>{stat.label}</Text>
                <Text
                  style={{
                    color: stat.accent || '#f8fafc',
                    fontSize: 18,
                    fontWeight: '800',
                    marginTop: 2,
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

export function TournamentSegmentTabs({ tabs, activeTab, onSelectTab }) {
  return (
    <View style={[discoverUi.surfaceCard, { padding: 6, flexDirection: 'row', gap: 6 }]}>
      {tabs.map((tab) => {
        const selected = activeTab === tab.id;

        return (
          <Pressable
            key={tab.id}
            onPress={() => onSelectTab(tab.id)}
            style={({ pressed }) => ({
              flex: 1,
              paddingVertical: 11,
              paddingHorizontal: 6,
              borderRadius: 10,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: selected ? tournamentColors.primary : '#f8fafc',
              borderWidth: 1,
              borderColor: selected ? tournamentColors.primary : tournamentColors.borderLight,
              opacity: pressed ? 0.88 : 1,
            })}
          >
            <Text
              style={{
                color: selected ? tournamentColors.white : tournamentColors.textMuted,
                fontWeight: '700',
                fontSize: 13,
              }}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function SectionCard({ title, subtitle, children, headerAction }) {
  return (
    <View style={[discoverUi.surfaceCard, { gap: 12 }]}>
      {(Boolean(title) || headerAction) && (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
          <View style={{ flex: 1, gap: 4 }}>
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

export function EmptyStateCard({ emoji = '🎱', title, message }) {
  return (
    <View style={[discoverUi.surfaceCard, { alignItems: 'center', paddingVertical: 24, gap: 8 }]}>
      <Text style={{ fontSize: 36 }}>{emoji}</Text>
      <Text style={{ fontSize: 17, fontWeight: '800', color: tournamentColors.text, textAlign: 'center' }}>
        {title}
      </Text>
      <Text style={{ fontSize: 14, lineHeight: 20, color: tournamentColors.textMuted, textAlign: 'center' }}>
        {message}
      </Text>
    </View>
  );
}

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
      <Text style={{ fontSize: 18 }}>👁</Text>
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

export function ActionButton({ label, onPress, disabled, variant = 'primary', fullWidth = false }) {
  const styles = {
    primary: { bg: tournamentColors.primary, text: tournamentColors.white, border: tournamentColors.primary },
    secondary: { bg: tournamentColors.white, text: tournamentColors.primary, border: tournamentColors.primary },
    danger: { bg: '#fef2f2', text: '#b91c1c', border: '#fecaca' },
    ghost: { bg: '#f8fafc', text: tournamentColors.text, border: tournamentColors.border },
    muted: { bg: '#e2e8f0', text: '#64748b', border: '#cbd5e1' },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => ({
        width: fullWidth ? '100%' : undefined,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 11,
        borderWidth: 1,
        borderColor: styles.border,
        backgroundColor: disabled && variant === 'primary' ? tournamentColors.primaryMuted : styles.bg,
        alignItems: 'center',
        opacity: pressed || disabled ? 0.72 : 1,
      })}
    >
      <Text style={{ fontWeight: '700', fontSize: 14, color: styles.text }}>{label}</Text>
    </Pressable>
  );
}

export function ListRowCard({ title, subtitle, children }) {
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        borderRadius: 12,
        padding: 12,
        gap: 8,
        backgroundColor: '#fafbfc',
      }}
    >
      <View style={{ gap: 2 }}>
        <Text style={{ fontWeight: '700', fontSize: 15, color: tournamentColors.text }}>{title}</Text>
        {Boolean(subtitle) && <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>{subtitle}</Text>}
      </View>
      {children}
    </View>
  );
}

const MEDAL_BY_RANK = {
  1: '🥇',
  2: '🥈',
  3: '🥉',
};

const MEDAL_ROW_STYLE_BY_RANK = {
  1: { backgroundColor: '#fffbeb' },
  2: { backgroundColor: '#f8fafc' },
  3: { backgroundColor: '#fff7ed' },
};

export function GroupStandingsCard({
  groupName,
  standings,
  resolvePlayerGameStats,
  showExtendedStats = false,
  showTopThreeMedals = false,
  medalCount = 3,
}) {
  return (
    <View style={discoverUi.listCard}>
      <View style={{ padding: 14, gap: 10 }}>
        <Text style={{ fontSize: 16, fontWeight: '800', color: tournamentColors.text }}>{groupName}</Text>

        {standings.length === 0 ? (
          <Text style={{ color: tournamentColors.textMuted, fontSize: 13 }}>No players in this group yet.</Text>
        ) : (
          <View style={{ borderWidth: 1, borderColor: tournamentColors.borderLight, borderRadius: 10, overflow: 'hidden' }}>
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: '#f8fafc',
                borderBottomWidth: 1,
                borderBottomColor: tournamentColors.borderLight,
                paddingHorizontal: 8,
                paddingVertical: 8,
              }}
            >
              <Text style={{ width: 32, fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>#</Text>
              <Text style={{ flex: 1, fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>Player</Text>
              {showExtendedStats && (
                <>
                  <Text style={{ width: 34, textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>
                    GP
                  </Text>
                  <Text style={{ width: 34, textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>
                    GR
                  </Text>
                </>
              )}
              <Text style={{ width: 30, textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>W</Text>
              <Text style={{ width: 30, textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>L</Text>
              <Text style={{ width: 36, textAlign: 'right', fontWeight: '700', fontSize: 11, color: tournamentColors.textMuted }}>Pts</Text>
            </View>

            {standings.map((entry, index) => {
              const isLastRow = index === standings.length - 1;
              const rankNumber = Number(entry.rank || index + 1);
              const medal =
                showTopThreeMedals && rankNumber >= 1 && rankNumber <= medalCount
                  ? MEDAL_BY_RANK[rankNumber]
                  : null;
              const playerGameStats = resolvePlayerGameStats
                ? resolvePlayerGameStats(entry)
                : { gamesPlayed: 0, gamesRemaining: 0 };

              return (
                <View
                  key={`${groupName}-${entry.playerId}`}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    paddingHorizontal: 8,
                    paddingVertical: 8,
                    borderBottomWidth: isLastRow ? 0 : 1,
                    borderBottomColor: '#f1f5f9',
                    ...(medal ? MEDAL_ROW_STYLE_BY_RANK[rankNumber] || null : null),
                  }}
                >
                  <Text style={{ width: 32, color: tournamentColors.text, fontWeight: '700' }}>
                    {medal ? medal : `#${rankNumber}`}
                  </Text>
                  <Text
                    style={{
                      flex: 1,
                      color: tournamentColors.text,
                      fontWeight: medal ? '700' : '400',
                    }}
                    numberOfLines={1}
                  >
                    {entry.player?.displayName || entry.playerName || entry.playerId}
                  </Text>
                  {showExtendedStats && (
                    <>
                      <Text style={{ width: 34, textAlign: 'right', color: tournamentColors.text }}>
                        {playerGameStats.gamesPlayed}
                      </Text>
                      <Text style={{ width: 34, textAlign: 'right', color: tournamentColors.text }}>
                        {playerGameStats.gamesRemaining}
                      </Text>
                    </>
                  )}
                  <Text style={{ width: 30, textAlign: 'right', color: tournamentColors.text }}>{entry.wins || 0}</Text>
                  <Text style={{ width: 30, textAlign: 'right', color: tournamentColors.text }}>{entry.losses || 0}</Text>
                  <Text style={{ width: 36, textAlign: 'right', color: tournamentColors.text, fontWeight: '700' }}>
                    {entry.points || 0}
                  </Text>
                </View>
              );
            })}
          </View>
        )}
      </View>
    </View>
  );
}

const infoBannerPalettes = {
  info: { bg: '#eff6ff', border: '#bfdbfe', title: '#1e40af', body: '#1d4ed8' },
  success: { bg: '#ecfdf5', border: '#bbf7d0', title: '#166534', body: '#15803d' },
  warning: { bg: '#fff7ed', border: '#fed7aa', title: '#9a3412', body: '#c2410c' },
  neutral: { bg: '#f8fafc', border: tournamentColors.borderLight, title: tournamentColors.text, body: tournamentColors.textMuted },
};

export function InfoBanner({ title, message, tone = 'info', emoji }) {
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
      {Boolean(emoji) && <Text style={{ fontSize: 20 }}>{emoji}</Text>}
      <View style={{ flex: 1, gap: 4 }}>
        {Boolean(title) && <Text style={{ fontWeight: '800', fontSize: 14, color: palette.title }}>{title}</Text>}
        {Boolean(message) && <Text style={{ fontSize: 13, lineHeight: 18, color: palette.body }}>{message}</Text>}
      </View>
    </View>
  );
}

export function TabStatsRow({ stats = [] }) {
  if (stats.length === 0) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {stats.map((stat) => (
        <View
          key={stat.label}
          style={{
            flexGrow: 1,
            minWidth: '28%',
            paddingVertical: 10,
            paddingHorizontal: 12,
            borderRadius: 12,
            backgroundColor: '#f8fafc',
            borderWidth: 1,
            borderColor: tournamentColors.borderLight,
          }}
        >
          <Text style={{ fontSize: 11, fontWeight: '600', color: tournamentColors.textMuted }}>{stat.label}</Text>
          <Text style={{ fontSize: 16, fontWeight: '800', color: stat.accent || tournamentColors.text, marginTop: 2 }}>
            {stat.value}
          </Text>
        </View>
      ))}
    </View>
  );
}

export function ChipSelector({ label, options, value, onChange }) {
  return (
    <View style={{ marginBottom: 4 }}>
      <Text style={{ fontWeight: '700', fontSize: 13, color: tournamentColors.textMuted, marginBottom: 8 }}>{label}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map((option) => {
          const selected = String(value) === String(option.value);

          return (
            <Pressable
              key={option.value}
              onPress={() => onChange(option.value)}
              style={({ pressed }) => ({
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: selected ? tournamentColors.primary : tournamentColors.border,
                backgroundColor: selected ? '#dbeafe' : '#f8fafc',
                opacity: pressed ? 0.88 : 1,
              })}
            >
              <Text
                style={{
                  fontWeight: '700',
                  fontSize: 13,
                  color: selected ? tournamentColors.primary : tournamentColors.textMuted,
                }}
              >
                {option.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export function FixtureSummaryBar({ text }) {
  if (!text) {
    return null;
  }

  return (
    <View
      style={{
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
      }}
    >
      <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.text, lineHeight: 18 }}>{text}</Text>
    </View>
  );
}

export function FixtureFilterPanel({
  playerFilterInput,
  onPlayerFilterInputChange,
  opponentFilterInput,
  onOpponentFilterInputChange,
  onClearFilter,
  onApplyFilter,
  isLoading,
}) {
  return (
    <View
      style={{
        padding: 12,
        borderRadius: 12,
        backgroundColor: '#f8fafc',
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontWeight: '700', fontSize: 13, color: tournamentColors.text, marginBottom: 10 }}>
        Filter matches by player
      </Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 10 }}>
        <TextInput
          style={{ flex: 1, ...tournamentUi.input }}
          placeholder="Player 1"
          value={playerFilterInput}
          onChangeText={onPlayerFilterInputChange}
          onSubmitEditing={onApplyFilter}
          returnKeyType="search"
          autoCapitalize="none"
        />
        <Text style={{ fontWeight: '700', color: tournamentColors.textMuted, fontSize: 13 }}>vs</Text>
        <TextInput
          style={{ flex: 1, ...tournamentUi.input }}
          placeholder="Player 2"
          value={opponentFilterInput}
          onChangeText={onOpponentFilterInputChange}
          onSubmitEditing={onApplyFilter}
          returnKeyType="search"
          autoCapitalize="none"
        />
      </View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <ActionButton label="Clear" onPress={onClearFilter} variant="ghost" fullWidth />
        </View>
        <View style={{ flex: 1 }}>
          <ActionButton
            label={isLoading ? 'Searching…' : 'Apply filter'}
            onPress={onApplyFilter}
            disabled={isLoading}
            fullWidth
          />
        </View>
      </View>
    </View>
  );
}

export function ToolbarIconButton({ label, onPress, disabled }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={{
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: '#f1f5f9',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '700', color: tournamentColors.primary }}>{label}</Text>
    </Pressable>
  );
}
