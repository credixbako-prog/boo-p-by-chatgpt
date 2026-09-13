-- Supabase's default table grants include UPDATE on every column.
-- Publications may only edit body; ownership, club and timestamps stay immutable.
revoke update, truncate, references, trigger on public.reading_club_posts from public, anon, authenticated;
grant update(body) on public.reading_club_posts to authenticated;
