-- Run after the migration. Every fixture and notification is rolled back.
begin;
insert into auth.users(id,email) values
 ('a97b3fa0-3210-4134-9d03-000000000001','sharing-owner@example.invalid'),
 ('a97b3fa0-3210-4134-9d03-000000000002','sharing-friend@example.invalid'),
 ('a97b3fa0-3210-4134-9d03-000000000003','sharing-stranger@example.invalid');
insert into public.user_books(user_id,local_id,payload)
select 'a97b3fa0-3210-4134-9d03-000000000001',lpad(i::text,3,'0'),
 jsonb_build_object('title','Livre '||i,'authors',jsonb_build_array('Autrice'),
 'libraryState','library','status','en-cours','mediaType','ebook',
 'currentPage',99,'reflection',jsonb_build_object('notebook','SECRET-NOTE','messages','SECRET-AI'),'note','SECRET')
from generate_series(1,26) i;
insert into public.friendships(id,requester_id,addressee_id,status) values
 ('a97b3fa0-3210-4134-9d03-000000000004','a97b3fa0-3210-4134-9d03-000000000001','a97b3fa0-3210-4134-9d03-000000000002','pending');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a97b3fa0-3210-4134-9d03-000000000001","role":"authenticated"}',true);
insert into public.community_posts(id,author_id,author_name,author_initials,activity_type,book_title,body,visibility,reading_kind,reading_source_id,reading_content) values
 ('a97b3fa0-3210-4134-9d03-000000000005',auth.uid(),'Lecteur test','LT','trace','Livre','Mon introduction','friends','notebook','001','COPIE CHOISIE'),
 ('a97b3fa0-3210-4134-9d03-000000000006',auth.uid(),'Lecteur test','LT','trace','Livre','Un mot','public','word','mot-1','Sérendipité');
do $$ begin
  begin
    insert into public.community_posts(author_id,author_name,author_initials,activity_type,body,visibility,reading_source_id,reading_content)
      values(auth.uid(),'Lecteur test','LT','trace','Invalide','friends','x','secret');
    raise exception 'A partial publication must fail';
  exception when check_violation then null; end;
  if has_function_privilege('anon','public.get_reader_library(uuid,text)','execute') then raise exception 'Anonymous library access'; end if;
end $$;

set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
  if (select count(*) from public.community_posts where id='a97b3fa0-3210-4134-9d03-000000000006')<>1 then raise exception 'Anonymous public copy missing'; end if;
  if exists(select 1 from public.community_posts where id='a97b3fa0-3210-4134-9d03-000000000005') then raise exception 'Anonymous friend copy leak'; end if;
end $$;
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"a97b3fa0-3210-4134-9d03-000000000003","role":"authenticated"}',true);
do $$ begin
  if (select count(*) from public.community_posts where id='a97b3fa0-3210-4134-9d03-000000000005')<>0 then raise exception 'Stranger saw friends publication'; end if;
  if (select count(*) from public.community_posts where id='a97b3fa0-3210-4134-9d03-000000000006')<>1 then raise exception 'Public copy missing'; end if;
  if (public.get_reader_library('a97b3fa0-3210-4134-9d03-000000000001')->>'available')::boolean then raise exception 'Stranger saw library'; end if;
  if exists(select 1 from public.user_books where user_id='a97b3fa0-3210-4134-9d03-000000000001') then raise exception 'Private JSON leak'; end if;
  update public.community_posts set body='Hijacked' where id='a97b3fa0-3210-4134-9d03-000000000006';
  if found then raise exception 'Cross-owner update'; end if;
  begin
    insert into public.community_posts(author_id,author_name,author_initials,activity_type,body,visibility)
      values('a97b3fa0-3210-4134-9d03-000000000001','Fake author','FA','trace','Hijacked','public');
    raise exception 'Cross-owner insert';
  exception when insufficient_privilege then null; end;
end $$;

select set_config('request.jwt.claims','{"sub":"a97b3fa0-3210-4134-9d03-000000000002","role":"authenticated"}',true);
do $$ begin
  if (public.get_reader_library('a97b3fa0-3210-4134-9d03-000000000001')->>'available')::boolean then raise exception 'Pending friend saw library'; end if;
end $$;
update public.friendships set status='accepted' where id='a97b3fa0-3210-4134-9d03-000000000004';
do $$ declare result jsonb; second_page jsonb; begin
  result:=public.get_reader_library('a97b3fa0-3210-4134-9d03-000000000001');
  if not (result->>'available')::boolean or jsonb_array_length(result->'books')<>24 then raise exception 'Accepted friend/library pagination failed'; end if;
  second_page:=public.get_reader_library('a97b3fa0-3210-4134-9d03-000000000001',result->>'next');
  if jsonb_array_length(second_page->'books')<>2 or second_page->>'next' is not null then raise exception 'Second library page failed'; end if;
  if result::text like '%SECRET%' or result::text like '%currentPage%' or result::text like '%reflection%' then raise exception 'Private fields leaked'; end if;
  if (result->'books'->0->>'mediaType')<>'ebook' then raise exception 'Media mapping failed'; end if;
  if exists(select 1 from public.user_books where user_id='a97b3fa0-3210-4134-9d03-000000000001') then raise exception 'Raw private JSON became readable'; end if;
  if (select reading_content from public.community_posts where id='a97b3fa0-3210-4134-9d03-000000000005') is distinct from 'COPIE CHOISIE' then raise exception 'Shared notebook missing'; end if;
end $$;
insert into public.community_comments(post_id,author_id,author_name,body) values
 ('a97b3fa0-3210-4134-9d03-000000000005',auth.uid(),'Ami test','Merci');
insert into public.community_encouragements(post_id,user_id) values ('a97b3fa0-3210-4134-9d03-000000000005',auth.uid());

select set_config('request.jwt.claims','{"sub":"a97b3fa0-3210-4134-9d03-000000000001","role":"authenticated"}',true);
delete from public.friendships where id='a97b3fa0-3210-4134-9d03-000000000004';
delete from public.community_posts where id='a97b3fa0-3210-4134-9d03-000000000006';
select set_config('request.jwt.claims','{"sub":"a97b3fa0-3210-4134-9d03-000000000002","role":"authenticated"}',true);
do $$ begin
  if (public.get_reader_library('a97b3fa0-3210-4134-9d03-000000000001')->>'available')::boolean then raise exception 'Revoked friend saw library'; end if;
  if exists(select 1 from public.community_posts where id in ('a97b3fa0-3210-4134-9d03-000000000005','a97b3fa0-3210-4134-9d03-000000000006')) then raise exception 'Revoked or withdrawn post visible'; end if;
  if exists(select 1 from public.community_comments where post_id='a97b3fa0-3210-4134-9d03-000000000005') then raise exception 'Comments leaked after revocation'; end if;
end $$;
select 'PASS: ownership, pending/accepted/revoked friendship, private JSON isolation, pagination, publication withdrawal, comments and validation' as checks;
rollback;
