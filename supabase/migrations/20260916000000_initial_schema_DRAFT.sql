-- =============================================================================
-- DRAFT — TO BE REVIEWED IN CLAUDE CODE BEFORE APPLYING (roadmap step 1)
-- =============================================================================
-- Initial schema: profiles, job_postings, applications, usage_counters.
-- (chat_messages is postponed — added by a later migration if the chatbot is built; ADR-007.)
--
-- Rules applied to every table:
--   * user_id uuid references auth.users on delete cascade
--   * RLS enabled
--   * select / insert / update / delete policies using auth.uid(), separate per operation
--   * an index starting with user_id, and an index starting with each foreign key
--     (a unique constraint's index counts)
--
-- Deliberate exception (see docs/decisions.md):
--   * usage_counters has only a select policy; writes go through increment_usage() (ADR-006)
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper: keep updated_at current
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- profiles — one row per user (user_id is the primary key)
-- -----------------------------------------------------------------------------
create table public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  skills     text[] not null default '{}',
  stack      text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- The primary key already creates a unique index on user_id.

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "profiles_insert_own" on public.profiles
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "profiles_delete_own" on public.profiles
  for delete to authenticated
  using ((select auth.uid()) = user_id);


-- -----------------------------------------------------------------------------
-- job_postings — pasted posting text + Claude's extraction and gap analysis
-- -----------------------------------------------------------------------------
create table public.job_postings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  raw_text        text not null check (char_length(raw_text) between 1 and 50000),
  -- Facts from the posting text only. Validated against shared postingExtractionSchema.
  -- Null until analysis completes.
  extracted       jsonb,
  -- Comparison against the user's profile at analysis time. Validated against shared
  -- gapAnalysisSchema. Kept separate so it can be re-run after a profile change without
  -- re-extracting the posting.
  gap_analysis    jsonb,
  -- One status covers both results (ADR-005). If "re-run gap analysis" is built later,
  -- add a separate gap_status (and gap_analyzed_at) in a new migration.
  analysis_status text not null default 'pending'
                  check (analysis_status in ('pending', 'processing', 'completed', 'failed')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index job_postings_user_id_idx on public.job_postings (user_id);

create trigger job_postings_set_updated_at
  before update on public.job_postings
  for each row execute function public.set_updated_at();

alter table public.job_postings enable row level security;

create policy "job_postings_select_own" on public.job_postings
  for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "job_postings_insert_own" on public.job_postings
  for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "job_postings_update_own" on public.job_postings
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "job_postings_delete_own" on public.job_postings
  for delete to authenticated
  using ((select auth.uid()) = user_id);


-- -----------------------------------------------------------------------------
-- applications — tracker entry for a posting (at most one per posting)
-- -----------------------------------------------------------------------------
create table public.applications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  posting_id uuid not null references public.job_postings (id) on delete cascade,
  status     text not null default 'saved'
             check (status in ('saved', 'applied', 'interviewing', 'offer', 'rejected', 'withdrawn')),
  notes      text,
  applied_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One application per posting. Re-applying later = paste the posting again (new posting).
  -- This unique constraint's index also serves as the posting_id foreign key index.
  constraint applications_posting_id_key unique (posting_id)
);

create index applications_user_id_idx on public.applications (user_id);

create trigger applications_set_updated_at
  before update on public.applications
  for each row execute function public.set_updated_at();

alter table public.applications enable row level security;

create policy "applications_select_own" on public.applications
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- Insert/update also check that the referenced posting belongs to the same user,
-- so a user cannot attach rows to someone else's posting id.
create policy "applications_insert_own" on public.applications
  for insert to authenticated
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.job_postings p
      where p.id = posting_id and p.user_id = (select auth.uid())
    )
  );

create policy "applications_update_own" on public.applications
  for update to authenticated
  using ((select auth.uid()) = user_id)
  with check (
    (select auth.uid()) = user_id
    and exists (
      select 1 from public.job_postings p
      where p.id = posting_id and p.user_id = (select auth.uid())
    )
  );

create policy "applications_delete_own" on public.applications
  for delete to authenticated
  using ((select auth.uid()) = user_id);


-- -----------------------------------------------------------------------------
-- usage_counters — DB-backed rate limiting (works across Vercel instances)
-- -----------------------------------------------------------------------------
create table public.usage_counters (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  window_start  timestamptz not null,
  request_count integer not null default 0 check (request_count >= 0),
  created_at    timestamptz not null default now(),
  -- One counter row per user per window.
  -- This unique constraint's index starts with user_id, so it also serves as the user_id index.
  constraint usage_counters_user_window_key unique (user_id, window_start)
  -- No `bucket` column: posting analysis is the only Claude feature, so one counter is enough.
  -- If the chatbot is added later, that migration adds `bucket` and widens this constraint (ADR-007).
);

alter table public.usage_counters enable row level security;

-- Users may READ their own usage (e.g. "7 of 20 analyses used today").
create policy "usage_counters_select_own" on public.usage_counters
  for select to authenticated
  using ((select auth.uid()) = user_id);

-- No insert / update / delete policies: with them, a user could call the Supabase REST API
-- directly (public anon key + own token) and reset their own counter. All writes go through
-- increment_usage() below.

-- Atomically adds 1 to the caller's counter for the current window and returns the new count.
-- Express calls this via the per-request client: supabase.rpc('increment_usage'),
-- then compares the result to the limit.
--
-- SECURITY DEFINER: runs with the function owner's rights, so it can write even though
-- users have no write policies. It is safe because:
--   * the user id comes from auth.uid(), never from a parameter
--   * the window is computed here, never passed in
--   * it can only ever increase the count (calling it directly only uses up your own quota)
create or replace function public.increment_usage()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  -- Fixed daily window, UTC (ADR-006). The UI shows the reset time in the user's local time.
  v_window_start timestamptz := date_trunc('day', now(), 'UTC');
  v_count integer;
begin
  if v_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  insert into public.usage_counters (user_id, window_start, request_count)
  values (v_user_id, v_window_start, 1)
  on conflict (user_id, window_start)
  do update set request_count = public.usage_counters.request_count + 1
  returning request_count into v_count;

  return v_count;
end;
$$;

-- Functions are executable by everyone by default; allow signed-in users only.
revoke execute on function public.increment_usage() from public, anon;
grant execute on function public.increment_usage() to authenticated;
