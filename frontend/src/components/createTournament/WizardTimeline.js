import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../ui/ScaledText';
import { tournamentColors } from '../../styles/tournamentUi';

export function WizardTimeline({ tabs, activeTab, onSelectTab, getTabIndex, getTabStatus }) {
  const activeIndex = getTabIndex(activeTab);

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={{ paddingVertical: 10, paddingHorizontal: 2, gap: 0 }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
        {tabs.map((tab, index) => {
          const status = getTabStatus ? getTabStatus(tab.id, index) : index < activeIndex ? 'complete' : index === activeIndex ? 'current' : 'upcoming';
          const isCurrent = status === 'current';
          const isComplete = status === 'complete';
          const isIncomplete = status === 'incomplete';
          const isLast = index === tabs.length - 1;

          let circleBg = tournamentColors.surfaceRaised;
          let circleBorder = tournamentColors.border;
          let circleContent = String(index + 1);
          let circleContentColor = tournamentColors.textMuted;

          if (isComplete) {
            circleBg = tournamentColors.primary;
            circleBorder = tournamentColors.primary;
            circleContent = '✓';
            circleContentColor = tournamentColors.onPrimary || '#ffffff';
          } else if (isIncomplete) {
            circleBg = tournamentColors.statusWarningBg;
            circleBorder = tournamentColors.warning;
            circleContent = '!';
            circleContentColor = tournamentColors.statusWarningText;
          } else if (isCurrent) {
            circleBg = tournamentColors.primary;
            circleBorder = tournamentColors.primary;
            circleContent = String(index + 1);
            circleContentColor = tournamentColors.onPrimary || '#ffffff';
          }

          const connectorComplete =
            isComplete ||
            (isCurrent && index > 0 && getTabStatus?.(tabs[index - 1]?.id) === 'complete');

          return (
            <View key={tab.id} style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <Pressable
                onPress={() => onSelectTab(tab.id)}
                style={({ pressed }) => ({
                  alignItems: 'center',
                  width: 84,
                  opacity: pressed ? 0.88 : 1,
                })}
              >
                <View
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: 16,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: circleBg,
                    borderWidth: 2,
                    borderColor: circleBorder,
                  }}
                >
                  <Text
                    style={{
                      color: circleContentColor,
                      fontSize: isComplete || isIncomplete ? 14 : 13,
                      fontWeight: '800',
                    }}
                  >
                    {circleContent}
                  </Text>
                </View>
                <Text
                  numberOfLines={2}
                  style={{
                    marginTop: 8,
                    textAlign: 'center',
                    fontSize: 11,
                    lineHeight: 14,
                    fontWeight: isCurrent ? '800' : '600',
                    color: isIncomplete
                      ? tournamentColors.warning
                      : isCurrent
                        ? tournamentColors.primary
                        : isComplete
                          ? tournamentColors.text
                          : tournamentColors.textMuted,
                  }}
                >
                  {tab.label}
                </Text>
              </Pressable>

              {!isLast ? (
                <View
                  style={{
                    width: 28,
                    height: 2,
                    marginTop: 15,
                    borderRadius: 999,
                    backgroundColor: connectorComplete ? tournamentColors.primary : tournamentColors.borderLight,
                  }}
                />
              ) : null}
            </View>
          );
        })}
      </View>
    </ScrollView>
  );
}
