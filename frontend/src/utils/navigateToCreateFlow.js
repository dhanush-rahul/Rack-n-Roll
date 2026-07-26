import {
  isCreateTournamentWalkthroughCompleted,
  WALKTHROUGH_FORCE_EVERY_VISIT,
} from './onboardingStore';

export async function navigateToCreateFlow(navigation) {
  if (WALKTHROUGH_FORCE_EVERY_VISIT) {
    navigation.navigate('CreateTournamentWalkthrough');
    return;
  }

  const completed = await isCreateTournamentWalkthroughCompleted();
  if (!completed) {
    navigation.navigate('CreateTournamentWalkthrough');
    return;
  }

  navigation.navigate('MainTabs', { screen: 'CreateTab' });
}
