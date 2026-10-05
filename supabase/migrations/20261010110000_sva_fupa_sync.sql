-- ─────────────────────────────────────────────────────────────────────────────
-- v19-B (Paket 1): FuPa-Abgleich — Betrieb ohne Handarbeit.
--
-- Die Edge Function `fupa-sync` holt Spiele (current + past) und die Ligatabelle
-- von der öffentlichen FuPa-API und schreibt sie idempotent nach sm_spiele /
-- sm_tabelle. Diese Migration liefert dafür nur das Drumherum:
--   1. sva_sync_log — Protokoll jedes Abgleichs (append-only, wie sva_publish_log).
--   2. sva_settings.fupa_auto — Schalter „Automatischer Abgleich an/aus".
--
-- Das eigentliche Schreiben macht die Function mit der service_role (umgeht RLS);
-- hier werden keine neuen Schreibpfade für anon/authenticated geöffnet.
--
-- NICHT automatisch anwenden (Builder-Regel: Migrationen als Dateien).
-- Reihenfolge: nach 20261010100000_sva_demo_spiel.sql. Idempotent formuliert.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Schalter „Automatischer Abgleich" ────────────────────────────────────
alter table public.sva_settings
  add column if not exists fupa_auto boolean not null default true;
comment on column public.sva_settings.fupa_auto is
  'v19-B: Automatischer FuPa-Abgleich per Zeitplan an/aus. Der manuelle Knopf „Jetzt abgleichen" läuft unabhängig davon.';

-- ── 2. Protokoll-Tabelle ────────────────────────────────────────────────────
create table if not exists public.sva_sync_log (
  id uuid primary key default gen_random_uuid(),
  zeit timestamptz not null default now(),
  quelle text not null default 'fupa' check (quelle in ('fupa')),
  -- wie ausgelöst: 'auto' (Zeitplan) | 'manuell' (Admin-Knopf)
  ausloeser text not null default 'auto' check (ausloeser in ('auto', 'manuell')),
  -- Ergebnis-Status
  status text not null check (status in ('ok', 'fehler', 'uebersprungen', 'nicht_konfiguriert')),
  -- Zahl der geänderten/neuen Zeilen (Spiele + Tabellenplätze)
  geaendert integer not null default 0,
  -- Fehlertext (nur bei status='fehler')
  fehler text,
  -- Detail-Zählwerte für die Admin-Karte (spiele_neu, spiele_aktualisiert, tabelle, publish …)
  details jsonb not null default '{}'::jsonb,
  angefordert_von text
);
comment on table public.sva_sync_log is
  'v19-B: Protokoll jedes FuPa-Abgleichs (Edge Function fupa-sync). Append-only.';
create index if not exists sva_sync_log_zeit_idx on public.sva_sync_log (zeit desc);
alter table public.sva_sync_log enable row level security;

-- ── 3. RLS: Admin liest, niemand schreibt über den Client ───────────────────
-- Geschrieben wird ausschließlich von der Edge Function mit der service_role
-- (umgeht RLS). anon/authenticated bekommen KEINE insert/update/delete-Policy.
drop policy if exists sva_sync_log_select on public.sva_sync_log;
create policy sva_sync_log_select on public.sva_sync_log
  for select to authenticated using (public.is_sm_admin());

-- Aufräumen: Protokoll auf die letzten 500 Einträge begrenzen (schlanke Tabelle).
create or replace function public.sva_sync_log_pruning()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.sva_sync_log
   where id in (
     select id from public.sva_sync_log order by zeit desc offset 500
   );
  return null;
end;
$$;
revoke execute on function public.sva_sync_log_pruning() from public, anon, authenticated;
grant  execute on function public.sva_sync_log_pruning() to service_role;

drop trigger if exists sva_sync_log_prune on public.sva_sync_log;
create trigger sva_sync_log_prune
  after insert on public.sva_sync_log
  for each statement execute function public.sva_sync_log_pruning();
