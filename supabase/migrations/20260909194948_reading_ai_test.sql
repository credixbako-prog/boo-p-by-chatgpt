create table public.boop_ai_requests (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now()
);
alter table public.boop_ai_requests enable row level security;
revoke all on public.boop_ai_requests from public, anon, authenticated;
grant select, insert, delete on public.boop_ai_requests to service_role;
create index boop_ai_requests_created on public.boop_ai_requests(created_at);
create function public.reserve_boop_ai_request(p_user_id uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare result uuid;
begin
 perform pg_advisory_xact_lock(91463001);
 if not exists(select 1 from auth.users where id=p_user_id and raw_app_meta_data->>'boop_ai_test'='true' and not coalesce(is_anonymous,false)) then
  raise exception 'Test access denied';
 end if;
 delete from public.boop_ai_requests where created_at < now()-interval '30 days';
 if (select count(*) from public.boop_ai_requests where created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') >= 100
 or (select count(*) from public.boop_ai_requests where user_id=p_user_id and created_at >= date_trunc('day',now() at time zone 'UTC') at time zone 'UTC') >= 50
 or exists(select 1 from public.boop_ai_requests where user_id=p_user_id and created_at > now()-interval '5 seconds') then
  raise exception 'Test quota reached';
 end if;
 insert into public.boop_ai_requests(user_id) values(p_user_id) returning id into result;
 return result;
end;
$$;
revoke all on function public.reserve_boop_ai_request(uuid) from public, anon, authenticated;
grant execute on function public.reserve_boop_ai_request(uuid) to service_role;
