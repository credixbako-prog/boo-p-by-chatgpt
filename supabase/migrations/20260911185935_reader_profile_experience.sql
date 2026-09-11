-- Profile presentation is separate from private reading JSON.
create table public.reader_preferences (
 user_id uuid primary key references auth.users(id) on delete cascade,
 welcome text not null default '' check(char_length(welcome)<=180),
 show_current boolean not null default true,
 featured text[] not null default '{}' check(cardinality(featured)<=6)
);
alter table public.reader_preferences enable row level security;
revoke all on public.reader_preferences from anon,authenticated;
grant select,insert,update,delete on public.reader_preferences to authenticated;
create policy reader_preferences_read on public.reader_preferences for select to authenticated using (
 user_id=(select auth.uid()) or private.is_accepted_reader_friend(user_id) or exists(select 1 from public.profile_shared_details p where p.user_id=reader_preferences.user_id and p.profile_visibility='public')
);
create policy reader_preferences_insert on public.reader_preferences for insert to authenticated with check(user_id=(select auth.uid()));
create policy reader_preferences_update on public.reader_preferences for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy reader_preferences_delete on public.reader_preferences for delete to authenticated using(user_id=(select auth.uid()));

create function private.reader_book_access(target_user uuid, book_id text) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and (auth.uid()=target_user or private.is_accepted_reader_friend(target_user))
 and exists(select 1 from public.user_books b where b.user_id=target_user and b.local_id=book_id and b.payload->>'libraryState'='library');
$$;
revoke all on function private.reader_book_access(uuid,text) from public,anon;
grant execute on function private.reader_book_access(uuid,text) to authenticated;

create function private.reader_book_card(book_id text,p jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',book_id,'title',left(coalesce(p->>'title','Sans titre'),400),
 'authors',case when jsonb_typeof(p->'authors')='array' then
 (select coalesce(jsonb_agg(left(a.value #>> '{}',240)),'[]'::jsonb) from (select value from jsonb_array_elements(p->'authors') limit 5) a) else '[]'::jsonb end,
 'status',case when p->>'status' in ('a-lire','en-cours','en-pause','lu','abandonne') then p->>'status' else 'a-lire' end,
 'mediaType',case when p->>'mediaType' in ('print','ebook','audio') then p->>'mediaType' else 'print' end,
 'isbn',case when p->>'isbn' ~ '^[0-9Xx -]{10,20}$' then p->>'isbn' else '' end,
 'coverUrl',case when coalesce(p->>'customCover','false')<>'true' and p->>'coverUrl' ~ '^https://(covers[.]openlibrary[.]org|books[.]google[.]com|books[.]google[.]fr|books[.]googleusercontent[.]com)/' then left(p->>'coverUrl',2000) else '' end);
$$;
revoke all on function private.reader_book_card(text,jsonb) from public,anon;
grant execute on function private.reader_book_card(text,jsonb) to authenticated;

create function private.reader_profile_books(target_user uuid, shelf text default 'all', after_id text default '', book_id text default '') returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare rows jsonb; prefs public.reader_preferences; total integer; finished integer;
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if auth.uid()<>target_user and not private.is_accepted_reader_friend(target_user) then
 return jsonb_build_object('available',false,'books','[]'::jsonb,'next',null); end if;
 select * into prefs from public.reader_preferences where user_id=target_user;
 select count(*),count(*) filter(where payload->>'status'='lu') into total,finished from public.user_books where user_id=target_user and payload->>'libraryState'='library';
 select coalesce(jsonb_agg(s.card order by s.local_id),'[]'::jsonb) into rows from (
 select b.local_id,private.reader_book_card(b.local_id,b.payload) card from public.user_books b
 where b.user_id=target_user and b.payload->>'libraryState'='library' and b.local_id>coalesce(after_id,'')
 and (book_id='' or b.local_id=book_id)
 and (shelf='all' or (shelf='current' and coalesce(prefs.show_current,true) and b.payload->>'status'='en-cours')
 or (shelf='featured' and b.local_id=any(prefs.featured)) or b.payload->>'status'=shelf)
 order by b.local_id limit 25) s;
 return jsonb_build_object('available',true,'total',total,'finished',finished,'showCurrent',coalesce(prefs.show_current,true),
 'books',case when jsonb_array_length(rows)>24 then rows-24 else rows end,
 'next',case when jsonb_array_length(rows)>24 then rows->23->>'id' else null end);
end;
$$;
revoke all on function private.reader_profile_books(uuid,text,text,text) from public,anon;
grant execute on function private.reader_profile_books(uuid,text,text,text) to authenticated;
create function public.get_reader_profile_books(target_user uuid,shelf text default 'all',after_id text default '',book_id text default '') returns jsonb
language sql stable security invoker set search_path='' as $$select private.reader_profile_books(target_user,shelf,after_id,book_id);$$;
revoke all on function public.get_reader_profile_books(uuid,text,text,text) from public,anon;
grant execute on function public.get_reader_profile_books(uuid,text,text,text) to authenticated;

create table public.reader_book_interactions (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null,book_id text not null,
 author_id uuid not null references auth.users(id) on delete cascade,
 kind text not null check(kind in ('trace','encouragement')),
 body text not null check(char_length(btrim(body)) between 1 and 1200),
 parent_id uuid,created_at timestamptz not null default now(),
 foreign key(owner_id,book_id) references public.user_books(user_id,local_id) on delete cascade,
 unique(id,owner_id,book_id),
 foreign key(parent_id,owner_id,book_id) references public.reader_book_interactions(id,owner_id,book_id) on delete cascade,
 check(kind='trace' or parent_id is null),check(parent_id is null or parent_id<>id)
);
create unique index reader_book_one_encouragement on public.reader_book_interactions(owner_id,book_id,author_id) where kind='encouragement';
create index reader_book_interactions_author on public.reader_book_interactions(author_id);
create index reader_book_interactions_parent on public.reader_book_interactions(parent_id,owner_id,book_id);
create index reader_book_interactions_book_date on public.reader_book_interactions(owner_id,book_id,created_at);
alter table public.reader_book_interactions enable row level security;
revoke all on public.reader_book_interactions from anon,authenticated;
grant select,insert,delete on public.reader_book_interactions to authenticated;
create policy reader_book_interactions_read on public.reader_book_interactions for select to authenticated using(private.reader_book_access(owner_id,book_id));
create policy reader_book_interactions_insert on public.reader_book_interactions for insert to authenticated with check(author_id=(select auth.uid()) and private.reader_book_access(owner_id,book_id));
create policy reader_book_interactions_delete on public.reader_book_interactions for delete to authenticated using((author_id=(select auth.uid()) or owner_id=(select auth.uid())) and private.reader_book_access(owner_id,book_id));
-- The publication owner can moderate received Traces; authors keep their existing deletion right.
create policy community_comments_delete_post_owner on public.community_comments for delete to authenticated using(exists(select 1 from public.community_posts p where p.id=community_comments.post_id and p.author_id=(select auth.uid())));

create function private.notify_reader_book_interaction() returns trigger language plpgsql security definer set search_path='' as $$
declare recipient uuid; actor text;
begin
 if auth.uid() is null or auth.uid()<>new.author_id then raise exception 'Invalid actor' using errcode='42501'; end if;
 actor:=private.boopp_actor_name(new.author_id);
 for recipient in select new.owner_id union select i.author_id from public.reader_book_interactions i where i.id=new.parent_id loop
  if recipient<>new.author_id and (recipient=new.owner_id or exists(select 1 from public.friendships f where f.status='accepted' and ((f.requester_id=recipient and f.addressee_id=new.owner_id) or (f.addressee_id=recipient and f.requester_id=new.owner_id)))) then
   if not exists(select 1 from public.notifications n where n.recipient_id=recipient and n.actor_id=new.author_id and n.type=case when new.kind='trace' then 'trace' else 'encouragement' end and n.route='#community?tab=friends&reader='||new.owner_id::text and n.created_at>now()-interval '1 minute') then
    insert into public.notifications(recipient_id,actor_id,actor_name,type,title,body,route,source_id)
    values(recipient,new.author_id,actor,case when new.kind='trace' then 'trace' else 'encouragement' end,
     case when new.kind='trace' then 'Une nouvelle Trace sur une lecture' else 'Un encouragement pour votre lecture' end,
     actor||case when new.kind='trace' then ' a laissé une Trace.' else ' vous souhaite une bonne lecture.' end,
     '#community?tab=friends&reader='||new.owner_id::text,new.id);
   end if;
  end if;
 end loop;
 return new;
end;$$;
revoke all on function private.notify_reader_book_interaction() from public,anon,authenticated;
create trigger notify_reader_book_interaction after insert on public.reader_book_interactions for each row execute function private.notify_reader_book_interaction();
