import React from 'react';
import { TournamentSegmentTabs } from '../../components/tournament/TournamentChrome';

export function TournamentTabBar({ activeTab, onSelectTab, shouldShowFinaleTab }) {
  const tabs = [
    { id: 'registrations', label: 'Players' },
    { id: 'groups', label: 'Groups' },
    { id: 'games', label: 'Games' },
  ];

  if (shouldShowFinaleTab) {
    tabs.push({ id: 'finale', label: 'Finale' });
  }

  return <TournamentSegmentTabs tabs={tabs} activeTab={activeTab} onSelectTab={onSelectTab} />;
}
