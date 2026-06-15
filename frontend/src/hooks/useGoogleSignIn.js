import { useCallback, useState } from 'react';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { signInWithGoogleNative } from '../services/googleSignInNative';
import { useGoogleSignInWeb } from './useGoogleSignInWeb';

const isExpoGo = Constants.appOwnership === 'expo';

export function useGoogleSignIn() {
  const [isNativeLoading, setIsNativeLoading] = useState(false);
  const webSignIn = useGoogleSignInWeb();

  const promptGoogleSignIn = useCallback(async () => {
    if (Platform.OS === 'web') {
      return webSignIn.promptGoogleSignIn();
    }

    if (isExpoGo) {
      throw new Error(
        'Google sign-in is not supported in Expo Go on Android. Use the web app, or install a development build (eas build --profile development --platform android).'
      );
    }

    setIsNativeLoading(true);

    try {
      return await signInWithGoogleNative();
    } finally {
      setIsNativeLoading(false);
    }
  }, [webSignIn]);

  return {
    isGoogleLoading: Platform.OS === 'web' ? webSignIn.isGoogleLoading : isNativeLoading,
    promptGoogleSignIn,
  };
}
