# Job Application Tracker

A personal job application tracker and analyzer.

- **Accounts:** sign up / sign in with Supabase Auth
- **Skills profile:** your skills and stack
- **Posting analyzer:** paste a job posting's text. Claude extracts the title, company, required and nice-to-have skills, stack, seniority, and salary range (only if listed), plus a gap analysis against your profile.
- **Application tracker:** status, notes, and dates, linked to postings
- **Account deletion:** removes all of your data

Postponed: a per-posting chatbot ("ask about this role" / "mock interviewer", SSE streaming). See [docs/roadmap.md](docs/roadmap.md) → Later.

Out of scope: job aggregator APIs, scraping, n8n, auto-fill, billing.

> **Status:** scaffold only. `GET /api/health` is the only implemented endpoint. See [docs/roadmap.md](docs/roadmap.md).

## Architecture

npm workspaces monorepo:

| Workspace              | What it is                                                                         |
| ---------------------- | ---------------------------------------------------------------------------------- |
| `client/`              | React + TypeScript + Vite + Tailwind CSS (deployed as Vercel project #1)           |
| `server/`              | Express + TypeScript API (deployed as Vercel project #2, a single Vercel Function) |
| `shared/`              | zod schemas and TypeScript types used by both                                      |
| `supabase/migrations/` | SQL migrations (PostgreSQL + RLS)                                                  |

React → Express (with a Supabase JWT) → Supabase Postgres (RLS). Express → Anthropic API. Secrets live only in `server/`.

- [docs/architecture.md](docs/architecture.md): diagrams, auth flow, architecture rules
- [docs/decisions.md](docs/decisions.md): decision records
- [docs/roadmap.md](docs/roadmap.md): build order

## Prerequisites

- **Node.js 24 (LTS)**, see `.nvmrc` (`nvm use`)
- npm (bundled with Node)
- A [Supabase](https://supabase.com) project
- An [Anthropic API](https://console.anthropic.com) key
- A [Vercel](https://vercel.com) account (for deployment)

## Setup

```bash
nvm use                                    # Node 24
# install dependencies (see "Dependencies to install" below)
cp client/.env.example client/.env         # then fill in values
cp server/.env.example server/.env         # then fill in values
# apply the database migrations (see "Database" below)
npm run dev
```

- Client: http://localhost:5173
- API health check: http://localhost:3001/api/health

## Database

Schema changes live in `supabase/migrations/` and are applied with the Supabase CLI (installed as a dev dependency, so run it with `npx supabase`). Tests live in `supabase/tests/database/` and use pgTAP.

**Local database (needs Docker Desktop running):**

| Command            | What it does                                                                                                                                 |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm run db:start` | Starts a local Supabase in Docker and applies all migrations. Prints local URLs and keys. Studio (the admin UI) is at http://127.0.0.1:54323 |
| `npm run db:test`  | Runs the pgTAP tests against the local database                                                                                              |
| `npm run db:reset` | Recreates the local database from the migrations (deletes local data)                                                                        |
| `npm run db:stop`  | Stops the local containers                                                                                                                   |
| `npm run db:types` | Regenerates `server/src/types/database.types.ts` from the local database. Run it after every migration                                       |

**Hosted project (one-time link, then push new migrations):**

```bash
npx supabase login                                 # opens the browser
npx supabase link --project-ref <your-project-ref> # asks for your database password
npx supabase db push --dry-run                     # shows what would be applied
npx supabase db push                               # applies it
```

- The project ref is the `<ref>` in `https://<ref>.supabase.co`.
- **Never edit a migration that's already been pushed.** Create a new one with `npx supabase migration new <name>`.

## Environment variables

### `client/.env`

| Variable                 | Description                                                |
| ------------------------ | ---------------------------------------------------------- |
| `VITE_SUPABASE_URL`      | Supabase project URL                                       |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon/publishable key (public, protected by RLS)   |
| `VITE_API_URL`           | Base URL of the Express API (e.g. `http://localhost:3001`) |

### `server/.env`

| Variable                    | Description                                               |
| --------------------------- | --------------------------------------------------------- |
| `SUPABASE_URL`              | Supabase project URL                                      |
| `SUPABASE_ANON_KEY`         | Supabase anon/publishable key, used with the user's token |
| `SUPABASE_SERVICE_ROLE_KEY` | **Secret.** Bypasses RLS. Account deletion only           |
| `ANTHROPIC_API_KEY`         | **Secret.** Claude API key                                |
| `CLIENT_ORIGIN`             | Allowed CORS origin (e.g. `http://localhost:5173`)        |
| `PORT`                      | Local dev port (default `3001`, ignored on Vercel)        |

All server variables are validated at startup by `server/src/config/env.ts`.

## Scripts (run from the repo root)

| Script                 | What it does                                                                                          |
| ---------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`          | Builds `shared/`, then runs the shared watcher, API (`tsx watch`), and Vite together                  |
| `npm run build`        | Builds `server/`, then `client/` (each builds `shared/` first, which is what Vercel runs per project) |
| `npm run lint`         | ESLint across the monorepo                                                                            |
| `npm run typecheck`    | Builds `shared/`, then type-checks every workspace                                                    |
| `npm run format`       | Formats with Prettier                                                                                 |
| `npm run format:check` | Checks formatting without writing                                                                     |

## Dependencies to install

Versions are intentionally not pinned here. Run **every command from the repo root**. The `-w <workspace>` flag picks which workspace's `package.json` the package is added to, so there's no need to `cd` into a folder.

`@jat/shared` is already listed as `"*"` in `server/package.json` and `client/package.json`. That tells npm workspaces to link the local `shared/` folder. It isn't published on npm, so don't `npm install` it by name.

**Root (dev):**

```bash
npm install -D typescript eslint @eslint/js typescript-eslint globals eslint-plugin-react-hooks eslint-plugin-react-refresh eslint-config-prettier prettier concurrently @types/node
```

**shared:**

```bash
npm install zod -w @jat/shared
```

**server:**

```bash
npm install express cors helmet zod @supabase/supabase-js @anthropic-ai/sdk -w @jat/server
npm install -D tsx @types/express @types/cors -w @jat/server
```

**client:**

```bash
npm install react react-dom @supabase/supabase-js -w @jat/client
npm install -D vite @vitejs/plugin-react tailwindcss @tailwindcss/vite @types/react @types/react-dom -w @jat/client
```

Added in later roadmap steps:

- Routing (step 5): e.g. `react-router`
- Tests (step 9): `jest`, `supertest`, `@types/supertest`, `@testing-library/react`, `@testing-library/jest-dom`, plus ESM/TS support for Jest (e.g. `ts-jest`), and a DOM environment (e.g. `jest-environment-jsdom`)

> After installing, check that `node_modules/@jat/shared` is a link to `shared/`, not a downloaded package: `ls -l node_modules/@jat` should show `shared -> ../../shared`.
