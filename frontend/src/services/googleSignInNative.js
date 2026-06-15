import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { googleAuthConfig, isGoogleSignInConfigured } from '../config/googleAuth';

let configured = false;

function ensureGoogleSignInConfigured() {
  if (configured || !isGoogleSignInConfigured()) {
    return;
  }

  GoogleSignin.configure({
    webClientId: googleAuthConfig.webClientId,
    offlineAccess: false,
  });

  configured = true;
}

function mapNativeGoogleError(error) {
  if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
    return null;
  }

  if (error?.code === statusCodes.IN_PROGRESS) {
    return new Error('Google sign-in is already in progress.');
  }

  if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return new Error('Google Play Services is required for sign-in on this device.');
  }

  if (error?.code === '10') {
    return new Error(
      'Google Sign-In is not configured for this Android build. Confirm SHA-1 and package name in Google Cloud, then rebuild the app.'
    );
  }

  return new Error(error?.message || 'Google sign-in failed. Please try again.');
}

export async function signInWithGoogleNative() {
  ensureGoogleSignInConfigured();

  try {
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    const response = await GoogleSignin.signIn();

    if (response.type === 'cancelled') {
      return null;
    }

    if (response.type !== 'success') {
      throw new Error('Google sign-in did not complete.');
    }

    let idToken = response.data?.idToken;

    if (!idToken) {
      const tokens = await GoogleSignin.getTokens();
      idToken = tokens?.idToken;
    }

    if (!idToken) {
      throw new Error('Google sign-in did not return an ID token.');
    }

    return idToken;
  } catch (error) {
    const mapped = mapNativeGoogleError(error);

    if (!mapped) {
      return null;
    }

    throw mapped;
  }
}
