create table if not exists public.notifications (
  id bigint generated always as identity primary key,
  recipient_id uuid not null references auth.users (id) on delete cascade,
  actor_id uuid references auth.users (id) on delete set null,
  actor_name text not null default 'Un lecteur',
  type text not null check (type in ('friend', 'trace', 'encouragement', 'info')),
  title text not null check (char_length(title) between 1 and 120),
  body text not null default '' check (char_length(body) <= 500),
  route text not null default '#home' check (char_length(route) between 1 and 300),
  source_id uuid,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

comment on table public.notifications is
  'Private BOO-P in-app notifications generated from social database events.';

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id, created_at desc)
  where read_at is null;

alter table public.notifications enable row level security;
alter table public.notifications replica identity full;

revoke all on table public.notifications from anon, authenticated;
grant select, delete on table public.notifications to authenticated;
grant update (read_at) on table public.notifications to authenticated;

drop policy if exists notifications_select_own on public.notifications;
create policy notifications_select_own
  on public.notifications for select to authenticated
  using ((select auth.uid()) = recipient_id);

drop policy if exists notifications_update_own on public.notifications;
create policy notifications_update_own
  on public.notifications for update to authenticated
  using ((select auth.uid()) = recipient_id)
  with check ((select auth.uid()) = recipient_id);

drop policy if exists notifications_delete_own on public.notifications;
create policy notifications_delete_own
  on public.notifications for delete to authenticated
  using ((select auth.uid()) = recipient_id);

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.boopp_actor_name(actor uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select d.display_name from public.profile_directory d where d.user_id = actor),
    'Un lecteur'
  );
$$;

create or replace function private.boopp_notify_friendship()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  display_name text;
begin
  if tg_op = 'INSERT' and new.status = 'pending' then
    display_name := private.boopp_actor_name(new.requester_id);
    insert into public.notifications (
      recipient_id, actor_id, actor_name, type, title, body, route, source_id
    ) values (
      new.addressee_id,
      new.requester_id,
      display_name,
      'friend',
      'Nouvelle demande d’amitié',
      display_name || ' souhaite rejoindre votre cercle de lecture.',
      '#community?tab=friends',
      new.id
    );
  elsif tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'accepted' then
    display_name := private.boopp_actor_name(new.addressee_id);
    insert into public.notifications (
      recipient_id, actor_id, actor_name, type, title, body, route, source_id
    ) values (
      new.requester_id,
      new.addressee_id,
      display_name,
      'friend',
      'Demande d’amitié acceptée',
      display_name || ' fait maintenant partie de vos amis BOO-P.',
      '#community?tab=friends',
      new.id
    );
  elsif tg_op = 'DELETE' and old.status = 'pending' then
    delete from public.notifications n
      where n.recipient_id = old.addressee_id
        and n.type = 'friend'
        and n.source_id = old.id;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create or replace function private.boopp_notify_trace()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author uuid;
  parent_author uuid;
  book text;
  display_name text;
  context_text text;
begin
  select p.author_id, p.book_title
    into post_author, book
    from public.community_posts p
    where p.id = new.post_id;

  display_name := coalesce(new.author_name, private.boopp_actor_name(new.author_id));
  context_text := case
    when nullif(trim(book), '') is null then '.'
    else ' sur « ' || left(trim(book), 180) || ' ». '
  end;

  if post_author is distinct from new.author_id then
    insert into public.notifications (
      recipient_id, actor_id, actor_name, type, title, body, route, source_id
    ) values (
      post_author,
      new.author_id,
      display_name,
      'trace',
      'Nouvelle Trace',
      display_name || ' a répondu à votre Trace' || context_text,
      '#community?tab=public&post=' || new.post_id::text,
      new.id
    );
  end if;

  if new.parent_id is not null then
    select c.author_id into parent_author
      from public.community_comments c
      where c.id = new.parent_id;

    if parent_author is distinct from new.author_id
      and parent_author is distinct from post_author then
      insert into public.notifications (
        recipient_id, actor_id, actor_name, type, title, body, route, source_id
      ) values (
        parent_author,
        new.author_id,
        display_name,
        'trace',
        'Réponse à votre Trace',
        display_name || ' a répondu à votre Trace' || context_text,
        '#community?tab=public&post=' || new.post_id::text,
        new.id
      );
    end if;
  end if;

  return new;
end;
$$;

create or replace function private.boopp_notify_encouragement()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  post_author uuid;
  target_post uuid;
  book text;
  display_name text;
  context_text text;
begin
  target_post := case when tg_op = 'DELETE' then old.post_id else new.post_id end;
  select p.author_id, p.book_title
    into post_author, book
    from public.community_posts p
    where p.id = target_post;

  if tg_op = 'DELETE' then
    delete from public.notifications n
      where n.recipient_id = post_author
        and n.actor_id = old.user_id
        and n.type = 'encouragement'
        and n.source_id = old.post_id;
    return old;
  end if;

  if post_author is distinct from new.user_id then
    display_name := private.boopp_actor_name(new.user_id);
    context_text := case
      when nullif(trim(book), '') is null then '.'
      else ' pour « ' || left(trim(book), 180) || ' ». '
    end;
    insert into public.notifications (
      recipient_id, actor_id, actor_name, type, title, body, route, source_id
    ) values (
      post_author,
      new.user_id,
      display_name,
      'encouragement',
      'Nouvel encouragement',
      display_name || ' vous encourage' || context_text,
      '#community?tab=public&post=' || new.post_id::text,
      new.post_id
    );
  end if;

  return new;
end;
$$;

revoke execute on function private.boopp_actor_name(uuid) from public, anon, authenticated;
revoke execute on function private.boopp_notify_friendship() from public, anon, authenticated;
revoke execute on function private.boopp_notify_trace() from public, anon, authenticated;
revoke execute on function private.boopp_notify_encouragement() from public, anon, authenticated;

drop trigger if exists friendships_notify_social on public.friendships;
create trigger friendships_notify_social
  after insert or update or delete on public.friendships
  for each row execute function private.boopp_notify_friendship();

drop trigger if exists community_comments_notify_social on public.community_comments;
create trigger community_comments_notify_social
  after insert on public.community_comments
  for each row execute function private.boopp_notify_trace();

drop trigger if exists community_encouragements_notify_social on public.community_encouragements;
create trigger community_encouragements_notify_social
  after insert or delete on public.community_encouragements
  for each row execute function private.boopp_notify_encouragement();

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1
      from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'notifications'
    ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end
$$;
