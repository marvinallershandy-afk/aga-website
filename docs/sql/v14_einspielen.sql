-- ═══════════════════════════════════════════════════════════════
-- SVA v14: ALLE ausstehenden Migrationen in EINEM Lauf (05.10.2026)
-- Supabase Dashboard → SQL Editor → komplett einfügen → Run.
-- Läuft als eine Transaktion: entweder alles oder nichts.
-- Enthält (in dieser Reihenfolge):
--   20260719090000_sm_webhooks.sql
--   20260719091000_sm_grafiken_bucket.sql
--   20260719092000_sm_website_content.sql
--   20260719093000_sm_tabelle.sql
--   20261004100000_sva_vereinspflege.sql
--   20261004101000_sva_web_snapshot.sql
--   20261004102000_sva_security_haertung.sql
-- Bewusst NICHT enthalten: 20260731120000_sm_insights_daily.sql (Social Media, nicht mehr nötig).
-- ═══════════════════════════════════════════════════════════════
begin;

-- ───── 20260719090000_sm_webhooks.sql ─────
-- P2 (Admin-Ausbau): Automationen produktiv machen.
-- Die Automationen-Seite hielt Webhook-URLs bisher NUR in localStorage
-- (pro Gerät, nicht team-weit sichtbar, nicht beobachtbar). Diese Migration
-- hebt sie in die Datenbank: eine Registry `sm_webhooks` (eine Zeile je
-- n8n-Andockpunkt/Event) plus ein Zustell-Log `sm_webhook_deliveries` als
-- Grundgerüst für die Beobachtbarkeit in der Admin-UI (letzter Versand/Status).
--
-- RLS 1:1 nach bestehendem sm_*-Muster (20260708000000_sm_baseline.sql /
-- 20260711020000_sm_insights.sql): nur is_sm_admin() darf lesen/schreiben.
--
-- NICHT auf prod anwenden ohne ausdrückliche Freigabe (Builder-Regel:
-- Migrationen entstehen als DATEIEN). Idempotent formuliert.

-- ── Webhook-Registry (eine Zeile je Event/Andockpunkt) ──────────────────────
create table if not exists public.sm_webhooks (
  id uuid primary key default gen_random_uuid(),
  event text not null unique,            -- z. B. 'beitrag.fertig', 'grafik.gerendert'
  url text,                               -- n8n-Webhook-Ziel (leer = noch nicht verbunden)
  aktiv boolean not null default true,
  letzter_versand timestamptz,            -- Zeitpunkt des letzten Versands (Test o. echt)
  letzter_status text,                    -- 'ok' | 'fehler' | HTTP-Code als Text
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sm_webhooks is
  'Registry der n8n-Andockpunkte je Event. Ersetzt die frühere localStorage-Ablage.';
comment on column public.sm_webhooks.event is
  'Fachlicher Event-Schlüssel, deckt sich mit den Rezepten in Automationen.tsx (HOOKS).';
comment on column public.sm_webhooks.letzter_status is
  'Ergebnis des letzten Versands: no-cors → opake Antwort, daher "ok" = kein Netzwerkfehler.';
alter table public.sm_webhooks enable row level security;

-- ── Zustell-Log (Grundgerüst für die Beobachtbarkeit) ───────────────────────
create table if not exists public.sm_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid references public.sm_webhooks(id) on delete cascade,
  event text not null,
  status text not null,                   -- 'ok' | 'fehler'
  http_code integer,                      -- bei no-cors null (opake Antwort)
  payload_excerpt text,                   -- gekürzter Payload zur Nachvollziehbarkeit
  gesendet_at timestamptz not null default now()
);
comment on table public.sm_webhook_deliveries is
  'Zustell-Log je Versand (Test + echt). Speist die "letzter Versand/Status"-Anzeige im Admin.';
create index if not exists sm_webhook_deliveries_webhook_id_idx
  on public.sm_webhook_deliveries (webhook_id, gesendet_at desc);
alter table public.sm_webhook_deliveries enable row level security;

-- ── Einheitliche Admin-RLS (nur is_sm_admin) ────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['sm_webhooks','sm_webhook_deliveries'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_sm_admin())', t);
  end loop;
end $$;

-- ── Seed der bekannten Andockpunkte (idempotent, URL bleibt leer) ───────────
-- Deckt sich mit den Rezepten in src/admin/pages/Automationen.tsx (HOOKS).
-- 'spiel.angelegt' bewusst als Platzhalter: Trigger-Quelle sm_spiele ist
-- eingefroren (STAGE0 R1) → nach SME Stage 1 auf `matches` INSERT umziehen.
insert into public.sm_webhooks (event)
values
  ('beitrag.fertig'),
  ('spiel.angelegt'),
  ('insights.faellig'),
  ('grafik.gerendert')
on conflict (event) do nothing;

-- ───── 20260719091000_sm_grafiken_bucket.sql ─────
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

-- ───── 20260719092000_sm_website_content.sql ─────
-- P1 (Admin-Ausbau, Copy-Teil): Sektionstexte der öffentlichen Website.
--
-- Unabhängig vom SME-Backfill (Kader/Spiele/Sponsoren) sind die Sektions-Texte
-- (Kicker/Titel/Body je Abschnitt) sofort im Cockpit pflegbar. Diese Tabelle
-- ist die Copy-Quelle; der Build-Fetch (scripts/fetch-content.mjs) liest sie und
-- der Website-Resolver (src/data/content.ts) überschreibt damit — pro Abschnitt
-- und NUR die Textfelder — die statischen Seeds aus src/data/club.ts (SECTIONS).
-- Reihenfolge und Abschnitts-IDs (Kamera-Stationen) bleiben aus dem statischen
-- Seed, damit unvollständige Pflege die 3D-Fahrt nicht bricht.
--
-- RLS 1:1 nach sm_*-Muster (nur is_sm_admin). NICHT auf prod anwenden
-- (Builder-Regel: Migrationen als DATEIEN). Idempotent formuliert.

create table if not exists public.sm_website_content (
  id uuid primary key default gen_random_uuid(),
  -- deckt sich mit Section.id in src/data/club.ts:
  -- 'verein' | 'mannschaft' | 'fanblock' | 'musik' | 'tabelle' | 'sponsoren' | 'kontakt'
  section_key text not null unique,
  label text,
  kicker text,
  titel text,
  body text,
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sm_website_content is
  'Sektionstexte der öffentlichen Website (Copy). Überschreibt beim Build die statischen SECTIONS-Seeds pro Abschnitt.';
alter table public.sm_website_content enable row level security;

create policy sm_website_content_select on public.sm_website_content for select to authenticated using (public.is_sm_admin());
create policy sm_website_content_insert on public.sm_website_content for insert to authenticated with check (public.is_sm_admin());
create policy sm_website_content_update on public.sm_website_content for update to authenticated using (public.is_sm_admin());
create policy sm_website_content_delete on public.sm_website_content for delete to authenticated using (public.is_sm_admin());

-- ───── 20260719093000_sm_tabelle.sql ─────
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

-- ───── 20261004100000_sva_vereinspflege.sql ─────
-- ─────────────────────────────────────────────────────────────────────────────
-- v14-C „Vereins-Pflege": der Admin pflegt ab jetzt die WEBSITE, nicht mehr
-- Social Media. Diese Migration legt das Datenmodell dafür an.
--
-- ENTSCHEIDUNG (begründet): Kader, Spiele, Sponsoren und Tabelle bleiben in
-- den bestehenden Tabellen sm_roster / sm_spiele / sm_sponsoren / sm_tabelle
-- und werden nur ADDITIV erweitert — keine neuen Parallel-Tabellen.
--   1. Eine Quelle der Wahrheit: Die Archiv-Module (Matchday-Grafiken,
--      Spieltagspaket) lesen dieselben Zeilen weiter. Zwei Kader-Tabellen
--      würden früher oder später auseinanderlaufen.
--   2. Bestehende Daten + Fremdschlüssel (sm_content.spiel_id,
--      RPC sm_spieltagspaket) bleiben gültig — kein Backfill, kein Dual-Write.
--   3. Der frühere „Freeze" dieser Tabellen zugunsten der SME-Kanonik
--      (players/matches/sponsors) ist überholt: Social Media ist laut Kunde
--      nicht mehr relevant und die kanonischen Tabellen existieren nicht.
--   4. Die Website liest NIE diese Tabellen, sondern ausschließlich die
--      Funktion web_snapshot() (nächste Migration). Ein späterer Umzug auf
--      andere Tabellen ist damit ein reines Umschreiben dieser Funktion.
-- Neu sind nur Dinge ohne Vorbild: sva_lineup (Aufstellung, append-only =
-- Verlauf bleibt erhalten), sva_settings (Links/Kontakt, genau 1 Zeile),
-- sva_publish_log (Protokoll „Website veröffentlichen") und der öffentliche
-- Storage-Bucket sva_public für Spielerfotos und Sponsorenlogos.
--
-- RLS überall nach dem sm_*-Muster: lesen/schreiben nur is_sm_admin().
-- NICHT automatisch anwenden — Reihenfolge siehe docs/VEREINSPFLEGE.md.
-- Idempotent formuliert (mehrfaches Anwenden schadet nicht).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Kader: sm_roster erweitern ───────────────────────────────────────────
-- slug   = stabile, öffentliche ID (Player.id auf der Website, z. B. 'p-pils').
--          Die Aufstellung auf der Website referenziert Spieler über diese ID.
-- rolle  = 'spieler' oder eine Trainerstab-Rolle (ersetzt position='Trainer/Staff').
alter table public.sm_roster add column if not exists slug text;
alter table public.sm_roster add column if not exists rolle text not null default 'spieler';
alter table public.sm_roster add column if not exists kapitaen boolean not null default false;
alter table public.sm_roster add column if not exists neuzugang boolean not null default false;
alter table public.sm_roster add column if not exists freisteller_url text;
alter table public.sm_roster add column if not exists im_verein_seit integer;
alter table public.sm_roster add column if not exists kontakt_text text;

update public.sm_roster
   set slug = 'r-' || left(replace(id::text, '-', ''), 10)
 where slug is null;
alter table public.sm_roster
  alter column slug set default ('r-' || left(replace(gen_random_uuid()::text, '-', ''), 10));
alter table public.sm_roster alter column slug set not null;
create unique index if not exists sm_roster_slug_key on public.sm_roster (slug);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sm_roster_slug_format') then
    alter table public.sm_roster
      add constraint sm_roster_slug_format check (slug ~ '^[a-z0-9][a-z0-9-]{1,40}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sm_roster_rolle_check') then
    alter table public.sm_roster
      add constraint sm_roster_rolle_check
      check (rolle in ('spieler', 'trainer', 'co-trainer', 'torwart-trainer', 'teammanager'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sm_roster_im_verein_seit_check') then
    alter table public.sm_roster
      add constraint sm_roster_im_verein_seit_check
      check (im_verein_seit is null or im_verein_seit between 1900 and 2100);
  end if;
end $$;

comment on column public.sm_roster.slug is 'Stabile öffentliche ID (Player.id/Staff.id auf der Website). Nicht ändern, sobald veröffentlicht.';
comment on column public.sm_roster.rolle is 'spieler | trainer | co-trainer | torwart-trainer | teammanager';
comment on column public.sm_roster.freisteller_url is 'Freigestelltes Foto (Alpha-WebP). Wird beim Foto-Tausch im Admin geleert.';

-- Alt-Einträge „Trainer/Staff" auf die neue Rolle heben.
update public.sm_roster set rolle = 'trainer'
 where position = 'Trainer/Staff' and rolle = 'spieler';

-- Echter Kader (Stand src/data/players.ts, 11.08.2026) als Startbestand.
-- Alt-Bestand (vor v14) wird beim ERSTEN Lauf inaktiv gesetzt — nicht gelöscht —,
-- damit keine alten Test-/Fantasienamen auf die Website gelangen. Im Admin
-- jederzeit wieder aktivierbar.
update public.sm_roster set aktiv = false
 where slug like 'r-%'
   and not exists (select 1 from public.sm_roster where slug like 'p-%' or slug like 's-%');

insert into public.sm_roster
  (slug, name, nummer, position, rolle, foto_url, freisteller_url, kapitaen, neuzugang, im_verein_seit, kontakt_text, sortierung, aktiv)
values
  ('p-pils',            'Malte Pils',              1,    'TW',  'spieler', '/players/malte-pils.webp',             '/players/cutout/malte-pils.webp',             false, false, null, null,  10, true),
  ('p-ebeling-t',       'Tino Ebeling',            38,   'TW',  'spieler', '/players/tino-ebeling.webp',           '/players/cutout/tino-ebeling.webp',           false, false, null, null,  20, true),
  ('p-huettry',         'Justin Hüttry',           3,    'ABW', 'spieler', '/players/justin-huettry.webp',         '/players/cutout/justin-huettry.webp',         false, false, null, null,  30, true),
  ('p-brettschneider',  'Lennard Brettschneider',  4,    'ABW', 'spieler', '/players/lennard-brettschneider.webp', '/players/cutout/lennard-brettschneider.webp', false, false, null, null,  40, true),
  ('p-sladek',          'Justin Sladek',           11,   'ABW', 'spieler', '/players/justin-sladek.webp',          '/players/cutout/justin-sladek.webp',          false, false, null, null,  50, true),
  ('p-neuber-m',        'Marcel Neuber',           14,   'ABW', 'spieler', '/players/marcel-neuber.webp',          '/players/cutout/marcel-neuber.webp',          false, false, null, null,  60, true),
  ('p-nauerz',          'Noel Nauerz',             15,   'ABW', 'spieler', '/players/noel-nauerz.webp',            '/players/cutout/noel-nauerz.webp',            false, false, null, null,  70, true),
  ('p-neuber-d',        'Dawid Neuber',            21,   'ABW', 'spieler', '/players/dawid-neuber.webp',           '/players/cutout/dawid-neuber.webp',           false, false, null, null,  80, true),
  ('p-marchel',         'Oliver Marchel',          29,   'ABW', 'spieler', '/players/oliver-marchel.webp',         '/players/cutout/oliver-marchel.webp',         false, false, null, null,  90, true),
  ('p-elsen',           'Joshua Elsen',            32,   'ABW', 'spieler', '/players/joshua-elsen.webp',           '/players/cutout/joshua-elsen.webp',           false, false, null, null, 100, true),
  ('p-warkehr-i',       'Isaak Warkehr',           null, 'ABW', 'spieler', '/players/isaak-warkehr.webp',          '/players/cutout/isaak-warkehr.webp',          false, true,  null, null, 110, true),
  ('p-litwitz',         'Lukas-Alexander Litwitz', 5,    'MIT', 'spieler', null,                                   null,                                          false, true,  null, null, 120, true),
  ('p-paruzel',         'Julio Paruzel',           7,    'MIT', 'spieler', '/players/julio-paruzel.webp',          '/players/cutout/julio-paruzel.webp',          false, false, null, null, 130, true),
  ('p-becker',          'Niclas Becker',           8,    'MIT', 'spieler', '/players/niclas-becker.webp',          '/players/cutout/niclas-becker.webp',          false, false, null, null, 140, true),
  ('p-kalwa',           'Justin Kalwa',            13,   'MIT', 'spieler', '/players/justin-kalwa.webp',           '/players/cutout/justin-kalwa.webp',           false, false, null, null, 150, true),
  ('p-jochim',          'Sam Luca Jochim',         17,   'MIT', 'spieler', null,                                   null,                                          false, true,  null, null, 160, true),
  ('p-pejas-n',         'Noah Pejas',              20,   'MIT', 'spieler', '/players/noah-pejas.webp',             '/players/cutout/noah-pejas.webp',             false, false, null, null, 170, true),
  ('p-pejas-e',         'Elias Pejas',             22,   'MIT', 'spieler', '/players/elias-pejas.webp',            '/players/cutout/elias-pejas.webp',            false, false, null, null, 180, true),
  ('p-helck',           'Tobias Helck',            24,   'MIT', 'spieler', '/players/tobias-helck.webp',           '/players/cutout/tobias-helck.webp',           true,  false, null, null, 190, true),
  ('p-bruenjes',        'Janek Brünjes',           33,   'MIT', 'spieler', '/players/janek-bruenjes.webp',         '/players/cutout/janek-bruenjes.webp',         false, false, null, null, 200, true),
  ('p-matthes',         'Paul Matthes',            44,   'MIT', 'spieler', '/players/paul-matthes.webp',           '/players/cutout/paul-matthes.webp',           false, false, null, null, 210, true),
  ('p-warkehr-a',       'Aaron Warkehr',           6,    'ANG', 'spieler', '/players/aaron-warkehr.webp',          '/players/cutout/aaron-warkehr.webp',          false, false, null, null, 220, true),
  ('p-viedts',          'Lennox Viedts',           10,   'ANG', 'spieler', null,                                   null,                                          false, false, null, null, 230, true),
  ('p-biedermann',      'Marc Kevin Biedermann',   37,   'ANG', 'spieler', '/players/marc-kevin-biedermann.webp',  '/players/cutout/marc-kevin-biedermann.webp',  false, true,  null, null, 240, true),
  ('s-junge',           'Carsten Junge',           null, null,  'trainer',     '/players/carsten-junge.webp', '/players/cutout/carsten-junge.webp', false, false, 2016, null, 500, true),
  ('s-ebeling-a',       'Adolf Ebeling',           null, null,  'co-trainer',  '/players/adolf-ebeling.webp', '/players/cutout/adolf-ebeling.webp', false, false, null, null, 510, true),
  ('s-hause',           'Niko Hause',              null, null,  'teammanager', '/players/niko-hause.webp',    '/players/cutout/niko-hause.webp',    false, true,  2018,
     'Hallo Niko! Ich habe eine Frage zum SV Agathenburg-Dollern.', 520, true)
on conflict (slug) do nothing;

-- ── 2. Sponsoren: sm_sponsoren erweitern ────────────────────────────────────
alter table public.sm_sponsoren add column if not exists website_url text;
alter table public.sm_sponsoren add column if not exists bande boolean not null default true;
alter table public.sm_sponsoren add column if not exists sortierung integer not null default 0;
comment on column public.sm_sponsoren.website_url is 'Öffentlicher Link (Website des Sponsors). Nicht verwechseln mit kontakt (intern).';
comment on column public.sm_sponsoren.bande is 'true = Logo erscheint auf der 3D-Bande, false = nur im Sponsoren-Streifen.';

-- ── 3. Aufstellung (append-only: jede Speicherung = neue Zeile) ─────────────
-- Hilfsfunktion für die Prüfregel „keine Doppelten" (Check-Constraints
-- dürfen keine Unterabfragen enthalten, aber IMMUTABLE-Funktionen aufrufen).
create or replace function public.sva_array_distinct(a uuid[])
returns boolean
language sql immutable
set search_path to 'public'
as $$
  select coalesce(cardinality(a), 0) = (select count(distinct x) from unnest(a) as x);
$$;

create table if not exists public.sva_lineup (
  id uuid primary key default gen_random_uuid(),
  formation text not null default '4-4-2'
    check (formation in ('4-4-2', '4-3-3', '4-2-3-1', '3-5-2')),
  -- Slot-Reihenfolge = FORMATION_SLOTS[formation] in src/data/lineup.ts
  startelf uuid[] not null
    check (cardinality(startelf) = 11 and public.sva_array_distinct(startelf)),
  bank uuid[] not null default '{}'
    check (public.sva_array_distinct(bank)),
  spiel_id uuid references public.sm_spiele(id) on delete set null,
  match_label text,
  erstellt_von text default (auth.jwt() ->> 'email'),
  created_at timestamptz not null default now(),
  constraint sva_lineup_kein_doppelter_einsatz check (not (startelf && bank))
);
comment on table public.sva_lineup is
  'Aufstellung (Formation, Startelf, Bank). Append-only: die jüngste Zeile ist die aktuelle, ältere bleiben als Verlauf.';
create index if not exists sva_lineup_created_at_idx on public.sva_lineup (created_at desc);
alter table public.sva_lineup enable row level security;

-- ── 4. Verein & Links (genau eine Zeile) ────────────────────────────────────
create table if not exists public.sva_settings (
  id smallint primary key default 1 check (id = 1),
  fussball_de_team_id text check (fussball_de_team_id is null or fussball_de_team_id ~ '^[A-Z0-9]{20,40}$'),
  fupa_url text check (fupa_url is null or fupa_url ~ '^https://(www\.)?fupa\.net/'),
  instagram text check (instagram is null or instagram ~ '^[A-Za-z0-9._]{1,30}$'),
  -- internationales Format ohne + und ohne führende 0, z. B. 4915112345678
  whatsapp text check (whatsapp is null or whatsapp ~ '^[1-9][0-9]{7,14}$'),
  email text check (email is null or email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  training text,
  adresse text,
  saison text,
  -- Von Hand bestätigt: Impressum + Datenschutz sind vollständig ausgefüllt.
  rechtstexte_ok boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.sva_settings is 'Vereins-Stammdaten und Links für die Website (genau 1 Zeile, id = 1).';
alter table public.sva_settings enable row level security;

-- Startwerte = heutiger Stand aus src/data/club.ts (Website bleibt nach dem
-- ersten Veröffentlichen identisch). WhatsApp bewusst leer: die Dummy-Nummer
-- wird NICHT übernommen — die Übersicht zeigt sie als offene Pflichtinfo.
insert into public.sva_settings (id, fussball_de_team_id, fupa_url, instagram, whatsapp, email, training, adresse, saison)
values (1, '00ES8GN7SS00004CVV0AG08LVUPGND5I', null, 'sva_fussball', null, 'info@aga-erste.de',
        'Di & Do, ab 19:00 Uhr', 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg', '2026/27')
on conflict (id) do nothing;

-- ── 5. Protokoll „Website veröffentlichen" ──────────────────────────────────
create table if not exists public.sva_publish_log (
  id uuid primary key default gen_random_uuid(),
  angefordert_at timestamptz not null default now(),
  angefordert_von text,
  status text not null check (status in ('ok', 'fehler', 'nicht_konfiguriert')),
  detail text
);
comment on table public.sva_publish_log is 'Jeder Klick auf „Website veröffentlichen" (Edge Function publish-site). Append-only.';
create index if not exists sva_publish_log_at_idx on public.sva_publish_log (angefordert_at desc);
alter table public.sva_publish_log enable row level security;

-- ── 6. Einheitliche Admin-RLS ───────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['sva_lineup', 'sva_settings', 'sva_publish_log'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_sm_admin())', t);
  end loop;
end $$;

-- Protokoll und Aufstellungs-Verlauf sind append-only: kein Update/Delete.
drop policy if exists sva_publish_log_update on public.sva_publish_log;
drop policy if exists sva_publish_log_delete on public.sva_publish_log;
drop policy if exists sva_lineup_update on public.sva_lineup;

-- ── 7. Startaufstellung = Seed aus src/data/lineup.ts (Beispiel-Elf) ────────
insert into public.sva_lineup (formation, startelf, bank, match_label, erstellt_von)
select '4-4-2',
       array(select r.id from unnest(array['p-pils','p-sladek','p-brettschneider','p-neuber-m','p-huettry',
                                           'p-kalwa','p-helck','p-becker','p-paruzel','p-warkehr-a','p-biedermann'])
                    with ordinality as s(slug, i)
             join public.sm_roster r on r.slug = s.slug order by s.i),
       array(select r.id from unnest(array['p-ebeling-t','p-nauerz','p-elsen','p-pejas-n','p-pejas-e','p-bruenjes','p-matthes'])
                    with ordinality as s(slug, i)
             join public.sm_roster r on r.slug = s.slug order by s.i),
       null,
       'migration'
 where not exists (select 1 from public.sva_lineup)
   and (select count(*) from public.sm_roster where slug in
        ('p-pils','p-sladek','p-brettschneider','p-neuber-m','p-huettry','p-kalwa','p-helck','p-becker','p-paruzel','p-warkehr-a','p-biedermann')) = 11;

-- ── 8. Öffentlicher Storage-Bucket für Fotos & Logos ────────────────────────
-- public = true: Bilder sind über ihre URL ohne Login abrufbar (die Website
-- lädt sie ohnehin zur BUILD-Zeit herunter, nicht im Browser der Besucher).
-- Bewusst KEINE select-Policy für anon → der Bucket ist nicht auflistbar.
-- Der Admin verkleinert Bilder vor dem Upload (max. ~1 MB), 5 MB ist Puffer.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sva_public', 'sva_public', true, 5242880, array['image/webp', 'image/png', 'image/jpeg'])
on conflict (id) do nothing;

drop policy if exists sva_public_select on storage.objects;
create policy sva_public_select on storage.objects
  for select to authenticated
  using (bucket_id = 'sva_public' and public.is_sm_admin());

drop policy if exists sva_public_insert on storage.objects;
create policy sva_public_insert on storage.objects
  for insert to authenticated
  with check (bucket_id = 'sva_public' and public.is_sm_admin());

drop policy if exists sva_public_update on storage.objects;
create policy sva_public_update on storage.objects
  for update to authenticated
  using (bucket_id = 'sva_public' and public.is_sm_admin());

drop policy if exists sva_public_delete on storage.objects;
create policy sva_public_delete on storage.objects
  for delete to authenticated
  using (bucket_id = 'sva_public' and public.is_sm_admin());

-- ───── 20261004101000_sva_web_snapshot.sql ─────
-- ─────────────────────────────────────────────────────────────────────────────
-- v14-C: Öffentliche Lese-Schicht der Website: web_snapshot().
--
-- Der Website-Build (scripts/fetch-content.mjs) ruft NUR diese Funktion auf —
-- mit dem öffentlichen anon-Key, per RPC. Sie liefert ein einziges JSON mit
-- ausschließlich veröffentlichbaren Feldern:
--   players, staff, lineup, nextMatch, lastMatch, form, table, sponsors,
--   settings, sections
-- NICHT enthalten (bewusst): Notizen, Steckbriefe, Sponsoren-Kontakte/
-- Ansprechpartner/Pakete/Laufzeiten, inaktive Einträge, Admin-E-Mails,
-- das Veröffentlichungs-Protokoll.
--
-- SECURITY DEFINER: läuft mit den Rechten des Eigentümers, damit anon nicht
-- selbst auf die sm_*-Tabellen zugreifen darf (deren RLS bleibt admin-only).
-- search_path ist fixiert (Schutz gegen Search-Path-Hijacking).
--
-- Optionale Tabellen (sm_tabelle, sm_website_content) werden nur gelesen,
-- wenn ihre Migration angewandt ist — sonst bleibt das Feld leer.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.web_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_players  jsonb;
  v_staff    jsonb;
  v_lineup   jsonb;
  v_next     jsonb;
  v_last     jsonb;
  v_form     jsonb;
  v_table    jsonb := '[]'::jsonb;
  v_sponsors jsonb;
  v_settings jsonb;
  v_sections jsonb := '[]'::jsonb;
  v_saison   text;
begin
  -- ── Spieler (aktiv, Rolle spieler) ─────────────────────────────────────────
  select coalesce(jsonb_agg(p.obj order by p.sortierung, p.nummer nulls last, p.name), '[]'::jsonb)
    into v_players
    from (
      select r.sortierung, r.nummer, r.name,
             jsonb_strip_nulls(jsonb_build_object(
               'id',           r.slug,
               'name',         r.name,
               'number',       r.nummer,
               'position',     case upper(coalesce(r.position, ''))
                                 when 'TW' then 'TW' when 'TORWART' then 'TW'
                                 when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
                                 when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
                                 else 'MIT' end,
               'photoUrl',     r.foto_url,
               'cutoutUrl',    r.freisteller_url,
               'isCaptain',    case when r.kapitaen then true end,
               'isNewSigning', case when r.neuzugang then true end,
               'since',        r.im_verein_seit
             )) || jsonb_build_object('number', r.nummer) as obj   -- number explizit (null = ohne Nummer)
        from public.sm_roster r
       where r.aktiv and r.rolle = 'spieler'
    ) p;

  -- ── Trainerstab ────────────────────────────────────────────────────────────
  select coalesce(jsonb_agg(s.obj order by s.sortierung, s.name), '[]'::jsonb)
    into v_staff
    from (
      select r.sortierung, r.name,
             jsonb_strip_nulls(jsonb_build_object(
               'id',             r.slug,
               'name',           r.name,
               'role',           r.rolle,
               'since',          r.im_verein_seit,
               'photoUrl',       r.foto_url,
               'cutoutUrl',      r.freisteller_url,
               'contactMessage', r.kontakt_text,
               'isNewSigning',   case when r.neuzugang then true end
             )) as obj
        from public.sm_roster r
       where r.aktiv and r.rolle <> 'spieler'
    ) s;

  -- ── Aufstellung: jüngste Zeile, IDs → slugs (nur aktive Spieler) ───────────
  select jsonb_build_object(
           'formation',  l.formation,
           'startelf',   coalesce((select jsonb_agg(r.slug order by e.i)
                                     from unnest(l.startelf) with ordinality as e(pid, i)
                                     join public.sm_roster r on r.id = e.pid and r.aktiv and r.rolle = 'spieler'), '[]'::jsonb),
           'bank',       coalesce((select jsonb_agg(r.slug order by e.i)
                                     from unnest(l.bank) with ordinality as e(pid, i)
                                     join public.sm_roster r on r.id = e.pid and r.aktiv and r.rolle = 'spieler'), '[]'::jsonb),
           'matchLabel', nullif(trim(coalesce(l.match_label, '')), ''),
           'updatedAt',  l.created_at
         )
    into v_lineup
    from public.sva_lineup l
   order by l.created_at desc
   limit 1;

  -- ── Nächstes Spiel: frühestes ohne Ergebnis, Anstoß nicht länger als 3 h her
  select jsonb_build_object(
           'opponent',    s.gegner,
           'home',        s.heim,
           'kickoff',     s.anstoss,
           'venue',       s.ort,
           'competition', s.wettbewerb,
           'matchday',    s.spieltag_nr
         )
    into v_next
    from public.sm_spiele s
   where s.anstoss >= now() - interval '3 hours'
     and (s.tore_sva is null or s.tore_gegner is null)
   order by s.anstoss asc
   limit 1;

  -- ── Letztes Spiel: jüngstes mit eingetragenem Ergebnis ─────────────────────
  select jsonb_build_object(
           'opponent',     s.gegner,
           'home',         s.heim,
           'kickoff',      s.anstoss,
           'goalsFor',     s.tore_sva,
           'goalsAgainst', s.tore_gegner
         )
    into v_last
    from public.sm_spiele s
   where s.tore_sva is not null and s.tore_gegner is not null
   order by s.anstoss desc
   limit 1;

  -- ── Form: letzte 5 Ergebnisse, ÄLTESTES zuerst (Vertrag club.ts FORM) ──────
  select coalesce(jsonb_agg(f.res order by f.anstoss asc), '[]'::jsonb)
    into v_form
    from (
      select s.anstoss,
             case when s.tore_sva > s.tore_gegner then 'W'
                  when s.tore_sva = s.tore_gegner then 'U'
                  else 'N' end as res
        from public.sm_spiele s
       where s.tore_sva is not null and s.tore_gegner is not null
       order by s.anstoss desc
       limit 5
    ) f;

  -- ── Sponsoren (aktiv) — ohne Kontakt/Paket/Laufzeit ────────────────────────
  select coalesce(jsonb_agg(x.obj order by x.sortierung, x.name), '[]'::jsonb)
    into v_sponsors
    from (
      select sp.sortierung, sp.name,
             jsonb_strip_nulls(jsonb_build_object(
               'name',    sp.name,
               'logoUrl', sp.logo_url,
               'url',     sp.website_url,
               'bande',   sp.bande
             )) as obj
        from public.sm_sponsoren sp
       where sp.aktiv
    ) x;

  -- ── Verein & Links ─────────────────────────────────────────────────────────
  select jsonb_strip_nulls(jsonb_build_object(
           'fussballDeTeamId', st.fussball_de_team_id,
           'fupaUrl',          st.fupa_url,
           'instagram',        st.instagram,
           'whatsapp',         st.whatsapp,
           'email',            st.email,
           'training',         st.training,
           'address',          st.adresse,
           'saison',           st.saison,
           'updatedAt',        st.updated_at
         )), st.saison
    into v_settings, v_saison
    from public.sva_settings st
   where st.id = 1;

  -- ── Ligatabelle (nur wenn Migration sm_tabelle angewandt ist) ──────────────
  -- Gibt es Zeilen der eingestellten Saison, nur diese; sonst alle.
  if to_regclass('public.sm_tabelle') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
               'pos', t.platz, 'team', t.team, 'sp', t.spiele, 'pkt', t.punkte,
               'w', t.siege, 'd', t.unentschieden, 'l', t.niederlagen,
               'goals', t.tore, 'against', t.gegentore, 'self', t.self
             ) order by t.platz), '[]'::jsonb)
        from public.sm_tabelle t
       where $1 is null
          or not exists (select 1 from public.sm_tabelle x where x.saison = $1)
          or t.saison = $1
    $q$ into v_table using v_saison;
  end if;

  -- ── Sektionstexte (nur wenn Migration sm_website_content angewandt ist) ────
  if to_regclass('public.sm_website_content') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', c.section_key, 'label', c.label, 'kicker', c.kicker,
               'title', c.titel, 'body', c.body
             )) order by c.sortierung), '[]'::jsonb)
        from public.sm_website_content c
       where c.aktiv
    $q$ into v_sections;
  end if;

  return jsonb_build_object(
    'version',     1,
    'generatedAt', now(),
    'players',     v_players,
    'staff',       v_staff,
    'lineup',      v_lineup,
    'nextMatch',   v_next,
    'lastMatch',   v_last,
    'form',        v_form,
    'table',       coalesce(v_table, '[]'::jsonb),
    'sponsors',    v_sponsors,
    'settings',    coalesce(v_settings, '{}'::jsonb),
    'sections',    coalesce(v_sections, '[]'::jsonb)
  );
end;
$$;

comment on function public.web_snapshot() is
  'Öffentlicher, read-only Website-Snapshot (nur veröffentlichbare Felder). Wird vom Netlify-Build per RPC mit dem anon-Key gelesen.';

-- Rechte: erst allen entziehen, dann gezielt freigeben.
revoke all on function public.web_snapshot() from public;
grant execute on function public.web_snapshot() to anon, authenticated, service_role;

-- ───── 20261004102000_sva_security_haertung.sql ─────
-- ─────────────────────────────────────────────────────────────────────────────
-- v14-C: Security-Härtung (Audit v14 §5).
--
-- 20260711030000 hat is_sm_admin() nur „from anon" entzogen. Postgres vergibt
-- EXECUTE auf neue Funktionen aber standardmäßig an PUBLIC — und darüber
-- erreicht anon die Funktion weiterhin. Korrekt ist „from public, anon" plus
-- ein expliziter Grant an die Rollen, die sie wirklich brauchen
-- (authenticated für RLS-Policies, service_role für Wartung).
--
-- WICHTIG: Ohne den Grant an authenticated würden alle RLS-Policies, die
-- is_sm_admin() aufrufen, für eingeloggte Admins fehlschlagen.
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.is_sm_admin() from public, anon;
grant  execute on function public.is_sm_admin() to authenticated, service_role;

-- Admin-RPCs (security invoker, RLS greift ohnehin) — trotzdem nicht für anon.
revoke execute on function public.sm_spieltagspaket(uuid) from public, anon;
grant  execute on function public.sm_spieltagspaket(uuid) to authenticated, service_role;

revoke execute on function public.sm_eingang_into_plan(uuid, date) from public, anon;
grant  execute on function public.sm_eingang_into_plan(uuid, date) to authenticated, service_role;

-- Hilfsfunktion der Aufstellungs-Prüfregel: nur intern gebraucht.
revoke execute on function public.sva_array_distinct(uuid[]) from public, anon;
grant  execute on function public.sva_array_distinct(uuid[]) to authenticated, service_role;

-- web_snapshot() bleibt bewusst für anon ausführbar (öffentliche Lese-Schicht,
-- siehe 20261004101000_sva_web_snapshot.sql).

commit;
