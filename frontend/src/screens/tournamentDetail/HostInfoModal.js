import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  ToastAndroid,
  useWindowDimensions,
  View,
} from 'react-native';
import { ScaledText as Text } from '../../components/ui/ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActionButton, formatProgressionLabel } from '../../components/tournament/TournamentChrome';
import { tournamentColors, tournamentUi } from '../../styles/tournamentUi';

function formatRegistrationMode(mode) {
  if (mode === 'inviteOnly') {
    return 'Invite only';
  }

  if (mode === 'public') {
    return 'Public';
  }

  return mode || '—';
}

function formatRegistrationStatus(status) {
  if (status === 'open') {
    return 'Open';
  }

  if (status === 'closed') {
    return 'Closed';
  }

  return status || '—';
}

function InfoRow({ label, value, isLast = false }) {
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: 12,
        paddingVertical: 10,
        borderBottomWidth: isLast ? 0 : 1,
        borderBottomColor: tournamentColors.borderLight,
      }}
    >
      <Text style={{ color: tournamentColors.textMuted, fontSize: 13, flex: 1 }}>{label}</Text>
      <Text
        style={{
          color: tournamentColors.text,
          fontWeight: '600',
          fontSize: 13,
          flex: 1.2,
          textAlign: 'right',
        }}
      >
        {value}
      </Text>
    </View>
  );
}

function SnapshotSection({ title, children }) {
  return (
    <View
      style={{
        borderRadius: 14,
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
        backgroundColor: '#fafbfc',
        padding: 14,
        marginBottom: 12,
      }}
    >
      <Text style={{ fontSize: 14, fontWeight: '800', color: tournamentColors.text, marginBottom: 10 }}>{title}</Text>
      {children}
    </View>
  );
}

function StatusPill({ label, tone = 'neutral' }) {
  const palette = {
    neutral: { bg: '#f1f5f9', text: '#475569', border: '#e2e8f0' },
    primary: { bg: '#dbeafe', text: '#1d4ed8', border: '#bfdbfe' },
    success: { bg: '#dcfce7', text: '#166534', border: '#bbf7d0' },
    warning: { bg: '#fef3c7', text: '#b45309', border: '#fde68a' },
  }[tone];

  return (
    <View
      style={{
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: palette.bg,
        borderWidth: 1,
        borderColor: palette.border,
      }}
    >
      <Text style={{ color: palette.text, fontSize: 11, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

function StatChip({ label, value, accent }) {
  return (
    <View
      style={{
        flex: 1,
        minWidth: '30%',
        paddingVertical: 10,
        paddingHorizontal: 10,
        borderRadius: 12,
        backgroundColor: tournamentColors.white,
        borderWidth: 1,
        borderColor: tournamentColors.borderLight,
      }}
    >
      <Text style={{ fontSize: 11, fontWeight: '600', color: tournamentColors.textMuted }}>{label}</Text>
      <Text
        style={{
          marginTop: 2,
          fontSize: 16,
          fontWeight: '800',
          color: accent || tournamentColors.text,
        }}
        numberOfLines={1}
      >
        {value}
      </Text>
    </View>
  );
}

function InviteCodeRow({ inviteCode }) {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    await Clipboard.setStringAsync(inviteCode);

    if (Platform.OS === 'android') {
      ToastAndroid.show('Invite code copied', ToastAndroid.SHORT);
    } else {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <View
      style={{
        marginTop: 4,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#fde68a',
        backgroundColor: '#fffbeb',
      }}
    >
      <Text style={{ color: '#b45309', fontSize: 12, fontWeight: '700' }}>Invite code</Text>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
          marginTop: 8,
        }}
      >
        <Text
          selectable
          style={{
            color: tournamentColors.text,
            fontSize: 22,
            fontWeight: '800',
            letterSpacing: 2,
            flex: 1,
          }}
        >
          {inviteCode}
        </Text>
        <Pressable
          onPress={onCopy}
          style={({ pressed }) => ({
            paddingVertical: 8,
            paddingHorizontal: 14,
            borderRadius: 10,
            backgroundColor: pressed ? '#1d4ed8' : tournamentColors.primary,
          })}
        >
          <Text style={{ color: tournamentColors.white, fontWeight: '700', fontSize: 13 }}>
            {copied ? 'Copied' : 'Copy'}
          </Text>
        </Pressable>
      </View>
      <Text style={{ color: tournamentColors.textMuted, fontSize: 11, marginTop: 8, lineHeight: 16 }}>
        Share this code so players can register.
      </Text>
    </View>
  );
}

export function HostInfoModal({
  visible,
  detail,
  isLoadingDetail,
  isLoadingRegistrations,
  isExporting = false,
  isEmailExporting = false,
  onClose,
  onRefresh,
  onExport,
  onEmailExport,
}) {
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const isInviteOnly = detail?.registrationMode === 'inviteOnly';
  const inviteCode = detail?.inviteCode || '';
  const isRefreshing = isLoadingDetail || isLoadingRegistrations;
  const sheetHeight = Math.min(windowHeight * 0.88, windowHeight - insets.top - 16);

  return (
    <Modal animationType="slide" transparent visible={visible} onRequestClose={onClose}>
      <View style={[tournamentUi.modalOverlay, { justifyContent: 'flex-end', padding: 0 }]}>
        <Pressable style={tournamentUi.modalBackdrop} onPress={onClose} />

        <View
          style={{
            height: sheetHeight,
            backgroundColor: tournamentColors.white,
            borderTopLeftRadius: 20,
            borderTopRightRadius: 20,
            overflow: 'hidden',
          }}
        >
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 10,
              paddingBottom: 12,
            }}
            showsVerticalScrollIndicator
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
            bounces
          >
            <View style={{ alignItems: 'center', marginBottom: 12 }}>
              <View
                style={{
                  width: 36,
                  height: 4,
                  borderRadius: 2,
                  backgroundColor: tournamentColors.border,
                }}
              />
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ color: tournamentColors.textMuted, fontSize: 11, fontWeight: '700', letterSpacing: 0.8 }}>
                  HOST SNAPSHOT
                </Text>
                <Text
                  style={{ color: tournamentColors.text, fontSize: 20, fontWeight: '800', marginTop: 4, lineHeight: 26 }}
                  numberOfLines={2}
                >
                  {detail?.name || 'Tournament'}
                </Text>
              </View>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                style={({ pressed }) => ({
                  width: 32,
                  height: 32,
                  borderRadius: 16,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderWidth: 1,
                  borderColor: tournamentColors.borderLight,
                  backgroundColor: pressed ? '#f1f5f9' : tournamentColors.white,
                })}
              >
                <Text style={{ color: tournamentColors.textMuted, fontSize: 20, lineHeight: 22 }}>×</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              <StatusPill label={formatProgressionLabel(detail?.progressionState)} tone="primary" />
              <StatusPill
                label={`Reg ${formatRegistrationStatus(detail?.registrationStatus)}`}
                tone={detail?.registrationStatus === 'closed' ? 'warning' : 'success'}
              />
              {isInviteOnly && <StatusPill label="Invite only" tone="warning" />}
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              <StatChip label="Approved" value={String(detail?.approvedParticipantsCount ?? 0)} accent="#2563eb" />
              <StatChip label="Pending" value={String(detail?.pendingParticipantsCount ?? 0)} accent="#b45309" />
              <StatChip label="Target" value={String(detail?.maxParticipants ?? '—')} />
            </View>

            <SnapshotSection title="Overview">
              <InfoRow label="Registration mode" value={formatRegistrationMode(detail?.registrationMode)} />
              <InfoRow
                label="Progression"
                value={formatProgressionLabel(detail?.progressionState)}
                isLast={!isInviteOnly || !inviteCode}
              />
              {isInviteOnly && Boolean(inviteCode) && <InviteCodeRow inviteCode={inviteCode} />}
            </SnapshotSection>

            <SnapshotSection title="Competition">
              <InfoRow label="Groups" value={String(detail?.competitionConfig?.groupCount ?? '—')} />
              <InfoRow
                label="Group stage"
                value={`Best of ${detail?.competitionConfig?.groupStageBestOf ?? 1} · double RR`}
              />
              <InfoRow
                label="Finale series"
                value={`Best of ${detail?.competitionConfig?.finalStageBestOf ?? '—'}`}
                isLast
              />
            </SnapshotSection>

            {Boolean(detail?.location?.formattedAddress || detail?.location?.city) && (
              <SnapshotSection title="Location">
                <Text style={{ fontSize: 13, lineHeight: 19, color: tournamentColors.text }}>
                  {detail?.location?.formattedAddress || detail?.location?.city || '—'}
                </Text>
              </SnapshotSection>
            )}
          </ScrollView>

          <View
            style={{
              paddingHorizontal: 16,
              paddingTop: 12,
              paddingBottom: Math.max(insets.bottom, 14),
              borderTopWidth: 1,
              borderTopColor: tournamentColors.borderLight,
              backgroundColor: '#f8fafc',
              gap: 8,
            }}
          >
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <View style={{ flex: 1 }}>
                <ActionButton
                  label={isExporting ? 'Exporting…' : 'Export as Excel'}
                  onPress={onExport}
                  disabled={isExporting || isRefreshing || isEmailExporting}
                  fullWidth
                />
              </View>
              <View style={{ flex: 1 }}>
                <ActionButton
                  label={isEmailExporting ? 'Emailing…' : 'Email Export'}
                  onPress={onEmailExport}
                  disabled={isEmailExporting || isRefreshing || isExporting}
                  variant="secondary"
                  fullWidth
                />
              </View>
            </View>
            <ActionButton
              label={isRefreshing ? 'Refreshing…' : 'Refresh snapshot'}
              onPress={onRefresh}
              disabled={isRefreshing || isExporting || isEmailExporting}
              fullWidth
            />
            <ActionButton label="Close" onPress={onClose} variant="ghost" fullWidth />
          </View>
        </View>
      </View>
    </Modal>
  );
}
