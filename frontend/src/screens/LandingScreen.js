import { useIsFocused } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import { ScrollView, View } from 'react-native';
import { ScaledText as Text } from '../components/ui/ScaledText';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AuthFeature, AuthLandingHero, AuthPrimaryButton } from '../components/auth/AuthChrome';
import { LegalFooter } from '../components/legal/LegalLinks';
import { ActionButton } from '../components/tournament/TournamentChrome';
import { authUi } from '../styles/authUi';

export function LandingScreen({ navigation }) {
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();

  return (
    <>
      {isFocused ? <StatusBar style="light" /> : null}
      <ScrollView
      style={authUi.screen}
      contentContainerStyle={[authUi.landingScrollContent, { paddingBottom: 32 + insets.bottom }]}
      showsVerticalScrollIndicator={false}
    >
      <AuthLandingHero
        subtitle="Discover tournaments, host events, and follow every rack from sign-up to the final break."
        imageHeight={300}
      />

      <View style={authUi.landingBody}>
        <View style={{ marginBottom: 20 }}>
          <AuthPrimaryButton label="Sign in" onPress={() => navigation.navigate('SignIn')} />
          <View style={{ marginTop: 10 }}>
            <ActionButton
              label="Create an account"
              onPress={() => navigation.navigate('SignUp')}
              variant="secondary"
              fullWidth
            />
          </View>
        </View>

        <View style={authUi.formCard}>
        <Text style={authUi.formTitle}>Why Rack n Roll?</Text>
        <AuthFeature
          variant="light"
          emoji="🎱"
          title="Discover & join"
          description="Find open tournaments and register in seconds."
        />
        <AuthFeature
          variant="light"
          emoji="📋"
          title="Host end to end"
          description="Groups, fixtures, scores, and finales in one flow."
        />
        <AuthFeature
          variant="light"
          emoji="🏆"
          title="Live standings"
          description="Follow group tables and results as matches are played."
        />
        </View>

        <Text style={[authUi.mutedText, { marginTop: 16, fontSize: 12 }]}>
          Fair play and accurate scoring keep every tournament honest. See you at the table.
        </Text>

        <LegalFooter style={{ marginTop: 20 }} />
      </View>
    </ScrollView>
    </>
  );
}
