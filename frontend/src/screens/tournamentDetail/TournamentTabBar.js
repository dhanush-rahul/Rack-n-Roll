import React, { useMemo } from 'react';
import { TournamentSegmentTabs } from '../../components/tournament/TournamentChrome';

export function TournamentTabBar({ activeTab, onSelectTab, stageTabs = [], showGamesTab = false }) {
  const tabs = useMemo(() => {
    const base = [
      { id: 'registrations', label: 'Players' },
      { id: 'groups', label: 'Groups' },
    ];

    if (showGamesTab) {
      base.push({ id: 'games', label: 'Games' });
    }

    stageTabs.forEach((stage) => {
      base.push({
        id: `stage:${stage.stageId}`,
        label: stage.name,
        muted: stage.status === 'locked',
      });
    });

    return base;
  }, [showGamesTab, stageTabs]);

  return <TournamentSegmentTabs tabs={tabs} activeTab={activeTab} onSelectTab={onSelectTab} />;
}
