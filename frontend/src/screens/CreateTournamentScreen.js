import React, { useMemo, useState } from 'react';
import { Platform, Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '../components/ui/ScaledTextInput';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { FeedbackModal } from '../components/FeedbackModal';
import { AppIcon } from '../components/ui/AppIcon';
import { ChipSelector } from '../components/tournament/TournamentChrome';
import { StickyFooterScreen } from '../components/layout/ScreenLayout';
import { invalidateTournamentCache } from '../hooks/queries/invalidateTournamentCache';
import { createTournament } from '../services/tournamentService';
import { tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { useResponsiveLayout, centeredContentStyle } from '../utils/responsive';

const PLAYER_PRESETS = [8, 16, 32, 64];

const GROUP_STAGE_BEST_OF_OPTIONS = [
  { value: '1', label: 'Best of 1' },
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
];

const buildDefaultStartsAt = () => {
  const defaultStart = new Date();
  defaultStart.setDate(defaultStart.getDate() + 7);
  defaultStart.setHours(18, 0, 0, 0);
  return defaultStart;
};

const formatPickerDate = (date) =>
  date.toLocaleDateString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

const formatPickerTime = (date) =>
  date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });

const formatPreviewDateTime = (date) =>
  date.toLocaleString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

function SectionCard({ title, subtitle, children }) {
  return (
    <View style={[tournamentUi.card, { gap: 12 }]}>
      <View style={{ gap: 4 }}>
        <Text style={{ fontSize: 16, fontWeight: '700', color: tournamentColors.text }}>{title}</Text>
        {Boolean(subtitle) && (
          <Text style={{ fontSize: 13, lineHeight: 18, color: tournamentColors.textMuted }}>{subtitle}</Text>
        )}
      </View>
      {children}
    </View>
  );
}

function FieldLabel({ children }) {
  return <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>{children}</Text>;
}

function PickerField({ label, value, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        borderWidth: 1,
        borderColor: tournamentColors.border,
        borderRadius: 10,
        padding: 12,
        backgroundColor: tournamentColors.white,
        opacity: pressed ? 0.9 : 1,
        gap: 6,
      })}
    >
      <FieldLabel>{label}</FieldLabel>
      <Text style={{ fontSize: 15, fontWeight: '600', color: tournamentColors.text }}>{value}</Text>
    </Pressable>
  );
}

function ModeOption({ label, description, selected, onPress }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => ({
        flex: 1,
        borderWidth: 2,
        borderColor: selected ? tournamentColors.primary : tournamentColors.border,
        borderRadius: 12,
        padding: 12,
        backgroundColor: selected ? '#eff6ff' : tournamentColors.white,
        opacity: pressed ? 0.9 : 1,
        gap: 4,
      })}
    >
      <Text style={{ fontWeight: '700', color: selected ? tournamentColors.primary : tournamentColors.text }}>
        {label}
      </Text>
      <Text style={{ fontSize: 12, lineHeight: 16, color: tournamentColors.textMuted }}>{description}</Text>
    </Pressable>
  );
}

export function CreateTournamentScreen({ navigation }) {
  const queryClient = useQueryClient();
  const { contentMaxWidth } = useResponsiveLayout();
  const defaultStartsAt = useMemo(() => buildDefaultStartsAt(), []);
  const [name, setName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('16');
  const [registrationMode, setRegistrationMode] = useState('public');
  const [inviteCode, setInviteCode] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [activePicker, setActivePicker] = useState(null);
  const [venue, setVenue] = useState('');
  const [groupStageBestOf, setGroupStageBestOf] = useState('3');
  const [competitionFormat, setCompetitionFormat] = useState('singles');
  const [pairFormationMode, setPairFormationMode] = useState('playerPicksPartner');
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [groupStageProctored, setGroupStageProctored] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState({
    visible: false,
    message: '',
    tournamentId: null,
  });

  const previewStartsAt = useMemo(() => formatPreviewDateTime(startsAt), [startsAt]);

  const onSchedulePickerChange = (event, selectedDate) => {
    if (Platform.OS === 'android') {
      setActivePicker(null);
    }

    if (event?.type === 'dismissed') {
      return;
    }

    if (!selectedDate) {
      return;
    }

    setStartsAt((previous) => {
      const next = new Date(previous);

      if (activePicker === 'date') {
        next.setFullYear(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
      } else if (activePicker === 'time') {
        next.setHours(selectedDate.getHours(), selectedDate.getMinutes(), 0, 0);
      }

      return next;
    });
    setFieldErrors((current) => ({ ...current, schedule: '' }));
  };

  const validateForm = () => {
    const nextErrors = {};
    const trimmedName = name.trim();
    const parsedPlayers = Number(maxParticipants);
    const trimmedVenue = venue.trim();

    if (trimmedName.length < 3) {
      nextErrors.name = 'Tournament name must be at least 3 characters.';
    }

    if (!Number.isInteger(parsedPlayers) || parsedPlayers < 1) {
      nextErrors.maxParticipants = 'Enter a whole number of players (at least 1).';
    }

    if (Number.isNaN(startsAt.getTime())) {
      nextErrors.schedule = 'Pick a valid start date and time.';
    }

    if (!trimmedVenue) {
      nextErrors.venue = 'Tell players where the tournament is held.';
    }

    if (registrationMode === 'inviteOnly' && inviteCode.trim().length < 4) {
      nextErrors.inviteCode = 'Invite-only tournaments need a code of at least 4 characters.';
    }

    setFieldErrors(nextErrors);
    return Object.keys(nextErrors).length === 0 ? { trimmedName, parsedPlayers, trimmedVenue, startsAt } : null;
  };

  const onSubmit = async () => {
    const validated = validateForm();

    if (!validated) {
      setErrorText('Please fix the highlighted fields.');
      return;
    }

    try {
      setErrorText('');
      setIsSubmitting(true);

      const payload = {
        name: validated.trimmedName,
        maxParticipants: validated.parsedPlayers,
        registrationMode,
        registrationStatus: 'open',
        startsAt: validated.startsAt.toISOString(),
        ...(registrationMode === 'inviteOnly' ? { inviteCode: inviteCode.trim().toUpperCase() } : {}),
        location: {
          formattedAddress: validated.trimmedVenue,
        },
        competitionConfig: {
          format: competitionFormat,
          pairFormationMode: competitionFormat === 'doubles' ? pairFormationMode : undefined,
          groupStageBestOf: Number(groupStageBestOf),
          handicapEnabled: competitionFormat === 'doubles' ? false : handicapEnabled,
          groupStageProctored: competitionFormat === 'doubles' ? false : groupStageProctored,
        },
      };

      const createdTournament = await createTournament(payload);
      await invalidateTournamentCache(queryClient);
      setSuccessModal({
        visible: true,
        message: `"${createdTournament.name}" is live on Discover.`,
        tournamentId: createdTournament.id,
      });
      setName('');
      setVenue('');
      setInviteCode('');
      setFieldErrors({});
    } catch (error) {
      const message =
        error.code === 'NETWORK_ERROR'
          ? 'Server is waking up. Please wait a moment and try again.'
          : error.message || 'Unable to create tournament';
      setErrorText(`${error.code || 'ERROR'}: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const onSuccessDismiss = () => {
    const tournamentId = successModal.tournamentId;
    setSuccessModal({ visible: false, message: '', tournamentId: null });

    if (tournamentId) {
      navigation.navigate('Home', { highlightTournamentId: tournamentId });
    }
  };

  return (
  <>
    <FeedbackModal
      visible={successModal.visible}
      title="Tournament launched!"
      message={successModal.message}
      icon="celebrate"
      dismissLabel="View on Discover"
      onDismiss={onSuccessDismiss}
    />
    <StickyFooterScreen
      style={tournamentUi.screen}
      keyboardAvoiding
      contentContainerStyle={[centeredContentStyle(contentMaxWidth), { gap: 14 }]}
      footer={
        <Pressable
          onPress={onSubmit}
          disabled={isSubmitting}
          style={({ pressed }) => ({
            backgroundColor: isSubmitting ? tournamentColors.primaryMuted : tournamentColors.primary,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed || isSubmitting ? 0.85 : 1,
          })}
        >
          <Text style={{ color: tournamentColors.white, fontSize: 16, fontWeight: '700' }}>
            {isSubmitting ? 'Creating tournament...' : 'Launch tournament'}
          </Text>
        </Pressable>
      }
    >
      <View
        style={{
          borderRadius: 16,
          padding: 16,
          backgroundColor: '#0f172a',
          gap: 8,
        }}
      >
        <Text style={{ color: '#e2e8f0', fontSize: 14, lineHeight: 20 }}>
          Set up your tournament once. Rack-N-Roll handles registration, groups, and scoring from there.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Text style={previewPillStyle}>Host Dashboard</Text>
          
        </View>
      </View>

      <SectionCard title="Tournament details" subtitle="What players will see first on Discover.">
        <View style={{ gap: 6 }}>
          <FieldLabel>Tournament name</FieldLabel>
          <TextInput
            style={tournamentUi.input}
            placeholder="e.g. Friday Night 9-Ball Open"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setFieldErrors((current) => ({ ...current, name: '' }));
            }}
          />
          {Boolean(fieldErrors.name) && <Text style={errorTextStyle}>{fieldErrors.name}</Text>}
        </View>

        <View style={{ gap: 8 }}>
          <FieldLabel>Number of players</FieldLabel>
          <TextInput
            style={tournamentUi.input}
            placeholder="16"
            keyboardType="number-pad"
            value={maxParticipants}
            onChangeText={(value) => {
              setMaxParticipants(value.replace(/[^\d]/g, ''));
              setFieldErrors((current) => ({ ...current, maxParticipants: '' }));
            }}
          />
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {PLAYER_PRESETS.map((preset) => {
              const selected = Number(maxParticipants) === preset;

              return (
                <Pressable
                  key={preset}
                  onPress={() => {
                    setMaxParticipants(String(preset));
                    setFieldErrors((current) => ({ ...current, maxParticipants: '' }));
                  }}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 8,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: selected ? tournamentColors.primary : tournamentColors.border,
                    backgroundColor: selected ? '#dbeafe' : tournamentColors.white,
                  }}
                >
                  <Text style={{ fontWeight: '600', color: selected ? tournamentColors.primary : tournamentColors.text }}>
                    {preset} players
                  </Text>
                </Pressable>
              );
            })}
          </View>
          {Boolean(fieldErrors.maxParticipants) && <Text style={errorTextStyle}>{fieldErrors.maxParticipants}</Text>}
        </View>
      </SectionCard>

      <SectionCard title="Competition format" subtitle="Singles or doubles for the entire tournament.">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ModeOption
            label="Singles"
            description="One player per side. Handicap and proctored scoring available."
            selected={competitionFormat === 'singles'}
            onPress={() => setCompetitionFormat('singles')}
          />
          <ModeOption
            label="Doubles"
            description="Two players per team. Manual team scoring only; handicap is off."
            selected={competitionFormat === 'doubles'}
            onPress={() => setCompetitionFormat('doubles')}
          />
        </View>

        {competitionFormat === 'doubles' && (
          <View style={{ marginTop: 12, gap: 8 }}>
            <FieldLabel>How teams form</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ModeOption
                label="Players pick"
                description="Approved players choose a solo partner after joining."
                selected={pairFormationMode === 'playerPicksPartner'}
                onPress={() => setPairFormationMode('playerPicksPartner')}
              />
              <ModeOption
                label="Host assigns"
                description="You form or break teams from the Players tab."
                selected={pairFormationMode === 'hostAssigns'}
                onPress={() => setPairFormationMode('hostAssigns')}
              />
            </View>
          </View>
        )}
      </SectionCard>

      <SectionCard title="Match format" subtitle="Group-stage series length before the finale (finale configured later).">
        <ChipSelector
          label="Games per match (group stage)"
          options={GROUP_STAGE_BEST_OF_OPTIONS}
          value={groupStageBestOf}
          onChange={setGroupStageBestOf}
        />
        {competitionFormat === 'singles' && (
        <Pressable
          onPress={() => setHandicapEnabled((current) => !current)}
          style={({ pressed }) => ({
            marginTop: 12,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            padding: 12,
            borderRadius: 10,
            borderWidth: 1,
            borderColor: handicapEnabled ? tournamentColors.primary : tournamentColors.border,
            backgroundColor: handicapEnabled ? '#eff6ff' : tournamentColors.white,
            opacity: pressed ? 0.9 : 1,
          })}
        >
          <AppIcon
            name={handicapEnabled ? 'checkboxOn' : 'checkboxOff'}
            size={22}
            color={handicapEnabled ? tournamentColors.primary : tournamentColors.textMuted}
          />
          <View style={{ flex: 1 }}>
            <Text style={{ fontWeight: '700', color: tournamentColors.text }}>Use handicap in standings</Text>
            <Text style={{ fontSize: 12, color: tournamentColors.textMuted, marginTop: 2 }}>
              Lower handicap = stronger player (APA-style). Copies profile handicap when players join.
            </Text>
          </View>
        </Pressable>
        )}
        {competitionFormat === 'singles' && (
        <View style={{ marginTop: 12, gap: 8 }}>
          <FieldLabel>Group-stage scoring</FieldLabel>
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <ModeOption
              label="Manual"
              description="Players and host enter scores in a grid on the Games tab."
              selected={!groupStageProctored}
              onPress={() => setGroupStageProctored(false)}
            />
            <ModeOption
              label="Proctored"
              description="Assigned proctors run live match scoring with leg and takeover."
              selected={groupStageProctored}
              onPress={() => setGroupStageProctored(true)}
            />
          </View>
        </View>
        )}
      </SectionCard>

      <SectionCard title="Registration" subtitle="Choose who can request a spot.">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ModeOption
            label="Public"
            description="Anyone on Discover can request to join."
            selected={registrationMode === 'public'}
            onPress={() => setRegistrationMode('public')}
          />
          <ModeOption
            label="Invite only"
            description="Players need your invite code to register."
            selected={registrationMode === 'inviteOnly'}
            onPress={() => setRegistrationMode('inviteOnly')}
          />
        </View>

        {registrationMode === 'inviteOnly' && (
          <View style={{ gap: 6 }}>
            <FieldLabel>Invite code</FieldLabel>
            <TextInput
              style={tournamentUi.input}
              placeholder="e.g. RACK2026"
              value={inviteCode}
              onChangeText={(value) => {
                setInviteCode(value);
                setFieldErrors((current) => ({ ...current, inviteCode: '' }));
              }}
              autoCapitalize="characters"
            />
            {Boolean(fieldErrors.inviteCode) && <Text style={errorTextStyle}>{fieldErrors.inviteCode}</Text>}
          </View>
        )}
      </SectionCard>

      <SectionCard title="Schedule" subtitle="Tap to pick when play begins.">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <PickerField
            label="Start date"
            value={formatPickerDate(startsAt)}
            onPress={() => setActivePicker((current) => (current === 'date' ? null : 'date'))}
          />
          <PickerField
            label="Start time"
            value={formatPickerTime(startsAt)}
            onPress={() => setActivePicker((current) => (current === 'time' ? null : 'time'))}
          />
        </View>

        {activePicker && (
          <View
            style={{
              borderWidth: 1,
              borderColor: tournamentColors.border,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: tournamentColors.white,
            }}
          >
            <DateTimePicker
              value={startsAt}
              mode={activePicker}
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={onSchedulePickerChange}
              minimumDate={activePicker === 'date' ? new Date() : undefined}
            />
            {Platform.OS === 'ios' && (
              <Pressable
                onPress={() => setActivePicker(null)}
                style={{
                  paddingVertical: 12,
                  alignItems: 'center',
                  borderTopWidth: 1,
                  borderTopColor: tournamentColors.borderLight,
                }}
              >
                <Text style={{ fontWeight: '700', color: tournamentColors.primary }}>Done</Text>
              </Pressable>
            )}
          </View>
        )}

        {Boolean(fieldErrors.schedule) && <Text style={errorTextStyle}>{fieldErrors.schedule}</Text>}
      </SectionCard>

      <SectionCard title="Location" subtitle="One place name or address — no map coordinates needed.">
        <View style={{ gap: 6 }}>
          <FieldLabel>Tournament held at</FieldLabel>
          <TextInput
            style={[tournamentUi.input, { minHeight: 88, textAlignVertical: 'top' }]}
            placeholder="e.g. Rack House Billiards, 120 Main St, Toronto"
            value={venue}
            onChangeText={(value) => {
              setVenue(value);
              setFieldErrors((current) => ({ ...current, venue: '' }));
            }}
            multiline
          />
          {Boolean(fieldErrors.venue) && <Text style={errorTextStyle}>{fieldErrors.venue}</Text>}
        </View>
      </SectionCard>

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: '#bfdbfe',
          backgroundColor: '#f8fafc',
          padding: 14,
          gap: 6,
        }}
      >
        <Text style={{ fontSize: 13, fontWeight: '700', color: tournamentColors.textMuted }}>Preview</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: tournamentColors.text }}>
          {name.trim() || 'Your tournament name'}
        </Text>
        <Text style={{ color: tournamentColors.textMuted }}>
          {maxParticipants || '—'} players · {previewStartsAt}
        </Text>
        <Text style={{ color: tournamentColors.textMuted }}>
          {venue.trim() || 'Venue not set yet'}
        </Text>
      </View>

      {Boolean(errorText) && <Text style={errorTextStyle}>{errorText}</Text>}
    </StickyFooterScreen>
  </>
  );
}

const previewPillStyle = {
  color: '#cbd5e1',
  fontSize: 12,
  fontWeight: '600',
  backgroundColor: 'rgba(148, 163, 184, 0.2)',
  paddingHorizontal: 10,
  paddingVertical: 5,
  borderRadius: 999,
  overflow: 'hidden',
};

const errorTextStyle = {
  color: tournamentColors.error,
  fontSize: 13,
  lineHeight: 18,
};
