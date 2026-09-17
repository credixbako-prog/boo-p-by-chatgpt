-- Staff authority is live server state, never user metadata or a cached JWT claim.
create table private.boop_staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  is_admin boolean not null default false,
  is_moderator boolean not null default false,
  updated_at timestamptz not null default now()
);
alter table private.boop_staff_roles enable row level security;
revoke all on private.boop_staff_roles from public,anon,authenticated;
grant select,insert,update,delete on private.boop_staff_roles to service_role;
insert into private.boop_staff_roles(user_id,is_moderator)
select id,true from auth.users where raw_app_meta_data->>'boop_moderator'='true';

create table private.boop_staff_audit (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  subject_id uuid not null,
  before_data jsonb not null default '{}',
  after_data jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table private.boop_staff_audit enable row level security;
revoke all on private.boop_staff_audit from public,anon,authenticated;
grant select,insert on private.boop_staff_audit to service_role;

create function private.boop_staff_user_eligible(p_user_id uuid) returns boolean
language sql volatile security definer set search_path='' as $$
  select private.boop_user_active(p_user_id) and exists(
    select 1 from auth.users u where u.id=p_user_id and u.email_confirmed_at is not null
      and not coalesce(u.is_anonymous,false) and (u.banned_until is null or u.banned_until<=now())
  );
$$;
revoke all on function private.boop_staff_user_eligible(uuid) from public,anon,authenticated;

create or replace function private.is_publication_moderator() returns boolean
language sql volatile security definer set search_path='' as $$
  select private.boop_staff_user_eligible(auth.uid()) and exists(
    select 1 from private.boop_staff_roles r where r.user_id=auth.uid() and (r.is_admin or r.is_moderator)
  );
$$;
revoke all on function private.is_publication_moderator() from public,anon;
grant execute on function private.is_publication_moderator() to authenticated;
create function private.is_boop_admin() returns boolean
language sql volatile security definer set search_path='' as $$
  select private.boop_staff_user_eligible(auth.uid()) and exists(
    select 1 from private.boop_staff_roles r where r.user_id=auth.uid() and r.is_admin
  );
$$;
revoke all on function private.is_boop_admin() from public,anon;
grant execute on function private.is_boop_admin() to authenticated;

create function public.get_boop_staff_access() returns jsonb
language sql volatile security invoker set search_path='' as $$
  select jsonb_build_object('isAdmin',private.is_boop_admin(),'isModerator',private.is_publication_moderator());
$$;
revoke all on function public.get_boop_staff_access() from public,anon;
grant execute on function public.get_boop_staff_access() to authenticated;

create function public.list_boop_staff_users(p_search text default '',p_limit integer default 30,p_offset integer default 0) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare result jsonb; lim integer:=least(greatest(coalesce(p_limit,30),1),100);
  off integer:=greatest(coalesce(p_offset,0),0); term text:=left(trim(coalesce(p_search,'')),160);
begin
  if not private.is_boop_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  with candidates as (
    select u.id,u.email,coalesce(p.display_name,'Lecteur BOO-P') as display_name,
      coalesce(r.is_admin,false) as is_admin,coalesce(r.is_moderator,false) as is_moderator,
      u.email_confirmed_at is not null as email_confirmed,u.created_at,u.last_sign_in_at
    from auth.users u left join private.boop_staff_roles r on r.user_id=u.id
      left join public.profiles p on p.user_id=u.id
    where not coalesce(u.is_anonymous,false) and private.boop_user_active(u.id)
      and (term='' or strpos(lower(coalesce(u.email,'')),lower(term))>0
        or strpos(lower(coalesce(p.display_name,'')),lower(term))>0)
    order by u.created_at desc,u.id limit lim+1 offset off
  ), numbered as (select *,row_number() over(order by created_at desc,id) as row_num from candidates)
  select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'email',email,'displayName',display_name,'isAdmin',is_admin,'isModerator',is_moderator,
    'emailConfirmed',email_confirmed,'createdAt',created_at,'lastSignInAt',last_sign_in_at
  ) order by created_at desc,id) filter(where row_num<=lim),'[]'::jsonb),
  'hasMore',count(*)>lim) into result from numbered;
  return result;
end;
$$;
revoke all on function public.list_boop_staff_users(text,integer,integer) from public,anon;
grant execute on function public.list_boop_staff_users(text,integer,integer) to authenticated;

create function public.set_boop_staff_roles(p_user_id uuid,p_is_admin boolean,p_is_moderator boolean) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare previous jsonb; result jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('boop-staff-roles',0));
  if not private.is_boop_admin() then raise exception 'Administrator access required' using errcode='42501'; end if;
  if p_user_id is null or p_is_admin is null or p_is_moderator is null then
    raise exception 'Explicit account and roles required' using errcode='22023';
  end if;
  if not private.boop_staff_user_eligible(p_user_id) then
    raise exception 'A confirmed, active account is required' using errcode='22023';
  end if;
  select jsonb_build_object('isAdmin',r.is_admin,'isModerator',r.is_moderator) into previous
    from private.boop_staff_roles r where r.user_id=p_user_id;
  previous:=coalesce(previous,jsonb_build_object('isAdmin',false,'isModerator',false));
  if (previous->>'isAdmin')::boolean and not p_is_admin and not exists(
    select 1 from private.boop_staff_roles r where r.user_id<>p_user_id and r.is_admin
      and private.boop_staff_user_eligible(r.user_id)
  ) then raise exception 'staff_last_admin' using errcode='55000'; end if;
  insert into private.boop_staff_roles(user_id,is_admin,is_moderator)
    values(p_user_id,p_is_admin,p_is_moderator)
    on conflict(user_id) do update set is_admin=excluded.is_admin,is_moderator=excluded.is_moderator,updated_at=now();
  result:=jsonb_build_object('id',p_user_id,'isAdmin',p_is_admin,'isModerator',p_is_moderator);
  if previous is distinct from result-'id' then
    insert into private.boop_staff_audit(actor_id,action,subject_id,before_data,after_data)
      values(auth.uid(),'staff_roles',p_user_id,previous,result-'id');
  end if;
  return result;
end;
$$;
revoke all on function public.set_boop_staff_roles(uuid,boolean,boolean) from public,anon;
grant execute on function public.set_boop_staff_roles(uuid,boolean,boolean) to authenticated;

-- This fires before prepare_boop_account_deletion can erase or detach any data.
-- The same lock serializes concurrent demotions and account deletion starts.
create function private.guard_boop_last_admin_deletion() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  perform pg_advisory_xact_lock(hashtextextended('boop-staff-roles',0));
  if exists(select 1 from private.boop_staff_roles where user_id=new.user_id and is_admin)
    and not exists(select 1 from private.boop_staff_roles r where r.user_id<>new.user_id
      and r.is_admin and private.boop_staff_user_eligible(r.user_id)) then
    raise exception 'staff_last_admin' using errcode='55000';
  end if;
  return new;
end;
$$;
revoke all on function private.guard_boop_last_admin_deletion() from public,anon,authenticated;
create trigger boop_last_admin_deletion before insert on private.account_deletions
  for each row execute function private.guard_boop_last_admin_deletion();

-- Invoker security intentionally retains all content and profile RLS, including
-- private originals and deleted accounts. No auth email or private library is read.
create function public.list_boop_staff_reports(p_status text default 'pending',p_limit integer default 30,p_offset integer default 0) returns jsonb
language plpgsql volatile security invoker set search_path='' as $$
declare result jsonb; lim integer:=least(greatest(coalesce(p_limit,30),1),100);
  off integer:=greatest(coalesce(p_offset,0),0);
begin
  if not private.is_publication_moderator() then raise exception 'Moderator access required' using errcode='42501'; end if;
  if p_status is null or p_status not in ('pending','reviewed','dismissed') then
    raise exception 'Invalid report status' using errcode='22023';
  end if;
  with reports as (
    select r.id,'user'::text as kind,r.reason,r.details,r.status,r.created_at,
      coalesce(reporter.display_name,'Lecteur BOO-P') as reporter_name,
      coalesce(target.display_name,'Profil indisponible') as target_name,
      r.reported_user_id as target_id,'user'::text as target_type,''::text as excerpt
    from public.user_reports r
      left join public.profile_directory reporter on reporter.user_id=r.reporter_id
      left join public.profile_directory target on target.user_id=r.reported_user_id
    where r.status=p_status
    union all
    select r.id,'publication',r.reason,r.details,r.status,r.created_at,
      coalesce(reporter.display_name,'Lecteur BOO-P'),
      coalesce(target.display_name,'Publication indisponible'),
      coalesce(r.post_id,r.club_post_id,r.card_id),
      case when r.post_id is not null then 'community_posts' when r.club_post_id is not null then 'reading_club_posts' else 'reading_cards' end,
      left(coalesce(p.body,cp.body,c.caption,''),600)
    from public.publication_reports r
      left join public.community_posts p on p.id=r.post_id and p.visibility in ('friends','public')
      left join public.reading_club_posts cp on cp.id=r.club_post_id
      left join public.reading_cards c on c.id=r.card_id and c.visibility<>'private'
      left join public.profile_directory reporter on reporter.user_id=r.reporter_id
      left join public.profile_directory target on target.user_id=coalesce(p.author_id,cp.author_id,c.user_id)
    where r.status=p_status
  ), candidates as (
    select * from reports order by created_at desc,kind,id limit lim+1 offset off
  ), numbered as (select *,row_number() over(order by created_at desc,kind,id) as row_num from candidates)
  select jsonb_build_object('items',coalesce(jsonb_agg(jsonb_build_object(
    'id',id,'kind',kind,'reason',reason,'details',details,'status',status,'createdAt',created_at,
    'reporterName',reporter_name,'targetName',target_name,'targetId',target_id,'targetType',target_type,'excerpt',excerpt
  ) order by created_at desc,kind,id) filter(where row_num<=lim),'[]'::jsonb),
  'hasMore',count(*)>lim) into result from numbered;
  return result;
end;
$$;
revoke all on function public.list_boop_staff_reports(text,integer,integer) from public,anon;
grant execute on function public.list_boop_staff_reports(text,integer,integer) to authenticated;

-- Status changes use one audited RPC; direct table updates cannot bypass it.
revoke update(status) on public.user_reports,public.publication_reports from authenticated;
create function public.review_boop_staff_report(p_kind text,p_report_id uuid,p_status text) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare previous text;
begin
  if not private.is_publication_moderator() then raise exception 'Moderator access required' using errcode='42501'; end if;
  if p_kind is null or p_kind not in ('user','publication') or p_report_id is null
    or p_status is null or p_status not in ('pending','reviewed','dismissed') then
    raise exception 'Invalid report or status' using errcode='22023';
  end if;
  if p_kind='user' then
    select status into previous from public.user_reports where id=p_report_id for update;
  else
    select status into previous from public.publication_reports where id=p_report_id for update;
  end if;
  if previous is null then raise exception 'Report unavailable' using errcode='P0002'; end if;
  if not private.is_publication_moderator() then raise exception 'Moderator access required' using errcode='42501'; end if;
  if p_status<>previous then
    if p_kind='user' then update public.user_reports set status=p_status where id=p_report_id;
    else update public.publication_reports set status=p_status where id=p_report_id; end if;
    insert into private.boop_staff_audit(actor_id,action,subject_id,before_data,after_data)
      values(auth.uid(),'report_'||p_kind,p_report_id,jsonb_build_object('status',previous),jsonb_build_object('status',p_status));
  end if;
  return jsonb_build_object('id',p_report_id,'kind',p_kind,'status',p_status);
end;
$$;
revoke all on function public.review_boop_staff_report(text,uuid,text) from public,anon;
grant execute on function public.review_boop_staff_report(text,uuid,text) to authenticated;
