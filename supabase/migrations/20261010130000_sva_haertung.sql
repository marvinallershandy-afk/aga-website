-- ─────────────────────────────────────────────────────────────────────────────
-- v19-B (Paket 3): Härtung — Kochsafe-Altlasten + Advisor-Kleinkram.
--
-- Das Supabase-Projekt beherbergt noch das inaktive Projekt „Kochsafe". Dessen
-- SECURITY-DEFINER-RPCs sind für anon UND authenticated ausführbar — anonyme
-- Schreibpfade in fremde Tabellen. Diese Migration entzieht die EXECUTE-Rechte
-- (droppt NICHTS). Dazu zwei billige Advisor-Punkte:
--   · search_path pinnen bei sva_statistik_pfade / sva_demo_position,
--   · sm_admins-Policies konsolidieren + auth.jwt() als (select auth.jwt()).
--
-- Alles mit to_regprocedure()-Wächtern: Funktionen, die es (z. B. in den
-- PGlite-Tests) nicht gibt, werden übersprungen. NICHT automatisch anwenden.
-- Reihenfolge: nach 20261010120000_sva_backup_bucket.sql. Idempotent.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Kochsafe-SECDEF-RPCs: EXECUTE für anon/authenticated/public entziehen ──
do $$
declare
  sig text;
  sigs text[] := array[
    'public.einladungscode_regenerieren(uuid)',
    'public.generiere_einladungscode()',
    'public.haushalt_beitreten(text)',
    'public.haushalt_gruenden(text)',
    'public.is_sme_member()',
    'public.ist_haushalt_mitglied(uuid)',
    'public.rezept_aktualisieren(uuid, jsonb)',
    'public.rezept_speichern(jsonb)',
    'public.wochenplan_status_aktualisieren()'
  ];
begin
  foreach sig in array sigs loop
    if to_regprocedure(sig) is not null then
      execute format('revoke execute on function %s from public, anon, authenticated', sig);
      raise notice 'Kochsafe-RPC gesperrt: %', sig;
    else
      raise notice 'Kochsafe-RPC nicht vorhanden (übersprungen): %', sig;
    end if;
  end loop;
end $$;

-- ── 2. search_path pinnen (Advisor: „function search_path mutable") ──────────
do $$
begin
  if to_regprocedure('public.sva_statistik_pfade()') is not null then
    alter function public.sva_statistik_pfade() set search_path to 'public', 'pg_temp';
  end if;
  if to_regprocedure('public.sva_demo_position(text)') is not null then
    alter function public.sva_demo_position(text) set search_path to 'public', 'pg_temp';
  end if;
end $$;

-- ── 3. sm_admins-Policies konsolidieren ──────────────────────────────────────
-- Vorher: zwei SELECT-Policies (self + admin) → „multiple permissive policies".
-- auth.jwt() direkt → „auth_rls_initplan". Jetzt: EINE SELECT-Policy, auth.jwt()
-- als (select auth.jwt()) (einmal pro Query statt pro Zeile). Verhalten
-- unverändert: Admin sieht alle, jeder sieht sich selbst; niemand ändert/löscht
-- die eigene Zeile (kein Selbst-Aussperren).
drop policy if exists sm_admins_self_select  on public.sm_admins;
drop policy if exists sm_admins_admin_select on public.sm_admins;
drop policy if exists sm_admins_select       on public.sm_admins;
create policy sm_admins_select on public.sm_admins
  for select to authenticated
  using (public.is_sm_admin() or lower(email) = lower(coalesce((select auth.jwt()) ->> 'email', '')));

drop policy if exists sm_admins_admin_update on public.sm_admins;
create policy sm_admins_admin_update on public.sm_admins
  for update to authenticated
  using (public.is_sm_admin() and lower(email) <> lower(coalesce((select auth.jwt()) ->> 'email', '')))
  with check (public.is_sm_admin() and lower(email) <> lower(coalesce((select auth.jwt()) ->> 'email', '')));

drop policy if exists sm_admins_admin_delete on public.sm_admins;
create policy sm_admins_admin_delete on public.sm_admins
  for delete to authenticated
  using (public.is_sm_admin() and lower(email) <> lower(coalesce((select auth.jwt()) ->> 'email', '')));
