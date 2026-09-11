begin;
insert into auth.users(id,email) values
 ('b97b3fa0-3210-4134-9d03-000000000201','card-owner@example.invalid'),
 ('b97b3fa0-3210-4134-9d03-000000000202','card-friend@example.invalid'),
 ('b97b3fa0-3210-4134-9d03-000000000203','card-stranger@example.invalid');
insert into public.friendships(requester_id,addressee_id,status) values('b97b3fa0-3210-4134-9d03-000000000201','b97b3fa0-3210-4134-9d03-000000000202','accepted');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000201","role":"authenticated"}',true);
insert into public.reading_cards(id,user_id,month_key,title,image_data) values('b97b3fa0-3210-4134-9d03-000000000204',auth.uid(),'2026-09','Ma carte','data:image/jpeg;base64,YWJj');
do $$ begin
 begin
 insert into public.reading_cards(id,user_id,month_key,title,image_data,visibility) values('b97b3fa0-3210-4134-9d03-000000000205',auth.uid(),'2026-09','Sans relecture','data:image/jpeg;base64,YWJj','public');raise exception 'Direct publication accepted';exception when insufficient_privilege then null;end;
 begin
 update public.reading_cards set image_data='data:image/jpeg;base64,YWJj';raise exception 'Published image mutable';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000202","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.reading_cards where id='b97b3fa0-3210-4134-9d03-000000000204') then raise exception 'Private card leak';end if;
 begin
 insert into public.reading_cards(id,user_id,month_key,title,image_data) values('b97b3fa0-3210-4134-9d03-000000000205','b97b3fa0-3210-4134-9d03-000000000201','2026-09','Hijacked','data:image/jpeg;base64,YWJj');raise exception 'Owner spoof';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000201","role":"authenticated"}',true);
update public.reading_cards set visibility='friends',caption='Mon mois' where id='b97b3fa0-3210-4134-9d03-000000000204';
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000202","role":"authenticated"}',true);
do $$ begin
 if not exists(select 1 from public.reading_cards where id='b97b3fa0-3210-4134-9d03-000000000204') then raise exception 'Friend card unavailable';end if;
 update public.reading_cards set caption='Hijacked' where id='b97b3fa0-3210-4134-9d03-000000000204';if found then raise exception 'Friend write';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000203","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.reading_cards where id='b97b3fa0-3210-4134-9d03-000000000204') then raise exception 'Stranger friend-card leak';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000201","role":"authenticated"}',true);
update public.reading_cards set visibility='public' where id='b97b3fa0-3210-4134-9d03-000000000204';
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000203","role":"authenticated"}',true);
do $$ begin
 if not exists(select 1 from public.reading_cards where id='b97b3fa0-3210-4134-9d03-000000000204') then raise exception 'Public card unavailable';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000201","role":"authenticated"}',true);
update public.reading_cards set visibility='private' where id='b97b3fa0-3210-4134-9d03-000000000204';
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000202","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.reading_cards where id='b97b3fa0-3210-4134-9d03-000000000204') then raise exception 'Withdrawn card leak';end if;
end $$;
set local role anon;
do $$ begin
 begin
 perform 1 from public.reading_cards;raise exception 'Anonymous card read';exception when insufficient_privilege then null;end;
end $$;
rollback;
