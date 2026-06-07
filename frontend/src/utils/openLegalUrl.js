import { Alert, Linking } from 'react-native';

export async function openLegalUrl(url, label = 'document') {
  const normalizedUrl = String(url || '').trim();

  if (!normalizedUrl) {
    Alert.alert('Unavailable', `The ${label} link is not configured yet.`);
    return;
  }

  try {
    const canOpen = await Linking.canOpenURL(normalizedUrl);

    if (!canOpen) {
      Alert.alert('Unable to open link', `Could not open the ${label}. Please try again later.`);
      return;
    }

    await Linking.openURL(normalizedUrl);
  } catch {
    Alert.alert('Unable to open link', `Could not open the ${label}. Please try again later.`);
  }
}
