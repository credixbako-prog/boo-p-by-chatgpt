-- Execute against the migrated schema; every synthetic fixture is rolled back.
begin;
insert into auth.users(id,email) values
 ('27c2da67-6666-4111-9222-000000000001','safety-a@example.invalid'),
 ('27c2da67-6666-4111-9222-000000000002','safety-b@example.invalid'),
 ('27c2da67-6666-4111-9222-000000000003','safety-c@example.invalid');
insert into public.profile_directory(user_id,display_name,handle,profile_visibility) values
 ('27c2da67-6666-4111-9222-000000000001','Safety A','safety_a_fixture','public'),
 ('27c2da67-6666-4111-9222-000000000002','Safety B','safety_b_fixture','public'),
 ('27c2da67-6666-4111-9222-000000000003','Safety C','safety_c_fixture','public');
insert into public.user_books(user_id,local_id,payload) values
 ('27c2da67-6666-4111-9222-000000000001','private-book','{"title":"Private A","libraryState":"library"}');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"27c2da67-6666-4111-9222-000000000003","role":"authenticated"}',true);
insert into public.reading_clubs(id,owner_id,name,visibility,access_mode) values
 ('27c2da67-6666-4111-9222-000000000010',auth.uid(),'Safety common club','public','open');
insert into public.community_posts(id,author_id,author_name,author_initials,activity_type,body,visibility) values
 ('27c2da67-6666-4111-9222-000000000020',auth.uid(),'Safety C','SC','trace','Common post','public');

select set_config('request.jwt.claims','{"sub":"27c2da67-6666-4111-9222-000000000002","role":"authenticated"}',true);
insert into public.profile_shared_details(user_id,profile_visibility) values(auth.uid(),'public');
insert into public.reader_badges(user_id,badge_id) values(auth.uid(),'first-step');
insert into public.friendships(requester_id,addressee_id) values(auth.uid(),'27c2da67-6666-4111-9222-000000000001');
insert into public.reading_club_members(club_id,user_id,status) values('27c2da67-6666-4111-9222-000000000010',auth.uid(),'active');
insert into public.community_posts(id,author_id,author_name,author_initials,activity_type,body,visibility) values
 ('27c2da67-6666-4111-9222-000000000021',auth.uid(),'Safety B','SB','trace','B public post','public');
insert into public.community_comments(id,post_id,author_id,author_name,body) values
 ('27c2da67-6666-4111-9222-000000000030','27c2da67-6666-4111-9222-000000000020',auth.uid(),'Safety B','B comment on C');
insert into public.reading_club_posts(id,club_id,author_id,body) values
 ('27c2da67-6666-4111-9222-000000000040','27c2da67-6666-4111-9222-000000000010',auth.uid(),'B club discussion');

select set_config('request.jwt.claims','{"sub":"27c2da67-6666-4111-9222-000000000001","role":"authenticated"}',true);
update public.friendships set status='accepted' where requester_id='27c2da67-6666-4111-9222-000000000002' and addressee_id=auth.uid();
insert into public.reading_club_members(club_id,user_id,status) values('27c2da67-6666-4111-9222-000000000010',auth.uid(),'active');
insert into public.reading_clubs(id,owner_id,name,visibility,access_mode) values
 ('27c2da67-6666-4111-9222-000000000011',auth.uid(),'Safety A club','public','open');
insert into public.community_posts(id,author_id,author_name,author_initials,activity_type,body,visibility) values
 ('27c2da67-6666-4111-9222-000000000022',auth.uid(),'Safety A','SA','trace','A public post','public');
insert into public.user_reports(reporter_id,reported_user_id,reason,details)
values(auth.uid(),'27c2da67-6666-4111-9222-000000000002','Autre motif','Synthetic report');
do $$begin
 if not exists(select 1 from public.community_posts where id='27c2da67-6666-4111-9222-000000000021') then raise exception 'Unblocked public post not visible';end if;
 if not exists(select 1 from public.reading_club_posts where id='27c2da67-6666-4111-9222-000000000040') then raise exception 'Unblocked club post not visible';end if;
 begin
  insert into public.user_blocks(blocker_id,blocked_id) values('27c2da67-6666-4111-9222-000000000003','27c2da67-6666-4111-9222-000000000002');
  raise exception 'Forged blocker accepted';exception when insufficient_privilege then null;
 end;
 begin
  insert into public.user_reports(reporter_id,reported_user_id,reason) values('27c2da67-6666-4111-9222-000000000003','27c2da67-6666-4111-9222-000000000002','Autre motif');
  raise exception 'Forged reporter accepted';exception when insufficient_privilege then null;
 end;
 begin
  update public.user_reports set status='reviewed' where reporter_id=auth.uid();
  raise exception 'Reporter reviewed report';exception when insufficient_privilege then null;
 end;
end $$;
insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),'27c2da67-6666-4111-9222-000000000002');
do $$begin
 if not exists(select 1 from public.user_blocks where blocker_id=auth.uid()) then raise exception 'Block missing';end if;
 if exists(select 1 from public.profile_directory where user_id='27c2da67-6666-4111-9222-000000000002') then raise exception 'Blocked profile visible';end if;
 if exists(select 1 from public.profile_shared_details where user_id='27c2da67-6666-4111-9222-000000000002') then raise exception 'Blocked public details visible';end if;
 if public.get_reader_latest_badge('27c2da67-6666-4111-9222-000000000002') is not null then raise exception 'Blocked public badge visible through definer';end if;
 if exists(select 1 from public.friendships where requester_id='27c2da67-6666-4111-9222-000000000002' and addressee_id=auth.uid()) then raise exception 'Blocked friendship visible';end if;
 if exists(select 1 from public.community_posts where id='27c2da67-6666-4111-9222-000000000021') then raise exception 'Blocked public post visible';end if;
 if exists(select 1 from public.community_comments where id='27c2da67-6666-4111-9222-000000000030') then raise exception 'Blocked comment on third-party post visible';end if;
 if exists(select 1 from public.reading_club_posts where id='27c2da67-6666-4111-9222-000000000040') then raise exception 'Blocked club post visible';end if;
 if exists(select 1 from public.notifications where actor_id='27c2da67-6666-4111-9222-000000000002') then raise exception 'Blocked notification visible';end if;
 if not exists(select 1 from public.user_books where user_id=auth.uid() and local_id='private-book') then raise exception 'Block hid own private data';end if;
 if not exists(select 1 from public.community_posts where id='27c2da67-6666-4111-9222-000000000022') then raise exception 'Block hid own post';end if;
 if not exists(select 1 from public.community_posts where id='27c2da67-6666-4111-9222-000000000020') then raise exception 'Block hid unrelated post';end if;
 begin
  insert into public.community_comments(post_id,author_id,author_name,body,parent_id) values('27c2da67-6666-4111-9222-000000000020',auth.uid(),'Safety A','Crafted reply','27c2da67-6666-4111-9222-000000000030');
  raise exception 'Reply to blocked parent accepted';exception when insufficient_privilege then null;
 end;
 begin
  insert into public.community_encouragements(post_id,user_id) values('27c2da67-6666-4111-9222-000000000021',auth.uid());
  raise exception 'Blocked encouragement accepted';exception when insufficient_privilege then null;
 end;
 begin
  insert into public.reading_club_comments(post_id,author_id,body) values('27c2da67-6666-4111-9222-000000000040',auth.uid(),'Blocked club comment');
  raise exception 'Blocked club comment accepted';exception when insufficient_privilege then null;
 end;
 begin
  insert into public.user_blocks(blocker_id,blocked_id) values(auth.uid(),'27c2da67-6666-4111-9222-000000000002');
  raise exception 'Duplicate block accepted';exception when unique_violation then null;
 end;
end $$;

select set_config('request.jwt.claims','{"sub":"27c2da67-6666-4111-9222-000000000002","role":"authenticated"}',true);
do $$begin
 if exists(select 1 from public.user_blocks) then raise exception 'Blocked user can inspect block list';end if;
 if exists(select 1 from public.user_reports where reported_user_id=auth.uid()) then raise exception 'Reported user can inspect reports';end if;
 if exists(select 1 from public.community_posts where id='27c2da67-6666-4111-9222-000000000022') then raise exception 'Reverse block public post visible';end if;
 if exists(select 1 from public.reading_clubs where id='27c2da67-6666-4111-9222-000000000011') then raise exception 'Blocked-owner club visible';end if;
 if (public.get_reader_profile_books('27c2da67-6666-4111-9222-000000000001')->>'available')::boolean then raise exception 'Block bypass through definer library';end if;
 begin
  insert into public.friendships(requester_id,addressee_id) values(auth.uid(),'27c2da67-6666-4111-9222-000000000001');
  raise exception 'Blocked friend request accepted';exception when insufficient_privilege then null;
 end;
 begin
  insert into public.community_comments(post_id,author_id,author_name,body) values('27c2da67-6666-4111-9222-000000000022',auth.uid(),'Safety B','Reverse blocked comment');
  raise exception 'Reverse blocked comment accepted';exception when insufficient_privilege then null;
 end;
 begin
  insert into public.reading_club_members(club_id,user_id,status) values('27c2da67-6666-4111-9222-000000000011',auth.uid(),'active');
  raise exception 'Blocked owner membership accepted';exception when insufficient_privilege then null;
 end;
 delete from public.user_blocks where blocked_id=auth.uid();if found then raise exception 'Target unblocked itself';end if;
end $$;
reset role;
-- Even definer-produced notifications are suppressed before push enqueue.
insert into public.notifications(recipient_id,actor_id,actor_name,type,title,body,route)
values('27c2da67-6666-4111-9222-000000000001','27c2da67-6666-4111-9222-000000000002','Safety B','trace','Synthetic','Synthetic','#community');
do $$begin
 if exists(select 1 from public.notifications where recipient_id='27c2da67-6666-4111-9222-000000000001' and actor_id='27c2da67-6666-4111-9222-000000000002') then raise exception 'Blocked notification inserted';end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"27c2da67-6666-4111-9222-000000000003","role":"authenticated","user_metadata":{"boop_moderator":true}}',true);
do $$begin
 if exists(select 1 from public.user_reports where reporter_id='27c2da67-6666-4111-9222-000000000001') then raise exception 'Untrusted metadata grants moderation';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"27c2da67-6666-4111-9222-000000000003","role":"authenticated","app_metadata":{"boop_moderator":true}}',true);
do $$begin
 if private.is_publication_moderator() then raise exception 'Cached claims grant moderation';end if;
end $$;
reset role;
update auth.users set email_confirmed_at=now() where id='27c2da67-6666-4111-9222-000000000003';
insert into private.boop_staff_roles(user_id,is_moderator) values('27c2da67-6666-4111-9222-000000000003',true);
set local role authenticated;
do $$begin
 perform public.review_boop_staff_report('user',id,'reviewed') from public.user_reports where reporter_id='27c2da67-6666-4111-9222-000000000001';
 if not exists(select 1 from public.user_reports where reporter_id='27c2da67-6666-4111-9222-000000000001' and status='reviewed') then raise exception 'Moderator cannot review report';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"27c2da67-6666-4111-9222-000000000001","role":"authenticated"}',true);
-- A resolved report does not prevent a later incident from being reported.
insert into public.user_reports(reporter_id,reported_user_id,reason,details)
values(auth.uid(),'27c2da67-6666-4111-9222-000000000002','Autre motif','A later incident after review');
do $$begin
 if (select count(*) from public.user_reports where reporter_id=auth.uid() and reported_user_id='27c2da67-6666-4111-9222-000000000002')<>2 then raise exception 'New incident cannot be reported after review';end if;
 begin
  insert into public.user_reports(reporter_id,reported_user_id,reason) values(auth.uid(),'27c2da67-6666-4111-9222-000000000002','Autre motif');
  raise exception 'Duplicate pending report accepted';exception when unique_violation then null;
 end;
end $$;
delete from public.user_blocks where blocker_id=auth.uid() and blocked_id='27c2da67-6666-4111-9222-000000000002';
do $$begin
 if not exists(select 1 from public.community_posts where id='27c2da67-6666-4111-9222-000000000021') then raise exception 'Unblock did not restore public visibility';end if;
 if exists(select 1 from public.friendships where requester_id='27c2da67-6666-4111-9222-000000000002' and addressee_id=auth.uid()) then raise exception 'Unblock restored friendship without consent';end if;
 if has_function_privilege('authenticated','private.users_blocked(uuid,uuid)','execute') then raise exception 'Private pair lookup exposed';end if;
 if has_table_privilege('anon','public.user_reports','select') or has_table_privilege('anon','public.user_blocks','insert') then raise exception 'Anonymous safety table access';end if;
end $$;
reset role;
select 'PASS: reports, moderator scope, bilateral blocking, own data, clubs, replies, notifications, unblock' checks;
rollback;
