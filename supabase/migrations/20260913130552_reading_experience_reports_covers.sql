-- A four-digit period is an annual report; existing YYYY-MM cards are unchanged.
alter table public.reading_cards drop constraint reading_cards_month_key_check;
alter table public.reading_cards add constraint reading_cards_month_key_check check(month_key ~ '^[0-9]{4}(-(0[1-9]|1[0-2]))?$');

-- The moderator flag must be set by an administrator in app_metadata.
-- No moderator account or privilege is assigned by this migration.
create function private.is_publication_moderator() returns boolean
language sql stable security invoker set search_path='' as $$
 select auth.uid() is not null and coalesce(auth.jwt()->'app_metadata'->>'boop_moderator','false')='true';
$$;
revoke all on function private.is_publication_moderator() from public,anon;
grant execute on function private.is_publication_moderator() to authenticated;

grant delete on public.reading_cards to authenticated;
create policy reading_cards_delete on public.reading_cards for delete to authenticated
 using(user_id=(select auth.uid()) or (visibility<>'private' and (select private.is_publication_moderator())));
create policy reading_cards_read_moderator on public.reading_cards for select to authenticated
 using(visibility<>'private' and (select private.is_publication_moderator()));
create policy community_posts_read_moderator on public.community_posts for select to authenticated
 using(visibility in ('friends','public') and (select private.is_publication_moderator()));
create policy community_posts_delete_moderator on public.community_posts for delete to authenticated
 using(visibility in ('friends','public') and (select private.is_publication_moderator()));
grant update(body) on public.reading_club_posts to authenticated;
create policy reading_club_posts_update_author on public.reading_club_posts for update to authenticated
 using(author_id=(select auth.uid()) and private.is_active_club_member(club_id))
 with check(author_id=(select auth.uid()) and private.is_active_club_member(club_id));
create policy reading_club_posts_delete_moderator on public.reading_club_posts for delete to authenticated
 using((select private.is_publication_moderator()));
create policy reading_club_posts_read_moderator on public.reading_club_posts for select to authenticated
 using((select private.is_publication_moderator()));

create table public.publication_reports (
 id uuid primary key default gen_random_uuid(),
 reporter_id uuid not null references auth.users(id) on delete cascade,
 post_id uuid references public.community_posts(id) on delete cascade,
 club_post_id uuid references public.reading_club_posts(id) on delete cascade,
 card_id uuid references public.reading_cards(id) on delete cascade,
 reason text not null check(char_length(reason) between 1 and 160),
 details text not null default '' check(char_length(details)<=2000),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
 created_at timestamptz not null default now(),
 check(num_nonnulls(post_id,club_post_id,card_id)=1)
);
create index publication_reports_reporter on public.publication_reports(reporter_id);
create index publication_reports_post on public.publication_reports(post_id) where post_id is not null;
create index publication_reports_club_post on public.publication_reports(club_post_id) where club_post_id is not null;
create index publication_reports_card on public.publication_reports(card_id) where card_id is not null;
create index publication_reports_pending on public.publication_reports(created_at) where status='pending';
create unique index publication_reports_once_post on public.publication_reports(reporter_id,post_id) where post_id is not null;
create unique index publication_reports_once_club_post on public.publication_reports(reporter_id,club_post_id) where club_post_id is not null;
create unique index publication_reports_once_card on public.publication_reports(reporter_id,card_id) where card_id is not null;
alter table public.publication_reports enable row level security;
revoke all on public.publication_reports from anon,authenticated;
grant select on public.publication_reports to authenticated;
grant insert(reporter_id,post_id,club_post_id,card_id,reason,details) on public.publication_reports to authenticated;
grant update(status) on public.publication_reports to authenticated;
create policy publication_reports_read on public.publication_reports for select to authenticated
 using(reporter_id=(select auth.uid()) or (select private.is_publication_moderator()));
-- These subqueries retain the target tables' RLS: an inaccessible item cannot be reported.
create policy publication_reports_insert on public.publication_reports for insert to authenticated with check(
 reporter_id=(select auth.uid()) and status='pending' and (
  (post_id is not null and exists(select 1 from public.community_posts p where p.id=post_id and p.author_id<>(select auth.uid()))) or
  (club_post_id is not null and exists(select 1 from public.reading_club_posts p where p.id=club_post_id and p.author_id<>(select auth.uid()))) or
  (card_id is not null and exists(select 1 from public.reading_cards c where c.id=card_id and c.user_id<>(select auth.uid()) and c.visibility<>'private'))
 ));
create policy publication_reports_update_moderator on public.publication_reports for update to authenticated
 using((select private.is_publication_moderator())) with check((select private.is_publication_moderator()));

-- Shared book cards are still projected only through the owner/accepted-friend RPC.
-- Allow bounded raster covers uploaded by the reader, never SVG/HTML or arbitrary URLs.
create or replace function private.reader_book_card(book_id text,p jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',book_id,'title',left(coalesce(p->>'title','Sans titre'),400),
 'authors',case when jsonb_typeof(p->'authors')='array' then
 (select coalesce(jsonb_agg(left(a.value #>> '{}',240)),'[]'::jsonb) from (select value from jsonb_array_elements(p->'authors') limit 5) a) else '[]'::jsonb end,
 'status',case when p->>'status' in ('a-lire','en-cours','en-pause','lu','abandonne') then p->>'status' else 'a-lire' end,
 'mediaType',case when p->>'mediaType' in ('print','ebook','audio') then p->>'mediaType' else 'print' end,
 'isbn',case when p->>'isbn' ~ '^[0-9Xx -]{10,20}$' then p->>'isbn' else '' end,
 'coverUrl',case
 when octet_length(p->>'coverUrl')<=2200000 and p->>'coverUrl' ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$' then p->>'coverUrl'
 when p->>'coverUrl' ~ '^https://(covers[.]openlibrary[.]org|books[.]google[.]com|books[.]google[.]fr|books[.]googleusercontent[.]com)/' then left(p->>'coverUrl',2000)
 when p->>'coverUrl' ~ '^https://shnyjvinzjvgourpscvh[.]supabase[.]co/(storage/v1/object/public/book-covers/|functions/v1/cover-image-proxy[?])' then left(p->>'coverUrl',2000)
 else '' end);
$$;
