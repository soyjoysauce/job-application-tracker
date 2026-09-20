// zod validation at the edges: bad input is rejected before any service or database call.
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { claimsFor, createFakeDb, POSTING_ID, USER_A } from './helpers.js';

const getClaims = vi.fn();
const createPosting = vi.fn();
const getPosting = vi.fn();

vi.mock('../src/lib/supabase.js', () => ({
  getAuthClient: () => ({ auth: { getClaims } }),
  createUserClient: () => createFakeDb(() => ({ data: null, error: null })).db,
  createAdminClient: () => createFakeDb(() => ({ data: null, error: null })).db,
}));
vi.mock('../src/services/posting.service.js', () => ({
  createPosting,
  getPosting,
  listPostings: vi.fn(),
  deletePosting: vi.fn(),
}));

const { default: app } = await import('../src/app.js');
const { notFound } = await import('../src/lib/dbError.js');

const auth = { Authorization: 'Bearer token' };

beforeEach(() => {
  getClaims.mockResolvedValue({ data: { claims: claimsFor(USER_A) }, error: null });
  createPosting.mockReset();
  getPosting.mockReset();
});

describe('request validation', () => {
  it('rejects an unknown field such as userId, instead of ignoring it', async () => {
    const response = await request(app)
      .post('/api/postings')
      .set(auth)
      .send({ rawText: 'A posting', userId: '22222222-2222-2222-2222-222222222222' });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
    expect(createPosting).not.toHaveBeenCalled();
  });

  it('rejects empty posting text and reports the field', async () => {
    const response = await request(app).post('/api/postings').set(auth).send({ rawText: '   ' });

    expect(response.status).toBe(400);
    expect(response.body.error.details).toContainEqual(
      expect.objectContaining({ path: 'rawText' }),
    );
  });

  it('rejects an id that is not a uuid before touching the database', async () => {
    const response = await request(app).get('/api/postings/not-a-uuid').set(auth);

    expect(response.status).toBe(400);
    expect(getPosting).not.toHaveBeenCalled();
  });

  it('rejects an empty application update', async () => {
    const response = await request(app).patch(`/api/applications/${POSTING_ID}`).set(auth).send({});

    expect(response.status).toBe(400);
    expect(response.body.error.details[0].message).toMatch(/at least one field/i);
  });

  it('rejects an unknown status filter', async () => {
    const response = await request(app).get('/api/applications?status=ghosted').set(auth);

    expect(response.status).toBe(400);
  });

  it('passes a service 404 through as the shared error shape', async () => {
    getPosting.mockRejectedValue(notFound('Posting'));

    const response = await request(app).get(`/api/postings/${POSTING_ID}`).set(auth);

    expect(response.status).toBe(404);
    expect(response.body.error).toEqual({ code: 'NOT_FOUND', message: 'Posting not found' });
  });

  it('validation errors never echo the submitted values back', async () => {
    const response = await request(app)
      .post('/api/postings')
      .set(auth)
      .send({ rawText: '', secretNote: 'my private data' });

    expect(JSON.stringify(response.body)).not.toContain('my private data');
  });
});
