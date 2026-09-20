/**
 * End-to-end isolation check for two users (roadmap step 7).
 *
 * The pgTAP tests (npm run db:test) prove the policies inside the database.
 * This script proves the same guarantees from the outside:
 *   1. through the running Express API,
 *   2. by bypassing the API — calling Supabase's REST API directly with the public
 *      anon key and a real user token, which anyone can do from a browser console,
 *   3. signed out, with only the anon key.
 *
 * It creates two throwaway users and deletes both accounts at the end.
 *
 * Usage (local stack + local API):
 *   eval "$(npx supabase status -o env | sed 's/^/L_/')"
 *   SUPABASE_URL=$L_API_URL SUPABASE_ANON_KEY=$L_ANON_KEY API_URL=http://localhost:3001 \
 *     npm run verify:rls
 */
const SUPABASE_URL = requireEnv('SUPABASE_URL');
const ANON_KEY = requireEnv('SUPABASE_ANON_KEY');
const API_URL = process.env.API_URL ?? 'http://localhost:3001';
const PASSWORD = 'test-password-123';

let passed = 0;
let failed = 0;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing ${name}. See the usage comment at the top of this file.`);
    process.exit(1);
  }
  return value;
}

function check(label: string, ok: boolean, detail?: unknown): void {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(
      `  FAIL  ${label}${detail === undefined ? '' : ` — got ${JSON.stringify(detail)}`}`,
    );
  }
}

interface User {
  token: string;
  id: string;
  email: string;
}

async function signUp(label: string): Promise<User> {
  const email = `rls_${label}_${Date.now()}@test.local`;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = (await response.json()) as { access_token?: string; user?: { id: string } };
  if (!body.access_token || !body.user) {
    throw new Error(`Sign-up failed for ${label}: ${JSON.stringify(body)}`);
  }
  return { token: body.access_token, id: body.user.id, email };
}

/** A request to our Express API, as a signed-in user. */
async function api<T = unknown>(
  user: User | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${API_URL}${path}`, {
    method,
    headers: {
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

/** A request straight to Supabase's REST API — the API bypass an attacker would try. */
async function rest<T = unknown>(
  user: User | null,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; body: T }> {
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: ANON_KEY,
      ...(user ? { Authorization: `Bearer ${user.token}` } : {}),
      'Content-Type': 'application/json',
      // Ask for the affected rows back, so "0 rows" is visible as an empty array.
      Prefer: 'return=representation',
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await response.text();
  return { status: response.status, body: (text ? JSON.parse(text) : null) as T };
}

console.log(`API:      ${API_URL}`);
console.log(`Supabase: ${SUPABASE_URL}\n`);

const userA = await signUp('a');
const userB = await signUp('b');

// --- Set up data owned by A -------------------------------------------------
await api(userA, 'PUT', '/api/profile', { skills: ['React'], stack: ['Node'] });
const created = await api<{ id: string }>(userA, 'POST', '/api/postings', {
  rawText: 'Private posting belonging to user A',
});
const postingA = created.body?.id;
if (created.status !== 201 || !postingA) {
  // Stop early with a clear message rather than failing every later check.
  console.error(
    `\nSetup failed: POST /api/postings returned ${created.status} ${JSON.stringify(created.body)}` +
      `\nIs the API running, and does its database have the migrations applied (npm run db:reset)?`,
  );
  process.exit(1);
}
const createdApp = await api<{ id: string }>(userA, 'POST', '/api/applications', {
  postingId: postingA,
  status: 'applied',
  notes: 'Private notes belonging to user A',
});
const applicationA = createdApp.body?.id;
if (createdApp.status !== 201 || !applicationA) {
  console.error(
    `\nSetup failed: POST /api/applications returned ${createdApp.status} ${JSON.stringify(createdApp.body)}`,
  );
  process.exit(1);
}
await rest(userA, 'POST', 'rpc/increment_usage', {});
check('setup: A has a posting and an application', true);

// --- 1. Through the API -----------------------------------------------------
console.log('\n1. Through the Express API (user B attacking user A)');

const bPostings = await api<unknown[]>(userB, 'GET', '/api/postings');
check("B's posting list is empty", bPostings.body?.length === 0, bPostings.body);

const bReadsPosting = await api(userB, 'GET', `/api/postings/${postingA}`);
check("B reading A's posting -> 404", bReadsPosting.status === 404, bReadsPosting.status);

const bDeletesPosting = await api(userB, 'DELETE', `/api/postings/${postingA}`);
check("B deleting A's posting -> 404", bDeletesPosting.status === 404, bDeletesPosting.status);

const bReadsApplication = await api(userB, 'GET', `/api/applications/${applicationA}`);
check(
  "B reading A's application -> 404",
  bReadsApplication.status === 404,
  bReadsApplication.status,
);

const bPatchesApplication = await api(userB, 'PATCH', `/api/applications/${applicationA}`, {
  status: 'rejected',
});
check(
  "B updating A's application -> 404",
  bPatchesApplication.status === 404,
  bPatchesApplication.status,
);

const bAttaches = await api(userB, 'POST', '/api/applications', { postingId: postingA });
check(
  "B attaching an application to A's posting -> 404",
  bAttaches.status === 404,
  bAttaches.status,
);

const bProfile = await api<{ skills: string[] }>(userB, 'GET', '/api/profile');
check("B's profile is empty, not A's", bProfile.body?.skills?.length === 0, bProfile.body);

const bSpoofs = await api(userB, 'POST', '/api/postings', {
  rawText: 'spoofed',
  userId: userA.id,
});
check('B sending userId in the body -> 400 rejected', bSpoofs.status === 400, bSpoofs.status);

// --- 2. Bypassing the API (direct Supabase REST) ----------------------------
console.log('\n2. Bypassing the API: direct Supabase REST with the public anon key');

const bSelectsPostings = await rest(userB, 'GET', 'job_postings?select=id,raw_text');
check(
  "B selecting job_postings returns none of A's rows",
  Array.isArray(bSelectsPostings.body) && bSelectsPostings.body.length === 0,
  bSelectsPostings.body,
);

const bSelectsProfiles = await rest(userB, 'GET', 'profiles?select=user_id,skills');
check(
  'B selecting profiles returns nothing',
  Array.isArray(bSelectsProfiles.body) && bSelectsProfiles.body.length === 0,
  bSelectsProfiles.body,
);

const bUpdatesPosting = await rest(userB, 'PATCH', `job_postings?id=eq.${postingA}`, {
  raw_text: 'tampered by B',
});
check(
  "B updating A's posting changes 0 rows",
  Array.isArray(bUpdatesPosting.body) && bUpdatesPosting.body.length === 0,
  bUpdatesPosting.body,
);

const bDeletesRow = await rest(userB, 'DELETE', `job_postings?id=eq.${postingA}`);
check(
  "B deleting A's posting deletes 0 rows",
  Array.isArray(bDeletesRow.body) && bDeletesRow.body.length === 0,
  bDeletesRow.body,
);

const bInsertsAsA = await rest<{ code?: string }>(userB, 'POST', 'job_postings', {
  user_id: userA.id,
  raw_text: 'row owned by A, written by B',
});
check(
  'B inserting a row owned by A -> rejected by RLS',
  bInsertsAsA.status === 403 || bInsertsAsA.body.code === '42501',
  { status: bInsertsAsA.status, body: bInsertsAsA.body },
);

const bAttachesDirect = await rest<{ code?: string }>(userB, 'POST', 'applications', {
  user_id: userB.id,
  posting_id: postingA,
});
check(
  "B attaching their own application to A's posting -> rejected by RLS",
  bAttachesDirect.status === 403 || bAttachesDirect.body.code === '42501',
  { status: bAttachesDirect.status, body: bAttachesDirect.body },
);

const bReadsCounters = await rest(userB, 'GET', 'usage_counters?select=user_id,request_count');
check(
  "B cannot see A's usage counter",
  Array.isArray(bReadsCounters.body) && bReadsCounters.body.length === 0,
  bReadsCounters.body,
);

// B's own rate-limit counter must be tamper-proof (ADR-006).
await rest(userB, 'POST', 'rpc/increment_usage', {});
const bResetsOwn = await rest(userB, 'PATCH', `usage_counters?user_id=eq.${userB.id}`, {
  request_count: 0,
});
check(
  'B cannot reset their own usage counter (update changes 0 rows)',
  Array.isArray(bResetsOwn.body) && bResetsOwn.body.length === 0,
  bResetsOwn.body,
);

const bDeletesOwnCounter = await rest(userB, 'DELETE', `usage_counters?user_id=eq.${userB.id}`);
check(
  'B cannot delete their own usage counter',
  Array.isArray(bDeletesOwnCounter.body) && bDeletesOwnCounter.body.length === 0,
  bDeletesOwnCounter.body,
);

const bInsertsCounter = await rest<{ code?: string }>(userB, 'POST', 'usage_counters', {
  user_id: userB.id,
  window_start: new Date().toISOString(),
  request_count: 0,
});
check(
  'B cannot insert a usage counter row',
  bInsertsCounter.status === 403 || bInsertsCounter.body.code === '42501',
  { status: bInsertsCounter.status, body: bInsertsCounter.body },
);

const bCounter = await rest<{ request_count: number }[]>(
  userB,
  'GET',
  'usage_counters?select=request_count',
);
check(
  "B's own counter still shows their 1 request",
  bCounter.body?.[0]?.request_count === 1,
  bCounter.body,
);

// --- 3. Signed out ----------------------------------------------------------
console.log('\n3. Signed out (anon key only)');

const anonPostings = await rest(null, 'GET', 'job_postings?select=id');
check(
  'anon select returns no rows',
  anonPostings.status === 401 ||
    (Array.isArray(anonPostings.body) && anonPostings.body.length === 0),
  { status: anonPostings.status, body: anonPostings.body },
);

const anonRpc = await rest(null, 'POST', 'rpc/increment_usage', {});
check('anon cannot call increment_usage', anonRpc.status >= 400, anonRpc.status);

const anonApi = await api(null, 'GET', '/api/postings');
check('API without a token -> 401', anonApi.status === 401, anonApi.status);

// --- 4. A's data survived every attempt -------------------------------------
console.log("\n4. User A's data is unchanged");

const aPosting = await api<{ rawText: string }>(userA, 'GET', `/api/postings/${postingA}`);
check('A can still read their posting', aPosting.status === 200, aPosting.status);
check(
  'the posting text was not tampered with',
  aPosting.body?.rawText === 'Private posting belonging to user A',
  aPosting.body?.rawText,
);
const aApplication = await api<{ status: string; notes: string }>(
  userA,
  'GET',
  `/api/applications/${applicationA}`,
);
check(
  'the application still has A’s status and notes',
  aApplication.body?.status === 'applied' &&
    aApplication.body?.notes === 'Private notes belonging to user A',
  aApplication.body,
);

// --- Clean up ---------------------------------------------------------------
await api(userA, 'DELETE', '/api/account');
await api(userB, 'DELETE', '/api/account');
console.log('\ncleaned up: both test accounts deleted');

console.log(`\nRESULT: ${passed} passed, ${failed} failed`);
process.exit(failed === 0 ? 0 : 1);
