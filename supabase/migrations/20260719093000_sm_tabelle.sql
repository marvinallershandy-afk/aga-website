-- P3 (Admin-Ausbau): Ligatabelle als Cockpit-Hoheit.
--
-- `FussballWidget.tsx` zeigte bisher statische Vorschau-Daten (TABLE_PREVIEW).
-- Diese Tabelle erlaubt eine gepflegte Ligatabelle im Admin (Handeingabe-Maske)
-- und speist über den P1-Build-Fetch (scripts/fetch-content.mjs, liest
-- sm_tabelle) die öffentliche Website.
--
-- ⚠️ QUELLE = GATE-D (offen, NICHT geraten): Woher die Tabellendaten kommen —
--    (a) offizielles DFB-Widget einbetten, (b) n8n-Auslesen von fussball.de,
--    (c) Handeingabe im Admin — entscheidet Marvin. Diese Migration + die
--    Admin-Maske decken den IMMER erlaubten Weg (c) Handeingabe ab und sind
--    zugleich das Ziel-Schema für (a)/(b). Der fussball.de→sm_tabelle-Auslesepfad
--    bleibt bewusst ein offener Schalter (kein n8n-Flow hier verdrahtet).
--
-- Ergebnis-Schreibpfad auf `matches` (kanonisch) NICHT hier — das ist SME Stage 1.
--
-- RLS 1:1 nach sm_*-Muster (nur is_sm_admin). NICHT auf prod anwenden
-- (Builder-Regel: Migrationen als DATEIEN). Idempotent formuliert.

create table if not exists public.sm_tabelle (
  id uuid primary key default gen_random_uuid(),
  saison text,                            -- z. B. '2026/27'
  platz integer not null,
  team text not null,
  spiele integer not null default 0,
  siege integer not null default 0,
  unentschieden integer not null default 0,
  niederlagen integer not null default 0,
  tore integer not null default 0,
  gegentore integer not null default 0,
  -- Tordifferenz als generierte Spalte (immer konsistent, nicht von Hand pflegbar).
  diff integer generated always as (tore - gegentore) stored,
  punkte integer not null default 0,
  -- markiert die eigene Mannschaft (Hervorhebung auf der Website).
  self boolean not null default false,
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  unique (saison, platz)
);
comment on table public.sm_tabelle is
  'Ligatabelle (Cockpit-Hoheit). Quelle = GATE-D (DFB-Widget / n8n / Handeingabe).';
comment on column public.sm_tabelle.diff is 'Tordifferenz, generiert aus tore - gegentore.';
alter table public.sm_tabelle enable row level security;

create policy sm_tabelle_select on public.sm_tabelle for select to authenticated using (public.is_sm_admin());
create policy sm_tabelle_insert on public.sm_tabelle for insert to authenticated with check (public.is_sm_admin());
create policy sm_tabelle_update on public.sm_tabelle for update to authenticated using (public.is_sm_admin());
create policy sm_tabelle_delete on public.sm_tabelle for delete to authenticated using (public.is_sm_admin());
