import React, { useMemo } from 'react';
import { Pressable, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { ScaledTextInput as TextInput } from '../ui/ScaledTextInput';
import { ChipSelector, InfoBanner } from './TournamentChrome';
import { ProgressionFlowPreview } from './ProgressionFlowPreview';
import { tournamentColors } from '../../styles/tournamentUi';
import {
  BEST_OF_OPTIONS,
  GROUP_COUNT_OPTIONS,
  buildBlankStage,
  buildFourStageKnockoutTemplate,
  buildSingleFinaleTemplate,
  createStageId,
  validateProgressionPlan,
} from '../../utils/progressionPlanUtils';

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
      {Boolean(description) && (
        <Text style={{ fontSize: 12, lineHeight: 16, color: tournamentColors.textMuted }}>{description}</Text>
      )}
    </Pressable>
  );
}

function Stepper({ label, value, onChange, min = 1, max = 64 }) {
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

export function ProgressionPlanEditor({
  value,
  onChange,
  competitionFormat = 'singles',
  fieldError = '',
}) {
  const validation = useMemo(() => validateProgressionPlan(value), [value]);

  const update = (patch) => onChange({ ...value, ...patch });

  const updateStage = (stageId, patch) => {
    update({
      stages: value.stages.map((stage) => (stage.stageId === stageId ? { ...stage, ...patch } : stage)),
    });
  };

  const removeStage = (stageId) => {
    update({
      stages: value.stages
        .filter((stage) => stage.stageId !== stageId)
        .map((stage, index) => ({ ...stage, order: index + 1 })),
    });
  };

  const moveStage = (stageId, direction) => {
    const index = value.stages.findIndex((stage) => stage.stageId === stageId);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= value.stages.length) return;
    const nextStages = [...value.stages];
    const [removed] = nextStages.splice(index, 1);
    nextStages.splice(targetIndex, 0, removed);
    update({ stages: nextStages.map((stage, orderIndex) => ({ ...stage, order: orderIndex + 1 })) });
  };

  return (
    <View style={{ gap: 14 }}>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <ModeOption
          label="Decide after groups"
          description="Configure knockout or round-robin stages once group play is underway."
          selected={!value.enabled && value.deferAfterGroups}
          onPress={() => update({ enabled: false, deferAfterGroups: true, stages: [] })}
        />
        <ModeOption
          label="Configure now"
          description="Add custom named stages with knockout or round-robin formats."
          selected={value.enabled}
          onPress={() => update({ enabled: true, deferAfterGroups: false })}
        />
        <ModeOption
          label="End after groups"
          description="Medal top players per group when group play finishes."
          selected={!value.enabled && !value.deferAfterGroups}
          onPress={() => update({ enabled: false, deferAfterGroups: false, stages: [] })}
        />
      </View>

      {!value.enabled && value.deferAfterGroups && (
        <InfoBanner
          tone="primary"
          title="Progression decided later"
          message="After group-stage games, you will name each round (Quarter Finals, Semis, etc.) and choose how players advance."
        />
      )}

      {value.enabled && (
        <>
          <ChipSelector
            label="Planned group count"
            options={GROUP_COUNT_OPTIONS.map((count) => ({ value: count, label: `${count} groups` }))}
            value={value.plannedGroupCount}
            onChange={(next) => update({ plannedGroupCount: next })}
          />

          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {[
              { label: 'Single finale', onPress: () => onChange(buildSingleFinaleTemplate()) },
              { label: '4-stage knockout', onPress: () => onChange(buildFourStageKnockoutTemplate()) },
              {
                label: 'Blank stage',
                onPress: () =>
                  update({
                    stages: [...value.stages, buildBlankStage(value.stages.length + 1)],
                  }),
              },
            ].map((template) => (
              <Pressable
                key={template.label}
                onPress={template.onPress}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: tournamentColors.border,
                  backgroundColor: tournamentColors.white,
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.primary }}>
                  {template.label}
                </Text>
              </Pressable>
            ))}
          </View>

          <ProgressionFlowPreview pipeline={validation.pipeline} errors={validation.errors} />

          {value.stages.map((stage, index) => {
            const isLast = index === value.stages.length - 1;
            return (
              <View
                key={stage.stageId}
                style={{
                  borderWidth: 1,
                  borderColor: tournamentColors.border,
                  borderRadius: 12,
                  padding: 12,
                  gap: 12,
                  backgroundColor: tournamentColors.white,
                }}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontWeight: '700', color: tournamentColors.text }}>Stage {index + 1}</Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <Pressable onPress={() => moveStage(stage.stageId, -1)}>
                      <Text style={{ color: tournamentColors.primary, fontWeight: '700' }}>↑</Text>
                    </Pressable>
                    <Pressable onPress={() => moveStage(stage.stageId, 1)}>
                      <Text style={{ color: tournamentColors.primary, fontWeight: '700' }}>↓</Text>
                    </Pressable>
                    <Pressable onPress={() => removeStage(stage.stageId)}>
                      <Text style={{ color: '#b91c1c', fontWeight: '700' }}>Remove</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={{ gap: 6 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: tournamentColors.textMuted }}>Name</Text>
                  <TextInput
                    style={{ borderWidth: 1, borderColor: tournamentColors.border, borderRadius: 10, padding: 10 }}
                    value={stage.name}
                    onChangeText={(name) => updateStage(stage.stageId, { name })}
                    placeholder="e.g. Quarter Final"
                  />
                </View>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <ModeOption
                    label="Knockout"
                    selected={stage.format === 'knockout'}
                    onPress={() => updateStage(stage.stageId, { format: 'knockout' })}
                  />
                  <ModeOption
                    label="Round-robin"
                    selected={stage.format === 'roundRobin'}
                    onPress={() => updateStage(stage.stageId, { format: 'roundRobin' })}
                  />
                </View>

                <ChipSelector
                  label="Best of"
                  options={BEST_OF_OPTIONS}
                  value={String(stage.bestOf)}
                  onChange={(bestOf) => updateStage(stage.stageId, { bestOf })}
                />

                {competitionFormat === 'singles' && (
                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    <ModeOption
                      label="Manual scoring"
                      selected={!stage.proctored}
                      onPress={() => updateStage(stage.stageId, { proctored: false })}
                    />
                    <ModeOption
                      label="Proctored"
                      selected={stage.proctored}
                      onPress={() => updateStage(stage.stageId, { proctored: true })}
                    />
                  </View>
                )}

                {index === 0 && (
                  <Stepper
                    label="Advance from each group"
                    value={Number(stage.topPerGroup || 2)}
                    onChange={(topPerGroup) => updateStage(stage.stageId, { topPerGroup })}
                    max={8}
                  />
                )}

                {!isLast && (
                  <Stepper
                    label="Advance to next stage"
                    value={Number(stage.advanceCount || 2)}
                    onChange={(advanceCount) => updateStage(stage.stageId, { advanceCount })}
                    max={128}
                  />
                )}

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <ModeOption
                    label="Auto from standings"
                    selected={stage.selectionMode !== 'hostManual'}
                    onPress={() => updateStage(stage.stageId, { selectionMode: 'autoStandings' })}
                  />
                  <ModeOption
                    label="Host picks"
                    selected={stage.selectionMode === 'hostManual'}
                    onPress={() => updateStage(stage.stageId, { selectionMode: 'hostManual' })}
                  />
                </View>
              </View>
            );
          })}

          <Pressable
            onPress={() =>
              update({
                stages: [...value.stages, { ...buildBlankStage(value.stages.length + 1), stageId: createStageId() }],
              })
            }
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 10,
              backgroundColor: tournamentColors.primary,
            }}
          >
            <Text style={{ color: '#fff', fontWeight: '700' }}>Add stage</Text>
          </Pressable>
        </>
      )}

      {Boolean(fieldError) && <Text style={{ color: '#b91c1c', fontSize: 13 }}>{fieldError}</Text>}
    </View>
  );
}

export { validateProgressionPlan };
