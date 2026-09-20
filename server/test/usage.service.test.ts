// Usage reporting: the UTC window, and clamping so the UI never shows "5 of 3".
import { describe, expect, it } from 'vitest';

import { createFakeDb, USER_A } from './helpers.js';
import { getUsage, nextWindowStart } from '../src/services/usage.service.js';

describe('getUsage', () => {
  it('reports zero when the user has not used any quota today', async () => {
    const { db } = createFakeDb(() => ({ data: null, error: null }));

    const usage = await getUsage(db, USER_A);

    expect(usage).toMatchObject({ used: 0, limit: 3, remaining: 3 });
  });

  it('clamps a counter that went past the limit (blocked requests still count)', async () => {
    const { db } = createFakeDb(() => ({ data: { request_count: 7 }, error: null }));

    const usage = await getUsage(db, USER_A);

    expect(usage.used).toBe(3);
    expect(usage.remaining).toBe(0);
  });

  it('asks for the row belonging to this user and today’s UTC window', async () => {
    const { db, calls } = createFakeDb(() => ({ data: { request_count: 1 }, error: null }));

    const usage = await getUsage(db, USER_A);

    const [call] = calls;
    expect(call?.table).toBe('usage_counters');
    expect(call?.args).toContainEqual(['user_id', USER_A]);
    // Midnight UTC — matching date_trunc('day', now(), 'UTC') in the SQL function.
    const windowStart = call?.args.find((args) => args[0] === 'window_start')?.[1] as string;
    expect(windowStart).toMatch(/T00:00:00\.000Z$/);
    // The window resets exactly 24h after it started.
    expect(new Date(usage.resetAt).getTime() - new Date(windowStart).getTime()).toBe(86_400_000);
  });

  it('nextWindowStart is the next UTC midnight, in the future', () => {
    const reset = new Date(nextWindowStart());

    expect(reset.getTime()).toBeGreaterThan(Date.now());
    expect(reset.getUTCHours()).toBe(0);
    expect(reset.getUTCMinutes()).toBe(0);
  });
});
