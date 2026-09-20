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
