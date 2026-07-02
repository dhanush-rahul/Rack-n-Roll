import { Alert, Linking } from 'react-native';
import { legalUrls } from '../config/legalUrls';

const ALLOWED_LEGAL_URLS = new Set([legalUrls.privacyPolicy, legalUrls.termsAndConditions]);

export async function openLegalUrl(url, label = 'document') {
  const normalizedUrl = String(url || '').trim();

  if (!normalizedUrl || !ALLOWED_LEGAL_URLS.has(normalizedUrl)) {
    Alert.alert('Unable to open link', `The ${label} link is not available.`);
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
