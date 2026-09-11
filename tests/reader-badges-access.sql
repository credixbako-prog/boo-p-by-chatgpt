begin;
insert into auth.users(id,email) values
 ('b97b3fa0-3210-4134-9d03-000000000101','badge-owner@example.invalid'),
 ('b97b3fa0-3210-4134-9d03-000000000102','badge-friend@example.invalid'),
 ('b97b3fa0-3210-4134-9d03-000000000103','badge-stranger@example.invalid');
insert into public.friendships(requester_id,addressee_id,status) values
 ('b97b3fa0-3210-4134-9d03-000000000101','b97b3fa0-3210-4134-9d03-000000000102','accepted');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000101","role":"authenticated"}',true);
insert into public.reader_badges(user_id,badge_id,unlocked_at) values
 (auth.uid(),'first-step',now()-interval '1 day'),(auth.uid(),'first-word',now());
insert into public.reader_badges(user_id,badge_id) values(auth.uid(),'first-step') on conflict(user_id,badge_id) do nothing;
do $$ begin
 if (select count(*) from public.reader_badges)<>2 then raise exception 'Owner ledger or deduplication';end if;
 begin
 insert into public.reader_badges(user_id,badge_id) values(auth.uid(),'invalid');raise exception 'Unknown badge accepted';exception when check_violation then null;end;
 begin
 update public.reader_badges set unlocked_at=now();raise exception 'Awards rewritable';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000102","role":"authenticated"}',true);
do $$ begin
 if (public.get_reader_latest_badge('b97b3fa0-3210-4134-9d03-000000000101')->>'badge_id') is distinct from 'first-word' then raise exception 'Friend latest badge';end if;
 if exists(select 1 from public.reader_badges) then raise exception 'Friend full ledger leak';end if;
 begin
 insert into public.reader_badges(user_id,badge_id) values('b97b3fa0-3210-4134-9d03-000000000101','five-books');raise exception 'Cross account award';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000103","role":"authenticated"}',true);
do $$ begin
 if public.get_reader_latest_badge('b97b3fa0-3210-4134-9d03-000000000101') is not null then raise exception 'Private badge leaked';end if;
end $$;
reset role;
insert into public.profile_shared_details(user_id,profile_visibility) values('b97b3fa0-3210-4134-9d03-000000000101','public');
set local role authenticated;
do $$ begin
 if (public.get_reader_latest_badge('b97b3fa0-3210-4134-9d03-000000000101')->>'badge_id') is distinct from 'first-word' then raise exception 'Public badge unavailable';end if;
end $$;
reset role;
update public.profile_shared_details set profile_visibility='private' where user_id='b97b3fa0-3210-4134-9d03-000000000101';
delete from public.friendships where requester_id='b97b3fa0-3210-4134-9d03-000000000101';
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000102","role":"authenticated"}',true);
do $$ begin
 if public.get_reader_latest_badge('b97b3fa0-3210-4134-9d03-000000000101') is not null then raise exception 'Revoked friendship leak';end if;
end $$;
set local role anon;
do $$ begin
 begin
 perform public.get_reader_latest_badge('b97b3fa0-3210-4134-9d03-000000000101');raise exception 'Anonymous access';exception when insufficient_privilege then null;end;
end $$;
rollback;
