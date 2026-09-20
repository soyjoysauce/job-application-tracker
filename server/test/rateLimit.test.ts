// The daily limit on Claude-backed routes (ADR-006). Test limit is 3 (see test/setup.ts).
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { claimsFor, createFakeDb, POSTING_ID, USER_A } from './helpers.js';

const getClaims = vi.fn();
const incrementUsage = vi.fn();
const analyzePosting = vi.fn();

vi.mock('../src/lib/supabase.js', () => ({
  getAuthClient: () => ({ auth: { getClaims } }),
  createUserClient: () => createFakeDb(() => ({ data: null, error: null })).db,
  createAdminClient: () => createFakeDb(() => ({ data: null, error: null })).db,
}));
vi.mock('../src/services/usage.service.js', async (importOriginal) => ({
  ...(await importOriginal<object>()),
  incrementUsage,
}));
vi.mock('../src/services/analysis.service.js', () => ({ analyzePosting }));

const { default: app } = await import('../src/app.js');

const analyze = () =>
  request(app).post(`/api/postings/${POSTING_ID}/analyze`).set('Authorization', 'Bearer token');

beforeEach(() => {
  getClaims.mockResolvedValue({ data: { claims: claimsFor(USER_A) }, error: null });
  incrementUsage.mockReset();
  analyzePosting.mockReset();
  analyzePosting.mockResolvedValue({ id: POSTING_ID, analysisStatus: 'completed' });
});

describe('rateLimit', () => {
  it('allows requests up to the daily limit', async () => {
    incrementUsage.mockResolvedValueOnce(1).mockResolvedValueOnce(2).mockResolvedValueOnce(3);

    for (let attempt = 1; attempt <= 3; attempt++) {
      expect((await analyze()).status).toBe(200);
    }
    expect(analyzePosting).toHaveBeenCalledTimes(3);
  });

  it('blocks the request after the limit, before doing the work', async () => {
    incrementUsage.mockResolvedValue(4);

    const response = await analyze();

    expect(response.status).toBe(429);
    expect(response.body.error.code).toBe('RATE_LIMITED');
    expect(response.body.error.details).toMatchObject({ limit: 3 });
    expect(Number(response.headers['retry-after'])).toBeGreaterThan(0);
    // The expensive work never ran.
    expect(analyzePosting).not.toHaveBeenCalled();
  });

  it('counts before the work runs, so a failing analysis still uses quota', async () => {
    incrementUsage.mockResolvedValue(1);
    analyzePosting.mockRejectedValue(new Error('Claude exploded'));

    const response = await analyze();

    expect(response.status).toBe(500);
    expect(incrementUsage).toHaveBeenCalledTimes(1);
  });

  it('does not apply to routes that never call Claude', async () => {
    incrementUsage.mockResolvedValue(99);

    const response = await request(app).get('/api/usage').set('Authorization', 'Bearer token');

    expect(response.status).not.toBe(429);
    expect(incrementUsage).not.toHaveBeenCalled();
  });
});
