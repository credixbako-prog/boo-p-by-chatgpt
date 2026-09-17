begin;
insert into auth.users(id,email) values
 ('b97b3fa0-3210-4134-9d03-000000000001','release-owner@example.invalid'),
 ('b97b3fa0-3210-4134-9d03-000000000002','release-reader@example.invalid'),
 ('b97b3fa0-3210-4134-9d03-000000000003','release-other@example.invalid');
insert into public.community_posts(id,author_id,author_name,author_initials,activity_type,body,visibility) values
 ('b97b3fa0-3210-4134-9d03-000000000007','b97b3fa0-3210-4134-9d03-000000000001','Test','T','trace','Test transactionnel public','public'),
 ('b97b3fa0-3210-4134-9d03-000000000008','b97b3fa0-3210-4134-9d03-000000000001','Test','T','trace','Test transactionnel privé','me');
insert into public.reading_cards(id,user_id,month_key,title,image_data,visibility) values
 ('b97b3fa0-3210-4134-9d03-000000000009','b97b3fa0-3210-4134-9d03-000000000001','2025','Année privée','data:image/jpeg;base64,AAAA','private'),
 ('b97b3fa0-3210-4134-9d03-000000000010','b97b3fa0-3210-4134-9d03-000000000001','2026-09','Mois partagé','data:image/jpeg;base64,AAAA','public');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000002","role":"authenticated","user_metadata":{"boop_moderator":true}}',true);
do $$ begin
 if private.is_publication_moderator() then raise exception 'User metadata escalated privileges';end if;
 if not has_column_privilege('authenticated','public.reading_club_posts','body','update') or has_column_privilege('authenticated','public.reading_club_posts','author_id','update') then raise exception 'Club column grants';end if;
 insert into public.publication_reports(reporter_id,post_id,reason) values(auth.uid(),'b97b3fa0-3210-4134-9d03-000000000007','Test isolé');
 begin
 insert into public.publication_reports(reporter_id,post_id,reason) values(auth.uid(),'b97b3fa0-3210-4134-9d03-000000000007','Doublon');
 raise exception 'Duplicate allowed';exception when unique_violation then null;end;
 begin
 insert into public.publication_reports(reporter_id,post_id,reason) values('b97b3fa0-3210-4134-9d03-000000000003','b97b3fa0-3210-4134-9d03-000000000007','Spoof');
 raise exception 'Reporter spoof accepted';exception when insufficient_privilege then null;end;
 begin
 insert into public.publication_reports(reporter_id,post_id,reason) values(auth.uid(),'b97b3fa0-3210-4134-9d03-000000000008','Privé');
 raise exception 'Private target reported';exception when insufficient_privilege then null;end;
 begin
 insert into public.publication_reports(reporter_id,card_id,reason,status) values(auth.uid(),'b97b3fa0-3210-4134-9d03-000000000010','Test','reviewed');
 raise exception 'Status spoof accepted';exception when insufficient_privilege then null;end;
 begin
 update public.publication_reports set status='reviewed' where reporter_id=auth.uid();
 raise exception 'Reporter updated moderation status';exception when insufficient_privilege then null;end;
 delete from public.reading_cards where id='b97b3fa0-3210-4134-9d03-000000000010';if found then raise exception 'Stranger deleted card';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000003","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.publication_reports where reporter_id='b97b3fa0-3210-4134-9d03-000000000002') then raise exception 'Report leaked to stranger';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000003","role":"authenticated","app_metadata":{"boop_moderator":true}}',true);
do $$ begin
 if private.is_publication_moderator() then raise exception 'Cached moderator claim accepted';end if;
end $$;
reset role;
update auth.users set email_confirmed_at=now() where id='b97b3fa0-3210-4134-9d03-000000000003';
insert into private.boop_staff_roles(user_id,is_moderator) values('b97b3fa0-3210-4134-9d03-000000000003',true);
set local role authenticated;
do $$ begin
 if not private.is_publication_moderator() then raise exception 'Moderator not recognized';end if;
 perform public.review_boop_staff_report('publication',id,'reviewed') from public.publication_reports where reporter_id='b97b3fa0-3210-4134-9d03-000000000002';
 if not exists(select 1 from public.publication_reports where reporter_id='b97b3fa0-3210-4134-9d03-000000000002' and status='reviewed') then raise exception 'Moderator cannot process report';end if;
 delete from public.community_posts where id='b97b3fa0-3210-4134-9d03-000000000008';if found then raise exception 'Moderator deleted private original';end if;
 delete from public.reading_cards where id='b97b3fa0-3210-4134-9d03-000000000009';if found then raise exception 'Moderator deleted private card';end if;
 delete from public.community_posts where id='b97b3fa0-3210-4134-9d03-000000000007';if not found then raise exception 'Moderator cannot delete shared post';end if;
 delete from public.reading_cards where id='b97b3fa0-3210-4134-9d03-000000000010';if not found then raise exception 'Moderator cannot delete shared card';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000001","role":"authenticated"}',true);
do $$ begin
 delete from public.reading_cards where id='b97b3fa0-3210-4134-9d03-000000000009';if not found then raise exception 'Owner cannot delete own card';end if;
end $$;
reset role;
do $$ begin
 if has_table_privilege('anon','public.publication_reports','select') then raise exception 'Anonymous report access';end if;
end $$;
select 'PASS: production reporting, duplicate/spoof denial, private originals, moderator/owner/stranger deletion, annual period, club column grants; all fixtures rolled back' checks;
rollback;
