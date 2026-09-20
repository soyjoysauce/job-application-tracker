// Public routes, error shape, and HTTP hardening (architecture rule 5).
import request from 'supertest';
import { describe, expect, it } from 'vitest';

import app from '../src/app.js';

describe('app basics', () => {
  it('GET /api/health returns ok', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('unknown routes return the shared 404 error shape', async () => {
    const response = await request(app).get('/api/nope');

    expect(response.status).toBe(404);
    expect(response.body).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /api/nope not found' },
    });
  });

  it('malformed JSON returns 400, not a crash', async () => {
    const response = await request(app)
      .post('/api/postings')
      .set('Content-Type', 'application/json')
      .send('{not json');

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('BAD_REQUEST');
  });

  it('bodies over the size limit return 413', async () => {
    const response = await request(app)
      .post('/api/postings')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ rawText: 'a'.repeat(200_000) }));

    expect(response.status).toBe(413);
    expect(response.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('allows the configured client origin and no other', async () => {
    const response = await request(app)
      .get('/api/health')
      .set('Origin', 'https://attacker.example');

    // cors names only CLIENT_ORIGIN; the browser blocks any other origin.
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  it('sets helmet security headers', async () => {
    const response = await request(app).get('/api/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
