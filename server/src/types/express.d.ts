// Adds `req.auth` to Express's Request type. Set by requireAuth (middleware/auth.middleware.ts).
import type { SupabaseClient } from '@supabase/supabase-js';

export interface AuthContext {
  /** The signed-in user's id (the token's `sub` claim, same as auth.uid() in SQL). */
  userId: string;
  email: string | undefined;
  /** Per-request Supabase client that queries as this user (RLS applies). */
  supabase: SupabaseClient;
}

declare global {
  namespace Express {
    interface Request {
      /** Only present on routes behind requireAuth. Read it with getAuth(req). */
      auth?: AuthContext;
    }
  }
}
