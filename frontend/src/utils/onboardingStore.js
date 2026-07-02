import AsyncStorage from '@react-native-async-storage/async-storage';

const DISCOVER_WALKTHROUGH_KEY = 'discover_walkthrough_v2_completed';
const CREATE_TOURNAMENT_WALKTHROUGH_KEY = 'create_tournament_walkthrough_v1_completed';

/** Testing only — set false before release. */
export const WALKTHROUGH_FORCE_EVERY_VISIT = false;

async function readFlag(key) {
  try {
    const value = await AsyncStorage.getItem(key);
    return value === 'true';
  } catch {
    return false;
  }
}

async function writeFlag(key, completed) {
  try {
    await AsyncStorage.setItem(key, completed ? 'true' : 'false');
  } catch {
    // Ignore persistence errors.
  }
}

export async function isDiscoverWalkthroughCompleted() {
  if (WALKTHROUGH_FORCE_EVERY_VISIT) {
    return false;
  }

  return readFlag(DISCOVER_WALKTHROUGH_KEY);
}

export async function setDiscoverWalkthroughCompleted(completed = true) {
  return writeFlag(DISCOVER_WALKTHROUGH_KEY, completed);
}

export async function resetDiscoverWalkthrough() {
  return writeFlag(DISCOVER_WALKTHROUGH_KEY, false);
}

export async function isCreateTournamentWalkthroughCompleted() {
  if (WALKTHROUGH_FORCE_EVERY_VISIT) {
    return false;
  }

  return readFlag(CREATE_TOURNAMENT_WALKTHROUGH_KEY);
}

export async function setCreateTournamentWalkthroughCompleted(completed = true) {
  return writeFlag(CREATE_TOURNAMENT_WALKTHROUGH_KEY, completed);
}

export async function resetCreateTournamentWalkthrough() {
  return writeFlag(CREATE_TOURNAMENT_WALKTHROUGH_KEY, false);
}

/** @deprecated Use discover walkthrough helpers instead. */
export const isHomeOnboardingCompleted = isDiscoverWalkthroughCompleted;
/** @deprecated Use discover walkthrough helpers instead. */
export const setHomeOnboardingCompleted = setDiscoverWalkthroughCompleted;
/** @deprecated Use discover walkthrough helpers instead. */
export const resetHomeOnboarding = resetDiscoverWalkthrough;
