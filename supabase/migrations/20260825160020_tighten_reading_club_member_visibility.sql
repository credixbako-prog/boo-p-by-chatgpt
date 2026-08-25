-- Public clubs are discoverable, but their membership roster is not public.
drop policy if exists reading_club_members_select_accessible
  on public.reading_club_members;

create policy reading_club_members_select_accessible
on public.reading_club_members for select to authenticated
using (
  user_id = (select auth.uid())
  or public.is_active_club_member(club_id)
  or public.is_club_manager(club_id)
);
