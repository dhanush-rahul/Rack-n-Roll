import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';
import { ActionButton, ChipSelector, SectionCard } from './TournamentChrome';
import { useTheme } from '../../context/ThemeContext';
import { useTypography } from '../../context/TypographyContext';
import { BEST_OF_OPTIONS, createStageId, getKnockoutAdvanceCount, getKnockoutByeCount, getKnockoutPlayedMatchCount } from '../../utils/progressionPlanUtils';

function Stepper({ label, value, onChange, min = 0, max = 32 }) {
  const { colors } = useTheme();
  const { sp, fs } = useTypography();
  const controlSize = sp(36);

  return (
    <View style={{ gap: sp(6) }}>
      <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.textMuted }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: sp(10) }}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={{
            width: controlSize,
            height: controlSize,
            borderRadius: sp(8),
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.inputFill,
          }}
        >
          <Text style={{ fontSize: fs(18), fontWeight: '700', color: colors.text }}>−</Text>
        </Pressable>
        <Text style={{ minWidth: sp(28), textAlign: 'center', fontWeight: '700', color: colors.text, fontSize: fs(15) }}>
          {value}
        </Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={{
            width: controlSize,
            height: controlSize,
            borderRadius: sp(8),
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: colors.inputFill,
          }}
        >
          <Text style={{ fontSize: fs(18), fontWeight: '700', color: colors.text }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InfoCallout({ children }) {
  const { colors } = useTheme();
  const { sp, fs } = useTypography();

  return (
    <View
      style={{
        gap: sp(6),
        borderWidth: 1,
        borderColor: colors.border,
        borderRadius: sp(12),
        padding: sp(12),
        backgroundColor: colors.primarySoft,
      }}
    >
      {children({ colors, fs })}
    </View>
  );
}

export function buildDefaultNextStageDraft({ participantCount = 6, bestOf = '3' } = {}) {
  const defaultAdvanceCount = getKnockoutAdvanceCount(participantCount);

  return {
    stageId: createStageId(),
    name: '',
    format: 'knockout',
    bestOf: String(bestOf),
    proctored: false,
    advanceCount: 0,
    sourceAdvanceCount: defaultAdvanceCount,
    selectionMode: 'autoStandings',
    poolMode: 'combined',
  };
}

export function StageToStageProgressionPanel({
  sourceStageName = 'this stage',
  participantCount = 0,
  defaultBestOf = '3',
  isProgressing = false,
  onContinue,
  onEndTournament,
  existingStageName = null,
  isLastConfiguredStage = false,
}) {
  const { colors } = useTheme();
  const { sp, fs } = useTypography();
  const [draft, setDraft] = useState(() =>
    buildDefaultNextStageDraft({ participantCount, bestOf: defaultBestOf })
  );

  useEffect(() => {
    setDraft(buildDefaultNextStageDraft({ participantCount, bestOf: defaultBestOf }));
  }, [participantCount, defaultBestOf]);

  const nextRoundCount = useMemo(
    () => Math.max(Number(draft.sourceAdvanceCount) || getKnockoutAdvanceCount(participantCount), 1),
    [draft.sourceAdvanceCount, participantCount]
  );

  const playedMatchCount = useMemo(
    () => getKnockoutPlayedMatchCount(participantCount),
    [participantCount]
  );

  const byeCount = useMemo(() => getKnockoutByeCount(participantCount), [participantCount]);

  const advanceBeyondMax = useMemo(() => {
    if (draft.format === 'knockout') {
      return getKnockoutAdvanceCount(nextRoundCount);
    }

    return Math.max(nextRoundCount, 0);
  }, [draft.format, nextRoundCount]);

  const nextRoundName = String(draft.name || '').trim();

  const canSubmit =
    Boolean(existingStageName) ||
    (String(draft.name || '').trim().length >= 2 &&
      Number(draft.sourceAdvanceCount) >= 1 &&
      Number(draft.advanceCount) >= 0 &&
      !isProgressing);

  const advanceBeyondCount = Number(draft.advanceCount ?? 0);

  const updateDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const isChampionshipRound = participantCount <= 2;

  if (isChampionshipRound) {
    return (
      <SectionCard
        title="Finish tournament"
        subtitle={`${participantCount} player${participantCount === 1 ? '' : 's'} remain in ${sourceStageName}.`}
      >
        <View style={{ gap: sp(14) }}>
          <InfoCallout>
            {({ colors: calloutColors, fs: calloutFs }) => (
              <>
                <Text style={{ fontWeight: '700', color: calloutColors.text, fontSize: calloutFs(14) }}>
                  This round decides the champion
                </Text>
                <Text style={{ fontSize: calloutFs(13), color: calloutColors.textMuted, lineHeight: calloutFs(18) }}>
                  With only {participantCount} player{participantCount === 1 ? '' : 's'} left, there is no next round to
                  plan. End the tournament once {sourceStageName} is complete.
                </Text>
              </>
            )}
          </InfoCallout>

          <ActionButton
            label={isProgressing ? 'Working…' : 'End tournament'}
            onPress={onEndTournament}
            disabled={isProgressing}
            fullWidth
          />
        </View>
      </SectionCard>
    );
  }

  return (
    <SectionCard
      title={existingStageName ? `Continue to ${existingStageName}` : 'Plan the next round'}
      subtitle={`Set up the round after ${sourceStageName}.`}
    >
      <View style={{ gap: sp(14) }}>
        <View style={{ gap: sp(6) }}>
          <Text style={{ fontSize: fs(13), fontWeight: '600', color: colors.textMuted }}>Round name</Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => updateDraft({ name })}
            placeholder="e.g. Semi Finals"
            placeholderTextColor={colors.placeholder}
            style={{
              borderWidth: 1,
              borderColor: colors.border,
              borderRadius: sp(10),
              paddingHorizontal: sp(12),
              paddingVertical: sp(10),
              backgroundColor: colors.inputFill,
              color: colors.text,
            }}
          />
        </View>

        <Stepper
          label={
            nextRoundName
              ? `Players advancing to ${nextRoundName}`
              : `Players advancing from ${sourceStageName}`
          }
          value={Number(draft.sourceAdvanceCount ?? nextRoundCount)}
          onChange={(sourceAdvanceCount) => updateDraft({ sourceAdvanceCount })}
          min={1}
          max={Math.max(participantCount, 1)}
        />
        <Text style={{ fontSize: fs(12), lineHeight: fs(17), color: colors.textMuted }}>
          How many players from {sourceStageName} will play in the next round.
        </Text>

        <Stepper
          label={nextRoundName ? `Advance beyond ${nextRoundName}` : 'Advance beyond next round'}
          value={advanceBeyondCount}
          onChange={(advanceCount) => updateDraft({ advanceCount })}
          min={0}
          max={Math.max(advanceBeyondMax, 0)}
        />

        <ChipSelector
          label="Stage format"
          options={[
            { value: 'knockout', label: 'Knockout' },
            { value: 'roundRobin', label: 'Round robin' },
          ]}
          value={draft.format}
          onChange={(format) => updateDraft({ format })}
        />

        <ChipSelector
          label="Series length"
          options={BEST_OF_OPTIONS}
          value={String(draft.bestOf)}
          onChange={(bestOf) => updateDraft({ bestOf })}
        />

        <InfoCallout>
          {({ colors: calloutColors, fs: calloutFs }) => (
            <>
              <Text style={{ fontWeight: '700', color: calloutColors.text, fontSize: calloutFs(14) }}>
                {nextRoundCount} player{nextRoundCount === 1 ? '' : 's'} advance from {participantCount} in{' '}
                {sourceStageName}
              </Text>
              <Text style={{ fontSize: calloutFs(13), color: calloutColors.textMuted, lineHeight: calloutFs(18) }}>
                {byeCount > 0
                  ? `${playedMatchCount} head-to-head match${playedMatchCount === 1 ? '' : 'es'} plus ${byeCount} bye${byeCount === 1 ? '' : 's'}. `
                  : ''}
                {nextRoundName
                  ? advanceBeyondCount === 0
                    ? `${nextRoundCount} player${nextRoundCount === 1 ? '' : 's'} will play in “${nextRoundName}”. The tournament ends after that round.`
                    : `${nextRoundCount} player${nextRoundCount === 1 ? '' : 's'} will play in “${nextRoundName}”. Then ${advanceBeyondCount} advance further.`
                  : `${nextRoundCount} player${nextRoundCount === 1 ? '' : 's'} will fill the next round you name above.`}
              </Text>
            </>
          )}
        </InfoCallout>

        <View style={{ flexDirection: 'row', gap: sp(8) }}>
          <View style={{ flex: 1 }}>
            <ActionButton
              label={isProgressing ? 'Working…' : existingStageName ? `Set up ${existingStageName}` : 'Continue'}
              onPress={() => onContinue?.(draft)}
              disabled={!canSubmit}
              fullWidth
            />
          </View>
          {isLastConfiguredStage ? (
            <View style={{ flex: 1 }}>
              <ActionButton
                label="End tournament"
                onPress={onEndTournament}
                disabled={isProgressing}
                fullWidth
              />
            </View>
          ) : null}
        </View>
      </View>
    </SectionCard>
  );
}
