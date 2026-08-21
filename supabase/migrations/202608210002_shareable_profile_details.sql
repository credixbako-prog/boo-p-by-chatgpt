-- Les détails d'un profil public sont visibles par la communauté authentifiée.
-- Ceux d'un profil privé ne deviennent lisibles qu'après acceptation de l'amitié.
create table if not exists public.profile_shared_details (
  user_id uuid primary key references auth.users(id) on delete cascade,
  profile_title text not null default '',
  bio text not null default '',
  interests text[] not null default '{}',
  profile_visibility text not null default 'private' check (profile_visibility in ('private', 'public')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profile_shared_details is
  'Only profile content explicitly intended for sharing. Private rows are readable solely by their owner and accepted friends.';

insert into public.profile_shared_details (user_id, interests, profile_visibility, created_at, updated_at)
select p.user_id, p.interests, p.profile_visibility, p.created_at, p.updated_at
from public.profiles p
on conflict (user_id) do nothing;

alter table public.profile_shared_details enable row level security;

create policy profile_shared_details_select_allowed
  on public.profile_shared_details for select to authenticated
  using (
    (select auth.uid()) = user_id
    or profile_visibility = 'public'
    or exists (
      select 1
      from public.friendships f
      where f.status = 'accepted'
        and (
          (f.requester_id = (select auth.uid()) and f.addressee_id = profile_shared_details.user_id)
          or
          (f.addressee_id = (select auth.uid()) and f.requester_id = profile_shared_details.user_id)
        )
    )
  );
create policy profile_shared_details_insert_own
  on public.profile_shared_details for insert to authenticated
  with check ((select auth.uid()) = user_id);
create policy profile_shared_details_update_own
  on public.profile_shared_details for update to authenticated
  using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy profile_shared_details_delete_own
  on public.profile_shared_details for delete to authenticated
  using ((select auth.uid()) = user_id);
