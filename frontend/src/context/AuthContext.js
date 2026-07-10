import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { FeedbackModal } from '../components/FeedbackModal';
import { clearToken, getToken, setToken } from '../utils/tokenStore';
import { loginUser, signInWithGoogle as signInWithGoogleApi, signupUser } from '../services/authService';
import { apiGet } from '../services/api';
import { wakeBackendIfNeeded } from '../services/systemService';
import { logWarning } from '../utils/errorLogger';
import { queryClient } from '../config/queryClient';

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [isLoading, setIsLoading] = useState(true);
  const [bootstrapMessage, setBootstrapMessage] = useState('Starting up…');
  const [token, setTokenState] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [signedOutModalVisible, setSignedOutModalVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const bootstrap = async () => {
      setBootstrapMessage('Connecting to server…');
      await wakeBackendIfNeeded({ force: true });

      setBootstrapMessage('Restoring your session…');
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

        setBootstrapMessage('Ready');
      }

      // Hold the splash message for a beat so it doesn't flash by, then let the
      // navigator crossfade smoothly into the dashboard.
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (isMounted) {
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
      bootstrapMessage,
      isAuthenticated: Boolean(token),
      currentUser,
      async signIn({ username, password }) {
        const result = await loginUser({ username, password });
        await setToken(result.token);
        setTokenState(result.token);
        setCurrentUser(result.user);
        return result;
      },
      async signUp({ firstName, lastName, username, email, password }) {
        const result = await signupUser({ firstName, lastName, username, email, password });
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
      updateCurrentUser(nextUser) {
        setCurrentUser((current) => ({ ...(current || {}), ...(nextUser || {}) }));
      },
      async signOut() {
        await clearToken();
        setTokenState(null);
        setCurrentUser(null);
        queryClient.clear();
        setSignedOutModalVisible(true);
      },
    }),
    [bootstrapMessage, currentUser, isLoading, token]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      <FeedbackModal
        visible={signedOutModalVisible}
        title="Signed out"
        message="You've been signed out successfully. See you next time!"
        icon="success"
        dismissLabel="OK"
        onDismiss={() => setSignedOutModalVisible(false)}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
