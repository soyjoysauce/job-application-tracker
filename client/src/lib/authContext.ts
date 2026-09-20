// The auth context object and its type. Kept in its own file (no components) so that
// Vite's fast refresh and the react-refresh lint rule stay happy.
import type { Session } from '@supabase/supabase-js';
import { createContext } from 'react';

export interface AuthState {
  /** The signed-in session, or null when signed out. */
  session: Session | null;
  /** True while the stored session is being restored on first load. */
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  /** Returns true if the account needs email confirmation before signing in. */
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthState | undefined>(undefined);
