import { useCallback, useState } from 'react';
import { useAuth } from '../context/AuthContext';

export function useRequireAuth(navigation) {
  const { isAuthenticated } = useAuth();
  const [promptState, setPromptState] = useState({
    visible: false,
    returnTo: null,
    message: 'Sign in or create an account to continue.',
    title: 'Sign in required',
  });

  const closeAuthPrompt = useCallback(() => {
    setPromptState((current) => ({
      ...current,
      visible: false,
    }));
  }, []);

  const requireAuth = useCallback(
    (action, { returnTo, message, title } = {}) => {
      if (isAuthenticated) {
        action?.();
        return true;
      }

      setPromptState({
        visible: true,
        returnTo: returnTo || null,
        message: message || 'Sign in or create an account to continue.',
        title: title || 'Sign in required',
      });
      return false;
    },
    [isAuthenticated]
  );

  const onSignInFromPrompt = useCallback(() => {
    const { returnTo } = promptState;
    closeAuthPrompt();
    navigation.navigate('SignIn', { returnTo });
  }, [closeAuthPrompt, navigation, promptState]);

  const onSignUpFromPrompt = useCallback(() => {
    const { returnTo } = promptState;
    closeAuthPrompt();
    navigation.navigate('SignUp', { returnTo });
  }, [closeAuthPrompt, navigation, promptState]);

  return {
    requireAuth,
    authPromptProps: {
      visible: promptState.visible,
      title: promptState.title,
      message: promptState.message,
      onCancel: closeAuthPrompt,
      onSignIn: onSignInFromPrompt,
      onSignUp: onSignUpFromPrompt,
    },
  };
}
