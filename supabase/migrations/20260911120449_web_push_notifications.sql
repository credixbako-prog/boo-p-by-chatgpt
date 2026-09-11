create extension if not exists pg_net with schema extensions;

create table public.push_devices (
  device_id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique check (length(token) between 20 and 4096),
  preferences jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  last_test_at timestamptz not null default '2000-01-01'
);
create index push_devices_user_idx on public.push_devices(user_id);
alter table public.push_devices enable row level security;
revoke all on public.push_devices from public, anon, authenticated;
grant all on public.push_devices to service_role;

create table public.push_jobs (
  id uuid primary key default gen_random_uuid(),
  capability uuid not null default gen_random_uuid(),
  notification_id bigint not null references public.notifications(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','sending','sent','failed')),
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(notification_id)
);
alter table public.push_jobs enable row level security;
revoke all on public.push_jobs from public, anon, authenticated;
grant all on public.push_jobs to service_role;

create function public.register_boop_push_device(p_user uuid, p_device uuid, p_token text, p_preferences jsonb)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended(p_user::text, 0));
  if exists(select 1 from public.push_devices where device_id=p_device and user_id<>p_user) then
    raise exception 'Device already registered';
  end if;
  delete from public.push_devices where user_id=p_user and updated_at < now()-interval '60 days';
  if not exists(select 1 from public.push_devices where device_id=p_device)
     and (select count(*) from public.push_devices where user_id=p_user)>=20 then
    raise exception 'Device limit';
  end if;
  insert into public.push_devices(device_id,user_id,token,preferences)
    values(p_device,p_user,p_token,p_preferences)
    on conflict(device_id) do update set token=excluded.token, preferences=excluded.preferences, updated_at=now();
end;
$$;
revoke all on function public.register_boop_push_device(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.register_boop_push_device(uuid,uuid,text,jsonb) to service_role;

create function private.boop_enqueue_push()
returns trigger language plpgsql security definer set search_path = '' as $$
declare job public.push_jobs;
begin
  if not exists(select 1 from public.push_devices where user_id=new.recipient_id and updated_at>now()-interval '60 days') then return new; end if;
  insert into public.push_jobs(notification_id) values(new.id) returning * into job;
  -- One-use random capability authorizes only this database-generated job.
  perform net.http_post(
    url := 'https://shnyjvinzjvgourpscvh.supabase.co/functions/v1/push-notifications',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := jsonb_build_object('action','dispatch','jobId',job.id,'capability',job.capability),
    timeout_milliseconds := 15000
  );
  delete from public.push_jobs where created_at < now()-interval '7 days';
  return new;
exception when others then
  -- Delivery must never prevent the original social action from completing.
  raise warning 'BOO-P push enqueue failed';
  return new;
end;
$$;
revoke all on function private.boop_enqueue_push() from public,anon,authenticated;
create trigger boop_enqueue_push after insert on public.notifications
  for each row execute function private.boop_enqueue_push();
