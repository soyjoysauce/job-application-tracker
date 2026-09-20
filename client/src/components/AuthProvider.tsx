// Holds the Supabase session and makes it available to the whole app via context.
import type { Session } from '@supabase/supabase-js';
import { useEffect, useMemo, useState, type ReactNode } from 'react';

import { AuthContext, type AuthState } from '../lib/authContext';
import { supabase } from '../lib/supabase';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Restore a session saved in localStorage (if any) on first load.
    void supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    // 2. Keep up with sign-in, sign-out and token refresh (including in other tabs).
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    // 3. Stop listening when this component goes away.
    return () => listener.subscription.unsubscribe();
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      loading,
      signIn: async (email, password) => {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error(error.message);
      },
      signUp: async (email, password) => {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw new Error(error.message);
        // With email confirmation on, Supabase returns a user but no session yet.
        return { needsEmailConfirmation: data.session === null };
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error) throw new Error(error.message);
      },
    }),
    [session, loading],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}
