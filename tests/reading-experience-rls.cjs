/* Run with PGLITE_MODULE pointing to an installed @electric-sql/pglite (0.5.8). */
const fs=require('node:fs'),assert=require('node:assert/strict');
const {PGlite}=require(process.env.PGLITE_MODULE||'../.tmp/pg-test/node_modules/@electric-sql/pglite');
(async()=>{const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;create schema private;
 create table auth.users(id uuid primary key);
 create function auth.uid() returns uuid language sql stable as $$select (nullif(current_setting('request.jwt.claims',true),'')::jsonb->>'sub')::uuid$$;
 `);
 await db.exec(`create function auth.jwt() returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;
 grant usage on schema auth,public,private to authenticated,anon;
 create function private.is_accepted_reader_friend(target_user uuid) returns boolean language sql stable as $$ select auth.uid()='00000000-0000-0000-0000-000000000002'::uuid and target_user='00000000-0000-0000-0000-000000000001'::uuid $$;
 create function private.is_active_club_member(club uuid) returns boolean language sql stable as $$select auth.uid() in ('00000000-0000-0000-0000-000000000001'::uuid,'00000000-0000-0000-0000-000000000002'::uuid)$$;
 create table public.community_posts(id uuid primary key,author_id uuid references auth.users(id),body text,visibility text);
 create table public.reading_club_posts(id uuid primary key,club_id uuid,author_id uuid references auth.users(id),body text);
 alter table community_posts enable row level security;alter table reading_club_posts enable row level security;
 grant select,insert,delete on community_posts to authenticated;grant all on reading_club_posts to authenticated;
 create policy community_read on community_posts for select to authenticated using(author_id=auth.uid() or visibility='public' or (visibility='friends' and private.is_accepted_reader_friend(author_id)));
 create policy community_delete on community_posts for delete to authenticated using(author_id=auth.uid());
 create policy club_read on reading_club_posts for select to authenticated using(private.is_active_club_member(club_id));
 create policy club_delete on reading_club_posts for delete to authenticated using(author_id=auth.uid());
 create table user_books(user_id uuid,local_id text,payload jsonb,primary key(user_id,local_id));
 create table profile_shared_details(user_id uuid,profile_visibility text);
 `);
 const profile=fs.readFileSync('supabase/migrations/20260911185935_reader_profile_experience.sql','utf8');await db.exec(profile.slice(0,profile.indexOf('create table public.reader_book_interactions')));
 await db.exec(fs.readFileSync('supabase/migrations/20260911204712_reading_cards.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260913130552_reading_experience_reports_covers.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260913130954_restrict_club_publication_updates.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20260914141454_reader_catalog_cover_sources.sql','utf8'));
 for(const host of ['images.chasse-aux-livres.fr','img.chasse-aux-livres.fr']){const url='https://'+host+'/test.jpg?width=240';assert.equal((await db.query("select private.reader_book_card('test',$1)->>'coverUrl' as url",[JSON.stringify({coverUrl:url,readingSheet:{answers:{summary:'private'}}})])).rows[0].url,url);}
 assert.equal((await db.query("select private.reader_book_card('test',$1)->>'coverUrl' as url",[JSON.stringify({coverUrl:'https://images.chasse-aux-livres.fr.evil.test/a.jpg'})])).rows[0].url,'');
 const owner='00000000-0000-0000-0000-000000000001',friend='00000000-0000-0000-0000-000000000002',stranger='00000000-0000-0000-0000-000000000003';
 const post='10000000-0000-0000-0000-000000000001',privatePost='10000000-0000-0000-0000-000000000002',club='20000000-0000-0000-0000-000000000001',card='30000000-0000-0000-0000-000000000001';
 await db.query('insert into auth.users values ($1),($2),($3)',[owner,friend,stranger]);await db.query("insert into community_posts values ($1,$3,'pub','public'),($2,$3,'private','me')",[post,privatePost,owner]);await db.query("insert into reading_club_posts values ($1,$1,$2,'texte original')",[club,owner]);await db.query("insert into reading_cards values ($1,$2,'2026-09','Carte','','public','data:image/jpeg;base64,AAAA',now())",[card,owner]);
 await db.query("insert into user_books values ($1,'b1',$2)",[owner,JSON.stringify({title:'Couverture personnelle',libraryState:'library',customCover:true,coverUrl:'data:image/jpeg;base64,AAAA',readingSheet:{answers:{summary:'secret'}},reflection:{notebook:'secret'},status:'en-cours'})]);
 async function asUser(id,metadata={}){await db.exec('reset role');await db.query("select set_config('request.jwt.claims',$1,false)",[JSON.stringify({sub:id,app_metadata:metadata,user_metadata:{boop_moderator:true}})]);await db.exec('set role authenticated');}
 async function denied(sql,params=[]){await assert.rejects(db.query(sql,params));}
 await asUser(friend);const books=(await db.query('select get_reader_profile_books($1) as data',[owner])).rows[0].data;assert.equal(books.available,true);assert.equal(books.books[0].coverUrl,'data:image/jpeg;base64,AAAA');assert.equal(JSON.stringify(books).includes('secret'),false);
 await db.query('insert into publication_reports(reporter_id,post_id,reason) values ($1,$2,$3)',[friend,post,'Spam']);
 await denied('insert into publication_reports(reporter_id,post_id,reason) values ($1,$2,$3)',[stranger,post,'Usurpation']);
 await denied('insert into publication_reports(reporter_id,post_id,reason) values ($1,$2,$3)',[friend,privatePost,'Privé']);
 assert.equal((await db.query('delete from community_posts where id=$1 returning id',[post])).rows.length,0);
 assert.equal((await db.query("update reading_club_posts set body='intrusion' where id=$1 returning id",[club])).rows.length,0);
 await asUser(stranger);assert.equal((await db.query('select get_reader_profile_books($1) as data',[owner])).rows[0].data.available,false);assert.equal((await db.query('select * from publication_reports')).rows.length,0);assert.equal((await db.query('delete from reading_cards where id=$1 returning id',[card])).rows.length,0);
 // User-editable metadata is deliberately ignored for moderator authorization.
 assert.equal((await db.query('select private.is_publication_moderator() as value')).rows[0].value,false);
 await asUser(owner);assert.equal((await db.query("update reading_club_posts set body='corrigé' where id=$1 returning id",[club])).rows.length,1);await denied('update reading_club_posts set author_id=$1 where id=$2',[friend,club]);
 await db.query("insert into reading_cards(id,user_id,month_key,title,image_data) values('30000000-0000-0000-0000-000000000002',$1,'2025','Année','data:image/jpeg;base64,AAAA')",[owner]);
 await denied("insert into reading_cards(id,user_id,month_key,title,image_data) values('30000000-0000-0000-0000-000000000003',$1,'2025-13','Invalide','data:image/jpeg;base64,AAAA')",[owner]);
 await asUser(stranger,{boop_moderator:true});assert.equal((await db.query('select * from publication_reports')).rows.length,1);assert.equal((await db.query("update publication_reports set status='reviewed' returning id")).rows.length,1);assert.equal((await db.query('delete from community_posts where id=$1 returning id',[privatePost])).rows.length,0);assert.equal((await db.query('delete from community_posts where id=$1 returning id',[post])).rows.length,1);assert.equal((await db.query('delete from reading_cards where id=$1 returning id',[card])).rows.length,1);
 await db.exec('reset role;set role anon');await denied('select * from publication_reports');await denied("select get_reader_profile_books('00000000-0000-0000-0000-000000000001')");
 console.log('PASS: migration on PostgreSQL, accepted-friend covers, no private sheet leakage, real reporting, author updates, moderator/stranger/anonymous allow-deny, annual period checks');
 }finally{await db.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
