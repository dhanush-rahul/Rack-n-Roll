import React, { createContext, useContext } from 'react';

const SignOutContext = createContext(undefined);

export function SignOutProvider({ requestSignOut, children }) {
  return <SignOutContext.Provider value={{ requestSignOut }}>{children}</SignOutContext.Provider>;
}

export function useSignOutRequest() {
  const context = useContext(SignOutContext);
  if (!context) {
    throw new Error('useSignOutRequest must be used within SignOutProvider');
  }

  return context;
}
