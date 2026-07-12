import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';
import { ActionButton, ChipSelector, SectionCard } from './TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';
import { BEST_OF_OPTIONS, createStageId, getKnockoutAdvanceCount, getKnockoutByeCount, getKnockoutPlayedMatchCount } from '../../utils/progressionPlanUtils';

function Stepper({ label, value, onChange, min = 0, max = 32 }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>{label}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable
          onPress={() => onChange(Math.max(min, value - 1))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: tournamentColors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tournamentColors.white,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700' }}>−</Text>
        </Pressable>
        <Text style={{ minWidth: 28, textAlign: 'center', fontWeight: '700' }}>{value}</Text>
        <Pressable
          onPress={() => onChange(Math.min(max, value + 1))}
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: tournamentColors.border,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: tournamentColors.white,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: '700' }}>+</Text>
        </Pressable>
      </View>
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
        <View style={{ gap: 14 }}>
          <View
            style={{
              gap: 6,
              borderWidth: 1,
              borderColor: tournamentColors.border,
              borderRadius: 12,
              padding: 12,
              backgroundColor: '#eff6ff',
            }}
          >
            <Text style={{ fontWeight: '700', color: tournamentColors.text }}>
              This round decides the champion
            </Text>
            <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
              With only {participantCount} player{participantCount === 1 ? '' : 's'} left, there is no next round to
              plan. End the tournament once {sourceStageName} is complete.
            </Text>
          </View>

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
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>Round name</Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => updateDraft({ name })}
            placeholder="e.g. Semi Finals"
            style={{
              borderWidth: 1,
              borderColor: tournamentColors.border,
              borderRadius: 10,
              paddingHorizontal: 12,
              paddingVertical: 10,
              backgroundColor: tournamentColors.white,
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
        <Text style={{ fontSize: 12, lineHeight: 17, color: tournamentColors.textMuted }}>
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

        <View
          style={{
            gap: 6,
            borderWidth: 1,
            borderColor: tournamentColors.border,
            borderRadius: 12,
            padding: 12,
            backgroundColor: '#eff6ff',
          }}
        >
          <Text style={{ fontWeight: '700', color: tournamentColors.text }}>
            {nextRoundCount} player{nextRoundCount === 1 ? '' : 's'} advance from {participantCount} in{' '}
            {sourceStageName}
          </Text>
          <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
            {byeCount > 0
              ? `${playedMatchCount} head-to-head match${playedMatchCount === 1 ? '' : 'es'} plus ${byeCount} bye${byeCount === 1 ? '' : 's'}. `
              : ''}
            {nextRoundName
              ? advanceBeyondCount === 0
                ? `${nextRoundCount} player${nextRoundCount === 1 ? '' : 's'} will play in “${nextRoundName}”. The tournament ends after that round.`
                : `${nextRoundCount} player${nextRoundCount === 1 ? '' : 's'} will play in “${nextRoundName}”. Then ${advanceBeyondCount} advance further.`
              : `${nextRoundCount} player${nextRoundCount === 1 ? '' : 's'} will fill the next round you name above.`}
          </Text>
        </View>

        <View style={{ flexDirection: 'row', gap: 8 }}>
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
