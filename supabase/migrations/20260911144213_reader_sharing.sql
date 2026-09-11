-- Personal JSON stays owner-only. Publications are explicit, editable copies.
alter table public.community_posts
  add column reading_kind text,
  add column reading_source_id text,
  add column reading_content text;
alter table public.community_posts add constraint community_posts_reading_copy check (
  (reading_kind is null and reading_source_id is null and reading_content is null)
  or (reading_kind is not null and reading_kind in ('notebook','word','expression','citation','thought','debut','fin','session')
    and reading_source_id is not null and char_length(reading_source_id) between 1 and 160
    and reading_content is not null and char_length(reading_content) <= 100000
    and visibility in ('friends','public','me'))
);
alter table public.community_posts add constraint community_posts_reading_source_unique
  unique (author_id, reading_kind, reading_source_id);
comment on column public.community_posts.reading_content is
  'Explicitly published copy; never synchronized automatically from a private notebook, draft or AI conversation.';

-- The invoker sees only friendships involving themselves under existing RLS.
create or replace function private.is_accepted_reader_friend(other_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select (select auth.uid()) is not null and exists (
    select 1 from public.friendships f where f.status = 'accepted'
      and ((f.requester_id = (select auth.uid()) and f.addressee_id = other_id)
        or (f.addressee_id = (select auth.uid()) and f.requester_id = other_id))
  );
$$;
revoke all on function private.is_accepted_reader_friend(uuid) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.is_accepted_reader_friend(uuid) to authenticated;

alter policy community_posts_select_visible on public.community_posts using (
  (select auth.uid()) = author_id or visibility = 'public'
);
create policy community_posts_select_friends on public.community_posts for select to authenticated
  using (visibility = 'friends' and private.is_accepted_reader_friend(author_id));
-- Delegating visibility to the parent row also covers friendship revocation.
alter policy community_comments_select_visible_post on public.community_comments using (
  exists (select 1 from public.community_posts p where p.id = community_comments.post_id)
);
alter policy community_comments_insert_visible_post on public.community_comments with check (
  (select auth.uid()) = author_id
  and exists (select 1 from public.community_posts p where p.id = community_comments.post_id)
);
alter policy community_comments_update_own on public.community_comments
  using ((select auth.uid()) = author_id and exists (select 1 from public.community_posts p where p.id = community_comments.post_id))
  with check ((select auth.uid()) = author_id and exists (select 1 from public.community_posts p where p.id = community_comments.post_id));
alter policy community_encouragements_select_visible_post on public.community_encouragements using (
  exists (select 1 from public.community_posts p where p.id = community_encouragements.post_id)
);
alter policy community_encouragements_insert_own on public.community_encouragements with check (
  (select auth.uid()) = user_id
  and exists (select 1 from public.community_posts p where p.id = community_encouragements.post_id)
);
alter policy community_media_select_visible_post on storage.objects using (
  bucket_id = 'community-media' and (owner_id = (select auth.uid())::text or exists (
    select 1 from public.community_posts p where p.photo_path = objects.name
      and p.author_id::text = objects.owner_id
      and split_part(objects.name, '/', 1) = p.author_id::text
  ))
);

-- A definer is necessary solely to project safe fields from owner-only JSON.
-- Keep the implementation private, check the caller before reading, and never
-- return payload wholesale (it contains notes, AI messages and unsaved drafts).
create or replace function private.reader_library(target_user uuid, after_id text default '')
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare reader uuid := auth.uid(); rows jsonb;
begin
  if reader is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if reader <> target_user and not private.is_accepted_reader_friend(target_user) then
    return jsonb_build_object('available',false,'books','[]'::jsonb,'next',null);
  end if;
  select coalesce(jsonb_agg(s.book order by s.local_id), '[]'::jsonb) into rows from (
    select b.local_id, jsonb_build_object(
      'id', b.local_id,
      'title', left(coalesce(b.payload->>'title','Sans titre'),400),
      'authors', case when jsonb_typeof(b.payload->'authors') = 'array' then (
        select coalesce(jsonb_agg(left(a.value #>> '{}',240)), '[]'::jsonb)
        from (select value from jsonb_array_elements(b.payload->'authors') limit 5) a
      ) else '[]'::jsonb end,
      'status', case when b.payload->>'status' in ('a-lire','en-cours','en-pause','lu','abandonne') then b.payload->>'status' else 'a-lire' end,
      'mediaType', case when b.payload->>'mediaType' in ('print','ebook','audio') then b.payload->>'mediaType' else 'print' end
    ) as book from public.user_books b
    where b.user_id = target_user and b.local_id > coalesce(after_id,'')
      and b.payload->>'libraryState' = 'library'
    order by b.local_id limit 25
  ) s;
  return jsonb_build_object('available',true,
    'books',case when jsonb_array_length(rows)>24 then rows - 24 else rows end,
    'next',case when jsonb_array_length(rows)>24 then rows->23->>'id' else null end);
end;
$$;
revoke all on function private.reader_library(uuid,text) from public, anon;
grant execute on function private.reader_library(uuid,text) to authenticated;
create or replace function public.get_reader_library(target_user uuid, after_id text default '')
returns jsonb language sql stable security invoker set search_path = '' as $$
  select private.reader_library(target_user, after_id);
$$;
revoke all on function public.get_reader_library(uuid,text) from public, anon;
grant execute on function public.get_reader_library(uuid,text) to authenticated;
