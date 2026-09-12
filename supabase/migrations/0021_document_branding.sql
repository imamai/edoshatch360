-- EDOS Hatch360 — document branding: a tenant's logo and authorised signature,
-- shown on quotations, orders, invoices and receipts.
--
-- The bucket is PRIVATE and read through short-lived signed URLs. A scanned
-- handwritten signature is a forgery risk if it sits on a permanent public
-- URL, and a logo is not worth a second bucket to separate them.
--
-- Paths are `<tenant_id>/<asset>-<timestamp>.<ext>`, so the first folder
-- segment is the tenancy boundary the policies below check.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'edoshatch360-branding',
  'edoshatch360-branding',
  false,
  2097152,                                    -- 2 MB; a logo needing more is wrong for a document
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;

-- Anyone who can see the tenant's documents can see the marks printed on them.
create policy edoshatch360_branding_read on storage.objects
for select to authenticated
using (
  bucket_id = 'edoshatch360-branding'
  and (storage.foldername(name))[1] in (
    select t::text from public.edoshatch360_tenant_ids() t
  )
);

-- Writes are owner-only, mirroring CAN_ADMIN in src/lib/data/session.ts.
-- Changing the signature on every future invoice is not a staff-level action.
create policy edoshatch360_branding_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'edoshatch360-branding'
  and (storage.foldername(name))[1] in (
    select t::text from public.edoshatch360_admin_tenant_ids() t
  )
);

create policy edoshatch360_branding_update on storage.objects
for update to authenticated
using (
  bucket_id = 'edoshatch360-branding'
  and (storage.foldername(name))[1] in (
    select t::text from public.edoshatch360_admin_tenant_ids() t
  )
)
with check (
  bucket_id = 'edoshatch360-branding'
  and (storage.foldername(name))[1] in (
    select t::text from public.edoshatch360_admin_tenant_ids() t
  )
);

create policy edoshatch360_branding_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'edoshatch360-branding'
  and (storage.foldername(name))[1] in (
    select t::text from public.edoshatch360_admin_tenant_ids() t
  )
);
