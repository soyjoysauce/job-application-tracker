// Auth middleware: verifies the Supabase access token and attaches req.auth.
// Flow (docs/architecture.md): Bearer token → verify with Supabase → 401 if invalid
// → per-request Supabase client that queries as the user (RLS applies).
import type { NextFunction, Request, Response } from 'express';

import { HttpError } from '../lib/httpError.js';
import { createUserClient, getAuthClient } from '../lib/supabase.js';
import type { AuthContext } from '../types/express.js';

export async function requireAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = readBearerToken(req.headers.authorization);
  if (!token) {
    throw unauthorized('Missing or malformed Authorization header');
  }

  // getClaims checks the token's signature and expiry (see ADR-008).
  const { data, error } = await getAuthClient().auth.getClaims(token);
  const claims = data?.claims;

  // `sub` + role "authenticated" = a signed-in user. This rejects e.g. the anon key sent as a token.
  if (error || !claims || typeof claims.sub !== 'string' || claims.role !== 'authenticated') {
    throw unauthorized('Invalid or expired token');
  }

  req.auth = {
    userId: claims.sub,
    email: typeof claims.email === 'string' ? claims.email : undefined,
    supabase: createUserClient(token),
  };
  next();
}

/** Returns req.auth on routes behind requireAuth. Throws if the middleware wasn't mounted. */
export function getAuth(req: Request): AuthContext {
  if (!req.auth) {
    // A programming error (route is missing requireAuth), not a client error.
    throw new Error('getAuth() called on a route without requireAuth');
  }
  return req.auth;
}

function readBearerToken(header: string | undefined): string | undefined {
  const match = header?.match(/^Bearer\s+(\S+)$/i);
  return match?.[1];
}

function unauthorized(message: string): HttpError {
  return new HttpError(401, 'UNAUTHORIZED', message);
}
