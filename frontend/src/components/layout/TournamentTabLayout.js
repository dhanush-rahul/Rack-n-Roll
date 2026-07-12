import React, { useMemo } from 'react';
import { View } from 'react-native';
import { TournamentSegmentTabs } from '../tournament/chrome/TournamentSegmentTabs';
import { TournamentTabBar } from '../../screens/tournamentDetail/TournamentTabBar';
import { useResponsiveLayout } from '../../utils/responsive';

export function HostTournamentTabLayout({ activeTab, onSelectTab, stageTabs = [], showGamesTab = false, children }) {
  const { isDesktopWeb } = useResponsiveLayout();

  const tabs = useMemo(() => {
    const base = [
      { id: 'registrations', label: 'Players' },
      { id: 'groups', label: 'Groups' },
    ];
    if (showGamesTab) {
      base.push({ id: 'games', label: 'Games' });
    }
    stageTabs.forEach((stage) => {
      base.push({ id: `stage:${stage.stageId}`, label: stage.name, muted: stage.status === 'locked' });
    });
    return base;
  }, [showGamesTab, stageTabs]);

  if (!isDesktopWeb) {
    return (
      <View style={{ gap: 16 }}>
        <TournamentTabBar
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          stageTabs={stageTabs}
          showGamesTab={showGamesTab}
        />
        {children}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
      <View style={{ width: 188, flexShrink: 0 }}>
        <TournamentSegmentTabs tabs={tabs} activeTab={activeTab} onSelectTab={onSelectTab} layout="vertical" />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 16 }}>{children}</View>
    </View>
  );
}

export function ScoresheetTabLayout({ tabs, activeTab, onSelectTab, children }) {
  const { isDesktopWeb } = useResponsiveLayout();

  if (!isDesktopWeb) {
    return (
      <View style={{ gap: 16 }}>
        <TournamentSegmentTabs tabs={tabs} activeTab={activeTab} onSelectTab={onSelectTab} />
        {children}
      </View>
    );
  }

  return (
    <View style={{ flexDirection: 'row', gap: 24, alignItems: 'flex-start' }}>
      <View style={{ width: 188, flexShrink: 0 }}>
        <TournamentSegmentTabs
          tabs={tabs}
          activeTab={activeTab}
          onSelectTab={onSelectTab}
          layout="vertical"
        />
      </View>
      <View style={{ flex: 1, minWidth: 0, gap: 16 }}>{children}</View>
    </View>
  );
}
