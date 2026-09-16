import { z } from 'zod';

// Postgres accepts any 8-4-4-4-12 hex id; z.uuid() would reject some (it only allows RFC versions).
export const idSchema = z.guid();

export const idParamSchema = z.object({ id: idSchema });

// Consistent error shape returned by the server's central error middleware.
export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
