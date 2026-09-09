-- Server-side guards supplement RLS, including requests made outside the UI.
create or replace function private.guard_friendship_identity()
returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.id, new.requester_id, new.addressee_id, new.created_at)
     is distinct from row(old.id, old.requester_id, old.addressee_id, old.created_at) then
    raise exception 'Friendship participants are immutable' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_friendship_identity() from public, anon, authenticated;
create trigger guard_friendship_identity before update on public.friendships
for each row execute function private.guard_friendship_identity();

create or replace function private.guard_club_membership()
returns trigger language plpgsql security definer set search_path = '' as $$
declare club_owner uuid;
begin
  if tg_op = 'UPDATE' then
    if row(new.club_id, new.user_id, new.created_at)
       is distinct from row(old.club_id, old.user_id, old.created_at) then
      raise exception 'Membership identity is immutable' using errcode = '42501';
    end if;
  end if;
  select owner_id into club_owner from public.reading_clubs where id = new.club_id;
  if new.user_id = club_owner then
    if new.role <> 'owner' or new.status <> 'active' then
      raise exception 'The club owner must remain active owner' using errcode = '42501';
    end if;
  elsif new.role = 'owner' then
    raise exception 'Only the club owner can hold the owner role' using errcode = '42501';
  end if;
  if tg_op = 'INSERT' then
    if new.role = 'moderator' and auth.uid() is distinct from club_owner then
      raise exception 'Only the owner can appoint moderators' using errcode = '42501';
    end if;
  elsif (new.role is distinct from old.role or old.role = 'moderator')
        and auth.uid() is distinct from club_owner then
    raise exception 'Only the owner can manage moderator roles' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_club_membership() from public, anon, authenticated;
create trigger guard_club_membership before insert or update on public.reading_club_members
for each row execute function private.guard_club_membership();

-- Moderators may remove members, but cannot remove peers or the owner.
alter policy reading_club_members_leave_or_manage on public.reading_club_members
using (
  (private.is_club_manager(club_id) and role = 'member')
  or (role <> 'owner' and exists (
    select 1 from public.reading_clubs c where c.id = club_id and c.owner_id = (select auth.uid())
  ))
  or (user_id = (select auth.uid()) and role = 'member')
);

alter table public.community_posts add constraint community_posts_photo_author_folder
check (photo_path is null or split_part(photo_path, '/', 1) = author_id::text);

create or replace function private.guard_post_photo_owner()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is not null and auth.uid() <> new.author_id then
    raise exception 'Only the author may attach a photo' using errcode = '42501';
  end if;
  if new.photo_path is not null and not exists (
    select 1 from storage.objects o where o.bucket_id = 'community-media'
      and o.name = new.photo_path and o.owner_id = new.author_id::text
  ) then
    raise exception 'A photo must belong to the post author' using errcode = '42501';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_post_photo_owner() from public, anon, authenticated;
create trigger guard_post_photo_owner before insert or update of photo_path, author_id
on public.community_posts for each row execute function private.guard_post_photo_owner();

alter policy community_media_select_visible_post on storage.objects using (
  bucket_id = 'community-media' and (
    owner_id = (select auth.uid())::text or exists (
      select 1 from public.community_posts p where p.photo_path = objects.name
        and p.author_id::text = objects.owner_id
        and split_part(objects.name, '/', 1) = p.author_id::text
        and (p.author_id = (select auth.uid()) or p.visibility = 'public')
    )
  )
);
alter policy community_media_update_own on storage.objects with check (
  bucket_id = 'community-media' and owner_id = (select auth.uid())::text
  and (storage.foldername(name))[1] = (select auth.uid())::text
  and storage.extension(name) = any(array['jpg','jpeg','png','webp'])
);
