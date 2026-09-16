-- pgTAP tests for the initial schema, RLS policies, and increment_usage().
-- Run against the local Supabase stack:  npx supabase test db
--
-- Everything runs inside one transaction and is rolled back at the end,
-- so the test users and rows never persist.
--
-- How "acting as a user" works: `set local role authenticated` switches to the role
-- Supabase uses for signed-in requests, and `request.jwt.claims` sets the token's
-- `sub`, which is what auth.uid() returns inside RLS policies.

begin;

create extension if not exists pgtap with schema extensions;

select plan(35);

-- ---------------------------------------------------------------------------
-- Structure
-- ---------------------------------------------------------------------------
select has_table('public', 'profiles', 'profiles table exists');
select has_table('public', 'job_postings', 'job_postings table exists');
select has_table('public', 'applications', 'applications table exists');
select has_table('public', 'usage_counters', 'usage_counters table exists');
select hasnt_table('public', 'chat_messages', 'chat_messages is postponed (ADR-007)');

select is(
  (
    select count(*)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ),
  0::bigint,
  'RLS is enabled on every public table'
);

select policies_are(
  'public', 'profiles',
  array['profiles_select_own', 'profiles_insert_own', 'profiles_update_own', 'profiles_delete_own'],
  'profiles has select/insert/update/delete policies'
);
select policies_are(
  'public', 'job_postings',
  array['job_postings_select_own', 'job_postings_insert_own', 'job_postings_update_own', 'job_postings_delete_own'],
  'job_postings has select/insert/update/delete policies'
);
select policies_are(
  'public', 'applications',
  array['applications_select_own', 'applications_insert_own', 'applications_update_own', 'applications_delete_own'],
  'applications has select/insert/update/delete policies'
);
select policies_are(
  'public', 'usage_counters',
  array['usage_counters_select_own'],
  'usage_counters is select-only (ADR-006)'
);

-- ---------------------------------------------------------------------------
-- Test users (created as the superuser, before switching roles)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, aud, role)
values
  ('11111111-1111-1111-1111-111111111111', 'user_a@test.local', 'authenticated', 'authenticated'),
  ('22222222-2222-2222-2222-222222222222', 'user_b@test.local', 'authenticated', 'authenticated');

-- ---------------------------------------------------------------------------
-- Acting as user A: normal use of own data
-- ---------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims to '{"sub": "11111111-1111-1111-1111-111111111111", "role": "authenticated"}';

select lives_ok(
  $$ insert into public.profiles (user_id, skills, stack)
     values ('11111111-1111-1111-1111-111111111111', '{React,TypeScript}', '{Node}') $$,
  'A can create own profile'
);
select lives_ok(
  $$ insert into public.job_postings (id, user_id, raw_text)
     values ('aaaaaaaa-0000-0000-0000-000000000001', '11111111-1111-1111-1111-111111111111', 'Frontend engineer, React') $$,
  'A can create own posting'
);
select lives_ok(
  $$ insert into public.job_postings (id, user_id, raw_text)
     values ('aaaaaaaa-0000-0000-0000-000000000002', '11111111-1111-1111-1111-111111111111', 'Backend engineer, Node') $$,
  'A can create a second posting'
);
select lives_ok(
  $$ insert into public.applications (user_id, posting_id, status)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001', 'applied') $$,
  'A can create an application for own posting'
);
select throws_ok(
  $$ insert into public.applications (user_id, posting_id)
     values ('11111111-1111-1111-1111-111111111111', 'aaaaaaaa-0000-0000-0000-000000000001') $$,
  '23505', null,
  'A cannot create a second application for the same posting (unique posting_id)'
);
select throws_ok(
  $$ insert into public.job_postings (user_id, raw_text)
     values ('11111111-1111-1111-1111-111111111111', '') $$,
  '23514', null,
  'empty raw_text is rejected'
);
select throws_ok(
  $$ insert into public.job_postings (user_id, raw_text, analysis_status)
     values ('11111111-1111-1111-1111-111111111111', 'x', 'done') $$,
  '23514', null,
  'unknown analysis_status is rejected'
);

-- ---------------------------------------------------------------------------
-- Acting as user A: rate-limit counter can't be tampered with
-- ---------------------------------------------------------------------------
select throws_ok(
  $$ insert into public.usage_counters (user_id, window_start, request_count)
     values ('11111111-1111-1111-1111-111111111111', now(), 0) $$,
  '42501', null,
  'A cannot insert into usage_counters directly'
);
select is(public.increment_usage(), 1, 'first increment_usage() returns 1');
select is(public.increment_usage(), 2, 'second increment_usage() returns 2');
select is_empty(
  $$ update public.usage_counters set request_count = 0 returning 1 $$,
  'A cannot reset own counter with update'
);
select is_empty(
  $$ delete from public.usage_counters returning 1 $$,
  'A cannot delete own counter'
);
select is(
  (select request_count from public.usage_counters),
  2,
  'A''s counter is still 2 after the tamper attempts'
);

-- ---------------------------------------------------------------------------
-- Acting as user B: A's data is invisible and untouchable
-- ---------------------------------------------------------------------------
set local request.jwt.claims to '{"sub": "22222222-2222-2222-2222-222222222222", "role": "authenticated"}';

select is_empty($$ select 1 from public.profiles $$, 'B cannot read A''s profile');
select is_empty($$ select 1 from public.job_postings $$, 'B cannot read A''s postings');
select is_empty($$ select 1 from public.applications $$, 'B cannot read A''s applications');
select is_empty($$ select 1 from public.usage_counters $$, 'B cannot read A''s usage counter');
select is_empty(
  $$ update public.job_postings set raw_text = 'changed by B' returning 1 $$,
  'B cannot update A''s postings'
);
select is_empty(
  $$ delete from public.applications returning 1 $$,
  'B cannot delete A''s applications'
);
select throws_ok(
  $$ insert into public.job_postings (user_id, raw_text)
     values ('11111111-1111-1111-1111-111111111111', 'spoofed owner') $$,
  '42501', null,
  'B cannot create a posting owned by A'
);
select throws_ok(
  $$ insert into public.applications (user_id, posting_id)
     values ('22222222-2222-2222-2222-222222222222', 'aaaaaaaa-0000-0000-0000-000000000002') $$,
  '42501', null,
  'B cannot attach an application to A''s posting'
);
select is(public.increment_usage(), 1, 'B has a separate counter');

-- ---------------------------------------------------------------------------
-- Signed-out (anon) access
-- ---------------------------------------------------------------------------
set local role anon;

select throws_ok(
  $$ select public.increment_usage() $$,
  '42501', null,
  'anon cannot call increment_usage()'
);

-- ---------------------------------------------------------------------------
-- Account deletion: deleting the auth user cascades to all of their rows
-- ---------------------------------------------------------------------------
reset role;

delete from auth.users where id = '11111111-1111-1111-1111-111111111111';

select is(
  (select count(*) from public.profiles where user_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*) from public.job_postings where user_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*) from public.applications where user_id = '11111111-1111-1111-1111-111111111111')
  + (select count(*) from public.usage_counters where user_id = '11111111-1111-1111-1111-111111111111'),
  0::bigint,
  'deleting user A removes all of A''s rows'
);
select is(
  (select count(*) from public.usage_counters where user_id = '22222222-2222-2222-2222-222222222222'),
  1::bigint,
  'user B''s data is untouched'
);

select * from finish();

rollback;
