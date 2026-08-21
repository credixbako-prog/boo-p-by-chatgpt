create index if not exists notifications_actor_idx
  on public.notifications (actor_id)
  where actor_id is not null;
