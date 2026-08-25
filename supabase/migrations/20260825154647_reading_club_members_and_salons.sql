-- BOO-P: persistent reading-club memberships, salons and discussions.
-- Every public table is protected by RLS and explicitly exposed only to authenticated users.

alter table public.reading_clubs
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.reading_club_members (
  club_id uuid not null references public.reading_clubs(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'moderator', 'member')),
  status text not null default 'pending' check (status in ('invited', 'pending', 'active')),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (club_id, user_id)
);

create table if not exists public.reading_salons (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.reading_clubs(id) on delete cascade,
  created_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 2 and 120),
  book_title text not null default '' check (char_length(book_title) <= 240),
  scheduled_at timestamptz not null,
  status text not null default 'scheduled' check (status in ('scheduled', 'live', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reading_salon_participants (
  salon_id uuid not null references public.reading_salons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'waiting' check (status in ('waiting', 'reading', 'paused', 'finished')),
  share_pages boolean not null default false,
  reading_minutes integer not null default 0 check (reading_minutes between 0 and 1000000),
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (salon_id, user_id)
);

create table if not exists public.reading_salon_messages (
  id uuid primary key default gen_random_uuid(),
  salon_id uuid not null references public.reading_salons(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create index if not exists reading_club_members_user_idx
  on public.reading_club_members (user_id, status, club_id);
create index if not exists reading_salons_club_date_idx
  on public.reading_salons (club_id, scheduled_at desc);
create index if not exists reading_salon_participants_user_idx
  on public.reading_salon_participants (user_id, salon_id);
create index if not exists reading_salon_messages_salon_date_idx
  on public.reading_salon_messages (salon_id, created_at);

create or replace function public.is_active_club_member(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.reading_club_members member
    where member.club_id = target_club_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
  );
$$;

create or replace function public.is_club_manager(target_club_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.reading_clubs club
    where club.id = target_club_id and club.owner_id = (select auth.uid())
  ) or exists (
    select 1 from public.reading_club_members member
    where member.club_id = target_club_id
      and member.user_id = (select auth.uid())
      and member.status = 'active'
      and member.role in ('owner', 'moderator')
  );
$$;

create or replace function public.set_reading_community_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists reading_clubs_set_updated_at on public.reading_clubs;
create trigger reading_clubs_set_updated_at
before update on public.reading_clubs
for each row execute function public.set_reading_community_updated_at();

drop trigger if exists reading_club_members_set_updated_at on public.reading_club_members;
create trigger reading_club_members_set_updated_at
before update on public.reading_club_members
for each row execute function public.set_reading_community_updated_at();

drop trigger if exists reading_salons_set_updated_at on public.reading_salons;
create trigger reading_salons_set_updated_at
before update on public.reading_salons
for each row execute function public.set_reading_community_updated_at();

drop trigger if exists reading_salon_participants_set_updated_at on public.reading_salon_participants;
create trigger reading_salon_participants_set_updated_at
before update on public.reading_salon_participants
for each row execute function public.set_reading_community_updated_at();

create or replace function public.add_reading_club_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reading_club_members (club_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active')
  on conflict (club_id, user_id) do update
    set role = 'owner', status = 'active', updated_at = now();
  return new;
end;
$$;

drop trigger if exists reading_clubs_add_owner_membership on public.reading_clubs;
create trigger reading_clubs_add_owner_membership
after insert on public.reading_clubs
for each row execute function public.add_reading_club_owner_membership();

insert into public.reading_club_members (club_id, user_id, role, status)
select id, owner_id, 'owner', 'active'
from public.reading_clubs
on conflict (club_id, user_id) do update
  set role = 'owner', status = 'active', updated_at = now();

create or replace function public.add_reading_salon_creator()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.reading_salon_participants (salon_id, user_id, status)
  values (new.id, new.created_by, 'waiting')
  on conflict (salon_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists reading_salons_add_creator on public.reading_salons;
create trigger reading_salons_add_creator
after insert on public.reading_salons
for each row execute function public.add_reading_salon_creator();

alter table public.reading_club_members enable row level security;
alter table public.reading_salons enable row level security;
alter table public.reading_salon_participants enable row level security;
alter table public.reading_salon_messages enable row level security;

drop policy if exists reading_clubs_select_visible on public.reading_clubs;
create policy reading_clubs_select_visible
on public.reading_clubs for select to authenticated
using (
  visibility = 'public'
  or owner_id = (select auth.uid())
  or public.is_active_club_member(id)
);

create policy reading_club_members_select_accessible
on public.reading_club_members for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_active_club_member(club_id)
  or public.is_club_manager(club_id)
  or exists (
    select 1 from public.reading_clubs club
    where club.id = club_id and club.visibility = 'public'
  )
);

create policy reading_club_members_request_or_invite
on public.reading_club_members for insert to authenticated
with check (
  public.is_club_manager(club_id)
  or (
    user_id = (select auth.uid())
    and role = 'member'
    and status = (
      select case when club.access_mode = 'open' then 'active' else 'pending' end
      from public.reading_clubs club where club.id = club_id and club.visibility = 'public'
    )
  )
);

create policy reading_club_members_manage_or_accept
on public.reading_club_members for update to authenticated
using (
  public.is_club_manager(club_id)
  or (user_id = (select auth.uid()) and status = 'invited')
)
with check (
  public.is_club_manager(club_id)
  or (user_id = (select auth.uid()) and role = 'member' and status = 'active')
);

create policy reading_club_members_leave_or_manage
on public.reading_club_members for delete to authenticated
using (
  (public.is_club_manager(club_id) and role <> 'owner')
  or (user_id = (select auth.uid()) and role = 'member')
);

create policy reading_salons_select_members
on public.reading_salons for select to authenticated
using (created_by = (select auth.uid()) or public.is_active_club_member(club_id));

create policy reading_salons_insert_managers
on public.reading_salons for insert to authenticated
with check (created_by = (select auth.uid()) and public.is_club_manager(club_id));

create policy reading_salons_update_managers
on public.reading_salons for update to authenticated
using (public.is_club_manager(club_id))
with check (public.is_club_manager(club_id));

create policy reading_salons_delete_managers
on public.reading_salons for delete to authenticated
using (public.is_club_manager(club_id));

create policy reading_salon_participants_select_members
on public.reading_salon_participants for select to authenticated
using (
  exists (
    select 1 from public.reading_salons salon
    where salon.id = salon_id and public.is_active_club_member(salon.club_id)
  )
);

create policy reading_salon_participants_join
on public.reading_salon_participants for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.reading_salons salon
    where salon.id = salon_id and public.is_active_club_member(salon.club_id)
  )
);

create policy reading_salon_participants_update_self_or_manager
on public.reading_salon_participants for update to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.reading_salons salon
    where salon.id = salon_id and public.is_club_manager(salon.club_id)
  )
)
with check (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.reading_salons salon
    where salon.id = salon_id and public.is_club_manager(salon.club_id)
  )
);

create policy reading_salon_participants_leave_or_manage
on public.reading_salon_participants for delete to authenticated
using (
  user_id = (select auth.uid())
  or exists (
    select 1 from public.reading_salons salon
    where salon.id = salon_id and public.is_club_manager(salon.club_id)
  )
);

create policy reading_salon_messages_select_members
on public.reading_salon_messages for select to authenticated
using (
  exists (
    select 1 from public.reading_salons salon
    where salon.id = salon_id and public.is_active_club_member(salon.club_id)
  )
);

create policy reading_salon_messages_insert_members
on public.reading_salon_messages for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.reading_salons salon
    where salon.id = salon_id and public.is_active_club_member(salon.club_id)
  )
);

create policy reading_salon_messages_delete_author_or_manager
on public.reading_salon_messages for delete to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1 from public.reading_salons salon
    where salon.id = salon_id and public.is_club_manager(salon.club_id)
  )
);

revoke all on public.reading_club_members, public.reading_salons,
  public.reading_salon_participants, public.reading_salon_messages from anon;
grant select, insert, update, delete on public.reading_club_members,
  public.reading_salons, public.reading_salon_participants,
  public.reading_salon_messages to authenticated;
grant all on public.reading_club_members, public.reading_salons,
  public.reading_salon_participants, public.reading_salon_messages to service_role;
revoke all on function public.is_active_club_member(uuid),
  public.is_club_manager(uuid) from public, anon;
grant execute on function public.is_active_club_member(uuid),
  public.is_club_manager(uuid) to authenticated, service_role;

comment on table public.reading_club_members is
  'Private BOO-P reading-club memberships and approval requests.';
comment on table public.reading_salons is
  'Persistent reading-room schedule belonging to a BOO-P club.';
comment on table public.reading_salon_participants is
  'Consent-aware salon presence and optional page-sharing preference.';
comment on table public.reading_salon_messages is
  'Messages visible only to active members of the salon club.';
