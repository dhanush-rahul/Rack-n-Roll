import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';
import { ActionButton, ChipSelector, InfoBanner, SectionCard } from './TournamentChrome';
import { tournamentColors } from '../../styles/tournamentUi';
import { BEST_OF_OPTIONS, createStageId } from '../../utils/progressionPlanUtils';

const POOL_MODE_OPTIONS = [
  {
    value: 'combined',
    label: 'All together',
    description:
      'All advancing players go into one bracket. Matchups follow standings (1st vs last, 2nd vs 2nd-last, etc.).',
  },
  {
    value: 'groupPairKnockout',
    label: 'Group-pair knockout',
    description: 'Pair groups (A vs B, C vs D) into separate knockout brackets.',
  },
  {
    value: 'randomKnockout',
    label: 'Random knockout',
    description:
      'Same players as “All together”, but matchups are shuffled randomly instead of by standings.',
  },
];

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

export function buildDefaultRuntimeStageDraft(groupCount = 4) {
  const isEvenGroups = Number(groupCount) % 2 === 0;
  return {
    stageId: createStageId(),
    name: '',
    format: 'knockout',
    bestOf: '3',
    proctored: false,
    topPerGroup: 3,
    advanceCount: 2,
    selectionMode: 'autoStandings',
    poolMode: isEvenGroups ? 'combined' : 'randomKnockout',
    directPromotePerGroup: 0,
    bypassTargetStageName: '',
    advancePerGroupPair: 1,
    showBypassOptions: false,
  };
}

export function GroupStageProgressionPanel({
  groupCount = 0,
  groupLabels = [],
  isProgressing = false,
  isLoadingPreview = false,
  preview = null,
  onPreview,
  onContinue,
  onEndAfterGroups,
  existingStageName = null,
}) {
  const [draft, setDraft] = useState(() => buildDefaultRuntimeStageDraft(groupCount));

  const previewGroups = preview?.groups?.length ? preview.groups : [];

  const effectiveGroupCount = Math.max(
    Number(preview?.groupCount) || 0,
    previewGroups.length,
    groupLabels.length,
    Number(groupCount) || 0,
    0
  );

  const isEvenGroupCount = effectiveGroupCount > 0 && effectiveGroupCount % 2 === 0;
  const availablePoolModes = useMemo(
    () =>
      POOL_MODE_OPTIONS.filter((option) => {
        if (option.value === 'groupPairKnockout') {
          return isEvenGroupCount;
        }
        return true;
      }),
    [isEvenGroupCount]
  );

  useEffect(() => {
    if (!isEvenGroupCount && draft.poolMode === 'groupPairKnockout') {
      setDraft((current) => ({ ...current, poolMode: 'randomKnockout' }));
    }
  }, [draft.poolMode, isEvenGroupCount]);

  useEffect(() => {
    if (!onPreview) return;
    const timer = setTimeout(() => {
      onPreview(draft);
    }, 250);
    return () => clearTimeout(timer);
  }, [draft, onPreview]);

  const updateDraft = (patch) => setDraft((current) => ({ ...current, ...patch }));

  const selectedPoolMode = availablePoolModes.find((option) => option.value === draft.poolMode);

  const summary = useMemo(() => {
    const groups = effectiveGroupCount;
    const directPromotePerGroup = Math.max(Number(draft.directPromotePerGroup) || 0, 0);
    const showBypass = Boolean(draft.showBypassOptions) && directPromotePerGroup > 0;

    const advancePerGroup = showBypass
      ? Math.max(Number(draft.topPerGroup) - directPromotePerGroup, 0)
      : Math.max(Number(draft.topPerGroup) || 0, 0);

    const totalInStage = groups * advancePerGroup;
    const totalBypass = groups * directPromotePerGroup;

    return {
      groups,
      advancePerGroup,
      totalInStage,
      totalBypass,
      showBypass,
      directPromotePerGroup,
    };
  }, [
    draft.directPromotePerGroup,
    draft.showBypassOptions,
    draft.topPerGroup,
    effectiveGroupCount,
  ]);

  const displayGroups = useMemo(() => {
    if (previewGroups.length > 0) {
      return previewGroups;
    }

    return Array.from({ length: effectiveGroupCount }, (_, index) => ({
      divisionName: groupLabels[index] || `Group ${index + 1}`,
      configuredAdvanceCount: summary.advancePerGroup,
      readyAdvanceCount: null,
    }));
  }, [effectiveGroupCount, groupLabels, previewGroups, summary.advancePerGroup]);

  const canSubmit =
    Boolean(existingStageName) ||
    (String(draft.name || '').trim().length >= 2 &&
      summary.advancePerGroup > 0 &&
      summary.totalInStage > 0 &&
      !isProgressing);

  return (
    <SectionCard
      title={existingStageName ? `Continue to ${existingStageName}` : 'Plan the next stage'}
      subtitle="Pick how many players move on from each group, then name the round."
    >
      <View style={{ gap: 14 }}>
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>Stage name</Text>
          <TextInput
            value={draft.name}
            onChangeText={(name) => updateDraft({ name })}
            placeholder='e.g. Quarter Finals'
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

        <View style={{ gap: 6 }}>
          <Stepper
            label="Advance per group"
            value={Number(draft.topPerGroup || 1)}
            onChange={(topPerGroup) => updateDraft({ topPerGroup })}
            min={1}
            max={16}
          />
          <Text style={{ fontSize: 12, lineHeight: 17, color: tournamentColors.textMuted }}>
            Players from each group who move into this stage. Example: 3 per group with 2 groups = 6 players
            total.
          </Text>
        </View>

        {!draft.showBypassOptions ? (
          <Pressable onPress={() => updateDraft({ showBypassOptions: true })}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.primary }}>
              + Some players skip to a later round
            </Text>
          </Pressable>
        ) : (
          <View
            style={{
              gap: 10,
              borderWidth: 1,
              borderColor: tournamentColors.border,
              borderRadius: 10,
              padding: 12,
              backgroundColor: '#f8fafc',
            }}
          >
            <Text style={{ fontWeight: '700', color: tournamentColors.text }}>Skip this stage (optional)</Text>
            <Text style={{ fontSize: 12, lineHeight: 17, color: tournamentColors.textMuted }}>
              Split qualifiers: top players jump ahead, the rest play this stage. Example: 4 qualify per group,
              1 skips to Semis, positions 2–4 play Quarter Finals.
            </Text>
            <Stepper
              label="Skip per group (direct promote)"
              value={Number(draft.directPromotePerGroup || 0)}
              onChange={(directPromotePerGroup) =>
                updateDraft({
                  directPromotePerGroup,
                  topPerGroup: Math.max(Number(draft.topPerGroup), directPromotePerGroup + 1),
                })
              }
              min={0}
              max={Math.max(Number(draft.topPerGroup || 1) - 1, 0)}
            />
            {Number(draft.directPromotePerGroup) > 0 && (
              <View style={{ gap: 6 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>
                  Later round name
                </Text>
                <TextInput
                  value={draft.bypassTargetStageName}
                  onChangeText={(bypassTargetStageName) => updateDraft({ bypassTargetStageName })}
                  placeholder='e.g. Semis'
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
            )}
            <Pressable
              onPress={() =>
                updateDraft({ showBypassOptions: false, directPromotePerGroup: 0, bypassTargetStageName: '' })
              }
            >
              <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>Remove skip option</Text>
            </Pressable>
          </View>
        )}

        <ChipSelector
          label="Stage format"
          options={[
            { value: 'knockout', label: 'Knockout' },
            { value: 'roundRobin', label: 'Round robin' },
          ]}
          value={draft.format}
          onChange={(format) =>
            updateDraft({
              format,
              poolMode: format === 'roundRobin' ? 'combined' : draft.poolMode,
            })
          }
        />

        {draft.format === 'knockout' && (
          <View style={{ gap: 6 }}>
            <ChipSelector
              label="How qualifiers are matched"
              options={availablePoolModes.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              value={draft.poolMode}
              onChange={(poolMode) => updateDraft({ poolMode })}
            />
            {Boolean(selectedPoolMode?.description) && (
              <Text style={{ fontSize: 12, lineHeight: 17, color: tournamentColors.textMuted }}>
                {selectedPoolMode.description}
              </Text>
            )}
          </View>
        )}

        <ChipSelector
          label="Series length"
          options={BEST_OF_OPTIONS}
          value={String(draft.bestOf)}
          onChange={(bestOf) => updateDraft({ bestOf })}
        />

        <View
          style={{
            gap: 8,
            borderWidth: 1,
            borderColor: tournamentColors.border,
            borderRadius: 12,
            padding: 12,
            backgroundColor: '#eff6ff',
          }}
        >
          <Text style={{ fontWeight: '700', fontSize: 16, color: tournamentColors.text }}>
            {summary.totalInStage} player{summary.totalInStage === 1 ? '' : 's'}
            {draft.name.trim() ? ` in “${draft.name.trim()}”` : ' in this stage'}
          </Text>
          <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
            {summary.advancePerGroup} from each of {summary.groups} group{summary.groups === 1 ? '' : 's'} (
            {summary.advancePerGroup} × {summary.groups} = {summary.totalInStage})
          </Text>
          {summary.showBypass && summary.totalBypass > 0 && (
            <Text style={{ fontSize: 13, color: tournamentColors.textMuted }}>
              + {summary.totalBypass} player{summary.totalBypass === 1 ? '' : 's'} skip straight to{' '}
              {draft.bypassTargetStageName || 'a later round'}
            </Text>
          )}

          {isLoadingPreview && (
            <Text style={{ fontSize: 12, color: tournamentColors.textMuted }}>Updating group breakdown…</Text>
          )}

          {displayGroups.map((group) => {
            const target = group.configuredAdvanceCount ?? summary.advancePerGroup;
            const ready = group.readyAdvanceCount;
            const label = group.divisionName || 'Group';

            if (ready == null) {
              return (
                <Text key={label} style={{ fontSize: 13, color: tournamentColors.textMuted }}>
                  {label}: {target} player{target === 1 ? '' : 's'} will advance
                </Text>
              );
            }

            const standingsReady = group.standingsReadyCount ?? ready;
            const needsStandings = standingsReady < target;

            return (
              <Text key={label} style={{ fontSize: 13, color: tournamentColors.textMuted }}>
                {label}: {target} player{target === 1 ? '' : 's'} advancing
                {needsStandings
                  ? ` (${standingsReady} confirmed in standings so far — finish group games to confirm the rest)`
                  : ' (standings ready)'}
              </Text>
            );
          })}
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
          <View style={{ flex: 1 }}>
            <ActionButton
              label="End after groups"
              onPress={onEndAfterGroups}
              disabled={isProgressing}
              fullWidth
              variant="secondary"
            />
          </View>
        </View>
      </View>
    </SectionCard>
  );
}
