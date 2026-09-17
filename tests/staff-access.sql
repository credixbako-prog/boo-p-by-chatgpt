-- Fresh isolated test database only: last-admin invariants require no real staff.
-- Synthetic fixtures, no production identities, every change rolls back.
begin;
select set_config('request.jwt.claims','{}',true);
insert into auth.users(id,email,email_confirmed_at) values
 ('ad71a000-0000-4000-8000-000000000001','staff-admin@example.invalid',now()),
 ('ad71a000-0000-4000-8000-000000000002','staff-mod@example.invalid',now()),
 ('ad71a000-0000-4000-8000-000000000003','staff-member@example.invalid',now()),
 ('ad71a000-0000-4000-8000-000000000004','staff-successor@example.invalid',now()),
 ('ad71a000-0000-4000-8000-000000000005','staff-unconfirmed@example.invalid',null),
 ('ad71a000-0000-4000-8000-000000000006','staff-banned@example.invalid',now()),
 ('ad71a000-0000-4000-8000-000000000007','staff-deleting@example.invalid',now());
update auth.users set banned_until=now()+interval '1 day' where id='ad71a000-0000-4000-8000-000000000006';
insert into private.account_deletions(user_id) values('ad71a000-0000-4000-8000-000000000007');
insert into private.boop_staff_roles(user_id,is_admin,is_moderator) values
 ('ad71a000-0000-4000-8000-000000000001',true,false),
 ('ad71a000-0000-4000-8000-000000000002',false,true),
 ('ad71a000-0000-4000-8000-000000000005',true,true),
 ('ad71a000-0000-4000-8000-000000000006',true,true),
 ('ad71a000-0000-4000-8000-000000000007',true,true);
insert into public.profiles(user_id,display_name) values
 ('ad71a000-0000-4000-8000-000000000001','Staff administrator'),
 ('ad71a000-0000-4000-8000-000000000002','Staff moderator'),
 ('ad71a000-0000-4000-8000-000000000003','Staff member');
insert into public.profile_directory(user_id,display_name,handle,profile_visibility) values
 ('ad71a000-0000-4000-8000-000000000001','Staff administrator','staff_admin_fixture','public'),
 ('ad71a000-0000-4000-8000-000000000002','Staff moderator','staff_mod_fixture','public'),
 ('ad71a000-0000-4000-8000-000000000003','Staff member','staff_member_fixture','public');
insert into public.community_posts(id,author_id,author_name,author_initials,body,visibility) values
 ('ad71a000-0000-4000-8000-000000000020','ad71a000-0000-4000-8000-000000000002','Staff mod','SM',repeat('shared ',120),'public'),
 ('ad71a000-0000-4000-8000-000000000021','ad71a000-0000-4000-8000-000000000002','Staff mod','SM','SECRET PRIVATE ORIGINAL','me'),
 ('ad71a000-0000-4000-8000-000000000023','ad71a000-0000-4000-8000-000000000001','Staff admin','SA','Another author public post','public');
insert into public.reading_cards(id,user_id,month_key,title,caption,image_data,visibility) values
 ('ad71a000-0000-4000-8000-000000000022','ad71a000-0000-4000-8000-000000000002','2026-08','Private','SECRET PRIVATE CARD','data:image/jpeg;base64,AAAA','private');
insert into public.user_reports(id,reporter_id,reported_user_id,reason) values
 ('ad71a000-0000-4000-8000-000000000030','ad71a000-0000-4000-8000-000000000003','ad71a000-0000-4000-8000-000000000002','Autre motif');
insert into public.publication_reports(id,reporter_id,post_id,reason) values
 ('ad71a000-0000-4000-8000-000000000031','ad71a000-0000-4000-8000-000000000003','ad71a000-0000-4000-8000-000000000020','Shared fixture'),
 ('ad71a000-0000-4000-8000-000000000032','ad71a000-0000-4000-8000-000000000003','ad71a000-0000-4000-8000-000000000021','Private fixture');
insert into public.publication_reports(id,reporter_id,card_id,reason) values
 ('ad71a000-0000-4000-8000-000000000033','ad71a000-0000-4000-8000-000000000003','ad71a000-0000-4000-8000-000000000022','Private card fixture');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000003","role":"authenticated","app_metadata":{"boop_admin":true,"boop_moderator":true},"user_metadata":{"boop_admin":true,"boop_moderator":true}}',true);
do $$begin
 if public.get_boop_staff_access()<>'{"isAdmin":false,"isModerator":false}'::jsonb then raise exception 'Forged metadata grants staff access';end if;
 begin perform public.list_boop_staff_users();raise exception 'Member reads account email list';exception when insufficient_privilege then null;end;
 begin perform public.list_boop_staff_reports();raise exception 'Member reads report queue';exception when insufficient_privilege then null;end;
 begin perform public.review_boop_staff_report('user','ad71a000-0000-4000-8000-000000000030','reviewed');raise exception 'Member reviews report';exception when insufficient_privilege then null;end;
 begin perform public.set_boop_staff_roles(auth.uid(),true,true);raise exception 'Member appoints self';exception when insufficient_privilege then null;end;
 begin insert into private.boop_staff_roles(user_id,is_admin) values(auth.uid(),true);raise exception 'Member writes canonical roles';exception when insufficient_privilege then null;end;
 begin perform count(*) from private.boop_staff_audit;raise exception 'Member reads staff audit';exception when insufficient_privilege then null;end;
end $$;

select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$declare value jsonb;begin
 if public.get_boop_staff_access()<>'{"isAdmin":false,"isModerator":true}'::jsonb then raise exception 'Live moderator denied without claims';end if;
 begin perform public.list_boop_staff_users();raise exception 'Moderator reads account email list';exception when insufficient_privilege then null;end;
 begin perform public.set_boop_staff_roles(auth.uid(),true,true);raise exception 'Moderator grants admin';exception when insufficient_privilege then null;end;
 value:=public.list_boop_staff_reports('pending',1,0);
 if jsonb_array_length(value->'items')<>1 or not (value->>'hasMore')::boolean then raise exception 'Report pagination broken';end if;
 value:=public.list_boop_staff_reports('pending',100,0);
 if jsonb_array_length(value->'items')<>4 then raise exception 'Unified queue missing report kinds';end if;
 if value::text like '%SECRET PRIVATE%' then raise exception 'Private content leaked through definer';end if;
 if exists(select 1 from jsonb_array_elements(value->'items') i where length(i->>'excerpt')>600) then raise exception 'Excerpt not bounded';end if;
 if not exists(select 1 from jsonb_array_elements(value->'items') i where i->>'targetId'='ad71a000-0000-4000-8000-000000000020' and length(i->>'excerpt')=600) then raise exception 'Visible excerpt missing';end if;
 begin perform public.list_boop_staff_reports('invalid');raise exception 'Invalid filter accepted';exception when invalid_parameter_value then null;end;
 begin update public.user_reports set status='reviewed' where id='ad71a000-0000-4000-8000-000000000030';raise exception 'Direct review bypasses audit';exception when insufficient_privilege then null;end;
 perform public.review_boop_staff_report('user','ad71a000-0000-4000-8000-000000000030','reviewed');
 perform public.review_boop_staff_report('publication','ad71a000-0000-4000-8000-000000000031','dismissed');
 perform public.review_boop_staff_report('publication','ad71a000-0000-4000-8000-000000000031','pending');
 begin perform public.review_boop_staff_report('user','ad71a000-0000-4000-8000-000000000030','anything');raise exception 'Invalid review status accepted';exception when invalid_parameter_value then null;end;
 begin perform public.review_boop_staff_report('user','ad71a000-0000-4000-8000-000000000099','reviewed');raise exception 'Missing report accepted';exception when no_data_found then null;end;
end $$;

select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000005","role":"authenticated"}',true);
do $$begin if private.is_boop_admin() or private.is_publication_moderator() then raise exception 'Unconfirmed account retains staff privileges';end if;end $$;
select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000006","role":"authenticated"}',true);
do $$begin if private.is_boop_admin() or private.is_publication_moderator() then raise exception 'Banned account retains staff privileges';end if;end $$;
select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000007","role":"authenticated"}',true);
do $$begin if private.is_boop_admin() or private.is_publication_moderator() then raise exception 'Deleting account retains staff privileges';end if;end $$;

select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare value jsonb;begin
 if public.get_boop_staff_access()<>'{"isAdmin":true,"isModerator":true}'::jsonb then raise exception 'Admin does not inherit moderation';end if;
 value:=public.list_boop_staff_users('staff-member',1,0);
 if jsonb_array_length(value->'items')<>1 or value->'items'->0->>'email'<>'staff-member@example.invalid' then raise exception 'Admin account search broken';end if;
 if value->'items'->0->>'displayName'<>'Staff member' then raise exception 'Admin display name missing';end if;
 if jsonb_array_length(public.list_boop_staff_users('%',100,0)->'items')<>0 then raise exception 'Search wildcard was expanded';end if;
 begin perform public.set_boop_staff_roles(auth.uid(),false,false);raise exception 'Last admin demoted';exception when object_not_in_prerequisite_state then if sqlerrm<>'staff_last_admin' then raise;end if;end;
 begin perform public.set_boop_staff_roles('ad71a000-0000-4000-8000-000000000005',true,true);raise exception 'Unconfirmed appointed';exception when invalid_parameter_value then null;end;
 begin perform public.set_boop_staff_roles('ad71a000-0000-4000-8000-000000000006',true,true);raise exception 'Banned appointed';exception when invalid_parameter_value then null;end;
 begin perform public.set_boop_staff_roles('ad71a000-0000-4000-8000-000000000007',true,true);raise exception 'Deleting appointed';exception when invalid_parameter_value then null;end;
 begin perform public.set_boop_staff_roles('ad71a000-0000-4000-8000-000000000003',null,true);raise exception 'Null role accepted';exception when invalid_parameter_value then null;end;
 perform public.set_boop_staff_roles('ad71a000-0000-4000-8000-000000000002',false,false);
end $$;
select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000002","role":"authenticated","app_metadata":{"boop_moderator":true}}',true);
do $$begin
 if private.is_publication_moderator() then raise exception 'Revoked moderator retains JWT authority';end if;
 begin perform public.list_boop_staff_reports();raise exception 'Revoked moderator reads queue';exception when insufficient_privilege then null;end;
 delete from public.community_posts where id='ad71a000-0000-4000-8000-000000000023';
 if found then raise exception 'Revoked moderator deletes another author publication';end if;
 delete from public.community_posts where id='ad71a000-0000-4000-8000-000000000020';
 -- This user is the author: existing ownership rights must survive staff revocation.
 if not found then raise exception 'Role revocation removed author rights';end if;
end $$;

reset role;
select set_config('request.jwt.claims','{}',true);
set local role service_role;
do $$begin
 begin perform public.prepare_boop_account_deletion('ad71a000-0000-4000-8000-000000000001');raise exception 'Last admin deletion started';exception when object_not_in_prerequisite_state then if sqlerrm<>'staff_last_admin' then raise;end if;end;
 if exists(select 1 from private.account_deletions where user_id='ad71a000-0000-4000-8000-000000000001') then raise exception 'Denied deletion left durable marker';end if;
end $$;
reset role;
do $$begin
 if not exists(select 1 from public.profiles where user_id='ad71a000-0000-4000-8000-000000000001') then raise exception 'Denied deletion lost profile';end if;
 if not exists(select 1 from public.community_posts where id='ad71a000-0000-4000-8000-000000000023' and body='Another author public post') then raise exception 'Denied deletion erased publication';end if;
 if (select count(*) from private.boop_staff_audit where action like 'report_%' and subject_id in ('ad71a000-0000-4000-8000-000000000030','ad71a000-0000-4000-8000-000000000031'))<>3 then raise exception 'Report audit incomplete';end if;
 if not exists(select 1 from private.boop_staff_audit where action='staff_roles' and subject_id='ad71a000-0000-4000-8000-000000000002') then raise exception 'Role audit missing';end if;
 if has_function_privilege('anon','public.get_boop_staff_access()','execute') or has_function_privilege('anon','public.list_boop_staff_users(text,integer,integer)','execute') then raise exception 'Anonymous staff RPC grants';end if;
 if has_table_privilege('authenticated','private.boop_staff_roles','select') then raise exception 'Canonical role table exposed';end if;
end $$;
insert into auth.users(id,email,email_confirmed_at)
select ('ad71a100-0000-4000-8000-'||lpad(n::text,12,'0'))::uuid,'staff-page-'||n||'@example.invalid',now() from generate_series(1,105) n;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$declare value jsonb;begin
 value:=public.list_boop_staff_users('staff-page-',100000,0);
 if jsonb_array_length(value->'items')<>100 or not (value->>'hasMore')::boolean then raise exception 'Admin list limit not bounded';end if;
 value:=public.list_boop_staff_users('staff-page-',100,100);
 if jsonb_array_length(value->'items')<>5 or (value->>'hasMore')::boolean then raise exception 'Admin list offset broken';end if;
 perform public.set_boop_staff_roles('ad71a000-0000-4000-8000-000000000004',true,true);
 perform public.set_boop_staff_roles(auth.uid(),false,true);
 if private.is_boop_admin() or not private.is_publication_moderator() then raise exception 'Admin handoff not immediate';end if;
 begin perform public.list_boop_staff_users();raise exception 'Demoted admin still lists emails';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000004","role":"authenticated"}',true);
select public.set_boop_staff_roles('ad71a000-0000-4000-8000-000000000001',true,true);
reset role;
select set_config('request.jwt.claims','{}',true);
set local role service_role;
select public.prepare_boop_account_deletion('ad71a000-0000-4000-8000-000000000001');
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"ad71a000-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$begin if private.is_boop_admin() or private.is_publication_moderator() then raise exception 'Deletion marker failed to revoke staff';end if;end $$;
reset role;
select set_config('request.jwt.claims','{}',true);
set local role service_role;
do $$begin
 begin perform public.prepare_boop_account_deletion('ad71a000-0000-4000-8000-000000000004');raise exception 'Second admin deletion left no admin';exception when object_not_in_prerequisite_state then null;end;
end $$;
reset role;
-- Retain the audit action while detaching an erased actor's identity.
select set_config('request.jwt.claims','{}',true);
delete from auth.users where id='ad71a000-0000-4000-8000-000000000001';
do $$begin
 if exists(select 1 from private.boop_staff_audit where actor_id='ad71a000-0000-4000-8000-000000000001') then raise exception 'Deleted staff actor retained in audit';end if;
 if not exists(select 1 from private.boop_staff_audit where actor_id is null and action='staff_roles' and subject_id='ad71a000-0000-4000-8000-000000000002') then raise exception 'Audit history disappeared with actor';end if;
end $$;
select 'PASS: live canonical roles, forged claims, member/mod/admin boundaries, confirmation/bans/deletion, bounded private-safe report queue, review and role audits, immediate revocation, pagination, last-admin demotion and deletion protection, admin handoff; rolled back' checks;
rollback;
