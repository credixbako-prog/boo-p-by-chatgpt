-- Keep RLS helpers and trigger functions out of the exposed Data API schema.
create schema if not exists private;

alter function public.is_active_club_member(uuid) set schema private;
alter function public.is_club_manager(uuid) set schema private;
alter function public.add_reading_club_owner_membership() set schema private;
alter function public.add_reading_salon_creator() set schema private;
alter function public.set_reading_community_updated_at() set schema private;

revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

revoke all on function private.is_active_club_member(uuid),
  private.is_club_manager(uuid) from public, anon;
grant execute on function private.is_active_club_member(uuid),
  private.is_club_manager(uuid) to authenticated, service_role;

revoke all on function private.add_reading_club_owner_membership(),
  private.add_reading_salon_creator(),
  private.set_reading_community_updated_at() from public, anon, authenticated;

create index if not exists reading_club_members_invited_by_idx
  on public.reading_club_members (invited_by)
  where invited_by is not null;
create index if not exists reading_salons_created_by_idx
  on public.reading_salons (created_by);
create index if not exists reading_salon_messages_author_idx
  on public.reading_salon_messages (author_id);
