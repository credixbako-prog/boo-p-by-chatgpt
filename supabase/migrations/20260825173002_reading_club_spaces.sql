-- BOO-P: private mini-communities for reading clubs.
-- Club books, announcements, discussions, comments and encouragements are
-- available only to active members. Managers curate books and announcements.

create table public.reading_club_books (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.reading_clubs(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(title) between 1 and 240),
  status text not null default 'planned' check (status in ('planned', 'current', 'read')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reading_club_posts (
  id uuid primary key default gen_random_uuid(),
  club_id uuid not null references public.reading_clubs(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  post_type text not null default 'discussion' check (post_type in ('announcement', 'discussion')),
  body text not null check (char_length(body) between 1 and 1200),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reading_club_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.reading_club_posts(id) on delete cascade,
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);

create table public.reading_club_encouragements (
  post_id uuid not null references public.reading_club_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create index reading_club_books_club_status_idx
  on public.reading_club_books (club_id, status, updated_at desc);
create index reading_club_books_added_by_idx
  on public.reading_club_books (added_by);
create index reading_club_posts_club_date_idx
  on public.reading_club_posts (club_id, created_at desc);
create index reading_club_posts_author_idx
  on public.reading_club_posts (author_id);
create index reading_club_comments_post_date_idx
  on public.reading_club_comments (post_id, created_at);
create index reading_club_comments_author_idx
  on public.reading_club_comments (author_id);
create index reading_club_encouragements_user_idx
  on public.reading_club_encouragements (user_id, post_id);

drop trigger if exists reading_club_books_set_updated_at on public.reading_club_books;
create trigger reading_club_books_set_updated_at
before update on public.reading_club_books
for each row execute function private.set_reading_community_updated_at();

drop trigger if exists reading_club_posts_set_updated_at on public.reading_club_posts;
create trigger reading_club_posts_set_updated_at
before update on public.reading_club_posts
for each row execute function private.set_reading_community_updated_at();

insert into public.reading_club_books (club_id, added_by, title, status)
select club.id, club.owner_id, club.book_title, 'current'
from public.reading_clubs club
where nullif(trim(club.book_title), '') is not null
  and not exists (
    select 1 from public.reading_club_books book
    where book.club_id = club.id and lower(book.title) = lower(club.book_title)
  );

alter table public.reading_club_books enable row level security;
alter table public.reading_club_posts enable row level security;
alter table public.reading_club_comments enable row level security;
alter table public.reading_club_encouragements enable row level security;

create policy reading_club_books_select_members
on public.reading_club_books for select to authenticated
using ((select private.is_active_club_member(club_id)));

create policy reading_club_books_insert_managers
on public.reading_club_books for insert to authenticated
with check (
  added_by = (select auth.uid())
  and (select private.is_club_manager(club_id))
);

create policy reading_club_books_update_managers
on public.reading_club_books for update to authenticated
using ((select private.is_club_manager(club_id)))
with check ((select private.is_club_manager(club_id)));

create policy reading_club_books_delete_managers
on public.reading_club_books for delete to authenticated
using ((select private.is_club_manager(club_id)));

create policy reading_club_posts_select_members
on public.reading_club_posts for select to authenticated
using ((select private.is_active_club_member(club_id)));

create policy reading_club_posts_insert_members
on public.reading_club_posts for insert to authenticated
with check (
  author_id = (select auth.uid())
  and (select private.is_active_club_member(club_id))
  and (
    post_type = 'discussion'
    or (select private.is_club_manager(club_id))
  )
);

create policy reading_club_posts_delete_author_or_manager
on public.reading_club_posts for delete to authenticated
using (
  author_id = (select auth.uid())
  or (select private.is_club_manager(club_id))
);

create policy reading_club_comments_select_members
on public.reading_club_comments for select to authenticated
using (
  exists (
    select 1 from public.reading_club_posts post
    where post.id = post_id
      and (select private.is_active_club_member(post.club_id))
  )
);

create policy reading_club_comments_insert_members
on public.reading_club_comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.reading_club_posts post
    where post.id = post_id
      and (select private.is_active_club_member(post.club_id))
  )
);

create policy reading_club_comments_delete_author_or_manager
on public.reading_club_comments for delete to authenticated
using (
  author_id = (select auth.uid())
  or exists (
    select 1 from public.reading_club_posts post
    where post.id = post_id
      and (select private.is_club_manager(post.club_id))
  )
);

create policy reading_club_encouragements_select_members
on public.reading_club_encouragements for select to authenticated
using (
  exists (
    select 1 from public.reading_club_posts post
    where post.id = post_id
      and (select private.is_active_club_member(post.club_id))
  )
);

create policy reading_club_encouragements_insert_self
on public.reading_club_encouragements for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.reading_club_posts post
    where post.id = post_id
      and (select private.is_active_club_member(post.club_id))
  )
);

create policy reading_club_encouragements_delete_self
on public.reading_club_encouragements for delete to authenticated
using (user_id = (select auth.uid()));

revoke all on public.reading_club_books, public.reading_club_posts,
  public.reading_club_comments, public.reading_club_encouragements from anon;
grant select, insert, update, delete on public.reading_club_books,
  public.reading_club_posts, public.reading_club_comments,
  public.reading_club_encouragements to authenticated;
grant all on public.reading_club_books, public.reading_club_posts,
  public.reading_club_comments, public.reading_club_encouragements to service_role;

comment on table public.reading_club_books is
  'Current, planned and completed reading history curated by BOO-P club managers.';
comment on table public.reading_club_posts is
  'Private club announcements and member discussions.';
comment on table public.reading_club_comments is
  'Member comments on private club posts.';
comment on table public.reading_club_encouragements is
  'Member encouragements on private club posts.';
