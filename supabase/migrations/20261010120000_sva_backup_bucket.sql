-- ─────────────────────────────────────────────────────────────────────────────
-- v19-B (Paket 2): Backup — der Verein hat auf dem Free-Tier keine
-- Restore-Punkte; Kader, Spiele, Album-Stände und Statistik leben NUR in dieser
-- DB. Eine tägliche Edge Function (03:00) exportiert alle sva_*/sm_*-Tabellen
-- (ohne Kochsafe) als JSON in den PRIVATEN Bucket `sva_backup`.
--
-- Diese Migration liefert:
--   1. Privater Bucket sva_backup (nur service_role).
--   2. RPC sva_backup_dump() (SECURITY DEFINER, nur service_role): zieht den
--      kompletten Inhalt aller sva_*/sm_*-Tabellen in EIN jsonb — dynamisch, so
--      dass neue Tabellen automatisch mitgesichert werden. Kochsafe (sme_*,
--      rezepte, haushalte …) wird bewusst NICHT gesichert.
--
-- NICHT automatisch anwenden (Builder-Regel: Migrationen als Dateien).
-- Reihenfolge: nach 20261010110000_sva_fupa_sync.sql. Idempotent formuliert.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Privater Bucket ──────────────────────────────────────────────────────
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sva_backup', 'sva_backup', false, 52428800, array['application/json'])
on conflict (id) do nothing;

-- ── 2. RLS: NUR service_role (die Edge Function) — kein anon/authenticated ──
-- storage.objects hat RLS bereits aktiv. Es gibt bewusst KEINE Policy für
-- authenticated/anon → selbst eingeloggte Vereins-Admins kommen nicht an die
-- Backups (die enthalten alle Daten im Klartext). service_role umgeht RLS
-- ohnehin; die Policies hier machen die Absicht explizit und testbar.
drop policy if exists sva_backup_service_all on storage.objects;
create policy sva_backup_service_all on storage.objects
  for all to service_role
  using (bucket_id = 'sva_backup')
  with check (bucket_id = 'sva_backup');

-- ── 3. Voll-Export aller sva_*/sm_*-Tabellen (ohne Kochsafe) ────────────────
-- Escape '\' macht den Unterstrich literal: 'sm\_%' matcht sm_spiele, aber NICHT
-- sme_members (Kochsafe). Ebenso wird alles unter sme_ zusätzlich ausgeschlossen.
create or replace function public.sva_backup_dump()
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_tables jsonb := '{}'::jsonb;
  v_tbl text;
  v_rows jsonb;
begin
  for v_tbl in
    select table_name
      from information_schema.tables
     where table_schema = 'public'
       and table_type = 'BASE TABLE'
       and (table_name like 'sva\_%' escape '\' or table_name like 'sm\_%' escape '\')
       and table_name not like 'sme\_%' escape '\'
     order by table_name
  loop
    execute format('select coalesce(jsonb_agg(t order by t), ''[]''::jsonb) from public.%I t', v_tbl)
      into v_rows;
    v_tables := v_tables || jsonb_build_object(v_tbl, v_rows);
  end loop;

  return jsonb_build_object(
    'generatedAt', now(),
    'tableCount', (select count(*) from jsonb_object_keys(v_tables)),
    'tables', v_tables
  );
end;
$$;

-- Nur die Edge Function (service_role) darf den Voll-Dump ziehen.
revoke execute on function public.sva_backup_dump() from public, anon, authenticated;
grant  execute on function public.sva_backup_dump() to service_role;

comment on function public.sva_backup_dump() is
  'v19-B: Voll-Export aller sva_*/sm_*-Tabellen (ohne Kochsafe) als jsonb. Nur service_role (Edge Function backup).';
