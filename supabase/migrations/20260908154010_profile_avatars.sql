-- Photo de profil BOO-P : fichier privé, compressé côté client, rattaché
-- aux trois représentations existantes du profil.
alter table public.profiles
  add column if not exists avatar_path text;

alter table public.profile_directory
  add column if not exists avatar_path text;

alter table public.profile_shared_details
  add column if not exists avatar_path text;

alter table public.profiles
  drop constraint if exists profiles_avatar_path_check;
alter table public.profiles
  add constraint profiles_avatar_path_check
  check (avatar_path is null or avatar_path = user_id::text || '/avatar.jpg');

alter table public.profile_directory
  drop constraint if exists profile_directory_avatar_path_check;
alter table public.profile_directory
  add constraint profile_directory_avatar_path_check
  check (avatar_path is null or avatar_path = user_id::text || '/avatar.jpg');

alter table public.profile_shared_details
  drop constraint if exists profile_shared_details_avatar_path_check;
alter table public.profile_shared_details
  add constraint profile_shared_details_avatar_path_check
  check (avatar_path is null or avatar_path = user_id::text || '/avatar.jpg');

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('profile-avatars', 'profile-avatars', false, 1048576, array['image/jpeg'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists profile_avatars_select_authenticated on storage.objects;
create policy profile_avatars_select_authenticated
on storage.objects for select to authenticated
using (bucket_id = 'profile-avatars');

drop policy if exists profile_avatars_select_public_anon on storage.objects;
create policy profile_avatars_select_public_anon
on storage.objects for select to anon
using (
  bucket_id = 'profile-avatars'
  and exists (
    select 1
    from public.profile_directory d
    where d.user_id::text = (storage.foldername(name))[1]
      and d.profile_visibility = 'public'
  )
);

drop policy if exists profile_avatars_insert_own on storage.objects;
create policy profile_avatars_insert_own
on storage.objects for insert to authenticated
with check (
  bucket_id = 'profile-avatars'
  and name = (select auth.uid())::text || '/avatar.jpg'
);

drop policy if exists profile_avatars_update_own on storage.objects;
create policy profile_avatars_update_own
on storage.objects for update to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = (select auth.uid())::text || '/avatar.jpg'
)
with check (
  bucket_id = 'profile-avatars'
  and name = (select auth.uid())::text || '/avatar.jpg'
);

drop policy if exists profile_avatars_delete_own on storage.objects;
create policy profile_avatars_delete_own
on storage.objects for delete to authenticated
using (
  bucket_id = 'profile-avatars'
  and name = (select auth.uid())::text || '/avatar.jpg'
);

comment on column public.profiles.avatar_path is
  'Private canonical path of the compressed BOO-P profile photo.';
comment on column public.profile_directory.avatar_path is
  'Minimal directory avatar path, visible to signed-in users with the account name.';
comment on column public.profile_shared_details.avatar_path is
  'Avatar path copied to the shareable profile details for public or accepted-friend access.';
