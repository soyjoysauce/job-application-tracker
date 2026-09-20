import { useContext } from 'react';

import { AuthContext, type AuthState } from '../lib/authContext';

/** Reads the auth state provided by <AuthProvider>. */
export function useAuth(): AuthState {
  const context = useContext(AuthContext);
  if (!context) {
    // A programming error: some component outside <AuthProvider> called useAuth().
    throw new Error('useAuth must be used inside <AuthProvider>');
  }
  return context;
}
