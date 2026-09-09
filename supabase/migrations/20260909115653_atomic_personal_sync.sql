-- All client mutations now use a transaction and a three-way comparison.
-- Old clients fail closed instead of replacing a newer device's collections.
revoke insert, update, delete, truncate on public.user_books,
  public.user_reading_sessions, public.user_traces, public.user_lexicon_entries,
  public.user_reading_goals from public, anon, authenticated;

create function private.read_personal_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select jsonb_build_object(
    'books',coalesce((select jsonb_agg(payload order by local_id) from public.user_books where user_id=auth.uid()),'[]'::jsonb),
    'sessions',coalesce((select jsonb_agg(payload order by local_id) from public.user_reading_sessions where user_id=auth.uid()),'[]'::jsonb),
    'traces',coalesce((select jsonb_agg(payload order by local_id) from public.user_traces where user_id=auth.uid()),'[]'::jsonb),
    'lexicon',coalesce((select jsonb_agg(payload order by local_id) from public.user_lexicon_entries where user_id=auth.uid()),'[]'::jsonb),
    'goals',coalesce((select jsonb_object_agg(period,payload) from public.user_reading_goals where user_id=auth.uid()),'{}'::jsonb)
  );
$$;
revoke all on function private.read_personal_snapshot() from public,anon;
grant execute on function private.read_personal_snapshot() to authenticated;

create function public.read_personal_snapshot() returns jsonb
language sql stable security invoker set search_path = '' as $$
  select private.read_personal_snapshot();
$$;
revoke all on function public.read_personal_snapshot() from public,anon;
grant execute on function public.read_personal_snapshot() to authenticated;

create function private.merge_personal_snapshot(baseline jsonb, desired jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  actor uuid := auth.uid();
  collection text; table_name text; key_name text;
  before_map jsonb; after_map jsonb; remote_map jsonb;
  item jsonb; item_key text; old_value jsonb; new_value jsonb; remote_value jsonb;
  empty_snapshot jsonb := '{"books":[],"sessions":[],"traces":[],"lexicon":[],"goals":{}}';
begin
  if actor is null or not exists(select 1 from auth.users where id=actor) then
    raise exception 'Authentication required' using errcode='42501';
  end if;
  baseline := coalesce(baseline, empty_snapshot);
  if jsonb_typeof(baseline) is distinct from 'object' or jsonb_typeof(desired) is distinct from 'object' then
    raise exception 'Invalid snapshot' using errcode='22023';
  end if;
  -- Lock is shared by all supported client writes for this account only.
  perform pg_advisory_xact_lock(hashtextextended('boop-sync:' || actor::text,0));
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
$$;
revoke all on function private.merge_personal_snapshot(jsonb,jsonb) from public,anon;
grant execute on function private.merge_personal_snapshot(jsonb,jsonb) to authenticated;

create function public.merge_personal_snapshot(baseline jsonb, desired jsonb)
returns jsonb language sql security invoker set search_path = '' as $$
  select private.merge_personal_snapshot(baseline,desired);
$$;
revoke all on function public.merge_personal_snapshot(jsonb,jsonb) from public,anon;
grant execute on function public.merge_personal_snapshot(jsonb,jsonb) to authenticated;
