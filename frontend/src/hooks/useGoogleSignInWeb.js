import { useCallback, useEffect, useMemo, useState } from 'react';
import { AccessTokenRequest, TokenResponse } from 'expo-auth-session';
import * as AuthSession from 'expo-auth-session';
import * as Google from 'expo-auth-session/providers/google';
import { resolveGoogleAuthRequestConfig } from '../config/googleAuth';

async function resolveGoogleIdToken(result, request, redirectUri) {
  const directToken = result.authentication?.idToken || result.params?.id_token;

  if (directToken) {
    return directToken;
  }

  if (result.params?.code && request?.clientId) {
    const exchangeRequest = new AccessTokenRequest({
      clientId: request.clientId,
      redirectUri,
      code: result.params.code,
      extraParams: {
        code_verifier: request.codeVerifier || '',
      },
    });

    const authentication = await exchangeRequest.performAsync(Google.discovery);

    if (authentication?.idToken) {
      return authentication.idToken;
    }
  }

  if (result.params?.access_token) {
    const tokenResponse = TokenResponse.fromQueryParams(result.params);

    if (tokenResponse.idToken) {
      return tokenResponse.idToken;
    }
  }

  return null;
}

export function useGoogleSignInWeb() {
  const [isLoading, setIsLoading] = useState(false);
  const redirectUri = useMemo(
    () =>
      AuthSession.makeRedirectUri({
        scheme: 'racknroll',
      }),
    []
  );

  useEffect(() => {
    if (__DEV__) {
      console.log('[rack-n-roll] Google OAuth redirect URI (web):', redirectUri);
    }
  }, [redirectUri]);

  const [request, , promptAsync] = Google.useIdTokenAuthRequest({
    ...resolveGoogleAuthRequestConfig(),
    redirectUri,
  });

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

      const idToken = await resolveGoogleIdToken(result, request, redirectUri);

      if (!idToken) {
        throw new Error('Google sign-in did not return an ID token.');
      }

      return idToken;
    } finally {
      setIsLoading(false);
    }
  }, [promptAsync, redirectUri, request]);

  return {
    isGoogleLoading: isLoading || !request,
    promptGoogleSignIn,
  };
}
