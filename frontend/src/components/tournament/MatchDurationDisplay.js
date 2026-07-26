import React from 'react';
import { ScaledText as Text } from '../ui/ScaledText';
import { tournamentColors } from '../../styles/tournamentUi';

export function formatMatchDuration(durationMs) {
  if (!Number.isFinite(durationMs) || durationMs <= 0) {
    return '—';
  }

  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}:${String(remainingMinutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }

  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function MatchDurationDisplay({ durationMs, startedAt, status }) {
  if (status === 'scheduled' || (!durationMs && !startedAt)) {
    return <Text style={{ fontSize: 12, color: tournamentColors.mutedIcon }}>—</Text>;
  }

  return (
    <Text style={{ fontSize: 12, color: tournamentColors.mutedIcon, fontWeight: '600' }}>
      {formatMatchDuration(durationMs)}
    </Text>
  );
}
