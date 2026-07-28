import React, { useMemo, useRef, useState, useCallback } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { ScaledTextInput as TextInput } from '../components/ui/ScaledTextInput';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQueryClient } from '@tanstack/react-query';
import { FeedbackModal } from '../components/FeedbackModal';
import { AppIcon } from '../components/ui/AppIcon';
import { ChipSelector } from '../components/tournament/TournamentChrome';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { invalidateTournamentCache } from '../hooks/queries/invalidateTournamentCache';
import { createTournament } from '../services/tournamentService';
import { HERO_TOP_MARGIN, tournamentColors, tournamentUi } from '../styles/tournamentUi';
import { useTheme } from '../context/ThemeContext';
import { PageColumn } from '../components/layout/PageColumn';
import { useResponsiveLayout } from '../utils/responsive';
import { WebScheduleInputs } from '../components/scheduling/WebScheduleInputs';
import { ProgressionPlanEditor, validateProgressionPlan } from '../components/tournament/ProgressionPlanEditor';
import { WizardTimeline } from '../components/createTournament/WizardTimeline';
import { buildDefaultProgressionState, serializeProgressionPlan } from '../utils/progressionPlanUtils';
import { markIgnoreNextPopState } from '../utils/navigationGuard';

const PLAYER_PRESETS = [8, 16, 32, 64];

const GROUP_STAGE_BEST_OF_OPTIONS = [
  { value: '1', label: 'Best of 1' },
  { value: '3', label: 'Best of 3' },
  { value: '5', label: 'Best of 5' },
  { value: '7', label: 'Best of 7' },
];

const CREATE_WIZARD_TABS = [
  { id: 'details', label: 'Details' },
  { id: 'format', label: 'Format' },
  { id: 'scoring', label: 'Scoring' },
  { id: 'progression', label: 'Progression' },
  { id: 'launch', label: 'Launch' },
];

const getTabIndex = (tabId) => CREATE_WIZARD_TABS.findIndex((tab) => tab.id === tabId);
const getNextTab = (tabId) => CREATE_WIZARD_TABS[getTabIndex(tabId) + 1]?.id ?? null;
const getPrevTab = (tabId) => CREATE_WIZARD_TABS[getTabIndex(tabId) - 1]?.id ?? null;

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
        backgroundColor: tournamentColors.inputFill,
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
        backgroundColor: selected ? tournamentColors.modeSelectedBg : tournamentColors.surfaceRaised,
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

function WizardNavFooter({ activeTab, onBack, onContinue, isLastTab }) {
  const prevTab = getPrevTab(activeTab);
  const nextTab = getNextTab(activeTab);

  if (!prevTab && !nextTab) {
    return null;
  }

  return (
    <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
      {prevTab ? (
        <Pressable
          onPress={onBack}
          style={({ pressed }) => ({
            flex: 1,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            borderWidth: 1,
            borderColor: tournamentColors.border,
            backgroundColor: tournamentColors.inputFill,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Text style={{ color: tournamentColors.text, fontSize: 15, fontWeight: '700' }}>Back</Text>
        </Pressable>
      ) : null}
      {!isLastTab && nextTab ? (
        <Pressable
          onPress={onContinue}
          style={({ pressed }) => ({
            flex: prevTab ? 1.4 : 1,
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            backgroundColor: tournamentColors.primary,
            opacity: pressed ? 0.88 : 1,
          })}
        >
          <Text style={{ color: tournamentColors.onPrimary || '#ffffff', fontSize: 15, fontWeight: '700' }}>Continue</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function CreateTournamentScreen({ navigation, route }) {
  const queryClient = useQueryClient();
  const { isDesktopWeb } = useResponsiveLayout();
  const { scrollPaddingBottom } = useScreenInsets();
  const { colors } = useTheme();
  const defaultStartsAt = useMemo(() => buildDefaultStartsAt(), []);
  const scrollRef = useRef(null);
  const [name, setName] = useState('');
  const [maxParticipants, setMaxParticipants] = useState('');
  const [registrationMode, setRegistrationMode] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [startsAt, setStartsAt] = useState(defaultStartsAt);
  const [activePicker, setActivePicker] = useState(null);
  const [venue, setVenue] = useState('');
  const [groupStageBestOf, setGroupStageBestOf] = useState('');
  const [competitionFormat, setCompetitionFormat] = useState('');
  const [pairFormationMode, setPairFormationMode] = useState('');
  const [handicapEnabled, setHandicapEnabled] = useState(false);
  const [groupStageProctored, setGroupStageProctored] = useState(null);
  const [scoringStyle, setScoringStyle] = useState('');
  const [activeWizardTab, setActiveWizardTab] = useState('details');
  const [visitedWizardTabs, setVisitedWizardTabs] = useState(() => new Set(['details']));
  const [progressionState, setProgressionState] = useState(() => buildDefaultProgressionState());
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorText, setErrorText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successModal, setSuccessModal] = useState({
    visible: false,
    message: '',
    tournamentId: null,
  });

  const previewStartsAt = useMemo(() => formatPreviewDateTime(startsAt), [startsAt]);

  const isFormatSelected = competitionFormat === 'singles' || competitionFormat === 'doubles';
  const isScoringStyleSelected = scoringStyle === 'individualGames' || scoringStyle === 'totalPoints';
  const isBestOfSelected = GROUP_STAGE_BEST_OF_OPTIONS.some((option) => option.value === groupStageBestOf);
  const isRegistrationSelected = registrationMode === 'public' || registrationMode === 'inviteOnly';

  const isTabValid = useCallback(
    (tabId) => {
      const trimmedName = name.trim();
      const parsedPlayers = Number(maxParticipants);
      const trimmedVenue = venue.trim();

      if (tabId === 'details') {
        if (trimmedName.length < 3) return false;
        if (!Number.isInteger(parsedPlayers) || parsedPlayers < 1) return false;
        if (Number.isNaN(startsAt.getTime())) return false;
        if (!trimmedVenue) return false;
        return true;
      }

      if (tabId === 'format') {
        if (!isFormatSelected) return false;
        if (competitionFormat === 'doubles' && pairFormationMode !== 'playerPicksPartner' && pairFormationMode !== 'hostAssigns') {
          return false;
        }
        return true;
      }

      if (tabId === 'scoring') {
        if (!isScoringStyleSelected || !isBestOfSelected) return false;
        if (competitionFormat === 'singles' && groupStageProctored === null) return false;
        return true;
      }

      if (tabId === 'progression') {
        return validateProgressionPlan(progressionState).valid;
      }

      if (tabId === 'launch') {
        if (!isRegistrationSelected) return false;
        if (registrationMode === 'inviteOnly' && inviteCode.trim().length < 4) return false;
        return true;
      }

      return true;
    },
    [
      competitionFormat,
      groupStageBestOf,
      groupStageProctored,
      inviteCode,
      isBestOfSelected,
      isFormatSelected,
      isRegistrationSelected,
      isScoringStyleSelected,
      maxParticipants,
      name,
      pairFormationMode,
      progressionState,
      registrationMode,
      scoringStyle,
      startsAt,
      venue,
    ]
  );

  const isFormFullyValid = useMemo(
    () => CREATE_WIZARD_TABS.every((tab) => isTabValid(tab.id)),
    [isTabValid]
  );

  const getTabStatus = useCallback(
    (tabId) => {
      const activeIndex = getTabIndex(activeWizardTab);
      const tabIndex = getTabIndex(tabId);

      if (tabId === activeWizardTab) {
        return 'current';
      }

      if (!visitedWizardTabs.has(tabId)) {
        if (tabIndex < activeIndex) {
          return 'incomplete';
        }
        return 'upcoming';
      }

      if (isTabValid(tabId)) {
        return 'complete';
      }

      return 'incomplete';
    },
    [activeWizardTab, isTabValid, visitedWizardTabs]
  );

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

  const validateTab = (tabId) => {
    const nextErrors = {};
    const trimmedName = name.trim();
    const parsedPlayers = Number(maxParticipants);
    const trimmedVenue = venue.trim();

    if (tabId === 'details') {
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
    }

    if (tabId === 'format') {
      if (!isFormatSelected) {
        nextErrors.competitionFormat = 'Choose singles or doubles.';
      } else if (
        competitionFormat === 'doubles' &&
        pairFormationMode !== 'playerPicksPartner' &&
        pairFormationMode !== 'hostAssigns'
      ) {
        nextErrors.pairFormationMode = 'Choose how teams form.';
      }
    }

    if (tabId === 'scoring') {
      if (!isScoringStyleSelected) {
        nextErrors.scoringStyle = 'Choose a scoring style.';
      }
      if (!isBestOfSelected) {
        nextErrors.groupStageBestOf = 'Choose games per match for the group stage.';
      }
      if (competitionFormat === 'singles' && groupStageProctored === null) {
        nextErrors.groupStageProctored = 'Choose manual or proctored group-stage scoring.';
      }
    }

    if (tabId === 'progression') {
      const progressionValidation = validateProgressionPlan(progressionState);
      if (!progressionValidation.valid) {
        nextErrors.progression = progressionValidation.errors[0] || 'Fix progression plan errors.';
      }
    }

    if (tabId === 'launch') {
      if (!isRegistrationSelected) {
        nextErrors.registrationMode = 'Choose public or invite-only registration.';
      } else if (registrationMode === 'inviteOnly' && inviteCode.trim().length < 4) {
        nextErrors.inviteCode = 'Invite-only tournaments need a code of at least 4 characters.';
      }
    }

    setFieldErrors((current) => {
      const cleared = { ...current };
      if (tabId === 'details') {
        delete cleared.name;
        delete cleared.maxParticipants;
        delete cleared.schedule;
        delete cleared.venue;
      }
      if (tabId === 'format') {
        delete cleared.competitionFormat;
        delete cleared.pairFormationMode;
      }
      if (tabId === 'scoring') {
        delete cleared.scoringStyle;
        delete cleared.groupStageBestOf;
        delete cleared.groupStageProctored;
      }
      if (tabId === 'progression') {
        delete cleared.progression;
      }
      if (tabId === 'launch') {
        delete cleared.registrationMode;
        delete cleared.inviteCode;
      }
      return { ...cleared, ...nextErrors };
    });

    return Object.keys(nextErrors).length === 0;
  };

  const goToTab = (tabId) => {
    setVisitedWizardTabs((current) => {
      const next = new Set(current);
      next.add(tabId);
      return next;
    });
    setActiveWizardTab(tabId);
    scrollRef.current?.scrollTo({ y: 0, animated: true });
  };

  const onContinue = () => {
    if (!validateTab(activeWizardTab)) {
      setErrorText('Please fix the highlighted fields before continuing.');
      return;
    }

    setErrorText('');
    const nextTab = getNextTab(activeWizardTab);
    if (nextTab) {
      goToTab(nextTab);
    }
  };

  const onBack = () => {
    setErrorText('');
    const prevTab = getPrevTab(activeWizardTab);
    if (prevTab) {
      goToTab(prevTab);
    }
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

    if (!isFormatSelected) {
      nextErrors.competitionFormat = 'Choose singles or doubles.';
    } else if (
      competitionFormat === 'doubles' &&
      pairFormationMode !== 'playerPicksPartner' &&
      pairFormationMode !== 'hostAssigns'
    ) {
      nextErrors.pairFormationMode = 'Choose how teams form.';
    }

    if (!isScoringStyleSelected) {
      nextErrors.scoringStyle = 'Choose a scoring style.';
    }

    if (!isBestOfSelected) {
      nextErrors.groupStageBestOf = 'Choose games per match for the group stage.';
    }

    if (competitionFormat === 'singles' && groupStageProctored === null) {
      nextErrors.groupStageProctored = 'Choose manual or proctored group-stage scoring.';
    }

    if (!isRegistrationSelected) {
      nextErrors.registrationMode = 'Choose public or invite-only registration.';
    }

    if (registrationMode === 'inviteOnly' && inviteCode.trim().length < 4) {
      nextErrors.inviteCode = 'Invite-only tournaments need a code of at least 4 characters.';
    }

    const progressionValidation = validateProgressionPlan(progressionState);
    if (!progressionValidation.valid) {
      nextErrors.progression = progressionValidation.errors[0] || 'Fix progression plan errors.';
    }

    setFieldErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      const errorTabByField = {
        name: 'details',
        maxParticipants: 'details',
        venue: 'details',
        schedule: 'details',
        competitionFormat: 'format',
        pairFormationMode: 'format',
        scoringStyle: 'scoring',
        groupStageBestOf: 'scoring',
        groupStageProctored: 'scoring',
        inviteCode: 'launch',
        registrationMode: 'launch',
        progression: 'progression',
      };
      const firstErrorField = Object.keys(nextErrors)[0];
      setActiveWizardTab(errorTabByField[firstErrorField] || 'details');
      return null;
    }

    return { trimmedName, parsedPlayers, trimmedVenue, startsAt };
  };

  const onSubmit = async () => {
    const validated = validateForm();

    if (!validated) {
      setErrorText('Please fix the highlighted fields on the indicated tab.');
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
          groupCount: progressionState.enabled ? Number(progressionState.plannedGroupCount) : undefined,
          handicapEnabled: competitionFormat === 'doubles' ? false : handicapEnabled,
          groupStageProctored: competitionFormat === 'doubles' ? false : Boolean(groupStageProctored),
          scoringStyle,
        },
        progressionPlan: progressionState.enabled
          ? serializeProgressionPlan(progressionState)
          : { stages: [], deferred: Boolean(progressionState.deferAfterGroups) },
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
      markIgnoreNextPopState();
      navigation.navigate('Discover', { highlightTournamentId: tournamentId });
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
    <KeyboardAvoidingView
      style={{ flex: 1 }}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
    >
      <ScrollView
        ref={scrollRef}
        style={[tournamentUi.screen, isDesktopWeb && { backgroundColor: colors.backgroundAlt }]}
        contentContainerStyle={{ paddingBottom: scrollPaddingBottom }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
      <PageColumn insetStyle={{ paddingTop: 16, gap: 14 }}>
      <View
        style={{
          marginTop: HERO_TOP_MARGIN,
          borderRadius: 16,
          padding: 16,
          backgroundColor: tournamentColors.heroBg,
          gap: 8,
          overflow: 'hidden',
        }}
      >
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: 70,
            top: -40,
            right: -30,
            backgroundColor: tournamentColors.heroGlow,
          }}
        />
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: 140,
            height: 140,
            borderRadius: 70,
            bottom: -50,
            left: -20,
            backgroundColor: tournamentColors.heroGlowAlt,
          }}
        />
        <Text style={{ color: tournamentColors.heroBodyText, fontSize: 14, lineHeight: 20 }}>
          Set up your tournament once. Rack-N-Roll handles registration, groups, and scoring from there.
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          <Text style={previewPillTextStyle}>Host Dashboard</Text>
        </View>
      </View>

      <WizardTimeline
        tabs={CREATE_WIZARD_TABS}
        activeTab={activeWizardTab}
        onSelectTab={goToTab}
        getTabIndex={getTabIndex}
        getTabStatus={getTabStatus}
      />

      {activeWizardTab === 'details' && (
        <>
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
                    backgroundColor: selected ? tournamentColors.chipSelectedBg : tournamentColors.surfaceRaised,
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

        <View style={{ gap: 6 }}>
          <FieldLabel>Tournament held at</FieldLabel>
          <TextInput
            style={tournamentUi.input}
            placeholder="e.g. Rack House Billiards, 120 Main St, Toronto"
            value={venue}
            onChangeText={(value) => {
              setVenue(value);
              setFieldErrors((current) => ({ ...current, venue: '' }));
            }}
          />
          {Boolean(fieldErrors.venue) && <Text style={errorTextStyle}>{fieldErrors.venue}</Text>}
        </View>
      </SectionCard>

      <SectionCard title="Schedule" subtitle="Pick when play begins.">
        {Platform.OS === 'web' ? (
          <WebScheduleInputs
            value={startsAt}
            onChange={(nextDate) => {
              setStartsAt(nextDate);
              setFieldErrors((current) => ({ ...current, schedule: '' }));
            }}
            dateLabel="Start date"
            timeLabel="Start time"
            minDate={new Date()}
          />
        ) : (
          <>
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
                  backgroundColor: tournamentColors.inputFill,
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
          </>
        )}

        {Boolean(fieldErrors.schedule) && <Text style={errorTextStyle}>{fieldErrors.schedule}</Text>}
      </SectionCard>
        </>
      )}

      {activeWizardTab === 'format' && (
      <SectionCard title="Competition format" subtitle="Singles or doubles for the entire tournament.">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ModeOption
            label="Singles"
            description="One player per side. Handicap and proctored scoring available."
            selected={competitionFormat === 'singles'}
            onPress={() => {
              setCompetitionFormat('singles');
              setGroupStageProctored(null);
              setFieldErrors((current) => ({ ...current, competitionFormat: '', pairFormationMode: '' }));
            }}
          />
          <ModeOption
            label="Doubles"
            description="Two players per team. Manual team scoring only; handicap is off."
            selected={competitionFormat === 'doubles'}
            onPress={() => {
              setCompetitionFormat('doubles');
              setGroupStageProctored(false);
              setFieldErrors((current) => ({ ...current, competitionFormat: '', pairFormationMode: '' }));
            }}
          />
        </View>
        {Boolean(fieldErrors.competitionFormat) && <Text style={errorTextStyle}>{fieldErrors.competitionFormat}</Text>}

        {competitionFormat === 'doubles' && (
          <View style={{ marginTop: 12, gap: 8 }}>
            <FieldLabel>How teams form</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <ModeOption
                label="Players pick"
                description="Approved players choose a solo partner after joining."
                selected={pairFormationMode === 'playerPicksPartner'}
                onPress={() => {
                  setPairFormationMode('playerPicksPartner');
                  setFieldErrors((current) => ({ ...current, pairFormationMode: '' }));
                }}
              />
              <ModeOption
                label="Host assigns"
                description="You form or break teams from the Players tab."
                selected={pairFormationMode === 'hostAssigns'}
                onPress={() => {
                  setPairFormationMode('hostAssigns');
                  setFieldErrors((current) => ({ ...current, pairFormationMode: '' }));
                }}
              />
            </View>
            {Boolean(fieldErrors.pairFormationMode) && <Text style={errorTextStyle}>{fieldErrors.pairFormationMode}</Text>}
          </View>
        )}
      </SectionCard>
      )}

      {activeWizardTab === 'scoring' && (
      <>
      <SectionCard title="Scoring style" subtitle="How match scores are entered and counted tournament-wide.">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ModeOption
            label="Individual games"
            description="One score box per game in the series (best-of format)."
            selected={scoringStyle === 'individualGames'}
            onPress={() => {
              setScoringStyle('individualGames');
              setFieldErrors((current) => ({ ...current, scoringStyle: '' }));
            }}
          />
          <ModeOption
            label="Total points"
            description="One running total per player for the whole match."
            selected={scoringStyle === 'totalPoints'}
            onPress={() => {
              setScoringStyle('totalPoints');
              setFieldErrors((current) => ({ ...current, scoringStyle: '' }));
            }}
          />
        </View>
        {Boolean(fieldErrors.scoringStyle) && <Text style={errorTextStyle}>{fieldErrors.scoringStyle}</Text>}
      </SectionCard>

      <SectionCard title="Match format" subtitle="Group-stage series length before later stages (finale configured in Progression).">
        <ChipSelector
          label="Games per match (group stage)"
          options={GROUP_STAGE_BEST_OF_OPTIONS}
          value={groupStageBestOf}
          onChange={(value) => {
            setGroupStageBestOf(value);
            setFieldErrors((current) => ({ ...current, groupStageBestOf: '' }));
          }}
        />
        {Boolean(fieldErrors.groupStageBestOf) && <Text style={errorTextStyle}>{fieldErrors.groupStageBestOf}</Text>}
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
            backgroundColor: handicapEnabled ? tournamentColors.modeSelectedBg : tournamentColors.surfaceRaised,
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
              description="Players and host enter scores in the match table on the Games tab."
              selected={groupStageProctored === false}
              onPress={() => {
                setGroupStageProctored(false);
                setFieldErrors((current) => ({ ...current, groupStageProctored: '' }));
              }}
            />
            <ModeOption
              label="Proctored"
              description="Assigned proctors run live match scoring with lag and takeover."
              selected={groupStageProctored === true}
              onPress={() => {
                setGroupStageProctored(true);
                setFieldErrors((current) => ({ ...current, groupStageProctored: '' }));
              }}
            />
          </View>
          {Boolean(fieldErrors.groupStageProctored) && (
            <Text style={errorTextStyle}>{fieldErrors.groupStageProctored}</Text>
          )}
        </View>
        )}
      </SectionCard>
      </>
      )}

      {activeWizardTab === 'progression' && (
      <SectionCard
        title="After groups"
        subtitle="Name your own stages, pick knockout or round-robin, and chain advancement rules."
      >
        <ProgressionPlanEditor
          value={progressionState}
          onChange={setProgressionState}
          competitionFormat={competitionFormat}
          fieldError={fieldErrors.progression}
        />
      </SectionCard>
      )}

      {activeWizardTab === 'launch' && (
      <>
      <SectionCard title="Registration" subtitle="Choose who can request a spot.">
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <ModeOption
            label="Public"
            description="Anyone on Discover can request to join."
            selected={registrationMode === 'public'}
            onPress={() => {
              setRegistrationMode('public');
              setFieldErrors((current) => ({ ...current, registrationMode: '' }));
            }}
          />
          <ModeOption
            label="Invite only"
            description="Players need your invite code to register."
            selected={registrationMode === 'inviteOnly'}
            onPress={() => {
              setRegistrationMode('inviteOnly');
              setFieldErrors((current) => ({ ...current, registrationMode: '' }));
            }}
          />
        </View>
        {Boolean(fieldErrors.registrationMode) && <Text style={errorTextStyle}>{fieldErrors.registrationMode}</Text>}

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

      <View
        style={{
          borderRadius: 14,
          borderWidth: 1,
          borderColor: tournamentColors.previewBorder,
          backgroundColor: tournamentColors.previewBg,
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
        <Text style={{ color: tournamentColors.textMuted }}>
          {competitionFormat === 'doubles'
            ? 'Doubles'
            : competitionFormat === 'singles'
              ? 'Singles'
              : 'Format not set'}
          {' · '}
          {scoringStyle === 'totalPoints'
            ? 'Total points'
            : scoringStyle === 'individualGames'
              ? 'Individual games'
              : 'Scoring not set'}
          {groupStageBestOf ? ` · Bo${groupStageBestOf} group stage` : ' · Group stage not set'}
        </Text>
      </View>

      {Boolean(errorText) && activeWizardTab === 'launch' && <Text style={errorTextStyle}>{errorText}</Text>}

        <Pressable
          onPress={onSubmit}
          disabled={isSubmitting || !isFormFullyValid}
          style={({ pressed }) => ({
            backgroundColor:
              isSubmitting || !isFormFullyValid ? tournamentColors.primaryMuted : tournamentColors.primary,
            borderRadius: 12,
            paddingVertical: 16,
            alignItems: 'center',
            opacity: pressed || isSubmitting || !isFormFullyValid ? 0.85 : 1,
          })}
        >
          <Text style={{ color: tournamentColors.onPrimary || '#ffffff', fontSize: 16, fontWeight: '700' }}>
            {isSubmitting ? 'Creating tournament...' : 'Launch tournament'}
          </Text>
        </Pressable>
      </>
      )}

      {Boolean(errorText) && <Text style={errorTextStyle}>{errorText}</Text>}

      <WizardNavFooter
        activeTab={activeWizardTab}
        onBack={onBack}
        onContinue={onContinue}
        isLastTab={activeWizardTab === 'launch'}
      />
      </PageColumn>
      </ScrollView>
    </KeyboardAvoidingView>
  </>
  );
}

const previewPillTextStyle = {
  color: tournamentColors.previewPill,
  fontSize: 12,
  fontWeight: '600',
  backgroundColor: tournamentColors.previewPillBg,
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
