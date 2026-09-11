-- Personal, self-reported milestones. Only the latest badge is projected to visitors.
create table public.reader_badges (
 user_id uuid not null references auth.users(id) on delete cascade,
 badge_id text not null check(badge_id in (
 'first-step','between-pages','words-path','deep-trace','open-curiosity','long-reading',
 'goal-day','goal-week','goal-month','goal-year','last-page','five-books','ten-books',
 'twenty-five-books','fifty-books','first-word','word-collector','word-treasure','expressions',
 'citations','first-thought','ten-thoughts','first-notebook','five-notebooks','ten-sessions',
 'fifty-sessions','ten-hours','three-genres','five-genres','book-passer')),
 unlocked_at timestamptz not null default now() check(isfinite(unlocked_at) and unlocked_at>='2000-01-01'::timestamptz and unlocked_at<=now()+interval '1 day'),
 primary key(user_id,badge_id)
);
alter table public.reader_badges enable row level security;
revoke all on public.reader_badges from anon,authenticated;
grant select,insert on public.reader_badges to authenticated;
create policy reader_badges_read_own on public.reader_badges for select to authenticated using(user_id=(select auth.uid()));
create policy reader_badges_insert_own on public.reader_badges for insert to authenticated with check(user_id=(select auth.uid()));

create function private.reader_latest_badge(target_user uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
 if auth.uid() is null then return null; end if;
 if auth.uid()<>target_user and not private.is_accepted_reader_friend(target_user)
 and not exists(select 1 from public.profile_shared_details p where p.user_id=target_user and p.profile_visibility='public') then return null; end if;
 return (select jsonb_build_object('badge_id',b.badge_id,'unlocked_at',b.unlocked_at)
 from public.reader_badges b where b.user_id=target_user order by b.unlocked_at desc,b.badge_id asc limit 1);
end;$$;
revoke all on function private.reader_latest_badge(uuid) from public,anon;
grant execute on function private.reader_latest_badge(uuid) to authenticated;
create function public.get_reader_latest_badge(target_user uuid) returns jsonb
language sql stable security invoker set search_path='' as $$select private.reader_latest_badge(target_user);$$;
revoke all on function public.get_reader_latest_badge(uuid) from public,anon;
grant execute on function public.get_reader_latest_badge(uuid) to authenticated;
