export { ActionButton } from './ActionButton';
export { TournamentScreenHero } from './TournamentScreenHero';
export { TournamentSegmentTabs } from './TournamentSegmentTabs';
export { SectionCard, CollapsibleSectionCard } from './SectionCard';
export { EmptyStateCard } from './EmptyStateCard';
export { ReadOnlyBanner, SuccessBanner, InfoBanner } from './Banners';
export { ListRowCard } from './ListRowCard';
export { GroupStandingsCard } from './GroupStandingsCard';
export { TabStatsRow } from './TabStatsRow';
export { ChipSelector } from './ChipSelector';
export { FixtureSummaryBar } from './FixtureSummaryBar';
export { FixtureFilterPanel } from './FixtureFilterPanel';
export { ToolbarIconButton } from './ToolbarIconButton';

export const formatProgressionLabel = (state) => {
  const labels = {
    registration: 'Registration',
    groupSetup: 'Group setup',
    groupStage: 'Group stage',
    stageActive: 'Stage active',
    finalStage: 'Finale',
    completed: 'Completed',
  };
  return labels[state] || 'In progress';
};
