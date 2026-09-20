// Postgres error codes -> safe HTTP errors, with no internal details leaking to the client.
import type { PostgrestError } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';

import { notFound, toHttpError } from '../src/lib/dbError.js';
import { HttpError } from '../src/lib/httpError.js';

function pgError(code: string, message = 'database says no'): PostgrestError {
  return { code, message, details: '', hint: '' } as PostgrestError;
}

describe('toHttpError', () => {
  it.each([
    ['23505', 409, 'CONFLICT'],
    ['23503', 404, 'NOT_FOUND'],
    ['23514', 400, 'BAD_REQUEST'],
    ['22P02', 400, 'BAD_REQUEST'],
    ['42501', 403, 'FORBIDDEN'],
  ])('maps %s to %i %s', (code, status, expectedCode) => {
    const error = toHttpError(pgError(code));

    expect(error).toBeInstanceOf(HttpError);
    expect(error).toMatchObject({ status, code: expectedCode });
  });

  it('turns an unknown code into a plain Error (becomes a logged 500)', () => {
    const error = toHttpError(pgError('XX000', 'internal detail'));

    expect(error).not.toBeInstanceOf(HttpError);
  });

  it('notFound names the resource without revealing whether it exists elsewhere', () => {
    expect(notFound('Posting')).toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      message: 'Posting not found',
    });
  });
});
