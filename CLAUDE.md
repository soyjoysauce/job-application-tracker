# CLAUDE.md

## Project summary

Personal job application tracker and analyzer. Users sign in (Supabase Auth), keep a skills profile, paste job postings for Claude to extract structured fields and a gap analysis, and track applications. Users can delete their account and all their data.

**Postponed (don't build unless asked):** per-posting chatbot with SSE (ADR-007) and re-running only the gap analysis. See `docs/roadmap.md` → Later.

**Out of scope:** job aggregator APIs, scraping, n8n, auto-fill, billing, embeddings/vector DB.

npm workspaces monorepo: `client/` (React + TS + Vite + Tailwind v4), `server/` (Express + TS), `shared/` (zod schemas + types), `supabase/migrations/`. Hosted on Vercel as two projects (root dirs `client/` and `server/`).

Build order: [docs/roadmap.md](docs/roadmap.md). Background: [docs/architecture.md](docs/architecture.md), [docs/decisions.md](docs/decisions.md).

## Working rule: the owner must be able to explain all code

The project owner must be able to explain every line of generated code. For **every change**:

- Summarize what changed **per file** (file path → what and why), in plain language.
- Point out any new concept, library, or pattern and explain it briefly.
- Prefer simple, readable code over clever code. Don't add features or abstractions beyond the current roadmap step.
- Don't write dependency versions from memory. Install with `npm install <pkg>` and let npm resolve them.
- Check current official docs for anything version-sensitive (Vercel, Supabase, Tailwind, Anthropic SDK, Express).

## Architecture rules (must follow)

1. **Auth flow**
   a. React signs in with Supabase Auth and receives an access token (JWT).
   b. React sends `Authorization: Bearer <token>` to Express.
   c. Express middleware verifies the token with Supabase and returns 401 if it's invalid.
   d. Express creates a per-request Supabase client using the anon/publishable key plus the user's token.
   e. RLS policies use `auth.uid()` to restrict rows to that user.
   Never trust a user id from the request body, params, or query.
2. **Secrets.** `SUPABASE_SERVICE_ROLE_KEY` is server-only and used only for admin operations (account deletion) via `createAdminClient()`. `ANTHROPIC_API_KEY` is server-only. Nothing secret gets a `VITE_` prefix.
3. **Layered server.** `routes/ → controllers/ → services/`, plus `middleware/`. Validate all input with zod. One central error middleware with a consistent error shape: `{ error: { code, message, details? } }` (`ApiErrorBody` in `shared/`).
4. **Rate limiting** state lives in the database (`usage_counters`), never in memory, because Vercel runs multiple instances. Users have read-only access to `usage_counters`. Increment only via `supabase.rpc('increment_usage')` (ADR-006).
5. **Hardening.** CORS restricted to `CLIENT_ORIGIN`, `helmet`, JSON body size limit, env vars validated at startup.
6. **Claude output** is validated with the shared zod schema before saving. Retry once, then mark the analysis `failed`.

## Folder conventions

```
client/src/
  pages/        route-level components
  components/   reusable UI components
  hooks/        custom React hooks
  lib/          supabase.ts (Auth client), api.ts (fetch wrapper with Bearer token),
                authContext.ts (context object only, no components)

server/src/
  app.ts        Express app, `export default app` (Vercel entry; never call listen() here)
  local.ts      local dev only: imports app and calls listen()
  config/       env.ts (zod env validation)
  routes/       *.routes.ts: paths + middleware only, mounted in routes/index.ts under /api
  controllers/  *.controller.ts: validate input, call services, send response
  services/     *.service.ts: business logic, DB and Claude calls (no req/res)
  middleware/   *.middleware.ts: auth, errors, 404, rate limit
  lib/          client factories (supabase.ts, anthropic.ts), HttpError, validate.ts (zod helpers)
  types/        type augmentations (express.d.ts)

shared/src/     zod schemas + inferred types (import as `@jat/shared`)
supabase/migrations/  timestamped SQL files
```

Conventions:

- **Server imports use `.js` extensions** for relative paths (`import { x } from './foo.js'`), which `NodeNext` module resolution requires.
- **Don't create `server/src/index.ts` or `server/src/server.ts`.** Vercel auto-detects those names, and `src/app.ts` must stay the only entry.
- Throw `HttpError(status, code, message)` for expected errors, and let the error middleware format them. Express 5 forwards errors thrown in async handlers automatically, so no try/catch wrappers are needed.
- **Auth:**
  - Mount authenticated routers in `routes/index.ts` as `apiRouter.use('/x', requireAuth, xRouter)`.
  - In controllers, get the user and their Supabase client with `const { userId, supabase } = getAuth(req)`.
  - Pass that `supabase` client into services for all user data queries.
  - Never read a user id from the body, params, or query.
- **Validation:** in controllers, use `parseBody(schema, req)`, `parseParams(schema, req)` and `parseQuery(schema, req)` from `lib/validate.ts`. Shared request/response schemas live in `shared/`.
  - Body schemas use `z.strictObject`, so unknown fields (like `userId`) are rejected.
  - IDs use `idSchema` (`z.guid()`).
- **Services:**
  - Signature: `(db: Db, userId: string, ...inputs)`. `db` is the per-request client from `getAuth`.
  - Filter with `.eq('user_id', userId)` even though RLS also enforces it.
  - Convert database rows (snake_case) to shared API types (camelCase) inside the service.
  - Throw `toHttpError(error)` for Supabase errors and `notFound('Thing')` for missing rows.
  - For update/delete, add `.select()` and treat 0 rows as 404: RLS hides other users' rows without raising an error.
  - Return 404, never 403, for another user's resource, so its existence isn't revealed.
- **DB types:** `server/src/types/database.types.ts` is generated. After every migration, run `npm run db:types` (with the local stack running), and never edit that file by hand.
- **Postings are read-only** (ADR-009). Don't add an update endpoint unless asked.
- **Client (React):**
  - Data goes through `api.get/post/put/patch/delete` from `lib/api.ts`, never straight to Supabase. Supabase is used for Auth only.
  - Read the session with `useAuth()`; never read tokens from localStorage directly.
  - Pages are default exports in `pages/`; add them under `<ProtectedRoute><Layout>` in `App.tsx` unless they're public.
  - Data fetching is plain `useState` + `useEffect` (no query library). Use the `cancelled` flag pattern so a response can't update an unmounted page, and always handle loading, error, and empty states.
  - Reuse `Button`, `Input`, `Label`, `Card` and `ErrorText` from `components/ui.tsx` instead of new Tailwind class strings.
  - Keep files that export components separate from files that export context or helpers (the `react-refresh` lint rule).
  - `ProtectedRoute` is convenience only. Real protection is the server plus RLS.
- **Account deletion:**
  - `services/account.service.ts` is the only code that uses `createAdminClient()`.
  - It must call `auth.admin.deleteUser(userId, false)`, a hard delete. A soft delete keeps `auth.users`, so the cascade never runs and the user's data stays.
  - The user id comes only from `getAuth(req)`.
  - Any new user-owned table must reference `auth.users` with `on delete cascade`, or deletion will leave its rows behind.
- `shared/` is built to `dist/`. Rebuild it (or keep `npm run dev` running) after changing schemas.
- Every new table follows the migration rules:
  - `user_id` → `auth.users` on delete cascade
  - RLS enabled
  - separate select/insert/update/delete policies with `auth.uid()`
  - an index **starting with** `user_id` and one starting with each foreign key (a unique constraint's or composite index's leading column counts, so don't add duplicate single-column indexes)
- Policies that reference another user-owned table (e.g. `posting_id`) must also check that the referenced row belongs to `auth.uid()`.
- A deliberate policy exception is documented in `docs/decisions.md`: `usage_counters` is select-only (ADR-006). Don't "fix" it.
- `shared/` is built by the `client` and `server` build scripts before they build.

## Commands (repo root)

```bash
npm run dev          # shared watcher + API (http://localhost:3001) + client (http://localhost:5173)
npm run build        # build server, then client (each builds shared first)
npm run lint         # ESLint
npm run typecheck    # build shared, then tsc --noEmit in each workspace
npm run format       # Prettier
npm run db:start     # local Supabase in Docker (applies migrations)
npm run db:test      # pgTAP tests in supabase/tests/database/
npm run db:reset     # rebuild local DB from migrations
npm run db:stop      # stop local Supabase
npm run db:types     # regenerate server/src/types/database.types.ts from the local DB
```

Database rules:

- Never edit a migration that's already been pushed to the hosted project. Add a new one with `npx supabase migration new <name>`.
- Every schema change comes with pgTAP tests. `npm run db:test` must pass.
- Never run `supabase db push` or `supabase link` yourself. The owner runs them.

Workspace-specific: `npm run <script> -w @jat/client | @jat/server | @jat/shared`.
