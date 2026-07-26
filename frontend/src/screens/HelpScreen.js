import React from 'react';
import { Linking, Platform, ScrollView, View } from 'react-native';
import Constants from 'expo-constants';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { useTheme } from '../context/ThemeContext';
import { ActionButton, SectionCard } from '../components/tournament/TournamentChrome';
import { LegalMenuSection } from '../components/legal/LegalLinks';
import { useScreenInsets } from '../hooks/useScreenInsets';
import { useResponsiveLayout, centeredContentStyle } from '../utils/responsive';
import { tournamentUi } from '../styles/tournamentUi';
import { resetCreateTournamentWalkthrough, resetDiscoverWalkthrough } from '../utils/onboardingStore';

const FAQ_ITEMS = [
  {
    question: 'How do I register for a tournament?',
    answer: 'Browse Discover, open a tournament, and tap Request registration. Invite-only events require a valid invite code.',
  },
  {
    question: 'How do I host a tournament?',
    answer: 'Sign in and tap the Create tab. Walk through the setup tabs and launch when you are ready.',
  },
  {
    question: 'Where do I see my matches?',
    answer: 'Open My Events and choose your event. The scoresheet shows fixtures and standings.',
  },
];

export function HelpScreen({ navigation }) {
  const { colors } = useTheme();
  const { scrollPaddingBottom } = useScreenInsets();
  const { contentMaxWidth, horizontalPadding, isDesktopWeb } = useResponsiveLayout();
  const appVersion = Constants.expoConfig?.version || '1.0.0';

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: isDesktopWeb ? colors.backgroundAlt : colors.background }}
      contentContainerStyle={[
        tournamentUi.content,
        { paddingHorizontal: horizontalPadding, paddingBottom: scrollPaddingBottom },
        centeredContentStyle(contentMaxWidth),
      ]}
    >
      <Text style={{ fontSize: 24, fontWeight: '800', color: colors.text, marginBottom: 16 }}>Help</Text>

      <View style={{ gap: 14 }}>
        <SectionCard title="FAQ" subtitle="Quick answers">
          {FAQ_ITEMS.map((item) => (
            <View key={item.question} style={{ marginBottom: 12 }}>
              <Text style={{ fontSize: 14, fontWeight: '700', color: colors.text }}>{item.question}</Text>
              <Text style={{ fontSize: 13, lineHeight: 19, color: colors.textMuted, marginTop: 4 }}>{item.answer}</Text>
            </View>
          ))}
        </SectionCard>

        <SectionCard title="Walkthroughs" subtitle="Replay guided tours">
          <View style={{ gap: 10 }}>
            <ActionButton
              label="Replay discover tour"
              variant="secondary"
              fullWidth
              onPress={async () => {
                await resetDiscoverWalkthrough();
                navigation.navigate('DiscoverWalkthrough');
              }}
            />
            <ActionButton
              label="Replay create tournament tour"
              variant="secondary"
              fullWidth
              onPress={async () => {
                await resetCreateTournamentWalkthrough();
                navigation.navigate('CreateTournamentWalkthrough');
              }}
            />
          </View>
        </SectionCard>

        <SectionCard title="Contact" subtitle="Need more help?">
          <ActionButton
            label="Email support"
            variant="secondary"
            fullWidth
            onPress={() => Linking.openURL('mailto:support@rack-n-roll.app')}
          />
          <Text style={{ marginTop: 10, fontSize: 12, color: colors.textMuted }}>App version {appVersion}</Text>
        </SectionCard>

        <SectionCard title="Legal">
          <LegalMenuSection />
        </SectionCard>
      </View>
    </ScrollView>
  );
}
