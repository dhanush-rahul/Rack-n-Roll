import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { clearToken, getToken, setToken } from '../utils/tokenStore';
import { loginUser, signInWithGoogle as signInWithGoogleApi, signupUser } from '../services/authService';
import { apiGet } from '../services/api';
import { wakeBackendIfNeeded } from '../services/systemService';
import { logWarning } from '../utils/errorLogger';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setTokenState] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      await wakeBackendIfNeeded();
      const restoredToken = await getToken();

      if (isMounted) {
        if (restoredToken) {
          try {
            const payload = await apiGet('/api/protected/ping');
            setTokenState(restoredToken);
            setCurrentUser({ id: payload?.data?.userId || null });
          } catch (error) {
            logWarning('Session restore failed; clearing stored token', {
              code: error?.code,
              message: error?.message,
            });
            await clearToken();
            setTokenState(null);
            setCurrentUser(null);
          }
        }

        setIsLoading(false);
      }
    };

    bootstrap();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({
      isLoading,
      isAuthenticated: Boolean(token),
      token,
      currentUser,
      async signIn({ email, password }) {
        const result = await loginUser({ email, password });
        await setToken(result.token);
        setTokenState(result.token);
        setCurrentUser(result.user);
        return result;
      },
      async signUp({ name, email, password }) {
        const result = await signupUser({ name, email, password });
        await setToken(result.token);
        setTokenState(result.token);
        setCurrentUser(result.user);
        return result;
      },
      async signInWithGoogle(idToken) {
        const result = await signInWithGoogleApi({ idToken });
        await setToken(result.token);
        setTokenState(result.token);
        setCurrentUser(result.user);
        return result;
      },
      async signOut() {
        await clearToken();
        setTokenState(null);
        setCurrentUser(null);
      },
    }),
    [currentUser, isLoading, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
