-- Private test ledger: no audio, transcript, book title or API key.
create table public.boop_voice_calls (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  call_id text,
  status text not null default 'pending' check(status in ('pending','active','closed','failed'))
);
alter table public.boop_voice_calls enable row level security;
revoke all on public.boop_voice_calls from public, anon, authenticated;
grant select, insert, update, delete on public.boop_voice_calls to service_role;
create index boop_voice_calls_created_idx on public.boop_voice_calls(created_at);
create index boop_voice_calls_user_idx on public.boop_voice_calls(user_id,created_at);

create function public.reserve_boop_voice_call(p_user_id uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare reservation uuid;
begin
  -- One transaction serializes reservations across all Edge Function instances.
  perform pg_advisory_xact_lock(91463000);
  delete from public.boop_voice_calls where created_at < now() - interval '30 days';
  if (select count(*) from public.boop_voice_calls where created_at >= (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')) >= 6
    or (select count(*) from public.boop_voice_calls where user_id=p_user_id and created_at >= (date_trunc('day',now() at time zone 'UTC') at time zone 'UTC')) >= 3
    or exists(select 1 from public.boop_voice_calls where user_id=p_user_id and status in ('pending','active') and created_at > now() - interval '65 minutes') then
    raise exception 'voice_test_limit';
  end if;
  insert into public.boop_voice_calls(user_id) values(p_user_id) returning id into reservation;
  return reservation;
end $$;
revoke all on function public.reserve_boop_voice_call(uuid) from public, anon, authenticated;
grant execute on function public.reserve_boop_voice_call(uuid) to service_role;
