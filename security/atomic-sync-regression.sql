-- Execute after migration within BEGIN ... ROLLBACK; no persistent fixtures.
create temporary table sync_test_users as select gen_random_uuid() a,gen_random_uuid() b;
grant select on sync_test_users to authenticated;
insert into auth.users(id,email,raw_user_meta_data)
select a,a::text || '@example.invalid','{}'::jsonb from sync_test_users
union all select b,b::text || '@example.invalid','{}'::jsonb from sync_test_users;
select set_config('request.jwt.claim.sub',(select a::text from sync_test_users),true);
set local role authenticated;
do $$
declare
  empty_state jsonb := '{"books":[],"sessions":[],"traces":[],"lexicon":[],"goals":{}}';
  base jsonb; remote_state jsonb; local_state jsonb; result_state jsonb; rejected boolean;
begin
  base := public.merge_personal_snapshot(null,jsonb_set(empty_state,'{books}','[{"id":"a","title":"A"}]'));
  remote_state := public.merge_personal_snapshot(base,jsonb_set(base,'{books}','[{"id":"a","title":"A"},{"id":"b","title":"B"}]'));
  local_state := jsonb_set(base,'{books}','[{"id":"a","title":"A modified"}]');
  result_state := public.merge_personal_snapshot(base,local_state);
  if jsonb_array_length(result_state->'books') <> 2 or not (result_state->'books' @> '[{"id":"b","title":"B"}]') then
    raise exception 'Stale device deleted remote addition';
  end if;
  if public.merge_personal_snapshot(base,local_state) <> result_state then raise exception 'Retry is not idempotent'; end if;
  -- Both devices edit A differently: entire transaction must fail.
  rejected := false;
  begin
    perform public.merge_personal_snapshot(base,jsonb_set(base,'{books}','[{"id":"a","title":"Conflicting edit"}]'));
  exception when raise_exception then
    if sqlerrm <> 'BOOP_SYNC_CONFLICT' then raise; end if;
    rejected := true;
  end;
  if not rejected then raise exception 'Conflicting edit was accepted'; end if;
  -- A late constraint error must roll back the earlier book update as well.
  rejected := false;
  begin
    perform public.merge_personal_snapshot(result_state,jsonb_set(jsonb_set(result_state,'{books}','[{"id":"a","title":"Should rollback"},{"id":"b","title":"B"}]'),'{goals}','{"invalid_period":{}}'));
  exception when check_violation then rejected := true;
  end;
  if not rejected or public.read_personal_snapshot() <> result_state then raise exception 'Non-atomic write'; end if;
  -- Explicit deletion does not delete a concurrent addition.
  base := result_state;
  remote_state := public.merge_personal_snapshot(base,jsonb_set(base,'{books}',(base->'books') || '[{"id":"c","title":"C"}]'));
  result_state := public.merge_personal_snapshot(base,jsonb_set(base,'{books}','[{"id":"b","title":"B"}]'));
  if result_state->'books' @> '[{"id":"a"}]' or not (result_state->'books' @> '[{"id":"c"}]') then raise exception 'Incorrect explicit deletion'; end if;
  -- Unchanged stale A must not resurrect the deleted record.
  remote_state := public.merge_personal_snapshot(base,base);
  if remote_state <> result_state then raise exception 'Stale replay resurrected deleted data'; end if;
  -- Adding a session for a book removed remotely must preserve the deletion
  -- and reject the orphan session without any partial write.
  rejected := false;
  begin
    perform public.merge_personal_snapshot(base,jsonb_set(base,'{sessions}','[{"id":"new-session","bookId":"a"}]'));
  exception when raise_exception then
    if sqlerrm <> 'BOOP_SYNC_CONFLICT' then raise; end if;
    rejected := true;
  end;
  if not rejected or public.read_personal_snapshot() <> result_state then raise exception 'Orphan concurrent session accepted'; end if;
  rejected := false;
  begin
    insert into public.user_books(user_id,local_id,payload) values(auth.uid(),'legacy','{}');
  exception when insufficient_privilege then rejected := true;
  end;
  if not rejected then raise exception 'Legacy writes remain authorized'; end if;
  perform set_config('request.jwt.claim.sub',(select b::text from sync_test_users),true);
  if public.read_personal_snapshot() <> empty_state then raise exception 'Cross-user data leak'; end if;
  perform public.merge_personal_snapshot(null,jsonb_set(empty_state,'{books}','[{"id":"b","title":"Other user"}]'));
  perform set_config('request.jwt.claim.sub',(select a::text from sync_test_users),true);
  if public.read_personal_snapshot() <> result_state then raise exception 'Cross-user write'; end if;
end $$;
reset role;
insert into public.user_books(user_id,local_id,payload)
select a,'bulk-' || n,jsonb_build_object('id','bulk-' || n) from sync_test_users,generate_series(1,1205) n;
set local role authenticated;
do $$ begin
  if jsonb_array_length(public.read_personal_snapshot()->'books') <> 1207 then raise exception 'Snapshot truncated'; end if;
end $$;
reset role;
select 'atomic sync regression tests passed' as result;
