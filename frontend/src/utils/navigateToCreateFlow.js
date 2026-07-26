import {
  isCreateTournamentWalkthroughCompleted,
  WALKTHROUGH_FORCE_EVERY_VISIT,
} from './onboardingStore';
import { markIgnoreNextPopState } from './navigationGuard';

export async function navigateToCreateFlow(navigation) {
  if (WALKTHROUGH_FORCE_EVERY_VISIT) {
    markIgnoreNextPopState();
    navigation.navigate('CreateTournamentWalkthrough');
    return;
  }

  const completed = await isCreateTournamentWalkthroughCompleted();
  if (!completed) {
    markIgnoreNextPopState();
    navigation.navigate('CreateTournamentWalkthrough');
    return;
  }

  markIgnoreNextPopState();
  navigation.navigate('MainTabs', { screen: 'CreateTab' });
}
