-- Run after the migration, inside BEGIN ... ROLLBACK. Synthetic rows only.
create temporary table audit_ids (name text primary key, id uuid not null);
insert into audit_ids select name, gen_random_uuid() from unnest(array['a','b','c','club_a','club_c','friend']) name;
grant select on audit_ids to authenticated;
create function pg_temp.audit_id(key text) returns uuid language sql as
$$ select id from audit_ids where name = key $$;
create function pg_temp.must_deny(statement text) returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when insufficient_privilege or check_violation then return;
  end;
  raise exception 'SECURITY REGRESSION: statement was not rejected: %', statement;
end;
$$;
insert into auth.users(id, email, raw_user_meta_data)
select id, id::text || '@example.invalid', '{}'::jsonb from audit_ids where name in ('a','b','c');
select set_config('request.jwt.claim.sub', pg_temp.audit_id('a')::text, true);
insert into public.reading_clubs(id,owner_id,name)
values(pg_temp.audit_id('club_a'), pg_temp.audit_id('a'), 'Audit rollback A');
select set_config('request.jwt.claim.sub', pg_temp.audit_id('c')::text, true);
insert into public.reading_clubs(id,owner_id,name)
values(pg_temp.audit_id('club_c'), pg_temp.audit_id('c'), 'Audit rollback C');
insert into public.friendships(id,requester_id,addressee_id,status)
values(pg_temp.audit_id('friend'),pg_temp.audit_id('a'),pg_temp.audit_id('b'),'pending');
insert into public.reading_club_members(club_id,user_id,role,status)
values(pg_temp.audit_id('club_a'),pg_temp.audit_id('b'),'member','invited');
-- Metadata fixtures: no file upload or external message; all rows roll back.
insert into storage.objects(bucket_id,name,owner_id)
values ('community-media',pg_temp.audit_id('a')::text || '/audit.jpg',pg_temp.audit_id('a')::text);
select set_config('request.jwt.claim.sub', pg_temp.audit_id('b')::text, true);
set local role authenticated;
select pg_temp.must_deny($q$update public.friendships set requester_id=pg_temp.audit_id('c'),status='accepted' where id=pg_temp.audit_id('friend')$q$);
select pg_temp.must_deny($q$update public.reading_club_members set club_id=pg_temp.audit_id('club_c'),status='active' where club_id=pg_temp.audit_id('club_a') and user_id=pg_temp.audit_id('b')$q$);
select pg_temp.must_deny($q$update public.reading_club_members set role='moderator',status='active' where club_id=pg_temp.audit_id('club_a') and user_id=pg_temp.audit_id('b')$q$);
select pg_temp.must_deny($q$insert into public.community_posts(author_id,author_name,author_initials,body,visibility,photo_path) values(pg_temp.audit_id('b'),'Audit','AU','Audit photo','public',pg_temp.audit_id('a')::text || '/audit.jpg')$q$);
do $$ declare affected integer; begin
  update public.friendships set status='accepted',updated_at=now() where id=pg_temp.audit_id('friend');
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Normal friendship acceptance failed'; end if;
  update public.reading_club_members set status='active' where club_id=pg_temp.audit_id('club_a') and user_id=pg_temp.audit_id('b');
  get diagnostics affected = row_count;
  if affected <> 1 then raise exception 'Normal invitation acceptance failed'; end if;
  if exists(select 1 from public.reading_clubs where id=pg_temp.audit_id('club_c')) then
    raise exception 'Foreign private club became accessible';
  end if;
  if exists(select 1 from storage.objects where name=pg_temp.audit_id('a')::text || '/audit.jpg') then
    raise exception 'Private photo became accessible';
  end if;
end $$;
select set_config('request.jwt.claim.sub', pg_temp.audit_id('a')::text, true);
insert into public.community_posts(author_id,author_name,author_initials,body,visibility,photo_path)
values(pg_temp.audit_id('a'),'Audit','AU','Audit photo','public',pg_temp.audit_id('a')::text || '/audit.jpg');
update public.reading_club_members set role='moderator' where club_id=pg_temp.audit_id('club_a') and user_id=pg_temp.audit_id('b');
select set_config('request.jwt.claim.sub', pg_temp.audit_id('b')::text, true);
select pg_temp.must_deny($q$update public.reading_club_members set role='member' where club_id=pg_temp.audit_id('club_a') and user_id=pg_temp.audit_id('a')$q$);
select pg_temp.must_deny($q$insert into public.reading_club_members(club_id,user_id,role,status) values(pg_temp.audit_id('club_a'),pg_temp.audit_id('c'),'moderator','active')$q$);
do $$ begin
  if not exists(select 1 from storage.objects where name=pg_temp.audit_id('a')::text || '/audit.jpg') then
    raise exception 'Legitimate public photo is inaccessible';
  end if;
end $$;
reset role;
select 'social access regression tests passed' as result;
