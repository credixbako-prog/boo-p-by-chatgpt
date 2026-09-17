-- Account deletion is a server-only workflow. API users can never choose a target.
create table private.account_deletions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  requested_at timestamptz not null default now()
);
alter table private.account_deletions enable row level security;
revoke all on private.account_deletions from public,anon,authenticated;
grant select,insert on private.account_deletions to service_role;
grant usage on schema private to service_role;

create function private.boop_user_active(target_user uuid) returns boolean
language sql volatile security definer set search_path='' as $$
  select target_user is not null
    and exists(select 1 from auth.users u where u.id=target_user)
    and not exists(select 1 from private.account_deletions d where d.user_id=target_user);
$$;
revoke all on function private.boop_user_active(uuid) from public,anon,authenticated;
grant execute on function private.boop_user_active(uuid) to service_role;

create function private.boop_account_active() returns boolean
language sql volatile security definer set search_path='' as $$
  select private.boop_user_active(auth.uid());
$$;
revoke all on function private.boop_account_active() from public,anon;
grant execute on function private.boop_account_active() to authenticated,service_role;

-- The blocked account can still discover and resume its own deletion workflow.
-- This exposes only a boolean for auth.uid(), never another account or metadata.
create function private.boop_account_deletion_status() returns boolean
language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and exists(
    select 1 from private.account_deletions d where d.user_id=auth.uid());
$$;
revoke all on function private.boop_account_deletion_status() from public,anon;
grant execute on function private.boop_account_deletion_status() to authenticated;
create function public.get_boop_account_deletion_status() returns boolean
language sql stable security invoker set search_path='' as $$
  select private.boop_account_deletion_status();
$$;
revoke all on function public.get_boop_account_deletion_status() from public,anon;
grant execute on function public.get_boop_account_deletion_status() to authenticated;

-- Guards still run inside existing SECURITY DEFINER sync and service RPCs.
-- Per-account locks serialize the start of cleanup with writes already in flight.
create function private.guard_boop_account_write() returns trigger
language plpgsql security definer set search_path='' as $$
declare actor uuid:=auth.uid(); subject uuid; field text; subjects uuid[]:='{}'; item jsonb:=to_jsonb(new);
begin
  -- FK deletion can detach another row that will itself be deleted later in the
  -- same cascade. Permit only loss of links, never new ownership or content.
  if actor is null and tg_op='UPDATE'
    and (to_jsonb(new)-array['parent_id','owner_id','invited_by','author_id','added_by','created_by'])
      = (to_jsonb(old)-array['parent_id','owner_id','invited_by','author_id','added_by','created_by'])
    and not exists(select 1 from jsonb_each(item) e
      where e.value is distinct from to_jsonb(old)->e.key and e.value<>'null'::jsonb) then
    return new;
  end if;
  if actor is not null then subjects:=array_append(subjects,actor); end if;
  foreach field in array tg_argv loop
    if nullif(item->>field,'') is not null then subjects:=array_append(subjects,(item->>field)::uuid); end if;
  end loop;
  for subject in select distinct value from unnest(subjects) value order by value loop
    perform pg_advisory_xact_lock(hashtextextended('boop-account:'||subject::text,0));
    if not private.boop_user_active(subject) then
      raise exception 'Account deletion in progress or account unavailable' using errcode='42501';
    end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.guard_boop_account_write() from public,anon,authenticated;

-- A deleted identity must not delete shared spaces or other readers' replies.
alter table public.reading_clubs alter column owner_id drop not null,
  drop constraint reading_clubs_owner_id_fkey,
  add constraint reading_clubs_owner_id_fkey foreign key(owner_id) references auth.users(id) on delete set null;
alter table public.reading_salons alter column created_by drop not null,
  drop constraint reading_salons_created_by_fkey,
  add constraint reading_salons_created_by_fkey foreign key(created_by) references auth.users(id) on delete set null;
alter table public.reading_club_books alter column added_by drop not null,
  drop constraint reading_club_books_added_by_fkey,
  add constraint reading_club_books_added_by_fkey foreign key(added_by) references auth.users(id) on delete set null;
alter table public.community_posts alter column author_id drop not null,
  drop constraint community_posts_author_id_fkey,
  add constraint community_posts_author_id_fkey foreign key(author_id) references auth.users(id) on delete set null;
alter table public.reading_club_posts alter column author_id drop not null,
  drop constraint reading_club_posts_author_id_fkey,
  add constraint reading_club_posts_author_id_fkey foreign key(author_id) references auth.users(id) on delete set null;
alter table public.community_comments drop constraint community_comments_parent_id_fkey,
  add constraint community_comments_parent_id_fkey foreign key(parent_id) references public.community_comments(id) on delete set null;
alter table public.reader_book_interactions alter column owner_id drop not null,
  drop constraint reader_book_interactions_parent_id_owner_id_book_id_fkey,
  add constraint reader_book_interactions_parent_id_owner_id_book_id_fkey
    foreign key(parent_id,owner_id,book_id) references public.reader_book_interactions(id,owner_id,book_id)
    on delete set null (parent_id);

-- Trigger FK updates may clear an invitation after its inviter disappears.
-- No identity, role, status or creation date is mutable through this exception.
create or replace function private.guard_club_membership() returns trigger
language plpgsql security definer set search_path='' as $$
declare club_owner uuid;
begin
  if tg_op='UPDATE' then
    if row(new.club_id,new.user_id,new.created_at) is distinct from row(old.club_id,old.user_id,old.created_at) then
      raise exception 'Membership identity is immutable' using errcode='42501';
    end if;
    if auth.uid() is null and old.invited_by is not null and new.invited_by is null
      and row(new.club_id,new.user_id,new.role,new.status,new.created_at)
        is not distinct from row(old.club_id,old.user_id,old.role,old.status,old.created_at) then
      return new;
    end if;
  end if;
  select owner_id into club_owner from public.reading_clubs where id=new.club_id;
  if new.user_id=club_owner then
    if new.role<>'owner' or new.status<>'active' then
      raise exception 'The club owner must remain active owner' using errcode='42501';
    end if;
  elsif new.role='owner' then
    raise exception 'Only the club owner can hold the owner role' using errcode='42501';
  end if;
  if tg_op='INSERT' then
    if new.role='moderator' and auth.uid() is distinct from club_owner then
      raise exception 'Only the owner can appoint moderators' using errcode='42501';
    end if;
  elsif (new.role is distinct from old.role or old.role='moderator')
    and auth.uid() is distinct from club_owner then
    raise exception 'Only the owner can manage moderator roles' using errcode='42501';
  end if;
  return new;
end;
$$;

-- Apply the active-account boundary to every current application table, including
-- user safety tables from the preceding migration. These policies grant no access.
do $$
declare target record; fields text; trigger_args text;
begin
  for target in select c.oid,c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind='r' and c.relrowsecurity
  loop
    execute format('create policy boop_active_account on public.%I as restrictive for all to authenticated using ((select private.boop_account_active())) with check ((select private.boop_account_active()))',target.relname);
    select string_agg(quote_literal(a.attname),',' order by a.attname) into trigger_args
    from pg_attribute a where a.attrelid=target.oid and a.attnum>0 and not a.attisdropped
      and (exists(select 1 from pg_constraint f where f.conrelid=target.oid and f.contype='f'
        and f.confrelid='auth.users'::regclass and a.attnum=any(f.conkey))
        or (target.relname='reader_book_interactions' and a.attname='owner_id'));
    execute format('create trigger boop_active_account_write before insert or update on public.%I for each row execute function private.guard_boop_account_write(%s)',target.relname,coalesce(trigger_args,''));
  end loop;
end;
$$;

create policy boop_active_account on storage.objects as restrictive for all to authenticated
  using((select private.boop_account_active())) with check((select private.boop_account_active()));
create function private.guard_boop_storage_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare subject uuid; subject_text text; candidates text[];
begin
  if new.bucket_id not in ('profile-avatars','community-media') then return new; end if;
  candidates:=array[auth.uid()::text,new.owner_id,new.owner::text,split_part(new.name,'/',1)];
  for subject_text in select distinct v from unnest(candidates) v where v ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' order by v loop
    subject:=subject_text::uuid;
    perform pg_advisory_xact_lock(hashtextextended('boop-account:'||subject::text,0));
    if not private.boop_user_active(subject) then raise exception 'Account unavailable' using errcode='42501'; end if;
  end loop;
  return new;
end;
$$;
revoke all on function private.guard_boop_storage_account() from public,anon,authenticated;
create trigger boop_active_account_write before insert or update on storage.objects
  for each row execute function private.guard_boop_storage_account();

-- Invoker RPCs are granted only to the service role. Cleanup is idempotent.
create function public.prepare_boop_account_deletion(p_user_id uuid) returns void
language plpgsql security invoker set search_path='' as $$
begin
  if p_user_id is null then raise exception 'Account required' using errcode='22023'; end if;
  perform pg_advisory_xact_lock(hashtextextended('boop-sync:'||p_user_id::text,0));
  perform pg_advisory_xact_lock(hashtextextended('boop-account:'||p_user_id::text,0));
  if exists(select 1 from public.boop_voice_calls where user_id=p_user_id and status='pending'
    and created_at>now()-interval '65 minutes') then
    raise exception 'BOOP_VOICE_START_PENDING' using errcode='55000';
  end if;
  insert into private.account_deletions(user_id) values(p_user_id) on conflict(user_id) do nothing;
  delete from public.push_devices where user_id=p_user_id;
  delete from public.notifications where actor_id=p_user_id or recipient_id=p_user_id;
  -- Names and body copies in notifications must not survive actor_id SET NULL.
  -- Remove the source author's contents but retain containers for other readers.
  update public.community_posts set author_id=null,author_name='Compte supprimé',author_initials='CS',
    body='Publication supprimée.',book_title='',photo_path=null,reading_kind=null,reading_source_id=null,reading_content=null,activity_type='trace'
    where author_id=p_user_id;
  update public.reading_club_posts set author_id=null,body='Publication supprimée.',post_type='discussion' where author_id=p_user_id;
  -- Shared catalogue remains; custom creator descriptions/titles are removed.
  -- Ownership disappears without automatically promoting another member.
  update public.reading_clubs set owner_id=null,name='Club de lecture',description='' where owner_id=p_user_id;
  update public.reading_salons set created_by=null,title='Salon de lecture' where created_by=p_user_id;
  update public.reading_club_books set added_by=null where added_by=p_user_id;
  -- Other readers' interactions on the removed personal library are detached.
  -- With no owner/library they become inaccessible; their text is not erased.
  update public.reader_book_interactions set owner_id=null,parent_id=null
    where owner_id=p_user_id and author_id<>p_user_id;
  delete from public.community_comments where author_id=p_user_id;
  delete from public.reader_book_interactions where author_id=p_user_id;
  -- FK parent_id SET NULL preserves replies by remaining readers.
end;
$$;
revoke all on function public.prepare_boop_account_deletion(uuid) from public,anon,authenticated;
grant execute on function public.prepare_boop_account_deletion(uuid) to service_role;

create function public.list_boop_account_deletion_objects(p_user_id uuid,p_limit integer default 500)
returns table(bucket_id text,name text) language plpgsql security invoker set search_path='' as $$
begin
  if not exists(select 1 from private.account_deletions d where d.user_id=p_user_id) then
    raise exception 'Account deletion not prepared' using errcode='42501';
  end if;
  return query select o.bucket_id,o.name from storage.objects o
    where o.owner_id=p_user_id::text or o.owner=p_user_id
      or (o.bucket_id in ('profile-avatars','community-media') and split_part(o.name,'/',1)=p_user_id::text
        and nullif(o.owner_id,'') is null and o.owner is null)
    order by o.bucket_id,o.name limit greatest(1,least(coalesce(p_limit,500),1000));
end;
$$;
revoke all on function public.list_boop_account_deletion_objects(uuid,integer) from public,anon,authenticated;
grant execute on function public.list_boop_account_deletion_objects(uuid,integer) to service_role;
-- Object contents are deleted with Storage API remove(), never SQL DELETE.

CREATE OR REPLACE FUNCTION private.merge_personal_snapshot(baseline jsonb, desired jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  actor uuid := auth.uid();
  collection text; table_name text; key_name text;
  before_map jsonb; after_map jsonb; remote_map jsonb;
  item jsonb; item_key text; old_value jsonb; new_value jsonb; remote_value jsonb;
  empty_snapshot jsonb := '{"books":[],"sessions":[],"traces":[],"lexicon":[],"goals":{}}';
begin
  if not private.boop_account_active() then raise exception 'Account unavailable' using errcode='42501'; end if;
  if actor is null or not exists(select 1 from auth.users where id=actor) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  baseline := coalesce(baseline, empty_snapshot);
  if jsonb_typeof(baseline) is distinct from 'object' or jsonb_typeof(desired) is distinct from 'object' then
    raise exception 'Invalid snapshot' using errcode='22023';
  end if;
  -- Lock is shared by all supported client writes for this account only.
  perform pg_advisory_xact_lock(hashtextextended('boop-sync:' || actor::text,0));
  if not private.boop_account_active() then raise exception 'Account unavailable' using errcode='42501'; end if;
  foreach collection in array array['books','sessions','traces','lexicon','goals'] loop
    table_name := case collection when 'books' then 'user_books' when 'sessions' then 'user_reading_sessions'
      when 'traces' then 'user_traces' when 'lexicon' then 'user_lexicon_entries' else 'user_reading_goals' end;
    key_name := case when collection='goals' then 'period' else 'local_id' end;
    if collection='goals' then
      if jsonb_typeof(baseline->collection) is distinct from 'object' or jsonb_typeof(desired->collection) is distinct from 'object' then
        raise exception 'Invalid goals' using errcode='22023';
      end if;
      before_map := baseline->collection; after_map := desired->collection;
    else
      if jsonb_typeof(baseline->collection) is distinct from 'array' or jsonb_typeof(desired->collection) is distinct from 'array' then
        raise exception 'Invalid collection' using errcode='22023';
      end if;
      -- Reject duplicates and missing IDs; never silently collapse a snapshot.
      foreach item in array array[baseline->collection,desired->collection] loop
        if exists(select 1 from jsonb_array_elements(item) v where jsonb_typeof(v) <> 'object' or coalesce(length(v->>'id'),0) not between 1 and 160)
          or (select count(*) from jsonb_array_elements(item)) <> (select count(distinct v->>'id') from jsonb_array_elements(item) v) then
          raise exception 'Invalid or duplicate record ID' using errcode='22023';
        end if;
      end loop;
      select coalesce(jsonb_object_agg(v->>'id',v),'{}'::jsonb) into before_map from jsonb_array_elements(baseline->collection) v;
      select coalesce(jsonb_object_agg(v->>'id',v),'{}'::jsonb) into after_map from jsonb_array_elements(desired->collection) v;
    end if;
    execute format('select coalesce(jsonb_object_agg(%I,payload),''{}''::jsonb) from public.%I where user_id=$1',key_name,table_name)
      into remote_map using actor;
    for item_key in select key from jsonb_object_keys(before_map || after_map) key loop
      old_value := before_map->item_key; new_value := after_map->item_key; remote_value := remote_map->item_key;
      if new_value is not distinct from old_value then continue; end if;
      -- An identical retry after a lost HTTP response is already complete.
      if remote_value is not distinct from new_value then continue; end if;
      if remote_value is distinct from old_value then
        raise exception 'BOOP_SYNC_CONFLICT' using errcode='P0001',detail=collection || ':' || item_key;
      end if;
      if new_value is null then
        execute format('delete from public.%I where user_id=$1 and %I=$2',table_name,key_name) using actor,item_key;
      else
        execute format('insert into public.%I(user_id,%I,payload,client_updated_at) values($1,$2,$3,clock_timestamp()) on conflict(user_id,%I) do update set payload=excluded.payload,client_updated_at=greatest(excluded.client_updated_at,%I.client_updated_at)',table_name,key_name,key_name,table_name)
          using actor,item_key,new_value;
      end if;
    end loop;
  end loop;
  -- Do not silently discard a concurrent session/trace when its book is deleted,
  -- or attach new work to a book deleted by another device.
  if exists (
    select 1 from (
      select payload from public.user_reading_sessions where user_id=actor
      union all select payload from public.user_traces where user_id=actor
      union all select payload from public.user_lexicon_entries where user_id=actor
    ) dependent
    where dependent.payload->>'bookId' in (
      select v->>'id' from jsonb_array_elements((baseline->'books') || (desired->'books')) v
    ) and not exists(select 1 from public.user_books b where b.user_id=actor and b.local_id=dependent.payload->>'bookId')
  ) then
    raise exception 'BOOP_SYNC_CONFLICT' using errcode='P0001',detail='A referenced book was deleted concurrently';
  end if;
  return private.read_personal_snapshot();
end;
$function$
;

CREATE OR REPLACE FUNCTION private.reader_library(target_user uuid, after_id text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare reader uuid := auth.uid(); rows jsonb;
begin
  if not private.boop_account_active() then raise exception 'Account unavailable' using errcode='42501'; end if;
  if reader is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  if not private.boop_user_active(target_user) or (reader <> target_user and not private.is_accepted_reader_friend(target_user)) then
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
$function$
;

CREATE OR REPLACE FUNCTION private.reader_profile_books(target_user uuid, shelf text DEFAULT 'all'::text, after_id text DEFAULT ''::text, book_id text DEFAULT ''::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare rows jsonb; prefs public.reader_preferences; total integer; finished integer;
begin
  if not private.boop_account_active() then raise exception 'Account unavailable' using errcode='42501'; end if;
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if not private.boop_user_active(target_user) or (auth.uid()<>target_user and not private.is_accepted_reader_friend(target_user)) then
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
$function$
;

CREATE OR REPLACE FUNCTION private.reader_latest_badge(target_user uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.boop_account_active() then raise exception 'Account unavailable' using errcode='42501'; end if;
 if auth.uid() is null or not private.boop_user_active(target_user) or private.viewer_blocked(target_user) then return null; end if;
 if auth.uid()<>target_user and not private.is_accepted_reader_friend(target_user)
 and not exists(select 1 from public.profile_shared_details p where p.user_id=target_user and p.profile_visibility='public') then return null; end if;
 return (select jsonb_build_object('badge_id',b.badge_id,'unlocked_at',b.unlocked_at)
 from public.reader_badges b where b.user_id=target_user order by b.unlocked_at desc,b.badge_id asc limit 1);
end;$function$
;

CREATE OR REPLACE FUNCTION private.reader_book_access(target_user uuid, book_id text)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.boop_account_active() and private.boop_user_active(target_user) and auth.uid() is not null and (auth.uid()=target_user or private.is_accepted_reader_friend(target_user))
 and exists(select 1 from public.user_books b where b.user_id=target_user and b.local_id=book_id and b.payload->>'libraryState'='library');
$function$
;

CREATE OR REPLACE FUNCTION private.boopp_notify_trace()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  post_author uuid;
  parent_author uuid;
  book text;
  display_name text;
  context_text text;
begin
  select p.author_id, p.book_title
    into post_author, book
    from public.community_posts p
    where p.id = new.post_id;

  display_name := coalesce(new.author_name, private.boopp_actor_name(new.author_id));
  context_text := case
    when nullif(trim(book), '') is null then '.'
    else ' sur « ' || left(trim(book), 180) || ' ». '
  end;

  if post_author is not null and post_author is distinct from new.author_id then
    insert into public.notifications (
      recipient_id, actor_id, actor_name, type, title, body, route, source_id
    ) values (
      post_author,
      new.author_id,
      display_name,
      'trace',
      'Nouvelle Trace',
      display_name || ' a répondu à votre Trace' || context_text,
      '#community?tab=public&post=' || new.post_id::text,
      new.id
    );
  end if;

  if new.parent_id is not null then
    select c.author_id into parent_author
      from public.community_comments c
      where c.id = new.parent_id;

    if parent_author is not null and parent_author is distinct from new.author_id
      and parent_author is distinct from post_author then
      insert into public.notifications (
        recipient_id, actor_id, actor_name, type, title, body, route, source_id
      ) values (
        parent_author,
        new.author_id,
        display_name,
        'trace',
        'Réponse à votre Trace',
        display_name || ' a répondu à votre Trace' || context_text,
        '#community?tab=public&post=' || new.post_id::text,
        new.id
      );
    end if;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION private.boopp_notify_encouragement()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  post_author uuid;
  target_post uuid;
  book text;
  display_name text;
  context_text text;
begin
  target_post := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  select p.author_id, p.book_title
    into post_author, book
    from public.community_posts p
    where p.id = target_post;

  if tg_op = 'DELETE' then
    delete from public.notifications n
      where n.recipient_id = post_author
        and n.actor_id = old.user_id
        and n.type = 'encouragement'
        and n.source_id = old.post_id;
    return old;
  end if;

  if post_author is not null and post_author is distinct from new.user_id then
    display_name := private.boopp_actor_name(new.user_id);
    context_text := case
      when nullif(trim(book), '') is null then '.'
      else ' pour « ' || left(trim(book), 180) || ' ». '
    end;
    insert into public.notifications (
      recipient_id, actor_id, actor_name, type, title, body, route, source_id
    ) values (
      post_author,
      new.user_id,
      display_name,
      'encouragement',
      'Nouvel encouragement',
      display_name || ' vous encourage' || context_text,
      '#community?tab=public&post=' || new.post_id::text,
      new.post_id
    );
  end if;

  return new;
end;
$function$
;
