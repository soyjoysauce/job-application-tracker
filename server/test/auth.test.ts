// requireAuth: which tokens are accepted, and what a rejection looks like (ADR-008).
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { claimsFor, createFakeDb, USER_A } from './helpers.js';

const getClaims = vi.fn();

// Replace the Supabase clients: no network, and the test controls what the token check returns.
vi.mock('../src/lib/supabase.js', () => ({
  getAuthClient: () => ({ auth: { getClaims } }),
  createUserClient: () => createFakeDb(() => ({ data: null, error: null })).db,
  createAdminClient: () => createFakeDb(() => ({ data: null, error: null })).db,
}));

const { default: app } = await import('../src/app.js');

describe('requireAuth', () => {
  beforeEach(() => {
    getClaims.mockReset();
  });

  it('rejects a request with no Authorization header', async () => {
    const response = await request(app).get('/api/me');

    expect(response.status).toBe(401);
    expect(response.body.error).toEqual({
      code: 'UNAUTHORIZED',
      message: 'Missing or malformed Authorization header',
    });
    expect(getClaims).not.toHaveBeenCalled();
  });

  it('rejects a non-Bearer scheme', async () => {
    const response = await request(app).get('/api/me').set('Authorization', 'Basic abc123');

    expect(response.status).toBe(401);
  });

  it('rejects a token Supabase does not accept', async () => {
    getClaims.mockResolvedValue({ data: null, error: new Error('bad signature') });

    const response = await request(app).get('/api/me').set('Authorization', 'Bearer forged.token');

    expect(response.status).toBe(401);
    expect(response.body.error.message).toBe('Invalid or expired token');
  });

  it('rejects a valid project key that is not a user token (role is not authenticated)', async () => {
    getClaims.mockResolvedValue({ data: { claims: { role: 'anon' } }, error: null });

    const response = await request(app).get('/api/me').set('Authorization', 'Bearer anon.key');

    expect(response.status).toBe(401);
  });

  it('accepts a valid user token and reports who it belongs to', async () => {
    getClaims.mockResolvedValue({
      data: { claims: claimsFor(USER_A, 'a@test.local') },
      error: null,
    });

    const response = await request(app).get('/api/me').set('Authorization', 'Bearer good.token');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ id: USER_A, email: 'a@test.local' });
    // The user id comes from the verified token, never from the request.
    expect(getClaims).toHaveBeenCalledWith('good.token');
  });
});
