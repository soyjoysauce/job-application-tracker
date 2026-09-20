// API client for the Express server.
// Every request carries the Supabase access token; the server verifies it (docs/architecture.md).
import type { ApiErrorBody } from '@jat/shared';

import { env } from './env';
import { supabase } from './supabase';

/** A failed API response. `status` and `code` let callers react (e.g. 404 vs 401). */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const API_URL = env.VITE_API_URL;

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  // getSession() refreshes the access token first if it has expired.
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ApiError(401, 'UNAUTHORIZED', 'You are signed out. Please sign in again.');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
        ...init.headers,
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    // fetch only rejects when the request never got a response: wrong API address,
    // server unreachable, or the browser blocked it (CORS). The browser's own message
    // is just "Failed to fetch", which says nothing about the cause.
    throw new ApiError(
      0,
      'NETWORK_ERROR',
      `Could not reach the API at ${API_URL}. Check that the server is running and that it allows requests from this site.`,
    );
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  // 204 No Content (our DELETE endpoints) has no body to parse.
  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** Convenience wrappers so pages read as `api.get('/profile')`. */
export const api = {
  get: <T>(path: string) => apiFetch<T>(path),
  post: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T = void>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

async function toApiError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as ApiErrorBody;
    if (body.error?.message) {
      return new ApiError(response.status, body.error.code, body.error.message, body.error.details);
    }
  } catch {
    // Not JSON (e.g. a proxy error page) — fall through to a generic message.
  }
  return new ApiError(response.status, 'UNKNOWN', `Request failed (${response.status})`);
}
