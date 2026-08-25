-- BOO-P: private, multi-device persistence for personal reading data.
--
-- The browser keeps BOO-P's evolving domain objects as JSON. These tables keep
-- that exact shape while adding an authenticated owner, a stable local ID and
-- server/client timestamps for deterministic reconciliation between devices.

create schema if not exists private;

create table public.user_books (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null check (char_length(local_id) between 1 and 160),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_id)
);

create table public.user_reading_sessions (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null check (char_length(local_id) between 1 and 160),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_id)
);

create table public.user_traces (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null check (char_length(local_id) between 1 and 160),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_id)
);

create table public.user_lexicon_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  local_id text not null check (char_length(local_id) between 1 and 160),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, local_id)
);

create table public.user_reading_goals (
  user_id uuid not null references auth.users(id) on delete cascade,
  period text not null check (period in ('week', 'month', 'year', 'celebrated')),
  payload jsonb not null default '{}'::jsonb
    check (jsonb_typeof(payload) = 'object' and octet_length(payload::text) <= 262144),
  client_updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, period)
);

create index user_books_updated_idx
  on public.user_books (user_id, updated_at desc);
create index user_reading_sessions_updated_idx
  on public.user_reading_sessions (user_id, updated_at desc);
create index user_traces_updated_idx
  on public.user_traces (user_id, updated_at desc);
create index user_lexicon_entries_updated_idx
  on public.user_lexicon_entries (user_id, updated_at desc);
create index user_reading_goals_updated_idx
  on public.user_reading_goals (user_id, updated_at desc);

create or replace function private.set_user_data_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- An offline device must not overwrite a record already changed more
  -- recently by another device. Direct per-item writes use the current time;
  -- bulk reconciliation keeps the source object's logical timestamp.
  if new.client_updated_at < old.client_updated_at then
    return old;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke execute on function private.set_user_data_updated_at()
  from public, anon, authenticated;

create trigger user_books_set_updated_at
before update on public.user_books
for each row execute function private.set_user_data_updated_at();

create trigger user_reading_sessions_set_updated_at
before update on public.user_reading_sessions
for each row execute function private.set_user_data_updated_at();

create trigger user_traces_set_updated_at
before update on public.user_traces
for each row execute function private.set_user_data_updated_at();

create trigger user_lexicon_entries_set_updated_at
before update on public.user_lexicon_entries
for each row execute function private.set_user_data_updated_at();

create trigger user_reading_goals_set_updated_at
before update on public.user_reading_goals
for each row execute function private.set_user_data_updated_at();

alter table public.user_books enable row level security;
alter table public.user_reading_sessions enable row level security;
alter table public.user_traces enable row level security;
alter table public.user_lexicon_entries enable row level security;
alter table public.user_reading_goals enable row level security;

create policy user_books_own_rows
on public.user_books for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_reading_sessions_own_rows
on public.user_reading_sessions for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_traces_own_rows
on public.user_traces for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_lexicon_entries_own_rows
on public.user_lexicon_entries for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy user_reading_goals_own_rows
on public.user_reading_goals for all to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- Explicit Data API exposure. Personal data never has an anonymous grant.
revoke all on table public.user_books, public.user_reading_sessions,
  public.user_traces, public.user_lexicon_entries, public.user_reading_goals
  from anon, authenticated;
grant select, insert, update, delete on table public.user_books,
  public.user_reading_sessions, public.user_traces,
  public.user_lexicon_entries, public.user_reading_goals
  to authenticated;
grant all on table public.user_books, public.user_reading_sessions,
  public.user_traces, public.user_lexicon_entries, public.user_reading_goals
  to service_role;

comment on table public.user_books is
  'Private per-user BOO-P library records synchronized across devices.';
comment on table public.user_reading_sessions is
  'Private per-user completed reading sessions synchronized across devices.';
comment on table public.user_traces is
  'Private per-user reading traces synchronized across devices.';
comment on table public.user_lexicon_entries is
  'Private per-user words, expressions and quotations synchronized across devices.';
comment on table public.user_reading_goals is
  'Private per-user weekly, monthly and annual reading-goal configuration.';

-- Guest mode: public profiles and public community activity are readable, but
-- the anonymous role receives no mutation privilege on any of these tables.
alter table public.profile_directory enable row level security;
alter table public.profile_shared_details enable row level security;
alter table public.community_posts enable row level security;
alter table public.community_comments enable row level security;
alter table public.community_encouragements enable row level security;

drop policy if exists profile_directory_select_public_anon
  on public.profile_directory;
create policy profile_directory_select_public_anon
on public.profile_directory for select to anon
using (profile_visibility = 'public');

drop policy if exists profile_shared_details_select_public_anon
  on public.profile_shared_details;
create policy profile_shared_details_select_public_anon
on public.profile_shared_details for select to anon
using (profile_visibility = 'public');

drop policy if exists community_posts_select_public_anon
  on public.community_posts;
create policy community_posts_select_public_anon
on public.community_posts for select to anon
using (visibility = 'public');

drop policy if exists community_comments_select_public_anon
  on public.community_comments;
create policy community_comments_select_public_anon
on public.community_comments for select to anon
using (
  exists (
    select 1
    from public.community_posts post
    where post.id = post_id
      and post.visibility = 'public'
  )
);

drop policy if exists community_encouragements_select_public_anon
  on public.community_encouragements;
create policy community_encouragements_select_public_anon
on public.community_encouragements for select to anon
using (
  exists (
    select 1
    from public.community_posts post
    where post.id = post_id
      and post.visibility = 'public'
  )
);

revoke all on table public.profile_directory,
  public.profile_shared_details, public.community_posts,
  public.community_comments, public.community_encouragements from anon;
grant select on table public.profile_directory,
  public.profile_shared_details, public.community_posts,
  public.community_comments, public.community_encouragements to anon;
