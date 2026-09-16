// zod helpers for controllers. Each returns fully typed data or throws a ZodError,
// which the central error middleware turns into a 400 VALIDATION_ERROR response.
import type { Request } from 'express';
import type { z } from 'zod';

export function parseBody<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return schema.parse(req.body);
}

export function parseParams<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return schema.parse(req.params);
}

export function parseQuery<T extends z.ZodType>(schema: T, req: Request): z.output<T> {
  return schema.parse(req.query);
}
