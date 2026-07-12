import React from 'react';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { tournamentColors } from '../../styles/tournamentUi';

/**
 * Single source of truth for all app icons.
 *
 * Call sites use semantic names (e.g. <AppIcon name="trophy" />) which map to a
 * MaterialCommunityIcons glyph below. To re-skin the entire app with a different
 * icon set, swap the imported set and remap the values here — no call site changes.
 */
const ICON_MAP = {
  // Domain
  pool: 'billiards',
  trophy: 'trophy',
  trophyOutline: 'trophy-outline',
  crown: 'crown',
  target: 'target',
  teams: 'handshake-outline',
  players: 'account-group',
  person: 'account',
  account: 'account-circle',
  chart: 'chart-bar',
  shield: 'shield-outline',
  hand: 'hand-back-left-outline',

  // Content / status
  clipboardList: 'clipboard-text-outline',
  registration: 'clipboard-edit-outline',
  calendar: 'calendar',
  location: 'map-marker',
  search: 'magnify',
  view: 'eye-outline',
  lock: 'lock',
  secure: 'shield-lock-outline',
  logout: 'logout',
  celebrate: 'party-popper',
  warning: 'alert-circle-outline',
  help: 'help-circle-outline',
  info: 'information-outline',
  success: 'check-circle',

  // Controls
  check: 'check',
  close: 'close',
  checkboxOn: 'checkbox-marked',
  checkboxOff: 'checkbox-blank-outline',
  chevronUp: 'chevron-up',
  chevronDown: 'chevron-down',
  chevronLeft: 'chevron-left',
  chevronRight: 'chevron-right',
  arrowRight: 'arrow-right',
  refresh: 'refresh',
  filter: 'filter-variant',
  download: 'download',
  trash: 'trash-can-outline',

  // Medals (color is applied at the call site / defaults below)
  medal: 'medal',
};

export const MEDAL_COLORS = {
  1: '#f59e0b',
  2: '#94a3b8',
  3: '#b45309',
};

export function AppIcon({ name, size = 20, color = tournamentColors.text, style }) {
  const glyph = ICON_MAP[name] || name;

  return <MaterialCommunityIcons name={glyph} size={size} color={color} style={style} />;
}
