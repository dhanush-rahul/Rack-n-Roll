import React from 'react';
import { View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { tournamentColors } from '../../styles/tournamentUi';

export function ProgressionFlowPreview({ pipeline = [], errors = [] }) {
  if (!pipeline.length) {
    return null;
  }

  return (
    <View style={{ gap: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        {pipeline.map((step, index) => (
          <React.Fragment key={`${step.label}-${index}`}>
            <View
              style={{
                paddingHorizontal: 10,
                paddingVertical: 6,
                borderRadius: 999,
                backgroundColor: step.byeWarning ? tournamentColors.errorSurface : tournamentColors.primarySoft,
                borderWidth: 1,
                borderColor: step.byeWarning ? tournamentColors.errorBorder : tournamentColors.previewBorder,
              }}
            >
              <Text style={{ fontSize: 12, fontWeight: '700', color: tournamentColors.text }}>
                {step.label}
                {step.count ? ` (${step.count})` : ''}
              </Text>
              {Boolean(step.format) && (
                <Text style={{ fontSize: 11, color: tournamentColors.textMuted }}>
                  {step.format === 'knockout' ? 'Knockout' : 'Round-robin'}
                </Text>
              )}
            </View>
            {index < pipeline.length - 1 && (
              <Text style={{ color: tournamentColors.textMuted, fontWeight: '700' }}>→</Text>
            )}
          </React.Fragment>
        ))}
      </View>
      {pipeline
        .filter((step) => step.byeWarning)
        .map((step) => (
          <Text key={step.label} style={{ fontSize: 12, color: tournamentColors.error }}>
            {step.byeWarning}
          </Text>
        ))}
      {errors.map((error) => (
        <Text key={error} style={{ fontSize: 12, color: tournamentColors.error }}>
          {error}
        </Text>
      ))}
    </View>
  );
}
