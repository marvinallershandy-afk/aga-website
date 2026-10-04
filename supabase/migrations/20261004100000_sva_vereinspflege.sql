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
