-- Frozen raster cards: no underlying book, notebook or AI conversation JSON is shared.
create table public.reading_cards (
 id uuid primary key,
 user_id uuid not null references auth.users(id) on delete cascade,
 month_key text not null check(month_key ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
 title text not null check(char_length(title) between 1 and 160),
 caption text not null default '' check(char_length(caption)<=1200),
 visibility text not null default 'private' check(visibility in ('private','friends','public')),
 image_data text not null check(octet_length(image_data)<=2200000 and image_data ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'),
 created_at timestamptz not null default now() check(isfinite(created_at))
);
create index reading_cards_owner_date on public.reading_cards(user_id,created_at desc,id);
alter table public.reading_cards enable row level security;
revoke all on public.reading_cards from anon,authenticated;
grant select,insert on public.reading_cards to authenticated;
grant update(caption,visibility) on public.reading_cards to authenticated;
create policy reading_cards_read on public.reading_cards for select to authenticated using(
 user_id=(select auth.uid()) or visibility='public' or (visibility='friends' and private.is_accepted_reader_friend(user_id))
);
create policy reading_cards_insert on public.reading_cards for insert to authenticated with check(user_id=(select auth.uid()) and visibility='private');
create policy reading_cards_update on public.reading_cards for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
