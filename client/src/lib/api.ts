// API client for the Express server.
// Every request sends `Authorization: Bearer <supabase access token>`.
// STUB — implemented in roadmap step 5.

export async function apiFetch<T>(_path: string, _init?: RequestInit): Promise<T> {
  // TODO(step 5):
  // 1. Read the current session's access token from Supabase Auth.
  // 2. Call `${import.meta.env.VITE_API_URL}${path}` with the Bearer header.
  // 3. Parse the shared ApiErrorBody shape on non-2xx responses and throw.
  throw new Error('Not implemented — see docs/roadmap.md step 5');
}
