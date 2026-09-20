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

## 4. Account deletion ✅

- `DELETE /api/account` (no body; the UI asks for confirmation) uses `createAdminClient()` to **hard**-delete the auth user. `on delete cascade` removes all of that user's rows.
- Verified manually against the local stack (19 checks):
  - 401 without a token and 204 on success;
  - all of the user's rows in every table go from 1 to 0, and the Auth user is gone;
  - the old token still passes auth until it expires but sees no data, a second delete returns 404, and signing in fails;
  - the other user is untouched.
- Also demonstrated locally that a **soft** delete would leave the user's rows in place, which is why the code passes `false`.

## 5a. Frontend auth + profile ✅

- Browser Supabase client (session kept in localStorage, token auto-refreshed) — Auth only.
- `apiFetch` / `api.*` helpers attach the Bearer token, parse the shared error shape, and throw `ApiError` (`status`, `code`).
- Auth state in React context: `lib/authContext.ts`, `components/AuthProvider.tsx`, `hooks/useAuth.ts`.
- React Router 8 (`react-router`), declarative mode: `/signin` public; `ProtectedRoute` → `Layout` → `/profile`, `/account`; `*` → 404.
- Pages: sign in / sign up (with an email-confirmation message), profile (comma-separated skills and stack), account (delete, guarded by typing `DELETE`).
- Shared UI pieces in `components/ui.tsx` (Button, Input, Label, Card, ErrorText).
- Verified in a browser against the local stack: sign up → profile; server-side trim/de-duplication shown in the form; refresh keeps the session; a signed-out deep link redirects to `/signin`; deletion signs out and the old credentials stop working; a failed sign-in shows the error.

## 5b. Frontend postings + applications ✅

- Postings: list (`/postings`, newest first, with analysis + application badges and a text preview), paste-new (`/postings/new`), detail (`/postings/:id`) with the analysis card, the application section, the pasted text, and a two-step delete that warns about the application cascade.
- Applications: `/applications` with a status filter, inline status changes, notes preview, and remove. Create/edit (status, applied date, notes) lives on the posting detail page.
- `useApiQuery(path)` hook: one place for loading/error/reload. Loading is **derived** from a key rather than set inside the effect (React's `set-state-in-effect` rule).
- `lib/format.ts`: `formatTimestamp` (local, for createdAt) vs `formatCalendarDate` (UTC, for appliedAt), status tones and labels.
- Status dropdowns are built from `applicationStatusSchema.options`, so the UI can't drift from the API.
- Verified in a browser against the local stack: paste → list → detail → track application → edit status/date/notes → filter → inline status change → delete posting removes its application.
- **Bug found and fixed while testing:** an applied date of 18 Sep displayed as 17 Sep, because a date-only value stored as midnight UTC was formatted in local time.

## 6. Rate limiting ✅

- `rateLimit` middleware (`server/src/middleware/rateLimit.middleware.ts`): calls `increment_usage()` through the per-request client, compares the new count to `DAILY_CLAUDE_LIMIT` (default 20), and throws 429 `RATE_LIMITED` with a `Retry-After` header and `{ limit, resetAt }` details.
- Counting happens **before** the work, so failed or slow Claude calls can't be retried for free. A blocked request still increments, so `GET /api/usage` clamps `used` to the limit.
- `GET /api/usage` returns `{ used, limit, remaining, resetAt }` for the UI (reading is free).
- `server/src/services/usage.service.ts` computes the window as midnight **UTC**, matching the SQL function.
- Verified against the local stack with `DAILY_CLAUDE_LIMIT=3` and two users (13 checks): the first 3 requests pass, the 4th returns 429 with `Retry-After`, reported usage is clamped while the stored counter keeps counting, and the second user has an independent quota.
- **Still to do in step 8:** mount `rateLimit` on the analyzer route.
- A user **can't** insert, update, or delete `usage_counters` rows directly (covered by the pgTAP tests from step 1).

## 7. RLS verification with two users ✅

- `npm run verify:rls` (`scripts/verify-rls.ts`) creates two throwaway users, attacks one from the other, and deletes both accounts afterwards. 26 checks in four groups:
  1. **Through the API:** B gets 404 reading, updating, deleting, or attaching an application to A's things; B's profile and list stay empty; sending `userId` in a body is rejected with 400.
  2. **Bypassing the API** (direct Supabase REST with the public anon key + B's real token): selects return none of A's rows; updates and deletes affect 0 rows; inserting a row owned by A, or attaching to A's posting, is refused by RLS; B cannot read A's counter, nor reset, delete, or insert their own (ADR-006).
  3. **Signed out:** the anon key alone returns no rows, can't call `increment_usage()`, and the API returns 401.
  4. **A's data is unchanged** after every attempt.
- **The verifier was itself verified:** adding a deliberately permissive `select` policy to the local database made check 2 fail, exposing every user's postings.
- **Worth knowing:** with that leaky policy, the **API checks still passed**, because the services also filter by `user_id`. Only the direct-REST checks caught it. That's why this step tests both paths — and why policy changes must always be re-verified with `npm run verify:rls`, not just through the UI.
- Run it against a deployed environment by pointing `API_URL` and `SUPABASE_URL` at it.

## 8. Claude posting analyzer ✅

- `POST /api/postings/:id/analyze` (behind `requireAuth` + `rateLimit`) extracts the posting's facts and compares them with the profile in one Claude call (ADR-010: `claude-sonnet-5`, button-triggered, `messages.parse` with the shared zod schema).
- Retries once, then sets `analysis_status = 'failed'` and returns 502. A second concurrent request gets 409.
- Saves `extraction` → `job_postings.extracted`, `gapAnalysis` → `job_postings.gap_analysis`.
- Gap analysis shape: matched / missing / matched nice-to-have skills, `overallFit`, and a short summary.
- UI: "Analyze with Claude" on the posting page with "N of 20 analyses left today", then the extracted fields plus a "How you compare" section.
- Verified: failure path with an invalid key (502, status `failed`, two attempts logged, quota still spent); three live calls — salary extracted when listed, `null` and "Not stated" when absent, and a **prompt-injection attempt inside a posting was ignored**.

## 9. Tests ✅

- **Runner: Vitest**, not Jest as originally planned — it runs this project's ESM + TypeScript with no extra configuration, and reuses the client's Vite setup. Same `describe` / `it` / `expect` API.
- **The database is faked** (`server/test/helpers.ts`): tests run in ~1s with no Docker, so they work anywhere including CI. Real database behaviour stays covered by `npm run db:test` (pgTAP) and `npm run verify:rls`.
- `npm test` from the root runs both suites (54 tests).
- **Server (41):** health/404/error shape/CORS/helmet/body limit; `requireAuth` accepting and rejecting tokens; rate limiting (allows up to the limit, 429 with `Retry-After`, counts before the work, not applied to free routes); the analyzer (success, retry once, fail twice → 502 + `failed`, refusal, schema mismatch, 409 concurrency, **posting text sent as tagged data**, user id never taken from the request); usage window and clamping; Postgres error mapping; validation (unknown fields like `userId` rejected, bad ids, empty updates, no echo of submitted values).
- **Client (13):** date helpers including a **regression guard for the off-by-one calendar-date bug**; profile page load/save/error; posting detail page analyze flow, quota message, "Not listed" salary, and the delete-cascade warning.
- Test files are type-checked too (`server/tsconfig.test.json`, client `include`).
- Verified the suite catches regressions: re-introducing the step 5b date bug failed the guard (`expected 'Sep 17, 2026' to contain '18'`).

## 10. GitHub Actions CI ✅

- `.github/workflows/ci.yml` runs on pushes to `main` and on every pull request. A new push to the same branch cancels the previous run.
- **Job 1 — checks (~1-2 min):** `npm ci`, `lint`, `typecheck`, `test` (54 Vitest tests), `build`. No Docker and no secrets: Supabase and Anthropic are faked in tests.
- **Job 2 — database (~3-4 min, in parallel):** starts local Supabase in Docker via `supabase/setup-cli`, applies every migration, and runs the 35 pgTAP tests. This is what catches a broken migration or RLS policy before it reaches the hosted project.
- Node comes from `.nvmrc`, so CI and local development can't drift.
- `npm run verify:rls` is deliberately **not** in CI (it needs the API running as well); run it locally after policy or endpoint changes.
- Verified locally before pushing: `npm ci --dry-run` (lockfile in sync) and the exact command sequence. GitHub validates the workflow file itself on the first push.

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
