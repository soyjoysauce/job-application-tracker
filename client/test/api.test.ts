// apiFetch turns transport failures into a message that names the cause.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSession = vi.fn();
vi.mock('../src/lib/supabase', () => ({ supabase: { auth: { getSession } } }));

const { ApiError, api } = await import('../src/lib/api');

beforeEach(() => {
  getSession.mockResolvedValue({ data: { session: { access_token: 'token' } } });
  vi.restoreAllMocks();
});

describe('apiFetch', () => {
  it('explains an unreachable API instead of "Failed to fetch"', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

    await expect(api.get('/api/postings')).rejects.toMatchObject({
      code: 'NETWORK_ERROR',
    });
    await expect(api.get('/api/postings')).rejects.toThrow(/Could not reach the API at/);
  });

  it('passes the server’s error message through', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({ error: { code: 'NOT_FOUND', message: 'Posting not found' } }),
          {
            status: 404,
          },
        ),
      ),
    );

    await expect(api.get('/api/postings/x')).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Posting not found',
    });
  });

  it('refuses to send a request when signed out', async () => {
    getSession.mockResolvedValue({ data: { session: null } });
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(api.get('/api/postings')).rejects.toBeInstanceOf(ApiError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
