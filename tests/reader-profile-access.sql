begin;
insert into auth.users(id,email) values
 ('b97b3fa0-3210-4134-9d03-000000000001','profile-owner@example.invalid'),
 ('b97b3fa0-3210-4134-9d03-000000000002','profile-friend@example.invalid'),
 ('b97b3fa0-3210-4134-9d03-000000000003','profile-stranger@example.invalid');
insert into public.user_books(user_id,local_id,payload) values
 ('b97b3fa0-3210-4134-9d03-000000000001','book','{"title":"Mon livre","authors":["Autrice"],"status":"en-cours","libraryState":"library","coverUrl":"https://covers.openlibrary.org/b/isbn/123-L.jpg","reflection":"SECRET"}'),
 ('b97b3fa0-3210-4134-9d03-000000000001','photo','{"title":"Photo privée","status":"lu","libraryState":"library","customCover":true,"coverUrl":"https://covers.openlibrary.org/b/isbn/private.jpg"}');
insert into public.friendships(id,requester_id,addressee_id,status) values('b97b3fa0-3210-4134-9d03-000000000004','b97b3fa0-3210-4134-9d03-000000000001','b97b3fa0-3210-4134-9d03-000000000002','accepted');
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000001","role":"authenticated"}',true);
insert into public.reader_preferences(user_id,welcome,show_current,featured) values(auth.uid(),'Bienvenue',false,array['book']);
insert into public.community_posts(id,author_id,author_name,author_initials,activity_type,body,visibility) values('b97b3fa0-3210-4134-9d03-000000000007',auth.uid(),'Propriétaire','PR','trace','Une publication entre amis','friends');
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000003","role":"authenticated"}',true);
do $$ begin
 if (public.get_reader_profile_books('b97b3fa0-3210-4134-9d03-000000000001')->>'available')::boolean then raise exception 'Stranger library leak'; end if;
 begin
 insert into public.reader_book_interactions(owner_id,book_id,author_id,kind,body) values('b97b3fa0-3210-4134-9d03-000000000001','book',auth.uid(),'trace','Non autorisé');
 raise exception 'Stranger write accepted'; exception when insufficient_privilege then null; end;
 update public.reader_preferences set welcome='Hijacked' where user_id='b97b3fa0-3210-4134-9d03-000000000001';if found then raise exception 'Preferences ownership';end if;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000002","role":"authenticated"}',true);
do $$ declare p jsonb;begin
 if (select welcome from public.reader_preferences where user_id='b97b3fa0-3210-4134-9d03-000000000001') is distinct from 'Bienvenue' then raise exception 'Friend cannot read welcome';end if;
 p:=public.get_reader_profile_books('b97b3fa0-3210-4134-9d03-000000000001');
 if p::text like '%SECRET%' or p::text like '%private.jpg%' or (p->>'finished')::integer<>1 then raise exception 'Unsafe book projection';end if;
 if jsonb_array_length(public.get_reader_profile_books('b97b3fa0-3210-4134-9d03-000000000001','current')->'books')<>0 then raise exception 'Hidden current section';end if;
 if jsonb_array_length(public.get_reader_profile_books('b97b3fa0-3210-4134-9d03-000000000001','featured')->'books')<>1 then raise exception 'Featured selection';end if;
end $$;
insert into public.reader_book_interactions(id,owner_id,book_id,author_id,kind,body) values
 ('b97b3fa0-3210-4134-9d03-000000000005','b97b3fa0-3210-4134-9d03-000000000001','book',auth.uid(),'trace','Que vous évoque ce livre ?'),
 ('b97b3fa0-3210-4134-9d03-000000000006','b97b3fa0-3210-4134-9d03-000000000001','book',auth.uid(),'encouragement','Bonne lecture !');
insert into public.community_comments(id,post_id,author_id,author_name,body) values('b97b3fa0-3210-4134-9d03-000000000008','b97b3fa0-3210-4134-9d03-000000000007',auth.uid(),'Ami','Une Trace sur la publication');
do $$ begin
 begin
 insert into public.reader_book_interactions(owner_id,book_id,author_id,kind,body) values('b97b3fa0-3210-4134-9d03-000000000001','book',auth.uid(),'encouragement','Doublon');raise exception 'Duplicate like';exception when unique_violation then null;end;
 begin
 insert into public.reader_book_interactions(owner_id,book_id,author_id,kind,body,parent_id) values('b97b3fa0-3210-4134-9d03-000000000001','photo',auth.uid(),'trace','Wrong book','b97b3fa0-3210-4134-9d03-000000000005');raise exception 'Cross book reply';exception when foreign_key_violation then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000001","role":"authenticated"}',true);
insert into public.reader_book_interactions(owner_id,book_id,author_id,kind,body,parent_id) values('b97b3fa0-3210-4134-9d03-000000000001','book',auth.uid(),'trace','Merci pour cette question','b97b3fa0-3210-4134-9d03-000000000005');
do $$ begin
 delete from public.community_comments where id='b97b3fa0-3210-4134-9d03-000000000008';if not found then raise exception 'Post owner cannot moderate received comment';end if;
 if not exists(select 1 from public.notifications where source_id='b97b3fa0-3210-4134-9d03-000000000005' and recipient_id=auth.uid()) then raise exception 'Missing notification';end if;
 delete from public.reader_book_interactions where id='b97b3fa0-3210-4134-9d03-000000000005';if not found then raise exception 'Owner cannot moderate';end if;
 if exists(select 1 from public.reader_book_interactions where parent_id='b97b3fa0-3210-4134-9d03-000000000005') then raise exception 'Orphaned reply';end if;
end $$;
delete from public.friendships where id='b97b3fa0-3210-4134-9d03-000000000004';
select set_config('request.jwt.claims','{"sub":"b97b3fa0-3210-4134-9d03-000000000002","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.reader_book_interactions where owner_id='b97b3fa0-3210-4134-9d03-000000000001') then raise exception 'Revoked friend saw interactions';end if;
 begin
 insert into public.reader_book_interactions(owner_id,book_id,author_id,kind,body) values('b97b3fa0-3210-4134-9d03-000000000001','book',auth.uid(),'trace','Refusé');raise exception 'Revoked friend wrote';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
do $$ begin
 if has_function_privilege('anon','public.get_reader_profile_books(uuid,text,text,text)','execute') then raise exception 'Anonymous function access';end if;
 if has_table_privilege('anon','public.reader_book_interactions','select') then raise exception 'Anonymous interaction access';end if;
end $$;
reset role;
select 'PASS: privacy, projection, preferences, friend interactions, moderation, replies, notifications, revocation' checks;
rollback;
