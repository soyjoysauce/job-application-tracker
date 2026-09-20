# Deployment

Two Vercel projects from this one repository, plus a daily workflow that keeps the free Supabase project awake.

```
client/  →  Vercel project #1 (static React app)
server/  →  Vercel project #2 (Express as a single Vercel Function)
```

**Before you start**

- The repository is pushed to GitHub and CI is green.
- The Supabase migrations are applied to the hosted project (`npx supabase db push`).
- **Set a spending limit in the Anthropic Console.** The app's daily limit protects against normal overuse; the Console limit is the hard cap on your bill.

---

## 1. Deploy the server

1. [vercel.com](https://vercel.com) → **Add New… → Project** → import `job-application-tracker`.
2. **Root Directory: `server`** (click Edit next to Root Directory). Leave "Include source files outside of the Root Directory" **on** — the API imports `shared/`.
3. Framework preset: **Express** (detected automatically).
4. Add the environment variables below (Production **and** Preview):

   | Variable                    | Value                                                |
   | --------------------------- | ---------------------------------------------------- |
   | `SUPABASE_URL`              | `https://<project-ref>.supabase.co`                  |
   | `SUPABASE_ANON_KEY`         | anon / publishable key                               |
   | `SUPABASE_SERVICE_ROLE_KEY` | **secret** — service role key                        |
   | `ANTHROPIC_API_KEY`         | **secret** — Claude API key                          |
   | `CLIENT_ORIGIN`             | `http://localhost:5173` for now; corrected in step 3 |
   | `DAILY_CLAUDE_LIMIT`        | optional, default `20`                               |
   | `CLAUDE_MODEL`              | optional, default `claude-sonnet-5`                  |

5. **Deploy**, then note the URL, e.g. `https://jat-server.vercel.app`.
6. Check it:

   ```bash
   curl https://<your-server>.vercel.app/api/health
   ```

   Expected: `{"status":"ok","timestamp":"…"}`.

## 2. Deploy the client

1. **Add New… → Project** → import the **same** repository again.
2. **Root Directory: `client`**. Framework preset: **Vite**.
3. Environment variables:

   | Variable                 | Value                                         |
   | ------------------------ | --------------------------------------------- |
   | `VITE_SUPABASE_URL`      | same as `SUPABASE_URL` above                  |
   | `VITE_SUPABASE_ANON_KEY` | same as `SUPABASE_ANON_KEY` above             |
   | `VITE_API_URL`           | the server URL from step 1, no trailing slash |

   These are compiled into the browser bundle, so never put a secret here.

4. **Deploy**, then note the URL, e.g. `https://jat-client.vercel.app`.

## 3. Point the two at each other

1. Server project → **Settings → Environment Variables** → set `CLIENT_ORIGIN` to the client URL (no trailing slash) → **redeploy the server**. Without this, the browser blocks every API call as a CORS error.
2. Supabase dashboard → **Authentication → URL Configuration**:
   - **Site URL**: the client URL.
   - **Redirect URLs**: add the client URL.

## 4. Verify the deployment

Open the client URL and walk through: sign up → save a profile → paste a posting → **Analyze** → track an application → delete the posting.

Optional, and it touches your real project: `npm run verify:rls` can be pointed at production. It creates two throwaway users and deletes both accounts when it finishes.

```bash
SUPABASE_URL=https://<project-ref>.supabase.co \
SUPABASE_ANON_KEY=<anon key> \
API_URL=https://<your-server>.vercel.app \
npm run verify:rls
```

## 5. Enable the keep-alive workflow

Free Supabase projects pause after roughly a week of inactivity. [`.github/workflows/keepalive.yml`](../.github/workflows/keepalive.yml) makes one request a day.

1. GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`
2. **Actions** tab → **Supabase keep-alive** → **Run workflow** to test it now. It should report `HTTP 200`.

GitHub disables scheduled workflows in repositories with no activity for 60 days; it emails you first, and one push re-enables it.

---

## Troubleshooting

**`sh: tsc: command not found` during the build (exit code 127)**

Vercel installs dependencies **scoped to the project being deployed** and its workspace dependencies — the repository root's `devDependencies` are not installed. A build tool that only exists at the root is therefore missing.

Fix: every workspace declares the tools its own scripts use. `typescript` is a `devDependency` of `shared`, `server` and `client`, not only of the root.

Reproduce the same conditions locally before pushing a fix:

```bash
# in a throwaway copy of the repo, with no node_modules
npm install --workspace=@jat/server --include-workspace-root=false
cd server && npm run build
```

## Things to know

- **Preview deployments of the client can't reach the API.** Each preview gets its own URL, and the server only allows `CLIENT_ORIGIN`. Either test against production, or set a Preview-scoped `CLIENT_ORIGIN` for the specific preview URL you're working with.
- **Both projects redeploy on every push** to `main`, unless Vercel decides a project's files and its internal dependencies didn't change. A change to `shared/` redeploys both.
- **Node version** is pinned to `24.x` by `engines` in `server/package.json` and `client/package.json`.
- **Why `server/vercel.json` exists:** it sets `buildCommand` to `npm run build`, which builds `shared/` before the API. Vercel's Express documentation doesn't state whether the preset runs the `build` script on its own, so this makes it deterministic.
- **The client's `vercel.json`** rewrites all paths to `index.html`, so refreshing on `/postings/123` works instead of 404ing.
- **Function limits:** on the Hobby plan a request has a maximum duration. Analysis normally takes a few seconds. If a very long posting ever times out, shorten the text or move to streaming.
