-- Annuaire minimal BOO-P : tous les comptes authentifiés sont trouvables,
-- mais aucune donnée privée (e-mail, biographie, intérêts, lectures) n'y figure.
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.profile_directory (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null unique check (handle ~ '^[a-z0-9][a-z0-9_.-]{2,29}$'),
  display_name text not null,
  profile_visibility text not null default 'private' check (profile_visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_directory is
  'Minimal searchable BOO-P directory. All accounts are discoverable to signed-in users by product decision; email, bio, interests and reading data are excluded.';

create index if not exists profile_directory_display_name_search_idx
  on public.profile_directory using gin (display_name extensions.gin_trgm_ops);

insert into public.profile_directory (user_id, handle, display_name, profile_visibility, created_at, updated_at)
select p.user_id,
       'lecteur-' || left(replace(p.user_id::text, '-', ''), 8),
       p.display_name,
       p.profile_visibility,
       p.created_at,
       p.updated_at
from public.profiles p
on conflict (user_id) do nothing;

alter table public.profile_directory enable row level security;

create policy profile_directory_select_authenticated
  on public.profile_directory for select to authenticated using (true);
create policy profile_directory_insert_own
  on public.profile_directory for insert to authenticated with check ((select auth.uid()) = user_id);
create policy profile_directory_update_own
  on public.profile_directory for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profile_directory_delete_own
  on public.profile_directory for delete to authenticated using ((select auth.uid()) = user_id);

create table if not exists public.friendships (
  id uuid primary key default gen_random_uuid(),
  requester_id uuid not null references auth.users(id) on delete cascade,
  addressee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (requester_id <> addressee_id)
);

comment on table public.friendships is
  'Reciprocal BOO-P friend requests and accepted friendships.';

create unique index if not exists friendships_unique_pair_idx
  on public.friendships (least(requester_id, addressee_id), greatest(requester_id, addressee_id));
create index if not exists friendships_requester_idx on public.friendships (requester_id);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id);

alter table public.friendships enable row level security;

create policy friendships_select_participant
  on public.friendships for select to authenticated
  using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);
create policy friendships_insert_requester
  on public.friendships for insert to authenticated
  with check ((select auth.uid()) = requester_id and status = 'pending');
create policy friendships_accept_addressee
  on public.friendships for update to authenticated
  using ((select auth.uid()) = addressee_id and status = 'pending')
  with check ((select auth.uid()) = addressee_id and status = 'accepted');
create policy friendships_delete_participant
  on public.friendships for delete to authenticated
  using ((select auth.uid()) = requester_id or (select auth.uid()) = addressee_id);
