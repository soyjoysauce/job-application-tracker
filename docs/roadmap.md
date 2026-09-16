# Roadmap

Build in this order. Each step should leave the app building, type-checking, and linting cleanly.

## 1. Schema + RLS ✅

- Migration: `supabase/migrations/20260916000000_initial_schema.sql`. The design decisions are in `docs/decisions.md` (ADR-005 to ADR-007).
- Tested locally with pgTAP (`supabase/tests/database/schema_rls.test.sql`, 35 tests):
  - structure and policies;
  - two-user isolation at the SQL level;
  - the `usage_counters` tamper checks;
  - `increment_usage()`;
  - deletion cascading from `auth.users`.
- Apply to the hosted project with `supabase link` + `supabase db push` (see README → Database).

## 2. Express foundation + auth middleware ✅

- `requireAuth`: Bearer token → `auth.getClaims` → 401 on failure; sets `req.auth` (ADR-008).
- `createUserClient(token)`, `getAuthClient()`, the `req.auth` type, and the `getAuth(req)` helper.
- zod helpers `parseBody` / `parseParams` / `parseQuery` (`server/src/lib/validate.ts`). Validation errors return `details: [{ path, message }]`.
- `GET /api/me` as the first protected route.
- Verified manually against the local stack:
  - 401 for a missing header, wrong scheme, garbage token, forged signature, or the anon key sent as a token;
  - 200 for real users; 400 for malformed JSON; 413 (`PAYLOAD_TOO_LARGE`) for oversized bodies; the CORS origin is set;
  - the per-request client respects RLS and can call `increment_usage()`.
- Automated versions of these checks come in step 9.

## 3. CRUD endpoints ✅

- Profile (get/upsert), postings (list/create/get/delete; read-only per ADR-009), and applications (full CRUD plus a `?status=` filter). All follow routes → controllers → services. The endpoint list is in `docs/architecture.md`.
- Request schemas and response types are in `shared/` (`profile.ts`, `posting.ts`, `application.ts`, `common.ts`).
- Generated database types (`npm run db:types`) make every query type-checked against the schema.
- Database errors map to safe HTTP errors (`server/src/lib/dbError.ts`).
- Verified manually against the local stack with two users (43 checks):
  - validation, including rejected unknown fields like `userId`;
  - 404 for other users' resources on read, update and delete;
  - 409 for a duplicate application;
  - the posting → application cascade.

## 4. Account deletion

- `DELETE /api/account`: uses `createAdminClient()` to delete the auth user. `on delete cascade` removes all of that user's rows.
- Verify that no rows remain for the deleted user.

## 5. Frontend auth + views

- Implement Supabase Auth in the client (sign up, sign in, sign out, session handling).
- Implement `apiFetch` with the Bearer token.
- Add routing and pages: profile, postings list/detail, application tracker.

## 6. Rate limiting

- Limiter middleware that calls `supabase.rpc('increment_usage')` with the per-request client, compares the returned count to the limit, and returns 429 when it's over (see ADR-006).
- Apply it to Claude-backed endpoints.
- Verify a user **can't** insert, update, or delete `usage_counters` rows directly through the Supabase REST API.

## 7. RLS verification with two users

- The SQL-level checks already exist (`npm run db:test`). This step verifies the same guarantees end to end.
- With two test accounts, confirm user A can't read, update, or delete user B's rows, both through the API and directly through the Supabase REST API with the anon key.
- Confirm a user can't attach an application to another user's posting.

## 8. Claude posting analyzer

- Extract structured fields and a gap analysis against the profile.
- Validate with `postingAnalysisSchema`. Retry once, then set `analysis_status = 'failed'`.
- Save `extraction` → `job_postings.extracted` and `gapAnalysis` → `job_postings.gap_analysis`.

## 9. Tests

- Server: Jest + Supertest (routes, auth middleware, error shape, validation).
- Client: React Testing Library.
- Pick the test runner setup (Jest with ESM + TS) when this step starts.

## 10. GitHub Actions CI

- On push/PR: install, lint, typecheck, test, build.

## 11. Vercel deployment + Supabase keep-alive

- Create two Vercel projects from this repo: root directory `client/` and root directory `server/`.
- Set environment variables for each project. Set `CLIENT_ORIGIN` to the deployed client URL.
- In each project's **Root Directory** settings, confirm **"Include source files outside of the Root Directory in the Build Step"** is on. It's on by default for new projects, and both apps need it to reach `shared/`.
- **Building `shared/`:** both `client` and `server` `build` scripts start with `npm run build -w @jat/shared`. Running that from inside `server/` was tested locally: npm finds the workspace root.
- **Verify with the first preview deploy:**
  - Does Vercel's Express preset run `server`'s `build` script? If not, set the server project's Build Command to `npm run build`.
  - Did install run at the repo root (workspace lockfile)?
  - Does `/api/health` respond?
- Add a daily GitHub Actions workflow that pings Supabase so the free-tier project isn't paused.

**What Vercel's docs confirm (checked 2026-09-16):**

- One Vercel project per folder, and every push deploys both.
- The package manager is detected from the **root** lockfile. npm workspaces are supported, as long as each package has a unique `name` and internal dependencies are listed in each `package.json`.
- Projects whose code and internal dependencies didn't change are skipped automatically, so a change to `shared/` redeploys both.

**Not stated in the docs:**

- Whether the Express preset runs the `build` script.
- The docs also contradict themselves: one page says an app "will not be able to access files outside" its root directory, while the monorepo FAQ says the "include source files outside" setting allows it.
- Hence the verification step above.

**Before going live:** set a spending limit in the Anthropic Console as the hard cap on Claude costs. The app's rate limit protects against normal overuse, not against every possible cost.

---

## Later (postponed; not part of the first version)

### Per-posting chatbot with SSE (ADR-007)

- Two modes: `ask` (about the role) and `interview` (mock interviewer).
- Stream responses with Server-Sent Events. Check Vercel function duration limits for streaming on the current plan.
- **New migration** that:
  - creates `chat_messages` (`user_id`, `posting_id`, `role`, `content`, `mode`, `created_at`), following the table rules in `CLAUDE.md`, including the posting ownership check;
  - makes it **append-only**: select/insert/delete policies, no update policy. "Edit and regenerate" = delete the message and everything after it, then insert;
  - adds a `bucket` column (`'analysis'` | `'chat'`) to `usage_counters`, changes the unique constraint to `(user_id, bucket, window_start)`, and changes `increment_usage()` to `increment_usage(p_bucket text)`, so chat and analysis get separate daily limits.

### Re-run gap analysis after a profile change

- Re-run only the gap analysis, without re-extracting the posting.
- **New migration** that adds `gap_status` and `gap_analyzed_at` to `job_postings`, so a failed re-run doesn't mark the whole analysis as failed. `gap_analyzed_at` compared with `profiles.updated_at` can show "profile changed — re-run?".
