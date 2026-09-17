-- Run after both 20260917 migrations. Every fixture and metadata change rolls back.
begin;
insert into auth.users(id,email) values
 ('bdaa9717-0000-4000-8000-000000000001','delete-fixture@example.invalid'),
 ('bdaa9717-0000-4000-8000-000000000002','survivor-fixture@example.invalid');
select set_config('request.jwt.claims','{"sub":"bdaa9717-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.profiles(user_id,display_name) values
 ('bdaa9717-0000-4000-8000-000000000001','DELETE PERSONAL NAME'),
 ('bdaa9717-0000-4000-8000-000000000002','Survivor');
insert into public.profile_directory(user_id,display_name,handle) values
 ('bdaa9717-0000-4000-8000-000000000001','DELETE PERSONAL NAME','deletion-fixture-a'),
 ('bdaa9717-0000-4000-8000-000000000002','Survivor','deletion-fixture-b');
insert into public.user_books(user_id,local_id,payload) values
 ('bdaa9717-0000-4000-8000-000000000001','private-book','{"title":"DELETE PERSONAL BOOK","libraryState":"library"}'),
 ('bdaa9717-0000-4000-8000-000000000002','shared-book','{"title":"Survivor book","libraryState":"library"}');
insert into public.friendships(requester_id,addressee_id,status) values
 ('bdaa9717-0000-4000-8000-000000000001','bdaa9717-0000-4000-8000-000000000002','accepted');
insert into public.reading_clubs(id,owner_id,name,description,visibility) values
 ('bdaa9717-0000-4000-8000-000000000101','bdaa9717-0000-4000-8000-000000000001','Shared club','Shared description','private');
insert into public.reading_club_members(club_id,user_id,role,status,invited_by) values
 ('bdaa9717-0000-4000-8000-000000000101','bdaa9717-0000-4000-8000-000000000002','moderator','active','bdaa9717-0000-4000-8000-000000000001');
insert into public.reading_salons(id,club_id,created_by,title,scheduled_at) values
 ('bdaa9717-0000-4000-8000-000000000201','bdaa9717-0000-4000-8000-000000000101','bdaa9717-0000-4000-8000-000000000001','Shared salon',now());
insert into public.reading_club_books(id,club_id,added_by,title) values
 ('bdaa9717-0000-4000-8000-000000000301','bdaa9717-0000-4000-8000-000000000101','bdaa9717-0000-4000-8000-000000000001','Shared catalogue book');
insert into public.community_posts(id,author_id,author_name,author_initials,activity_type,body,book_title,visibility) values
 ('bdaa9717-0000-4000-8000-000000000401','bdaa9717-0000-4000-8000-000000000001','DELETE PERSONAL NAME','DA','trace','DELETE PERSONAL POST','DELETE PERSONAL TITLE','public');
select set_config('request.jwt.claims','{"sub":"bdaa9717-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into public.community_posts(id,author_id,author_name,author_initials,activity_type,body,book_title,visibility) values
 ('bdaa9717-0000-4000-8000-000000000402','bdaa9717-0000-4000-8000-000000000002','Survivor','SU','trace','Survivor post','','public');
select set_config('request.jwt.claims','{"sub":"bdaa9717-0000-4000-8000-000000000001","role":"authenticated"}',true);
insert into public.community_comments(id,post_id,author_id,author_name,body,parent_id) values
 ('bdaa9717-0000-4000-8000-000000000501','bdaa9717-0000-4000-8000-000000000402','bdaa9717-0000-4000-8000-000000000001','DELETE PERSONAL NAME','DELETE PERSONAL COMMENT',null),
 ('bdaa9717-0000-4000-8000-000000000503','bdaa9717-0000-4000-8000-000000000402','bdaa9717-0000-4000-8000-000000000001','DELETE PERSONAL NAME','DELETE PERSONAL CHILD','bdaa9717-0000-4000-8000-000000000501');
insert into public.reading_club_posts(id,club_id,author_id,post_type,body) values
 ('bdaa9717-0000-4000-8000-000000000601','bdaa9717-0000-4000-8000-000000000101','bdaa9717-0000-4000-8000-000000000001','discussion','DELETE PERSONAL CLUB POST');
insert into public.reader_book_interactions(id,owner_id,book_id,author_id,kind,body) values
 ('bdaa9717-0000-4000-8000-000000000801','bdaa9717-0000-4000-8000-000000000002','shared-book','bdaa9717-0000-4000-8000-000000000001','trace','DELETE PERSONAL INTERACTION');
select set_config('request.jwt.claims','{"sub":"bdaa9717-0000-4000-8000-000000000002","role":"authenticated"}',true);
insert into public.community_comments(id,post_id,author_id,author_name,body,parent_id) values
 ('bdaa9717-0000-4000-8000-000000000502','bdaa9717-0000-4000-8000-000000000402','bdaa9717-0000-4000-8000-000000000002','Survivor','Survivor reply','bdaa9717-0000-4000-8000-000000000501'),
 ('bdaa9717-0000-4000-8000-000000000504','bdaa9717-0000-4000-8000-000000000401','bdaa9717-0000-4000-8000-000000000002','Survivor','Survivor reply on removed publication',null);
insert into public.reading_club_comments(id,post_id,author_id,body) values
 ('bdaa9717-0000-4000-8000-000000000701','bdaa9717-0000-4000-8000-000000000601','bdaa9717-0000-4000-8000-000000000002','Survivor club reply');
insert into public.reading_salon_messages(id,salon_id,author_id,body) values
 ('bdaa9717-0000-4000-8000-000000000702','bdaa9717-0000-4000-8000-000000000201','bdaa9717-0000-4000-8000-000000000002','Survivor salon message');
insert into public.reader_book_interactions(id,owner_id,book_id,author_id,kind,body,parent_id) values
 ('bdaa9717-0000-4000-8000-000000000802','bdaa9717-0000-4000-8000-000000000002','shared-book','bdaa9717-0000-4000-8000-000000000002','trace','Survivor library reply','bdaa9717-0000-4000-8000-000000000801'),
 ('bdaa9717-0000-4000-8000-000000000803','bdaa9717-0000-4000-8000-000000000001','private-book','bdaa9717-0000-4000-8000-000000000002','trace','Survivor detached library reply',null);
-- Storage METADATA fixtures only; no physical file is created/deleted by SQL.
insert into storage.objects(bucket_id,name,owner_id) values
 ('community-media','bdaa9717-0000-4000-8000-000000000001/fixture/photo.jpg','bdaa9717-0000-4000-8000-000000000001'),
 ('profile-avatars','bdaa9717-0000-4000-8000-000000000001/avatar.jpg',null),
 ('community-media','bdaa9717-0000-4000-8000-000000000001/fixture/other-owner.jpg','bdaa9717-0000-4000-8000-000000000002'),
 ('community-media','bdaa9717-0000-4000-8000-000000000002/fixture/photo.jpg','bdaa9717-0000-4000-8000-000000000002');
do $$ begin
 if has_function_privilege('authenticated','public.prepare_boop_account_deletion(uuid)','execute')
 or has_function_privilege('anon','public.prepare_boop_account_deletion(uuid)','execute')
 or has_function_privilege('authenticated','public.list_boop_account_deletion_objects(uuid,integer)','execute')
 or has_table_privilege('authenticated','private.account_deletions','insert') then
   raise exception 'Account deletion service privilege leak';
 end if;
 if (select prosecdef from pg_proc where oid='public.prepare_boop_account_deletion(uuid)'::regprocedure)
 or (select prosecdef from pg_proc where oid='public.list_boop_account_deletion_objects(uuid,integer)'::regprocedure) then
   raise exception 'Public cleanup RPC must be security invoker';
 end if;
end $$;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
set local role service_role;
insert into public.boop_voice_calls(id,user_id,status) values
 ('bdaa9717-0000-4000-8000-000000000901','bdaa9717-0000-4000-8000-000000000001','pending');
do $$ begin
 begin
   perform public.prepare_boop_account_deletion('bdaa9717-0000-4000-8000-000000000001');
   raise exception 'Voice startup raced account deletion';
 exception when object_not_in_prerequisite_state then
   if sqlerrm<>'BOOP_VOICE_START_PENDING' then raise;end if;
 end;
 if exists(select 1 from private.account_deletions where user_id='bdaa9717-0000-4000-8000-000000000001') then
   raise exception 'Voice preflight left a deletion marker';
 end if;
end $$;
update public.boop_voice_calls set status='closed' where id='bdaa9717-0000-4000-8000-000000000901';
select public.prepare_boop_account_deletion('bdaa9717-0000-4000-8000-000000000001');
select public.prepare_boop_account_deletion('bdaa9717-0000-4000-8000-000000000001');
do $$ begin
 if (select count(*) from public.list_boop_account_deletion_objects('bdaa9717-0000-4000-8000-000000000001',500))<>2 then
   raise exception 'Storage owner and prefix enumeration failed';
 end if;
 if exists(select 1 from public.list_boop_account_deletion_objects('bdaa9717-0000-4000-8000-000000000001',500)
   where name like 'bdaa9717-0000-4000-8000-000000000002/%') then raise exception 'Other owner storage included';end if;
 begin
   insert into public.boop_voice_calls(user_id) values('bdaa9717-0000-4000-8000-000000000001');
   raise exception 'Service write restored deleting account';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bdaa9717-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 if private.boop_account_active() then raise exception 'Deleting account still active';end if;
 if not public.get_boop_account_deletion_status() then raise exception 'Own deletion cannot be resumed';end if;
 if exists(select 1 from public.profile_directory) then raise exception 'Deleting JWT reads authenticated directory';end if;
 begin
   perform public.merge_personal_snapshot('{"books":[],"sessions":[],"traces":[],"lexicon":[],"goals":{}}','{"books":[],"sessions":[],"traces":[],"lexicon":[],"goals":{}}');
   raise exception 'SECURITY DEFINER sync accepted deleting JWT';
 exception when insufficient_privilege then null;end;
 begin
   perform public.get_reader_profile_books('bdaa9717-0000-4000-8000-000000000002');
   raise exception 'SECURITY DEFINER projection accepted deleting JWT';
 exception when insufficient_privilege then null;end;
 begin
   insert into storage.objects(bucket_id,name,owner_id) values('community-media','bdaa9717-0000-4000-8000-000000000001/new.jpg',auth.uid()::text);
   raise exception 'Deleting JWT restored media';
 exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
-- Exercise database FK behavior on fixture identity only. Production uses Auth
-- Admin API after Storage API removal, never a direct SQL delete.
delete from auth.users where id='bdaa9717-0000-4000-8000-000000000001';
do $$ begin
 if exists(select 1 from private.account_deletions where user_id='bdaa9717-0000-4000-8000-000000000001')
 or exists(select 1 from public.profiles where user_id='bdaa9717-0000-4000-8000-000000000001')
 or exists(select 1 from public.user_books where user_id='bdaa9717-0000-4000-8000-000000000001') then raise exception 'Personal data did not cascade';end if;
 if not exists(select 1 from public.reading_clubs where id='bdaa9717-0000-4000-8000-000000000101' and owner_id is null and name='Club de lecture' and description='')
 or not exists(select 1 from public.reading_salons where id='bdaa9717-0000-4000-8000-000000000201' and created_by is null and title='Salon de lecture')
 or not exists(select 1 from public.reading_club_books where id='bdaa9717-0000-4000-8000-000000000301' and added_by is null) then raise exception 'Shared structure was deleted';end if;
 if not exists(select 1 from public.reading_club_members where club_id='bdaa9717-0000-4000-8000-000000000101'
   and user_id='bdaa9717-0000-4000-8000-000000000002' and role='moderator' and invited_by is null) then raise exception 'Moderator or invitation cleanup failed';end if;
 if not exists(select 1 from public.community_posts where id='bdaa9717-0000-4000-8000-000000000401'
   and author_id is null and author_name='Compte supprimé' and body='Publication supprimée.' and book_title='' and photo_path is null and reading_content is null)
 or not exists(select 1 from public.reading_club_posts where id='bdaa9717-0000-4000-8000-000000000601'
   and author_id is null and body='Publication supprimée.') then raise exception 'Personal publication data survived';end if;
 if not exists(select 1 from public.community_comments where id='bdaa9717-0000-4000-8000-000000000502' and body='Survivor reply' and parent_id is null)
 or not exists(select 1 from public.community_comments where id='bdaa9717-0000-4000-8000-000000000504')
 or not exists(select 1 from public.reading_club_comments where id='bdaa9717-0000-4000-8000-000000000701')
 or not exists(select 1 from public.reading_salon_messages where id='bdaa9717-0000-4000-8000-000000000702')
 or not exists(select 1 from public.reader_book_interactions where id='bdaa9717-0000-4000-8000-000000000802' and parent_id is null)
 or not exists(select 1 from public.reader_book_interactions where id='bdaa9717-0000-4000-8000-000000000803' and owner_id is null) then raise exception 'Other readers contributions were deleted';end if;
 if exists(select 1 from public.notifications where actor_name='DELETE PERSONAL NAME' or body like '%DELETE PERSONAL NAME%') then raise exception 'Notification identity copy survived';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"bdaa9717-0000-4000-8000-000000000001","role":"authenticated"}',true);
do $$ begin
 if private.boop_account_active() or exists(select 1 from public.profile_directory) then raise exception 'Deleted JWT still authorized';end if;
 if public.get_boop_account_deletion_status() then raise exception 'Deleted account status marker survived';end if;
 begin
   insert into storage.objects(bucket_id,name,owner_id) values('profile-avatars','bdaa9717-0000-4000-8000-000000000001/avatar-restored.jpg',auth.uid()::text);
   raise exception 'Deleted JWT restored storage';
 exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"bdaa9717-0000-4000-8000-000000000002","role":"authenticated"}',true);
do $$ begin
 if not private.boop_account_active() then raise exception 'Unrelated account disabled';end if;
 if public.get_boop_account_deletion_status() then raise exception 'Another account deletion status leaked';end if;
 if not private.is_club_manager('bdaa9717-0000-4000-8000-000000000101') then raise exception 'Surviving moderator lost management';end if;
 if exists(select 1 from public.reader_book_interactions where id='bdaa9717-0000-4000-8000-000000000803') then raise exception 'Detached private library interaction exposed';end if;
end $$;
reset role;
select 'PASS: deletion ACL, retry, Storage scope, stale JWT, service writes, tombstones and shared-content preservation' checks;
rollback;
