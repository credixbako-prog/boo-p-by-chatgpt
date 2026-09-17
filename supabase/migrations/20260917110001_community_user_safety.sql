-- Blocks are private to their author; access restrictions are bilateral.
create table public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
create index user_blocks_blocked on public.user_blocks(blocked_id, blocker_id);
alter table public.user_blocks enable row level security;
revoke all on public.user_blocks from public, anon, authenticated;
grant select, delete on public.user_blocks to authenticated;
grant insert(blocker_id, blocked_id) on public.user_blocks to authenticated;
grant all on public.user_blocks to service_role;

-- Internal pair lookup is deliberately not executable by API users. The viewer
-- wrapper can only inspect blocks involving auth.uid(), never arbitrary pairs.
create function private.users_blocked(first_user uuid, second_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select first_user is not null and second_user is not null and exists (
    select 1 from public.user_blocks b
    where (b.blocker_id = first_user and b.blocked_id = second_user)
       or (b.blocker_id = second_user and b.blocked_id = first_user)
  );
$$;
revoke all on function private.users_blocked(uuid,uuid) from public,anon,authenticated;
create function private.viewer_blocked(other_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and private.users_blocked(auth.uid(), other_user);
$$;
revoke all on function private.viewer_blocked(uuid) from public,anon;
grant execute on function private.viewer_blocked(uuid) to authenticated;

create policy user_blocks_read on public.user_blocks for select to authenticated
using (blocker_id = (select auth.uid()));
create policy user_blocks_insert on public.user_blocks for insert to authenticated
with check (blocker_id = (select auth.uid()) and blocker_id <> blocked_id);
-- A block grants no access to its target. The auth.users FK validates existence;
-- querying the same table from this policy would cause recursive RLS expansion.
create policy user_blocks_delete on public.user_blocks for delete to authenticated
using (blocker_id = (select auth.uid()));

create table public.user_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reported_user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check(reason in ('Harcèlement ou propos haineux','Contenu inapproprié','Spam ou publicité','Atteinte à la vie privée','Autre motif')),
  details text not null default '' check(char_length(details) <= 2000),
  status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
  created_at timestamptz not null default now(),
  check(reporter_id <> reported_user_id)
);
create unique index user_reports_once_pending on public.user_reports(reporter_id,reported_user_id) where status='pending';
create index user_reports_target on public.user_reports(reported_user_id);
create index user_reports_pending on public.user_reports(created_at) where status='pending';
alter table public.user_reports enable row level security;
revoke all on public.user_reports from public,anon,authenticated;
grant select on public.user_reports to authenticated;
grant insert(reporter_id,reported_user_id,reason,details) on public.user_reports to authenticated;
grant update(status) on public.user_reports to authenticated;
grant all on public.user_reports to service_role;
create policy user_reports_read on public.user_reports for select to authenticated
using(reporter_id=(select auth.uid()) or (select private.is_publication_moderator()));
create policy user_reports_insert on public.user_reports for insert to authenticated
with check(reporter_id=(select auth.uid()) and reported_user_id<>reporter_id and status='pending' and (
  exists(select 1 from public.profile_directory p where p.user_id=reported_user_id)
  or exists(select 1 from public.user_blocks b where b.blocker_id=(select auth.uid()) and b.blocked_id=reported_user_id)
));
create policy user_reports_review on public.user_reports for update to authenticated
using((select private.is_publication_moderator())) with check((select private.is_publication_moderator()));

-- Remove direct contact atomically. Unblocking never restores an old friendship.
-- Notifications cascade to queued push jobs; private reading data is untouched.
create function private.apply_user_block() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null or auth.uid() <> new.blocker_id then
    raise exception 'Invalid block owner' using errcode='42501';
  end if;
  delete from public.friendships f where
    (f.requester_id=new.blocker_id and f.addressee_id=new.blocked_id)
    or (f.requester_id=new.blocked_id and f.addressee_id=new.blocker_id);
  delete from public.notifications n where
    (n.recipient_id=new.blocker_id and n.actor_id=new.blocked_id)
    or (n.recipient_id=new.blocked_id and n.actor_id=new.blocker_id);
  return new;
end;
$$;
revoke all on function private.apply_user_block() from public,anon,authenticated;
create trigger apply_user_block after insert on public.user_blocks
for each row execute function private.apply_user_block();

-- Restrictive policies intersect existing visibility rules (including public
-- posts). They do not grant additional access or affect anonymous public reads.
create policy profile_directory_block_filter on public.profile_directory as restrictive for select to authenticated
using(not private.viewer_blocked(user_id));
create policy profile_details_block_filter on public.profile_shared_details as restrictive for select to authenticated
using(not private.viewer_blocked(user_id));
create policy reader_preferences_block_filter on public.reader_preferences as restrictive for select to authenticated
using(not private.viewer_blocked(user_id));
create policy friendships_block_filter on public.friendships as restrictive for all to authenticated
using(not private.viewer_blocked(requester_id) and not private.viewer_blocked(addressee_id))
with check(not private.viewer_blocked(requester_id) and not private.viewer_blocked(addressee_id));
create policy community_posts_block_filter on public.community_posts as restrictive for select to authenticated
using(not private.viewer_blocked(author_id) or (select private.is_publication_moderator()));
create policy community_comments_block_filter on public.community_comments as restrictive for select to authenticated
using(not private.viewer_blocked(author_id));
create policy community_encouragements_block_filter on public.community_encouragements as restrictive for select to authenticated
using(not private.viewer_blocked(user_id));
create policy reading_cards_block_filter on public.reading_cards as restrictive for select to authenticated
using(not private.viewer_blocked(user_id) or (select private.is_publication_moderator()));
create policy reader_book_interactions_block_filter on public.reader_book_interactions as restrictive for select to authenticated
using(not private.viewer_blocked(author_id) and not private.viewer_blocked(owner_id));
create policy notifications_block_filter on public.notifications as restrictive for select to authenticated
using(not private.viewer_blocked(actor_id));
-- Avatar signing is denied too; already issued signed links expire normally.
create policy profile_avatar_block_filter on storage.objects as restrictive for select to authenticated
using(bucket_id<>'profile-avatars' or not private.viewer_blocked(
  case when (storage.foldername(name))[1] ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(name))[1])::uuid else null end));

-- Called from SECURITY DEFINER projections too, so the explicit block predicate
-- cannot rely on the caller's friendship RLS remaining active.
create or replace function private.is_accepted_reader_friend(other_id uuid)
returns boolean language sql stable security invoker set search_path='' as $$
  select auth.uid() is not null and not private.viewer_blocked(other_id) and exists(
    select 1 from public.friendships f where f.status='accepted' and (
      (f.requester_id=auth.uid() and f.addressee_id=other_id)
      or (f.addressee_id=auth.uid() and f.requester_id=other_id)));
$$;
create or replace function private.reader_latest_badge(target_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or private.viewer_blocked(target_user) then return null; end if;
  if auth.uid()<>target_user and not private.is_accepted_reader_friend(target_user)
    and not exists(select 1 from public.profile_shared_details p where p.user_id=target_user and p.profile_visibility='public') then return null; end if;
  return (select jsonb_build_object('badge_id',b.badge_id,'unlocked_at',b.unlocked_at)
    from public.reader_badges b where b.user_id=target_user order by b.unlocked_at desc,b.badge_id asc limit 1);
end;
$$;

-- Owner blocks revoke effective club membership without erasing membership or
-- other members' discussions. Peer blocks hide each other's contributions.
create or replace function private.is_active_club_member(target_club_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.reading_club_members m join public.reading_clubs c on c.id=m.club_id
    where m.club_id=target_club_id and m.user_id=auth.uid() and m.status='active'
      and not private.viewer_blocked(c.owner_id));
$$;
create or replace function private.is_club_manager(target_club_id uuid) returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from public.reading_clubs c where c.id=target_club_id
      and not private.viewer_blocked(c.owner_id) and (
        c.owner_id=auth.uid() or exists(select 1 from public.reading_club_members m
          where m.club_id=c.id and m.user_id=auth.uid() and m.status='active' and m.role in ('owner','moderator'))));
$$;
create policy reading_clubs_block_filter on public.reading_clubs as restrictive for select to authenticated
using(not private.viewer_blocked(owner_id));
create policy reading_club_members_block_filter on public.reading_club_members as restrictive for all to authenticated
using(not private.viewer_blocked(user_id)) with check(not private.viewer_blocked(user_id));
create policy reading_club_posts_block_filter on public.reading_club_posts as restrictive for select to authenticated
using(not private.viewer_blocked(author_id) or (select private.is_publication_moderator()));
create policy reading_club_comments_block_filter on public.reading_club_comments as restrictive for select to authenticated
using(not private.viewer_blocked(author_id));
create policy reading_club_encouragements_block_filter on public.reading_club_encouragements as restrictive for select to authenticated
using(not private.viewer_blocked(user_id));
create policy reading_salons_block_filter on public.reading_salons as restrictive for select to authenticated
using(not private.viewer_blocked(created_by));
create policy reading_salon_participants_block_filter on public.reading_salon_participants as restrictive for all to authenticated
using(not private.viewer_blocked(user_id)) with check(not private.viewer_blocked(user_id));
create policy reading_salon_messages_block_filter on public.reading_salon_messages as restrictive for select to authenticated
using(not private.viewer_blocked(author_id));

-- FK constraints do not check parent RLS. Check parent authors explicitly to
-- reject a crafted reply to a hidden comment on a third reader's visible post.
create function private.guard_blocked_interaction() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); target uuid;
begin
  if actor is null then
    -- Auth-admin deletion may detach a reply/book FK while preserving another
    -- reader's contribution. This path cannot alter its identity or contents.
    if tg_op='UPDATE' then
      if tg_table_name='community_comments' then
        if new.parent_id is null and (to_jsonb(new)-'parent_id')=(to_jsonb(old)-'parent_id') then return new; end if;
      elsif tg_table_name='reader_book_interactions' then
        if (new.parent_id is null or new.parent_id is not distinct from old.parent_id)
          and (new.owner_id is null or new.owner_id is not distinct from old.owner_id)
          and (to_jsonb(new)-'parent_id'-'owner_id')=(to_jsonb(old)-'parent_id'-'owner_id') then return new; end if;
      end if;
    end if;
    raise exception 'Authentication required' using errcode='42501';
  end if;
  if tg_table_name='community_comments' then
    select p.author_id into target from public.community_posts p where p.id=new.post_id;
    if private.users_blocked(actor,target) then raise exception 'Interaction unavailable' using errcode='42501'; end if;
    if new.parent_id is not null then
      select c.author_id into target from public.community_comments c where c.id=new.parent_id and c.post_id=new.post_id;
      if not found then raise exception 'Invalid reply' using errcode='23503'; end if;
    end if;
  elsif tg_table_name='community_encouragements' then
    select p.author_id into target from public.community_posts p where p.id=new.post_id;
  elsif tg_table_name in ('reading_club_comments','reading_club_encouragements') then
    select p.author_id into target from public.reading_club_posts p where p.id=new.post_id;
  elsif tg_table_name='reader_book_interactions' then
    target:=new.owner_id;
    if private.users_blocked(actor,target) then raise exception 'Interaction unavailable' using errcode='42501'; end if;
    if new.parent_id is not null then
      select i.author_id into target from public.reader_book_interactions i
      where i.id=new.parent_id and i.owner_id=new.owner_id and i.book_id=new.book_id;
      if not found then raise exception 'Invalid reply' using errcode='23503'; end if;
    end if;
  end if;
  if private.users_blocked(actor,target) then raise exception 'Interaction unavailable' using errcode='42501'; end if;
  return new;
end;
$$;
revoke all on function private.guard_blocked_interaction() from public,anon,authenticated;
create trigger guard_blocked_interaction before insert or update on public.community_comments
for each row execute function private.guard_blocked_interaction();
create trigger guard_blocked_interaction before insert or update on public.community_encouragements
for each row execute function private.guard_blocked_interaction();
create trigger guard_blocked_interaction before insert or update on public.reading_club_comments
for each row execute function private.guard_blocked_interaction();
create trigger guard_blocked_interaction before insert or update on public.reading_club_encouragements
for each row execute function private.guard_blocked_interaction();
create trigger guard_blocked_interaction before insert or update on public.reader_book_interactions
for each row execute function private.guard_blocked_interaction();

-- Every notification source is covered, including replies on a third party's
-- post. Returning NULL prevents both inbox delivery and the push enqueue trigger.
create function private.suppress_blocked_notification() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if private.users_blocked(new.recipient_id,new.actor_id) then return null; end if;
  return new;
end;
$$;
revoke all on function private.suppress_blocked_notification() from public,anon,authenticated;
create trigger suppress_blocked_notification before insert on public.notifications
for each row execute function private.suppress_blocked_notification();

create function private.guard_blocked_club_membership() returns trigger
language plpgsql security definer set search_path='' as $$
declare club_owner uuid; actor uuid := auth.uid();
begin
  if actor is null then
    -- ON DELETE SET NULL for an invitation's former sender is not a new invite.
    if tg_op='UPDATE' and new.invited_by is null
      and (to_jsonb(new)-'invited_by')=(to_jsonb(old)-'invited_by') then return new; end if;
    raise exception 'Authentication required' using errcode='42501';
  end if;
  select owner_id into club_owner from public.reading_clubs where id=new.club_id;
  if private.users_blocked(actor,new.user_id) or private.users_blocked(actor,club_owner)
     or private.users_blocked(new.user_id,club_owner) then
    raise exception 'Membership unavailable' using errcode='42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_blocked_club_membership() from public,anon,authenticated;
create trigger guard_blocked_club_membership before insert or update on public.reading_club_members
for each row execute function private.guard_blocked_club_membership();
