import { useCallback, useState } from 'react';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { resolveGoogleAuthRequestConfig } from '../config/googleAuth';

WebBrowser.maybeCompleteAuthSession();

export function useGoogleSignIn() {
  const [isLoading, setIsLoading] = useState(false);
  const [request, , promptAsync] = Google.useAuthRequest(resolveGoogleAuthRequestConfig());

  const promptGoogleSignIn = useCallback(async () => {
    if (!request) {
      throw new Error('Google sign-in is still initializing. Please try again.');
    }

    setIsLoading(true);

    try {
      const result = await promptAsync();

      if (result.type === 'cancel' || result.type === 'dismiss') {
        return null;
      }

      if (result.type !== 'success') {
        throw new Error('Google sign-in did not complete.');
      }

      const idToken = result.authentication?.idToken || result.params?.id_token;

      if (!idToken) {
        throw new Error('Google sign-in did not return an ID token.');
      }

      return idToken;
    } finally {
      setIsLoading(false);
    }
  }, [promptAsync, request]);

  return {
    isGoogleLoading: isLoading || !request,
    promptGoogleSignIn,
  };
}
