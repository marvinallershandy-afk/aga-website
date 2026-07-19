-- P0 + P4 (Admin-Ausbau): Storage-Bucket `sm_grafiken` für Matchday-Grafiken.
--
-- Der Matchday-Generator (src/admin/matchday/export.ts) lädt PNGs in diesen
-- privaten Bucket. Bisher war das ein optionaler Schritt und der Bucket war im
-- Prod-Projekt NICHT angelegt → Upload lief ins Leere. Diese Datei beschreibt
-- Bucket + RLS deklarativ und idempotent.
--
-- ⚠️ WARTET AUF MARVIN: Das Anlegen des Buckets ist ein Handgriff im Supabase-
-- Dashboard bzw. das Anwenden dieser Migration. Der Code degradiert sauber,
-- solange der Bucket fehlt (Fallback auf reinen PNG-Download, klare UI-Meldung).
-- NICHT automatisch anwenden (Builder-Regel: Migrationen als DATEIEN).
--
-- RLS-Prinzip wie bei allen sm_*-Objekten: nur is_sm_admin() (eingeloggte
-- Vereins-Admins) dürfen lesen/schreiben. Der Bucket ist privat (public=false);
-- öffentliche Auslieferung von Grafiken erfolgt NICHT über diesen Bucket,
-- sondern über die n8n-Drive-Ablage (Event grafik.gerendert).

-- ── Bucket anlegen (privat) ─────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sm_grafiken', 'sm_grafiken', false, 10485760, array['image/png'])
on conflict (id) do nothing;

-- ── RLS-Policies auf storage.objects, auf diesen Bucket begrenzt ────────────
-- storage.objects hat RLS bereits aktiv (Supabase-Default).
drop policy if exists sm_grafiken_select on storage.objects;
create policy sm_grafiken_select on storage.objects
  for select to authenticated
  using (bucket_id = 'sm_grafiken' and public.is_sm_admin());

drop policy if exists sm_grafiken_insert on storage.objects;
create policy sm_grafiken_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sm_grafiken' and public.is_sm_admin());

drop policy if exists sm_grafiken_update on storage.objects;
create policy sm_grafiken_update on storage.objects
  for update to authenticated
  using (bucket_id = 'sm_grafiken' and public.is_sm_admin());

drop policy if exists sm_grafiken_delete on storage.objects;
create policy sm_grafiken_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'sm_grafiken' and public.is_sm_admin());
