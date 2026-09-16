// Turns Supabase/PostgREST errors into HttpErrors with safe, consistent messages.
// Anything unexpected is re-thrown as a plain Error, so the error middleware logs it and returns 500.
import type { PostgrestError } from '@supabase/supabase-js';

import { HttpError } from './httpError.js';

export function toHttpError(error: PostgrestError): Error {
  switch (error.code) {
    case '23505': // unique_violation
      return new HttpError(409, 'CONFLICT', 'This resource already exists');
    case '23503': // foreign_key_violation
      return new HttpError(404, 'NOT_FOUND', 'Referenced resource not found');
    case '23514': // check_violation
    case '22P02': // invalid_text_representation (e.g. bad uuid)
    case '22007': // invalid_datetime_format
      return new HttpError(400, 'BAD_REQUEST', 'Invalid value');
    case '42501': // insufficient_privilege / RLS rejected the row
      return new HttpError(403, 'FORBIDDEN', 'Not allowed');
    default:
      return new Error(`Database error ${error.code}: ${error.message}`);
  }
}

export function notFound(what: string): HttpError {
  return new HttpError(404, 'NOT_FOUND', `${what} not found`);
}
