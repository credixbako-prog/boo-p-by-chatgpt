-- Covers already used in readers’ libraries were stripped by the profile projection.
-- Retain owner/accepted-friend access and the existing private-data projection.
create or replace function private.reader_book_card(book_id text,p jsonb) returns jsonb
language sql immutable security invoker set search_path='' as $$
 select jsonb_build_object('id',book_id,'title',left(coalesce(p->>'title','Sans titre'),400),
 'authors',case when jsonb_typeof(p->'authors')='array' then
 (select coalesce(jsonb_agg(left(a.value #>> '{}',240)),'[]'::jsonb) from (select value from jsonb_array_elements(p->'authors') limit 5) a) else '[]'::jsonb end,
 'status',case when p->>'status' in ('a-lire','en-cours','en-pause','lu','abandonne') then p->>'status' else 'a-lire' end,
 'mediaType',case when p->>'mediaType' in ('print','ebook','audio') then p->>'mediaType' else 'print' end,
 'isbn',case when p->>'isbn' ~ '^[0-9Xx -]{10,20}$' then p->>'isbn' else '' end,
 'coverUrl',case
 when octet_length(p->>'coverUrl')<=2200000 and p->>'coverUrl' ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$' then p->>'coverUrl'
 when p->>'coverUrl' ~ '^https://(covers[.]openlibrary[.]org|books[.]google[.]com|books[.]google[.]fr|books[.]googleusercontent[.]com|images[.]chasse-aux-livres[.]fr|img[.]chasse-aux-livres[.]fr)/' then left(p->>'coverUrl',2000)
 when p->>'coverUrl' ~ '^https://shnyjvinzjvgourpscvh[.]supabase[.]co/(storage/v1/object/public/book-covers/|functions/v1/cover-image-proxy[?])' then left(p->>'coverUrl',2000)
 else '' end);
$$;
