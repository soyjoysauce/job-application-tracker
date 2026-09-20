// Shared test helpers. No real Supabase or Anthropic call is made anywhere in the test suite.
import { vi } from 'vitest';

import type { Db } from '../src/lib/supabase.js';

export const USER_A = '11111111-1111-1111-1111-111111111111';
export const USER_B = '22222222-2222-2222-2222-222222222222';
export const POSTING_ID = 'aaaaaaaa-0000-4000-8000-000000000001';

export interface QueryCall {
  table: string;
  /** Method names in call order, e.g. ['update', 'eq', 'eq', 'neq', 'select']. */
  ops: string[];
  /** Arguments of each call, same order as `ops`. */
  args: unknown[][];
}

export type QueryResult = { data: unknown; error: unknown };

/**
 * A stand-in for the Supabase client.
 *
 * Supabase queries are chains: db.from('t').update({...}).eq(...).select('id').
 * Every method here returns the same chain object and records the call; awaiting the
 * chain asks `respond` what the query should return. `calls` lets a test assert what
 * the service actually asked the database to do.
 */
export function createFakeDb(respond: (call: QueryCall) => QueryResult) {
  const calls: QueryCall[] = [];

  const db = {
    from(table: string) {
      const call: QueryCall = { table, ops: [], args: [] };
      calls.push(call);

      const chain: Record<string, unknown> = {};
      const proxy = new Proxy(chain, {
        get(_target, property: string) {
          // Awaiting the chain resolves with the configured result.
          if (property === 'then') {
            const result = respond(call);
            return (onFulfilled: (value: QueryResult) => unknown) =>
              Promise.resolve(result).then(onFulfilled);
          }
          return (...args: unknown[]) => {
            call.ops.push(property);
            call.args.push(args);
            return proxy;
          };
        },
      });
      return proxy;
    },
    rpc: vi.fn(),
  };

  return { db: db as unknown as Db, calls, rpc: db.rpc };
}

/** Claims for a valid Supabase access token. */
export function claimsFor(userId: string, email = 'user@test.local') {
  return { sub: userId, role: 'authenticated', email };
}
