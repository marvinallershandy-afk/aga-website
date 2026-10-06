-- ─────────────────────────────────────────────────────────────────────────────
-- v20-T „SVA Tipp-Liga“ + Manager-Teil „Deine Elf“ (Konzept
-- SVA_KONZEPT_FANERLEBNIS.md, Abschnitt 3 + Update B/C/D).
--
-- Was diese Migration tut (alles ADDITIV, nur eigene sva_tipp_*-Objekte;
-- web_snapshot() bleibt UNVERÄNDERT):
--   1. Tabellen
--        sva_tipp_einstellungen  (1 Zeile: aktiv, Partner „präsentiert von“,
--                                 Preise, Story-Code der Woche, Winterpause)
--        sva_tipp_teilnehmer     (Konto = Album-Konto: user_id → sva_album_fans;
--                                 Teilnahmebedingungen, öffentlich sichtbar?,
--                                 Kabine = Spieler-Konto, nur Admin setzt)
--        sva_tipp_spieltage      (je Spiel: tippbar-Schalter, 3 Bonusfragen,
--                                 Zuschauer-Linie, Auflösung, Wertung)
--        sva_tipp_bericht        (Spielbericht je Spieler: Einsatz, Minuten,
--                                 Tore, Vorlagen, Karte, Zu-null)
--        sva_tipp_tipps / sva_tipp_elf (Abgaben der Fans)
--        sva_tipp_punkte         (Ergebnis der Wertung je Konto und Spiel)
--        sva_tipp_ligen / sva_tipp_liga_mitglieder (Stammtisch-Ligen per Code)
--        sva_tipp_abzeichen
--   2. Reine Rechenfunktionen (IMMUTABLE, getestet): Ergebnis-Punkte 4/3/2,
--      Tipp-Punkte inkl. Torschütze/Spieler des Spiels/Bonus/Joker,
--      Spieler-Punkte „Deine Elf“.
--   3. Sperre nach Anpfiff SERVERSEITIG: Trigger auf Tipps/Elf (Tippschluss =
--      Anstoß bzw. früherer Ticker-Anpfiff; Status ≠ geplant = zu).
--      Joker 1× pro Monat: Teil-Unique-Index (user, Monat) where joker.
--      Demo-Spiele NIE tippbar/wertbar; Testspiele nur per Admin-Schalter
--      („Winterwertung“, eigene Rangliste).
--   4. RLS: Fans lesen fremde Tipps/Elfs erst nach Tippschluss; keine direkten
--      Schreibrechte — alles über SECURITY-DEFINER-RPCs (tipp_*).
--   5. Fan-RPCs: tipp_lage, tipp_beitreten, tipp_profil_speichern, tipp_abgeben,
--      tipp_elf_speichern, tipp_rangliste, tipp_duell, tipp_verteilung,
--      tipp_liga_* , tipp_meine_ligen.
--      tipp_abgeben schreibt beim ERSTEN Tipp eines Spieltags 1 Album-Karte
--      gut — über album_karte_gutschreiben('tipp', spiel), FALLS es die RPC
--      gibt (Paket v20-karten; dynamisch, ohne sie läuft alles weiter).
--   6. Admin-RPCs (Team: Spielbericht, Bonusfragen, Werten; Admin: Kabine,
--      Story-Daten): tipp_admin_*.
--   7. Statistik: feste Pfadliste (sva_statistik_pfade) um /tippen,
--      /teilnahmebedingungen und die Tipp-Ereignisse erweitert.
--
-- Konto löschen (/album → album_konto_loeschen): löscht sva_album_fans →
-- per Fremdschlüssel (on delete cascade) auch Teilnahme, Tipps, Elf, Punkte,
-- Liga-Mitgliedschaften und Abzeichen. album_konto_loeschen bleibt unverändert.
--
-- NICHT automatisch anwenden — nach 20261011110000_sva_am_platz.sql.
-- Idempotent formuliert. Lokal getestet: supabase/tests/tippliga.test.mjs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Reine Helfer ─────────────────────────────────────────────────────────
-- Saison eines Anstoßes: ab Juli neue Saison („2026/27“, wie sva_settings.saison).
create or replace function public.sva_tipp_saison_von(p_ts timestamptz)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case when extract(month from (p_ts at time zone 'Europe/Berlin')) >= 7
              then extract(year from (p_ts at time zone 'Europe/Berlin'))::int::text || '/'
                   || lpad(((extract(year from (p_ts at time zone 'Europe/Berlin'))::int + 1) % 100)::text, 2, '0')
              else (extract(year from (p_ts at time zone 'Europe/Berlin'))::int - 1)::text || '/'
                   || lpad((extract(year from (p_ts at time zone 'Europe/Berlin'))::int % 100)::text, 2, '0')
         end;
$$;

-- Monat (Europe/Berlin) eines Anstoßes — Basis für Monatswertung und Joker.
create or replace function public.sva_tipp_monat_von(p_ts timestamptz)
returns date
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select date_trunc('month', p_ts at time zone 'Europe/Berlin')::date;
$$;

-- Pflichtspiel? (wie Kalender: „(TEST)“ im Gegner bzw. Test-/Freundschaftsspiel
-- im Wettbewerb = kein Pflichtspiel; FuPa übernimmt Testspiele gar nicht erst)
create or replace function public.sva_tipp_ist_pflichtspiel(p_gegner text, p_wettbewerb text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select position('(test)' in lower(coalesce(p_gegner, ''))) = 0
     and coalesce(p_wettbewerb, '') !~* '(test|freundschaft)';
$$;

-- Position normalisieren (wie web_live/web_snapshot)
create or replace function public.sva_tipp_pos(p text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case upper(coalesce(p, ''))
           when 'TW' then 'TW' when 'TORWART' then 'TW'
           when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
           when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
           else 'MIT' end;
$$;

-- Bonusfragen-Pool (Schlüssel) und gültige Antworten
create or replace function public.sva_tipp_fragen_pool()
returns text[]
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select array['gelb', 'rot', 'tor20', 'tore_hz1', 'elfmeter', 'zuschauer', 'erstes_tor']::text[];
$$;

create or replace function public.sva_tipp_bonus_ok(p_key text, p_wert text)
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case p_key
           when 'gelb'       then p_wert in ('0', '1-2', '3+')
           when 'rot'        then p_wert in ('ja', 'nein')
           when 'tor20'      then p_wert in ('ja', 'nein')
           when 'tore_hz1'   then p_wert in ('0', '1', '2+')
           when 'elfmeter'   then p_wert in ('ja', 'nein')
           when 'zuschauer'  then p_wert in ('ueber', 'unter')
           when 'erstes_tor' then p_wert in ('sva', 'gegner', 'niemand')
           else false end;
$$;

-- genau 3 verschiedene Fragen aus dem Pool
create or replace function public.sva_tipp_fragen_ok(p text[])
returns boolean
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(cardinality(p), 0) = 3
     and p <@ public.sva_tipp_fragen_pool()
     and (select count(distinct x) from unnest(p) x) = 3;
$$;

-- ── 1. Tabellen ─────────────────────────────────────────────────────────────
create table if not exists public.sva_tipp_einstellungen (
  id smallint primary key default 1 check (id = 1),
  -- false = Tipp-Liga pausiert (Abgaben werden freundlich abgelehnt)
  aktiv boolean not null default true,
  -- „Tipp-Liga präsentiert von …“ (leer = unsichtbar)
  partner_id uuid references public.sm_sponsoren(id) on delete set null,
  -- optionale Preise (Freitext, z. B. „Spieltagssieger: Getränk am Stand“)
  preise text check (preise is null or char_length(preise) <= 300),
  -- Sa-Story „Noch nicht getippt?“: optionaler Story-Code der Woche (Einlösung im Album)
  story_code text check (story_code is null or story_code ~ '^[A-Za-z0-9-]{3,24}$'),
  -- „Deine Elf“: freie Aufstellung erlaubt (sonst nur 1 TW/ABW · 2 MIT · 2 ANG)
  elf_frei boolean not null default true,
  -- Winterpause (MM-TT, Europe/Berlin)
  winter_von text not null default '11-15' check (winter_von ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  winter_bis text not null default '03-14' check (winter_bis ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'),
  updated_at timestamptz not null default now(),
  updated_by text default (auth.jwt() ->> 'email')
);
comment on table public.sva_tipp_einstellungen is 'v20-T Tipp-Liga: Einstellungen (genau 1 Zeile). Lesen/Schreiben nur Admin; öffentlich über tipp_lage().';
insert into public.sva_tipp_einstellungen (id) values (1) on conflict (id) do nothing;
alter table public.sva_tipp_einstellungen enable row level security;

-- Teilnahme: dasselbe Konto wie das Sammelalbum (Vorname + Initial in sva_album_fans)
create table if not exists public.sva_tipp_teilnehmer (
  user_id uuid primary key references public.sva_album_fans(user_id) on delete cascade,
  bedingungen_at timestamptz not null default now(),
  -- freiwillig: in öffentlichen Ranglisten als „Vorname I.“ zeigen
  sichtbar boolean not null default false,
  -- Spieler-Konto („Kabine“) — setzt nur der Admin
  kabine boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sva_tipp_teilnehmer is 'v20-T: Teilnahme an der Tipp-Liga (Album-Konto). sichtbar = Name in öffentlichen Ranglisten; kabine = Spieler-Konto (Admin).';
alter table public.sva_tipp_teilnehmer enable row level security;

create table if not exists public.sva_tipp_spieltage (
  spiel_id uuid primary key references public.sm_spiele(id) on delete cascade,
  -- null = automatisch (Pflichtspiel ja, Testspiel nein); true = auch Testspiel
  -- („Winterwertung“); false = dieses Spiel nicht tippen
  tippbar boolean,
  -- genau 3 Bonusfragen aus dem Pool; null = automatischer Vorschlag
  fragen text[] check (fragen is null or public.sva_tipp_fragen_ok(fragen)),
  zuschauer_linie integer check (zuschauer_linie is null or zuschauer_linie between 0 and 5000),
  -- Auflösung der Bonusfragen {schluessel: antwort}
  aufloesung jsonb not null default '{}'::jsonb,
  -- erster SVA-Torschütze (null = kein SVA-Tor bzw. Eigentor)
  erster_torschuetze uuid references public.sm_roster(id) on delete set null,
  bericht_at timestamptz,
  bericht_von text,
  gewertet_at timestamptz,
  gewertet_von text,
  updated_at timestamptz not null default now()
);
comment on table public.sva_tipp_spieltage is 'v20-T: Tipp-Daten je Spiel (Bonusfragen, Auflösung, Wertung). Schreiben nur über tipp_admin_*.';
alter table public.sva_tipp_spieltage enable row level security;

create table if not exists public.sva_tipp_bericht (
  spiel_id uuid not null references public.sm_spiele(id) on delete cascade,
  roster_id uuid not null references public.sm_roster(id) on delete cascade,
  eingesetzt boolean not null default true,
  minuten integer check (minuten is null or minuten between 0 and 130),
  tore integer not null default 0 check (tore between 0 and 15),
  vorlagen integer not null default 0 check (vorlagen between 0 and 15),
  karte text check (karte is null or karte in ('gelb', 'gelbrot', 'rot')),
  zu_null boolean not null default false,
  primary key (spiel_id, roster_id)
);
comment on table public.sva_tipp_bericht is 'v20-T: Spielbericht je Spieler (Basis für „Deine Elf“). Admin/Team über tipp_admin_bericht_speichern.';
alter table public.sva_tipp_bericht enable row level security;

create table if not exists public.sva_tipp_tipps (
  user_id uuid not null references public.sva_tipp_teilnehmer(user_id) on delete cascade,
  spiel_id uuid not null references public.sm_spiele(id) on delete cascade,
  tore_sva integer not null check (tore_sva between 0 and 20),
  tore_gegner integer not null check (tore_gegner between 0 and 20),
  erster_torschuetze uuid references public.sm_roster(id) on delete set null,
  motm uuid references public.sm_roster(id) on delete set null,
  joker boolean not null default false,
  -- vom Trigger gesetzt (Monat des Anstoßes) → Joker-Limit per Unique-Index
  joker_monat date,
  bonus jsonb not null default '{}'::jsonb check (jsonb_typeof(bonus) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, spiel_id)
);
comment on table public.sva_tipp_tipps is 'v20-T: Ergebnis-Tipp + Bonusfragen je Konto und Spiel. Abgabe nur bis Anpfiff (Trigger), fremde Tipps erst danach lesbar (RLS).';
create unique index if not exists sva_tipp_joker_einmal_pro_monat on public.sva_tipp_tipps (user_id, joker_monat) where joker;
create index if not exists sva_tipp_tipps_spiel_idx on public.sva_tipp_tipps (spiel_id);
alter table public.sva_tipp_tipps enable row level security;

create table if not exists public.sva_tipp_elf (
  user_id uuid not null references public.sva_tipp_teilnehmer(user_id) on delete cascade,
  spiel_id uuid not null references public.sm_spiele(id) on delete cascade,
  -- Reihenfolge = Plätze: [TW/ABW, MIT, MIT, ANG, ANG] (bzw. frei)
  spieler uuid[] not null check (cardinality(spieler) = 5 and public.sva_array_distinct(spieler)),
  kapitaen uuid not null,
  frei boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, spiel_id),
  constraint sva_tipp_elf_kapitaen_in_elf check (kapitaen = any (spieler))
);
comment on table public.sva_tipp_elf is 'v20-T: „Deine Elf“ (5 Spieler + Kapitän) je Konto und Spiel. Abgabe nur bis Anpfiff.';
create index if not exists sva_tipp_elf_spiel_idx on public.sva_tipp_elf (spiel_id);
alter table public.sva_tipp_elf enable row level security;

create table if not exists public.sva_tipp_punkte (
  user_id uuid not null references public.sva_tipp_teilnehmer(user_id) on delete cascade,
  spiel_id uuid not null references public.sm_spiele(id) on delete cascade,
  wertung text not null check (wertung in ('saison', 'winter')),
  saison text not null,
  monat date not null,
  anstoss timestamptz not null,
  tipp integer not null default 0,   -- Teil A vor Joker
  elf integer not null default 0,    -- Teil B
  joker boolean not null default false,
  gesamt integer not null default 0,
  exakt boolean not null default false,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  primary key (user_id, spiel_id)
);
comment on table public.sva_tipp_punkte is 'v20-T: Punkte je Konto und gewertetem Spiel (Neuberechnung = löschen + neu).';
create index if not exists sva_tipp_punkte_saison_idx on public.sva_tipp_punkte (saison, wertung);
create index if not exists sva_tipp_punkte_monat_idx on public.sva_tipp_punkte (monat);
create index if not exists sva_tipp_punkte_spiel_idx on public.sva_tipp_punkte (spiel_id);
alter table public.sva_tipp_punkte enable row level security;

create table if not exists public.sva_tipp_ligen (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 3 and 40),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{6}$'),
  gruender uuid references public.sva_tipp_teilnehmer(user_id) on delete set null,
  created_at timestamptz not null default now()
);
comment on table public.sva_tipp_ligen is 'v20-T: Stammtisch-Ligen (privat, Beitritt per 6-stelligem Code).';
alter table public.sva_tipp_ligen enable row level security;

create table if not exists public.sva_tipp_liga_mitglieder (
  liga_id uuid not null references public.sva_tipp_ligen(id) on delete cascade,
  user_id uuid not null references public.sva_tipp_teilnehmer(user_id) on delete cascade,
  beigetreten_at timestamptz not null default now(),
  primary key (liga_id, user_id)
);
create index if not exists sva_tipp_liga_mitglieder_user_idx on public.sva_tipp_liga_mitglieder (user_id);
alter table public.sva_tipp_liga_mitglieder enable row level security;

create table if not exists public.sva_tipp_abzeichen (
  user_id uuid not null references public.sva_tipp_teilnehmer(user_id) on delete cascade,
  abzeichen text not null check (abzeichen in (
    'erster_tipp', 'hellseher', 'treuer_tipper', 'kartenexperte', 'kapitaensgriff',
    'volltreffer', 'jokerkoenig', 'torriecher', 'spieltagssieger', 'stammtisch')),
  erreicht_at timestamptz not null default now(),
  primary key (user_id, abzeichen)
);
comment on table public.sva_tipp_abzeichen is 'v20-T: verdiente Abzeichen (bleiben, einmal verdient).';
alter table public.sva_tipp_abzeichen enable row level security;

-- ── 2. RLS ──────────────────────────────────────────────────────────────────
-- Admin-Lesen/Pflege über Policies; Fans haben KEINE Schreibrechte (nur RPCs).
drop policy if exists sva_tipp_einstellungen_select on public.sva_tipp_einstellungen;
create policy sva_tipp_einstellungen_select on public.sva_tipp_einstellungen for select to authenticated using (public.is_sm_admin());
drop policy if exists sva_tipp_einstellungen_update on public.sva_tipp_einstellungen;
create policy sva_tipp_einstellungen_update on public.sva_tipp_einstellungen for update to authenticated
  using (public.is_sm_admin()) with check (public.is_sm_admin());

drop policy if exists sva_tipp_teilnehmer_select on public.sva_tipp_teilnehmer;
create policy sva_tipp_teilnehmer_select on public.sva_tipp_teilnehmer for select to authenticated
  using (user_id = auth.uid() or public.is_sm_admin());

drop policy if exists sva_tipp_spieltage_select on public.sva_tipp_spieltage;
create policy sva_tipp_spieltage_select on public.sva_tipp_spieltage for select to authenticated using (public.is_sva_team());
drop policy if exists sva_tipp_bericht_select on public.sva_tipp_bericht;
create policy sva_tipp_bericht_select on public.sva_tipp_bericht for select to authenticated using (public.is_sva_team());

drop policy if exists sva_tipp_punkte_select on public.sva_tipp_punkte;
create policy sva_tipp_punkte_select on public.sva_tipp_punkte for select to authenticated
  using (user_id = auth.uid() or public.is_sm_admin());
drop policy if exists sva_tipp_abzeichen_select on public.sva_tipp_abzeichen;
create policy sva_tipp_abzeichen_select on public.sva_tipp_abzeichen for select to authenticated
  using (user_id = auth.uid() or public.is_sm_admin());
drop policy if exists sva_tipp_ligen_select on public.sva_tipp_ligen;
create policy sva_tipp_ligen_select on public.sva_tipp_ligen for select to authenticated
  using (public.is_sm_admin() or exists (select 1 from public.sva_tipp_liga_mitglieder m where m.liga_id = id and m.user_id = auth.uid()));
drop policy if exists sva_tipp_liga_mitglieder_select on public.sva_tipp_liga_mitglieder;
create policy sva_tipp_liga_mitglieder_select on public.sva_tipp_liga_mitglieder for select to authenticated
  using (user_id = auth.uid() or public.is_sm_admin());

-- Tippschluss erreicht? (für RLS „fremde Tipps erst nach Anpfiff“)
create or replace function public.sva_tipp_offen(p_spiel uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((
    select s.status = 'geplant' and s.anpfiff_at is null and now() < s.anstoss
      from public.sm_spiele s where s.id = p_spiel), false);
$$;
comment on function public.sva_tipp_offen(uuid) is 'v20-T: true, solange getippt werden darf (vor Anstoß, Ticker noch nicht angepfiffen).';

drop policy if exists sva_tipp_tipps_select on public.sva_tipp_tipps;
create policy sva_tipp_tipps_select on public.sva_tipp_tipps for select to authenticated
  using (user_id = auth.uid() or not public.sva_tipp_offen(spiel_id));
drop policy if exists sva_tipp_elf_select on public.sva_tipp_elf;
create policy sva_tipp_elf_select on public.sva_tipp_elf for select to authenticated
  using (user_id = auth.uid() or not public.sva_tipp_offen(spiel_id));

-- Direkte Schreibrechte entziehen (Supabase-Default gibt sie neuen Tabellen)
revoke insert, update, delete on public.sva_tipp_teilnehmer, public.sva_tipp_spieltage, public.sva_tipp_bericht,
  public.sva_tipp_tipps, public.sva_tipp_elf, public.sva_tipp_punkte, public.sva_tipp_ligen,
  public.sva_tipp_liga_mitglieder, public.sva_tipp_abzeichen
  from anon, authenticated;
revoke insert, delete on public.sva_tipp_einstellungen from anon, authenticated;
revoke all on public.sva_tipp_einstellungen, public.sva_tipp_teilnehmer, public.sva_tipp_spieltage, public.sva_tipp_bericht,
  public.sva_tipp_tipps, public.sva_tipp_elf, public.sva_tipp_punkte, public.sva_tipp_ligen,
  public.sva_tipp_liga_mitglieder, public.sva_tipp_abzeichen
  from anon;
grant select on public.sva_tipp_einstellungen, public.sva_tipp_teilnehmer, public.sva_tipp_spieltage, public.sva_tipp_bericht,
  public.sva_tipp_tipps, public.sva_tipp_elf, public.sva_tipp_punkte, public.sva_tipp_ligen,
  public.sva_tipp_liga_mitglieder, public.sva_tipp_abzeichen
  to authenticated;
grant update on public.sva_tipp_einstellungen to authenticated;

-- ── 3. Spiel-Helfer ─────────────────────────────────────────────────────────
-- Wertung eines Spiels: 'saison' (Pflichtspiel), 'winter' (Testspiel mit
-- Admin-Schalter), null = nicht tippbar (Vorführ-Spiel NIE).
create or replace function public.sva_tipp_wertung(p_spiel uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select case
           when s.demo then null
           when t.tippbar is false then null
           when public.sva_tipp_ist_pflichtspiel(s.gegner, s.wettbewerb) then 'saison'
           when t.tippbar is true then 'winter'
           else null
         end
    from public.sm_spiele s
    left join public.sva_tipp_spieltage t on t.spiel_id = s.id
   where s.id = p_spiel;
$$;

create or replace function public.sva_tipp_schluss(p_spiel uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select least(s.anstoss, coalesce(s.anpfiff_at, s.anstoss)) from public.sm_spiele s where s.id = p_spiel;
$$;

-- Automatischer Fragen-Vorschlag: 3 aus dem Pool, deterministisch je Spiel
-- (wechselt von Spiel zu Spiel); „Zuschauer“ nur bei Heimspielen (Check-ins).
create or replace function public.sva_tipp_fragen_vorschlag(p_spiel uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select array(
    select k from unnest(public.sva_tipp_fragen_pool()) k
     where k <> 'zuschauer' or coalesce((select s.heim from public.sm_spiele s where s.id = p_spiel), false)
     order by md5(p_spiel::text || k)
     limit 3);
$$;

create or replace function public.sva_tipp_fragen(p_spiel uuid)
returns text[]
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((select t.fragen from public.sva_tipp_spieltage t where t.spiel_id = p_spiel),
                  public.sva_tipp_fragen_vorschlag(p_spiel));
$$;

-- Zuschauer-Linie: gepflegt oder Ø der Album-Check-ins der letzten 5 Heimspiele
-- (auf 5 gerundet, mindestens 20; ohne Daten 50).
create or replace function public.sva_tipp_zuschauer_linie(p_spiel uuid)
returns integer
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v integer;
  v_schnitt numeric;
begin
  select t.zuschauer_linie into v from public.sva_tipp_spieltage t where t.spiel_id = p_spiel;
  if v is not null then return v; end if;
  select avg(x.n) into v_schnitt from (
    select count(c.id) as n
      from public.sm_spiele s
      join public.sva_album_checkins c on c.spiel_id = s.id
     where s.heim and not s.demo and s.id <> p_spiel
       and s.anstoss < (select s2.anstoss from public.sm_spiele s2 where s2.id = p_spiel)
     group by s.id, s.anstoss
     order by s.anstoss desc
     limit 5) x;
  if v_schnitt is null then return 50; end if;
  return greatest(20, (round(v_schnitt / 5) * 5)::int);
end;
$$;

-- Erster SVA-Torschütze aus dem Ticker (null = kein Tor / Eigentor ohne Schütze)
create or replace function public.sva_tipp_erster_auto(p_spiel uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select t.roster_id from public.sva_ticker t
   where t.spiel_id = p_spiel and t.typ = 'tor'
   order by t.zeitpunkt, t.created_at limit 1;
$$;

-- Automatische Auflösung der Bonusfragen (Ticker, Bericht, Check-ins).
-- Nur, was sich sicher ableiten lässt; der Admin bestätigt/ändert im Spielbericht.
create or replace function public.sva_tipp_aufloesung_auto(p_spiel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_ticker boolean;
  v_r jsonb := '{}'::jsonb;
  v_n integer;
  v_hz timestamptz;
  v_erstes text;
  v_bericht boolean;
begin
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null then return v_r; end if;
  v_ticker := exists (select 1 from public.sva_ticker t where t.spiel_id = p_spiel and t.typ = 'abpfiff');
  v_bericht := exists (select 1 from public.sva_tipp_bericht b where b.spiel_id = p_spiel);

  -- Gelbe Karten SVA
  if v_ticker then
    select count(*) into v_n from public.sva_ticker t where t.spiel_id = p_spiel and t.typ = 'gelb' and t.roster_id is not null;
  elsif v_bericht then
    select count(*) into v_n from public.sva_tipp_bericht b where b.spiel_id = p_spiel and b.karte in ('gelb', 'gelbrot');
  else
    v_n := null;
  end if;
  if v_n is not null then
    v_r := v_r || jsonb_build_object('gelb', case when v_n = 0 then '0' when v_n <= 2 then '1-2' else '3+' end);
  end if;

  if v_ticker then
    -- Rote Karte (beide Teams, inkl. Gelb-Rot)
    v_r := v_r || jsonb_build_object('rot', case when exists (select 1 from public.sva_ticker t where t.spiel_id = p_spiel and t.typ in ('rot', 'gelbrot')) then 'ja' else 'nein' end);
    -- Tor vor der 20. Minute (beide Teams)
    v_r := v_r || jsonb_build_object('tor20', case when exists (select 1 from public.sva_ticker t where t.spiel_id = p_spiel and t.typ in ('tor', 'gegentor') and coalesce(t.minute, 99) < 20) then 'ja' else 'nein' end);
    -- Tore 1. Halbzeit
    select min(t.zeitpunkt) into v_hz from public.sva_ticker t where t.spiel_id = p_spiel and t.typ = 'halbzeit';
    select count(*) into v_n from public.sva_ticker t
     where t.spiel_id = p_spiel and t.typ in ('tor', 'gegentor')
       and (case when v_hz is not null then t.zeitpunkt <= v_hz else coalesce(t.minute, 99) <= 45 end);
    v_r := v_r || jsonb_build_object('tore_hz1', case when v_n = 0 then '0' when v_n = 1 then '1' else '2+' end);
    -- Elfmeter
    v_r := v_r || jsonb_build_object('elfmeter', case when exists (
             select 1 from public.sva_ticker t where t.spiel_id = p_spiel
                and (t.typ = 'elfmeter' or coalesce(t.text, '') ~* '(elfmeter|strafsto)')) then 'ja' else 'nein' end);
    -- Wer trifft zuerst
    select t.typ into v_erstes from public.sva_ticker t
     where t.spiel_id = p_spiel and t.typ in ('tor', 'gegentor') order by t.zeitpunkt, t.created_at limit 1;
    v_r := v_r || jsonb_build_object('erstes_tor', case v_erstes when 'tor' then 'sva' when 'gegentor' then 'gegner' else 'niemand' end);
  elsif v_s.tore_sva is not null and v_s.tore_gegner is not null then
    -- ohne Ticker: nur Eindeutiges aus dem Ergebnis
    if v_s.tore_sva = 0 and v_s.tore_gegner = 0 then
      v_r := v_r || jsonb_build_object('erstes_tor', 'niemand', 'tor20', 'nein', 'tore_hz1', '0');
    elsif v_s.tore_gegner = 0 then
      v_r := v_r || jsonb_build_object('erstes_tor', 'sva');
    elsif v_s.tore_sva = 0 then
      v_r := v_r || jsonb_build_object('erstes_tor', 'gegner');
    end if;
    if v_bericht and exists (select 1 from public.sva_tipp_bericht b where b.spiel_id = p_spiel and b.karte in ('rot', 'gelbrot')) then
      v_r := v_r || jsonb_build_object('rot', 'ja');
    end if;
  end if;

  -- Zuschauer über/unter Linie (Album-Check-ins; nur Heimspiele)
  if v_s.heim then
    select count(*) into v_n from public.sva_album_checkins c where c.spiel_id = p_spiel;
    if v_n > 0 or v_s.status = 'beendet' then
      v_r := v_r || jsonb_build_object('zuschauer', case when v_n > public.sva_tipp_zuschauer_linie(p_spiel) then 'ueber' else 'unter' end);
    end if;
  end if;
  return v_r;
end;
$$;

-- ── 4. Reine Punkte-Rechnung (IMMUTABLE) ───────────────────────────────────
-- Ergebnis-Tipp: exakt 4 · Tordifferenz 3 · Tendenz 2 · sonst 0
create or replace function public.sva_tipp_ergebnis_punkte(p_tipp_sva integer, p_tipp_geg integer, p_sva integer, p_geg integer)
returns integer
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case
           when p_tipp_sva is null or p_tipp_geg is null or p_sva is null or p_geg is null then 0
           when p_tipp_sva = p_sva and p_tipp_geg = p_geg then 4
           when p_tipp_sva - p_tipp_geg = p_sva - p_geg then 3
           when sign(p_tipp_sva - p_tipp_geg) = sign(p_sva - p_geg) then 2
           else 0
         end;
$$;

-- Teil A komplett. Joker verdoppelt Teil A (Ergebnis, Torschütze, Spieler des
-- Spiels, Bonusfragen). Antwort: Aufschlüsselung als jsonb.
create or replace function public.sva_tipp_tipp_punkte(
  p_tipp_sva integer, p_tipp_geg integer, p_erster uuid, p_motm uuid, p_joker boolean, p_bonus jsonb, p_fragen text[],
  p_sva integer, p_geg integer, p_ist_erster uuid, p_ist_motm uuid, p_aufloesung jsonb)
returns jsonb
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $$
declare
  v_erg integer := public.sva_tipp_ergebnis_punkte(p_tipp_sva, p_tipp_geg, p_sva, p_geg);
  v_tor integer := case when p_erster is not null and p_erster = p_ist_erster then 3 else 0 end;
  v_motm integer := case when p_motm is not null and p_motm = p_ist_motm then 2 else 0 end;
  v_bonus jsonb := '{}'::jsonb;
  v_b integer := 0;
  v_richtig integer := 0;
  k text;
  v_summe integer;
begin
  if p_tipp_sva is null then
    return jsonb_build_object('ergebnis', 0, 'art', 'kein', 'torschuetze', 0, 'motm', 0, 'bonus', '{}'::jsonb,
                              'bonusSumme', 0, 'bonusRichtig', 0, 'summe', 0, 'joker', false, 'gesamt', 0);
  end if;
  foreach k in array coalesce(p_fragen, '{}'::text[]) loop
    if coalesce(p_aufloesung ->> k, '') <> '' then
      if coalesce(p_bonus ->> k, '') = p_aufloesung ->> k then
        v_bonus := v_bonus || jsonb_build_object(k, 1);
        v_b := v_b + 1;
        v_richtig := v_richtig + 1;
      else
        v_bonus := v_bonus || jsonb_build_object(k, 0);
      end if;
    end if;
  end loop;
  v_summe := v_erg + v_tor + v_motm + v_b;
  return jsonb_build_object(
    'ergebnis', v_erg,
    'art', case v_erg when 4 then 'exakt' when 3 then 'differenz' when 2 then 'tendenz' else 'daneben' end,
    'torschuetze', v_tor,
    'motm', v_motm,
    'bonus', v_bonus,
    'bonusSumme', v_b,
    'bonusRichtig', v_richtig,
    'summe', v_summe,
    'joker', coalesce(p_joker, false),
    'gesamt', case when coalesce(p_joker, false) then v_summe * 2 else v_summe end);
end;
$$;

-- „Deine Elf“: Punkte EINES Spielers (ohne Kapitäns-Faktor).
-- Einsatz +1 · Tor +5 · Vorlage +3 · Zu-null (TW/ABW, ≥ 60 Min.) +4 ·
-- Spieler des Spiels +5 · Sieg (eingesetzt) +2 · Gelb −1 / Gelb-Rot −3 / Rot −4.
create or replace function public.sva_tipp_spieler_punkte(
  p_eingesetzt boolean, p_tore integer, p_vorlagen integer, p_zu_null boolean, p_position text,
  p_minuten integer, p_karte text, p_motm boolean, p_sieg boolean)
returns jsonb
language plpgsql
immutable
set search_path to 'public', 'pg_temp'
as $$
declare
  v_posten jsonb := '[]'::jsonb;
  v_p integer := 0;
  v_pos text := public.sva_tipp_pos(p_position);
begin
  if not coalesce(p_eingesetzt, false) then
    return jsonb_build_object('punkte', 0, 'posten', '[]'::jsonb, 'eingesetzt', false);
  end if;
  v_posten := v_posten || jsonb_build_array(jsonb_build_object('k', 'einsatz', 'p', 1));
  v_p := 1;
  if coalesce(p_tore, 0) > 0 then
    v_posten := v_posten || jsonb_build_array(jsonb_build_object('k', 'tor', 'n', p_tore, 'p', 5 * p_tore));
    v_p := v_p + 5 * p_tore;
  end if;
  if coalesce(p_vorlagen, 0) > 0 then
    v_posten := v_posten || jsonb_build_array(jsonb_build_object('k', 'vorlage', 'n', p_vorlagen, 'p', 3 * p_vorlagen));
    v_p := v_p + 3 * p_vorlagen;
  end if;
  if coalesce(p_zu_null, false) and v_pos in ('TW', 'ABW') and coalesce(p_minuten, 90) >= 60 then
    v_posten := v_posten || jsonb_build_array(jsonb_build_object('k', 'zunull', 'p', 4));
    v_p := v_p + 4;
  end if;
  if coalesce(p_motm, false) then
    v_posten := v_posten || jsonb_build_array(jsonb_build_object('k', 'motm', 'p', 5));
    v_p := v_p + 5;
  end if;
  if coalesce(p_sieg, false) then
    v_posten := v_posten || jsonb_build_array(jsonb_build_object('k', 'sieg', 'p', 2));
    v_p := v_p + 2;
  end if;
  if p_karte = 'gelb' then
    v_posten := v_posten || jsonb_build_array(jsonb_build_object('k', 'gelb', 'p', -1));
    v_p := v_p - 1;
  elsif p_karte = 'gelbrot' then
    v_posten := v_posten || jsonb_build_array(jsonb_build_object('k', 'gelbrot', 'p', -3));
    v_p := v_p - 3;
  elsif p_karte = 'rot' then
    v_posten := v_posten || jsonb_build_array(jsonb_build_object('k', 'rot', 'p', -4));
    v_p := v_p - 4;
  end if;
  return jsonb_build_object('punkte', v_p, 'posten', v_posten, 'eingesetzt', true);
end;
$$;

-- ── 5. Sperre nach Anpfiff + Joker-Monat (Trigger) ──────────────────────────
create or replace function public.sva_tipp_abgabe_waechter()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
begin
  -- Fremdschlüssel-Aktionen (Spieler gelöscht → set null) laufen verschachtelt
  -- und dürfen nach Anpfiff weiter durch.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    return new;
  end if;
  select * into v_s from public.sm_spiele where id = new.spiel_id;
  if v_s.id is null then
    raise exception 'tipp_spiel_unbekannt' using errcode = 'P0001';
  end if;
  if public.sva_tipp_wertung(new.spiel_id) is null then
    raise exception 'tipp_nicht_tippbar' using errcode = 'P0001';
  end if;
  if not public.sva_tipp_offen(new.spiel_id) then
    raise exception 'tipp_geschlossen' using errcode = 'P0001';
  end if;
  if tg_table_name = 'sva_tipp_tipps' then
    new.joker_monat := public.sva_tipp_monat_von(v_s.anstoss);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists sva_tipp_tipps_waechter on public.sva_tipp_tipps;
create trigger sva_tipp_tipps_waechter
  before insert or update on public.sva_tipp_tipps
  for each row execute function public.sva_tipp_abgabe_waechter();
drop trigger if exists sva_tipp_elf_waechter on public.sva_tipp_elf;
create trigger sva_tipp_elf_waechter
  before insert or update on public.sva_tipp_elf
  for each row execute function public.sva_tipp_abgabe_waechter();

-- ── 6. Interne Bausteine ────────────────────────────────────────────────────
create or replace function public.sva_tipp_uid()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'tipp_nicht_angemeldet' using errcode = '28000';
  end if;
  return v;
end;
$$;

create or replace function public.sva_tipp_team_pruefen()
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_sva_team() then
    raise exception 'tipp_kein_team' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.sva_tipp_admin_pruefen()
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_sm_admin() then
    raise exception 'tipp_kein_admin' using errcode = '42501';
  end if;
end;
$$;

create or replace function public.sva_tipp_slug(p_roster uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select r.slug from public.sm_roster r where r.id = p_roster;
$$;

-- slug → roster-id (nur aktive Spieler); null bei leerem slug, Fehler bei unbekanntem
create or replace function public.sva_tipp_roster(p_slug text)
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v uuid;
begin
  if p_slug is null or btrim(p_slug) = '' then return null; end if;
  select r.id into v from public.sm_roster r where r.slug = p_slug and r.aktiv and r.rolle = 'spieler';
  if v is null then
    raise exception 'tipp_spieler_unbekannt' using errcode = '22023';
  end if;
  return v;
end;
$$;

create or replace function public.sva_tipp_name(p_user uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select f.vorname || ' ' || f.initial || '.' from public.sva_album_fans f where f.user_id = p_user;
$$;

create or replace function public.sva_tipp_liga_code()
returns text
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v text;
  i int;
begin
  for i in 1 .. 20 loop
    v := (select string_agg(substr(a, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.sva_tipp_ligen l where l.code = v);
  end loop;
  return v;
end;
$$;

-- Kader für „Deine Elf“ / Torschützen-Auswahl: aktive Spieler + Saison-Zahlen
-- (nur Spiele/Tore — keine Bewertungen).
create or replace function public.sva_tipp_kader_json()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with st as (
    select b.roster_id,
           count(*) filter (where b.eingesetzt)::int as spiele,
           coalesce(sum(b.tore), 0)::int as tore
      from public.sva_tipp_bericht b
      join public.sm_spiele s on s.id = b.spiel_id
      join public.sva_tipp_spieltage t on t.spiel_id = s.id and t.gewertet_at is not null
     where public.sva_tipp_saison_von(s.anstoss) = public.sva_tipp_saison_von(now())
       and not s.demo
     group by b.roster_id
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', r.slug, 'name', r.name, 'nummer', r.nummer, 'position', public.sva_tipp_pos(r.position),
           'fotoUrl', r.foto_url, 'cutoutUrl', r.freisteller_url,
           'kapitaen', case when r.kapitaen then true end,
           'spiele', coalesce(st.spiele, 0), 'tore', coalesce(st.tore, 0)))
         order by r.sortierung, r.nummer nulls last, r.name), '[]'::jsonb)
    from public.sm_roster r
    left join st on st.roster_id = r.id
   where r.aktiv and r.rolle = 'spieler';
$$;

-- Ein Spiel für die Fan-Ansicht (inkl. eigener Abgaben, wenn eingeloggt)
create or replace function public.sva_tipp_spiel_json(p_spiel uuid, p_uid uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_t public.sva_tipp_spieltage;
  v_tipp public.sva_tipp_tipps;
  v_elf public.sva_tipp_elf;
  v_p public.sva_tipp_punkte;
  v_fragen text[];
  v_status text;
  v_offen boolean;
  v_gewertet boolean;
begin
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null then return null; end if;
  select * into v_t from public.sva_tipp_spieltage where spiel_id = p_spiel;
  v_fragen := public.sva_tipp_fragen(p_spiel);
  v_offen := public.sva_tipp_offen(p_spiel);
  v_gewertet := v_t.gewertet_at is not null;
  v_status := case when v_s.status in ('live', 'halbzeit') then v_s.status
                   when v_s.status = 'beendet' or (v_s.tore_sva is not null and v_s.tore_gegner is not null) then 'beendet'
                   else 'geplant' end;
  if p_uid is not null then
    select * into v_tipp from public.sva_tipp_tipps where spiel_id = p_spiel and user_id = p_uid;
    select * into v_elf from public.sva_tipp_elf where spiel_id = p_spiel and user_id = p_uid;
    select * into v_p from public.sva_tipp_punkte where spiel_id = p_spiel and user_id = p_uid;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'id', v_s.id,
    'gegner', v_s.gegner,
    'heim', v_s.heim,
    'anstoss', v_s.anstoss,
    'schluss', public.sva_tipp_schluss(p_spiel),
    'offen', v_offen,
    'wettbewerb', nullif(btrim(coalesce(v_s.wettbewerb, '')), ''),
    'spieltag', v_s.spieltag_nr,
    'ort', v_s.ort,
    'status', v_status,
    'wertung', public.sva_tipp_wertung(p_spiel),
    'toreSva', case when v_status = 'beendet' then coalesce(v_s.tore_sva, v_s.live_tore_sva)
                    when v_status in ('live', 'halbzeit') then v_s.live_tore_sva end,
    'toreGegner', case when v_status = 'beendet' then coalesce(v_s.tore_gegner, v_s.live_tore_gegner)
                       when v_status in ('live', 'halbzeit') then v_s.live_tore_gegner end,
    'fragen', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                  'key', k,
                  'linie', case when k = 'zuschauer' then public.sva_tipp_zuschauer_linie(p_spiel) end)) order by i)
                 from unnest(v_fragen) with ordinality as f(k, i)),
    'anzahlTipps', (select count(*) from public.sva_tipp_tipps x where x.spiel_id = p_spiel),
    'gewertetAt', v_t.gewertet_at,
    'aufloesung', case when v_gewertet then v_t.aufloesung end,
    'motm', case when v_gewertet or v_status = 'beendet' then public.sva_tipp_slug(v_s.motm_roster_id) end,
    'ersterTorschuetze', case when v_gewertet then public.sva_tipp_slug(v_t.erster_torschuetze) end,
    'meinTipp', case when v_tipp.user_id is not null then jsonb_strip_nulls(jsonb_build_object(
                  'toreSva', v_tipp.tore_sva, 'toreGegner', v_tipp.tore_gegner,
                  'ersterTorschuetze', public.sva_tipp_slug(v_tipp.erster_torschuetze),
                  'motm', public.sva_tipp_slug(v_tipp.motm),
                  'joker', v_tipp.joker, 'bonus', v_tipp.bonus, 'at', v_tipp.updated_at)) end,
    'meineElf', case when v_elf.user_id is not null then jsonb_build_object(
                  'spieler', (select jsonb_agg(public.sva_tipp_slug(x) order by i) from unnest(v_elf.spieler) with ordinality as e(x, i)),
                  'kapitaen', public.sva_tipp_slug(v_elf.kapitaen),
                  'frei', v_elf.frei) end,
    'meinePunkte', case when v_p.user_id is not null then jsonb_build_object(
                  'tipp', v_p.tipp, 'elf', v_p.elf, 'joker', v_p.joker, 'gesamt', v_p.gesamt,
                  'exakt', v_p.exakt, 'details', v_p.details) end
  ));
end;
$$;

-- Abzeichen prüfen (nur hinzufügen — einmal verdient, bleibt verdient)
create or replace function public.sva_tipp_abzeichen_pruefen(p_user uuid)
returns text[]
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_neu text[] := '{}';
  v_kand text[] := '{}';
  v_serie integer;
  k text;
begin
  if p_user is null then return v_neu; end if;
  if exists (select 1 from public.sva_tipp_tipps t where t.user_id = p_user) then
    v_kand := v_kand || 'erster_tipp'::text;
  end if;
  if (select count(*) from public.sva_tipp_punkte p where p.user_id = p_user and p.exakt) >= 3 then
    v_kand := v_kand || 'hellseher'::text;
  end if;
  -- 10 gewertete Spieltage am Stück getippt
  select coalesce(max(n), 0) into v_serie from (
    select count(*) as n from (
      select g.spiel_id, g.hat,
             row_number() over (order by g.anstoss) - row_number() over (partition by g.hat order by g.anstoss) as grp
        from (
          select t.spiel_id, s.anstoss,
                 exists (select 1 from public.sva_tipp_tipps x where x.spiel_id = t.spiel_id and x.user_id = p_user) as hat
            from public.sva_tipp_spieltage t
            join public.sm_spiele s on s.id = t.spiel_id
           where t.gewertet_at is not null and not s.demo
        ) g
    ) z where z.hat group by z.grp
  ) q;
  if v_serie >= 10 then v_kand := v_kand || 'treuer_tipper'::text; end if;
  if (select count(*) from public.sva_tipp_punkte p, jsonb_each_text(coalesce(p.details -> 'tipp' -> 'bonus', '{}'::jsonb)) b
       where p.user_id = p_user and b.key in ('gelb', 'rot') and b.value = '1') >= 5 then
    v_kand := v_kand || 'kartenexperte'::text;
  end if;
  if exists (select 1 from public.sva_tipp_punkte p where p.user_id = p_user and coalesce((p.details ->> 'kapitaenPunkte')::int, 0) >= 10) then
    v_kand := v_kand || 'kapitaensgriff'::text;
  end if;
  if exists (select 1 from public.sva_tipp_punkte p where p.user_id = p_user and p.exakt
               and coalesce((p.details -> 'tipp' ->> 'bonusRichtig')::int, 0) >= 3) then
    v_kand := v_kand || 'volltreffer'::text;
  end if;
  if exists (select 1 from public.sva_tipp_punkte p where p.user_id = p_user and p.exakt and p.joker) then
    v_kand := v_kand || 'jokerkoenig'::text;
  end if;
  if (select count(*) from public.sva_tipp_punkte p where p.user_id = p_user and coalesce((p.details -> 'tipp' ->> 'torschuetze')::int, 0) > 0) >= 3 then
    v_kand := v_kand || 'torriecher'::text;
  end if;
  if exists (select 1 from public.sva_tipp_punkte p
              where p.user_id = p_user and p.gesamt > 0
                and p.gesamt = (select max(q.gesamt) from public.sva_tipp_punkte q where q.spiel_id = p.spiel_id)) then
    v_kand := v_kand || 'spieltagssieger'::text;
  end if;
  if exists (select 1 from public.sva_tipp_liga_mitglieder m where m.user_id = p_user
               and (select count(*) from public.sva_tipp_liga_mitglieder m2 where m2.liga_id = m.liga_id) >= 5) then
    v_kand := v_kand || 'stammtisch'::text;
  end if;
  foreach k in array v_kand loop
    insert into public.sva_tipp_abzeichen (user_id, abzeichen) values (p_user, k)
    on conflict do nothing;
    if found then v_neu := v_neu || k; end if;
  end loop;
  return v_neu;
end;
$$;

-- Album-Mission auslösen (Paket v20-karten), falls die RPC existiert.
-- Bevorzugt album_ziel_ausloesen(ziel, bezug, user). Gibt es nur die
-- 2-Parameter-Fassung (wirkt auf auth.uid()), wird die Sitzung für den Aufruf
-- transaktionslokal auf den Fan gesetzt und danach wiederhergestellt.
-- Fehler im Album-Modul verhindern NIE die Wertung.
create or replace function public.sva_tipp_album_ziel(p_ziel text, p_spiel uuid, p_user uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_alt text;
begin
  if p_user is null then return false; end if;
  if to_regprocedure('public.album_ziel_ausloesen(text,uuid,uuid)') is not null then
    begin
      execute 'select public.album_ziel_ausloesen($1, $2, $3)' using p_ziel, p_spiel, p_user;
      return true;
    exception when others then
      return false;
    end;
  elsif to_regprocedure('public.album_ziel_ausloesen(text,uuid)') is not null then
    v_alt := current_setting('request.jwt.claims', true);
    begin
      perform set_config('request.jwt.claims', jsonb_build_object('sub', p_user, 'role', 'authenticated')::text, true);
      execute 'select public.album_ziel_ausloesen($1, $2)' using p_ziel, p_spiel;
      perform set_config('request.jwt.claims', coalesce(v_alt, ''), true);
      return true;
    exception when others then
      perform set_config('request.jwt.claims', coalesce(v_alt, ''), true);
      return false;
    end;
  end if;
  return false;
end;
$$;

-- Punkte-Zeilen im Ranglisten-Bereich (Art + Kreis)
create or replace function public.sva_tipp_scope(p_art text, p_spiel uuid, p_monat date, p_saison text, p_liga uuid, p_ich uuid)
returns table (user_id uuid, spiel_id uuid, gesamt integer, exakt boolean, anstoss timestamptz)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  -- Anstoß aus sm_spiele (aktuell, auch wenn das Spiel nach dem Werten verlegt wurde)
  select p.user_id, p.spiel_id, p.gesamt, p.exakt, s.anstoss
    from public.sva_tipp_punkte p
    join public.sm_spiele s on s.id = p.spiel_id
   where case p_art
           when 'spieltag' then p.spiel_id = p_spiel
           when 'monat'    then p.monat = p_monat
           when 'saison'   then p.saison = p_saison and p.wertung = 'saison'
           when 'winter'   then p.saison = p_saison and p.wertung = 'winter'
           else false end
     and exists (
       select 1 from public.sva_tipp_teilnehmer t
        where t.user_id = p.user_id
          and case when p_liga is not null
                   then exists (select 1 from public.sva_tipp_liga_mitglieder m where m.liga_id = p_liga and m.user_id = t.user_id)
                   else (t.sichtbar or t.user_id = p_ich) end);
$$;

-- Rangliste (intern). p_art: spieltag | monat | saison | winter.
-- Kreis: Liga-Mitglieder ODER öffentlich sichtbare Teilnehmer (+ man selbst).
create or replace function public.sva_tipp_rang(p_art text, p_spiel uuid, p_monat date, p_saison text, p_liga uuid, p_ich uuid, p_limit integer default 50)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_latest uuid;
  v_eintraege jsonb;
  v_ich jsonb;
  v_n integer;
  v_schnitt numeric;
begin
  if p_art <> 'spieltag' then
    select s.spiel_id into v_latest from public.sva_tipp_scope(p_art, p_spiel, p_monat, p_saison, p_liga, p_ich) s order by s.anstoss desc limit 1;
  end if;

  with sc as (
    select * from public.sva_tipp_scope(p_art, p_spiel, p_monat, p_saison, p_liga, p_ich)
  ), jetzt as (
    select s.user_id, sum(s.gesamt)::int as pkt, count(*) filter (where s.exakt)::int as exakt, count(*)::int as spiele
      from sc s group by s.user_id
  ), vorher as (
    select s.user_id, sum(s.gesamt)::int as pkt, count(*) filter (where s.exakt)::int as exakt
      from sc s where v_latest is not null and s.spiel_id <> v_latest group by s.user_id
  ), r1 as (
    select j.*, rank() over (order by j.pkt desc, j.exakt desc) as platz from jetzt j
  ), r0 as (
    select v.user_id, rank() over (order by v.pkt desc, v.exakt desc) as platz from vorher v
  ), alle as (
    select r1.user_id, r1.platz, r1.pkt, r1.exakt, r1.spiele,
           case when v_latest is null then null when r0.platz is null then null else (r0.platz - r1.platz)::int end as trend,
           (v_latest is not null and r0.user_id is null and p_art <> 'spieltag') as neu,
           t.kabine, public.sva_tipp_name(r1.user_id) as name
      from r1
      left join r0 on r0.user_id = r1.user_id
      join public.sva_tipp_teilnehmer t on t.user_id = r1.user_id
  )
  select coalesce((select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'platz', a.platz, 'name', a.name, 'punkte', a.pkt, 'exakt', a.exakt, 'spiele', a.spiele,
            'trend', a.trend, 'neu', case when a.neu then true end,
            'kabine', case when a.kabine then true end,
            'ich', case when a.user_id = p_ich then true end)) order by a.platz, a.name)
           from (select * from alle order by platz, name limit greatest(1, least(coalesce(p_limit, 50), 200))) a), '[]'::jsonb),
         (select jsonb_strip_nulls(jsonb_build_object('platz', a.platz, 'name', a.name, 'punkte', a.pkt, 'exakt', a.exakt,
            'spiele', a.spiele, 'trend', a.trend, 'kabine', case when a.kabine then true end, 'ich', true))
            from alle a where a.user_id = p_ich),
         (select count(*) from alle)::int,
         (select round(avg(a.pkt), 1) from alle a)
    into v_eintraege, v_ich, v_n, v_schnitt;

  return jsonb_strip_nulls(jsonb_build_object(
    'art', p_art,
    'spielId', p_spiel,
    'monat', case when p_monat is not null then to_char(p_monat, 'YYYY-MM') end,
    'saison', p_saison,
    'eintraege', v_eintraege,
    'ich', v_ich,
    'teilnehmer', v_n,
    'schnitt', v_schnitt));
end;
$$;

-- Fans vs. Kabine (Schnitt pro Spieltag-Teilnahme)
create or replace function public.sva_tipp_duell_json(p_spiel uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with sp as (
    select coalesce(p_spiel, (select t.spiel_id from public.sva_tipp_spieltage t join public.sm_spiele s on s.id = t.spiel_id
                                where t.gewertet_at is not null and not s.demo order by s.anstoss desc limit 1)) as id
  ), x as (
    select p.*, t.kabine, t.sichtbar from public.sva_tipp_punkte p join public.sva_tipp_teilnehmer t on t.user_id = p.user_id
  )
  select jsonb_strip_nulls(jsonb_build_object(
    'spieltag', (select jsonb_strip_nulls(jsonb_build_object(
                   'spielId', s.id, 'gegner', s.gegner, 'heim', s.heim, 'anstoss', s.anstoss,
                   'fans', (select round(avg(x.gesamt), 1) from x where x.spiel_id = s.id and not x.kabine),
                   'kabine', (select round(avg(x.gesamt), 1) from x where x.spiel_id = s.id and x.kabine),
                   'nFans', (select count(*) from x where x.spiel_id = s.id and not x.kabine),
                   'nKabine', (select count(*) from x where x.spiel_id = s.id and x.kabine)))
                   from public.sm_spiele s where s.id = (select id from sp)),
    'saison', jsonb_strip_nulls(jsonb_build_object(
                   'saison', public.sva_tipp_saison_von(now()),
                   'fans', (select round(avg(x.gesamt), 1) from x where x.saison = public.sva_tipp_saison_von(now()) and x.wertung = 'saison' and not x.kabine),
                   'kabine', (select round(avg(x.gesamt), 1) from x where x.saison = public.sva_tipp_saison_von(now()) and x.wertung = 'saison' and x.kabine),
                   'nFans', (select count(distinct x.user_id) from x where x.saison = public.sva_tipp_saison_von(now()) and x.wertung = 'saison' and not x.kabine),
                   'nKabine', (select count(distinct x.user_id) from x where x.saison = public.sva_tipp_saison_von(now()) and x.wertung = 'saison' and x.kabine))),
    -- nur Positives: bester Kabinen-Tipper der Saison (nur wenn öffentlich sichtbar)
    'kabineBester', (select jsonb_build_object('name', public.sva_tipp_name(y.user_id), 'punkte', y.pkt)
                       from (select x.user_id, sum(x.gesamt)::int pkt from x
                              where x.kabine and x.sichtbar and x.saison = public.sva_tipp_saison_von(now()) and x.wertung = 'saison'
                              group by x.user_id order by 2 desc limit 1) y where y.pkt > 0)
  ));
$$;

create or replace function public.sva_tipp_winterpause(p_ts timestamptz)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_e public.sva_tipp_einstellungen;
  v_md text := to_char(p_ts at time zone 'Europe/Berlin', 'MM-DD');
  v_jahr int := extract(year from (p_ts at time zone 'Europe/Berlin'))::int;
  v_aktiv boolean;
  v_bis date;
begin
  select * into v_e from public.sva_tipp_einstellungen where id = 1;
  v_e.winter_von := coalesce(v_e.winter_von, '11-15');
  v_e.winter_bis := coalesce(v_e.winter_bis, '03-14');
  v_aktiv := v_md >= v_e.winter_von or v_md <= v_e.winter_bis;
  v_bis := to_date(case when v_md >= v_e.winter_von then v_jahr + 1 else v_jahr end || '-' || v_e.winter_bis, 'YYYY-MM-DD');
  return jsonb_build_object('aktiv', v_aktiv, 'bis', v_bis, 'von', v_e.winter_von);
end;
$$;

-- ── 7. Öffentlich / Fan: Lage ───────────────────────────────────────────────
create or replace function public.tipp_lage()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_e public.sva_tipp_einstellungen;
  v_offen uuid;
  v_gesperrt uuid;
  v_gewertet uuid;
  v_fan public.sva_album_fans;
  v_t public.sva_tipp_teilnehmer;
  v_ich jsonb;
  v_partner jsonb;
  v_letzte jsonb;
  v_monat date;
  v_saison text := public.sva_tipp_saison_von(now());
begin
  select * into v_e from public.sva_tipp_einstellungen where id = 1;

  select s.id into v_offen from public.sm_spiele s
   where not s.demo and public.sva_tipp_wertung(s.id) is not null and public.sva_tipp_offen(s.id)
   order by s.anstoss asc limit 1;
  select s.id into v_gesperrt from public.sm_spiele s
    left join public.sva_tipp_spieltage t on t.spiel_id = s.id
   where not s.demo and public.sva_tipp_wertung(s.id) is not null and not public.sva_tipp_offen(s.id)
     and t.gewertet_at is null and s.anstoss > now() - interval '7 days'
   order by s.anstoss desc limit 1;
  select s.id into v_gewertet from public.sm_spiele s
    join public.sva_tipp_spieltage t on t.spiel_id = s.id
   where not s.demo and t.gewertet_at is not null
   order by s.anstoss desc limit 1;

  if v_e.partner_id is not null then
    select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url))
      into v_partner from public.sm_sponsoren sp where sp.id = v_e.partner_id and sp.aktiv;
  end if;

  if v_uid is not null then
    select * into v_fan from public.sva_album_fans where user_id = v_uid;
    select * into v_t from public.sva_tipp_teilnehmer where user_id = v_uid;
    if v_offen is not null then
      v_monat := public.sva_tipp_monat_von((select s.anstoss from public.sm_spiele s where s.id = v_offen));
    end if;
    -- letzte eigene Elf (Vorbelegung → Tipp in 20 Sekunden)
    select jsonb_build_object(
             'spieler', (select jsonb_agg(public.sva_tipp_slug(x) order by i) from unnest(e.spieler) with ordinality as z(x, i)),
             'kapitaen', public.sva_tipp_slug(e.kapitaen), 'frei', e.frei)
      into v_letzte
      from public.sva_tipp_elf e join public.sm_spiele s on s.id = e.spiel_id
     where e.user_id = v_uid order by s.anstoss desc limit 1;

    v_ich := jsonb_strip_nulls(jsonb_build_object(
      'email', auth.jwt() ->> 'email',
      'profil', case when v_fan.user_id is not null then jsonb_build_object(
                  'vorname', v_fan.vorname, 'initial', v_fan.initial,
                  'anzeigename', v_fan.vorname || ' ' || v_fan.initial || '.') end,
      'teilnehmer', case when v_t.user_id is not null then jsonb_build_object(
                  'sichtbar', v_t.sichtbar, 'kabine', v_t.kabine, 'seit', v_t.created_at) end,
      'jokerFrei', case when v_monat is not null then not exists (
                  select 1 from public.sva_tipp_tipps x where x.user_id = v_uid and x.joker
                     and x.joker_monat = v_monat and x.spiel_id <> v_offen) end,
      'abzeichen', coalesce((select jsonb_agg(jsonb_build_object('key', a.abzeichen, 'at', a.erreicht_at) order by a.erreicht_at)
                     from public.sva_tipp_abzeichen a where a.user_id = v_uid), '[]'::jsonb),
      'statistik', (select jsonb_build_object(
                     'punkte', coalesce(sum(p.gesamt), 0), 'spieltage', count(*),
                     'exakt', count(*) filter (where p.exakt), 'beste', coalesce(max(p.gesamt), 0))
                     from public.sva_tipp_punkte p where p.user_id = v_uid and p.saison = v_saison and p.wertung = 'saison'),
      'tippsGesamt', (select count(*) from public.sva_tipp_tipps x where x.user_id = v_uid),
      'letzteElf', v_letzte,
      'ligen', (select count(*) from public.sva_tipp_liga_mitglieder m where m.user_id = v_uid)
    ));
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'version', 1,
    'serverNow', now(),
    'saison', v_saison,
    'einstellungen', jsonb_strip_nulls(jsonb_build_object(
        'aktiv', coalesce(v_e.aktiv, true),
        'partner', v_partner,
        'preise', nullif(btrim(coalesce(v_e.preise, '')), ''),
        'elfFrei', coalesce(v_e.elf_frei, true),
        'winterpause', public.sva_tipp_winterpause(now()))),
    'offen', public.sva_tipp_spiel_json(v_offen, v_uid),
    'gesperrt', public.sva_tipp_spiel_json(v_gesperrt, v_uid),
    'gewertet', public.sva_tipp_spiel_json(v_gewertet, v_uid),
    'kader', public.sva_tipp_kader_json(),
    'ich', v_ich
  ));
end;
$$;
comment on function public.tipp_lage() is 'v20-T: Tipp-Liga-Lage für /tippen (anon + eingeloggt): offenes/gesperrtes/gewertetes Spiel, Kader, eigene Abgaben.';

-- ── 8. Fan: Teilnahme + Profil ──────────────────────────────────────────────
create or replace function public.tipp_beitreten(
  p_vorname text, p_initial text, p_sichtbar boolean default false,
  p_bedingungen boolean default false, p_einwilligung boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
begin
  if coalesce(p_bedingungen, false) is not true then
    raise exception 'tipp_bedingungen_fehlen' using errcode = '22023';
  end if;
  -- gemeinsames Konto: gibt es noch kein Album-Profil, legt die Tipp-Liga es an
  -- (mit derselben Prüfung + Einwilligung wie das Album)
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    if coalesce(p_einwilligung, false) is not true then
      raise exception 'tipp_einwilligung_fehlt' using errcode = '22023';
    end if;
    perform public.album_profil_speichern(p_vorname, p_initial, false, false, true);
  end if;
  insert into public.sva_tipp_teilnehmer (user_id, sichtbar)
  values (v_uid, coalesce(p_sichtbar, false))
  on conflict (user_id) do update set sichtbar = excluded.sichtbar, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.tipp_profil_speichern(p_vorname text, p_initial text, p_sichtbar boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_f public.sva_album_fans;
begin
  select * into v_f from public.sva_album_fans where user_id = v_uid;
  if v_f.user_id is null or not exists (select 1 from public.sva_tipp_teilnehmer t where t.user_id = v_uid) then
    raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001';
  end if;
  perform public.album_profil_speichern(p_vorname, p_initial, v_f.rangliste, v_f.erinnerung, true);
  update public.sva_tipp_teilnehmer set sichtbar = coalesce(p_sichtbar, false), updated_at = now() where user_id = v_uid;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 9. Fan: Tipp abgeben ────────────────────────────────────────────────────
create or replace function public.tipp_abgeben(
  p_spiel uuid, p_tore_sva integer, p_tore_gegner integer,
  p_erster text default null, p_motm text default null,
  p_joker boolean default false, p_bonus jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_e public.sva_tipp_einstellungen;
  v_s public.sm_spiele;
  v_fragen text[];
  v_bonus jsonb := '{}'::jsonb;
  k text;
  v text;
  v_neu boolean;
  v_karte boolean := false;
  v_res text;
  v_abz text[];
begin
  select * into v_e from public.sva_tipp_einstellungen where id = 1;
  if not coalesce(v_e.aktiv, true) then
    raise exception 'tipp_pausiert' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.sva_tipp_teilnehmer t where t.user_id = v_uid) then
    raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001';
  end if;
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null then raise exception 'tipp_spiel_unbekannt' using errcode = 'P0001'; end if;
  if public.sva_tipp_wertung(p_spiel) is null then raise exception 'tipp_nicht_tippbar' using errcode = 'P0001'; end if;
  if not public.sva_tipp_offen(p_spiel) then raise exception 'tipp_geschlossen' using errcode = 'P0001'; end if;
  if p_tore_sva is null or p_tore_gegner is null or p_tore_sva not between 0 and 20 or p_tore_gegner not between 0 and 20 then
    raise exception 'tipp_ungueltig:ergebnis' using errcode = '22023';
  end if;

  -- Bonus: nur die 3 Fragen dieses Spiels, nur gültige Antworten
  v_fragen := public.sva_tipp_fragen(p_spiel);
  if p_bonus is not null and jsonb_typeof(p_bonus) = 'object' then
    for k, v in select key, value from jsonb_each_text(p_bonus) loop
      if not (k = any (v_fragen)) or not public.sva_tipp_bonus_ok(k, v) then
        raise exception 'tipp_ungueltig:bonus' using errcode = '22023';
      end if;
      v_bonus := v_bonus || jsonb_build_object(k, v);
    end loop;
  end if;

  -- Joker: 1× pro Monat (Index + freundliche Meldung)
  perform pg_advisory_xact_lock(hashtext('sva_tipp_joker:' || v_uid::text));
  if coalesce(p_joker, false) and exists (
       select 1 from public.sva_tipp_tipps x
        where x.user_id = v_uid and x.joker and x.spiel_id <> p_spiel
          and x.joker_monat = public.sva_tipp_monat_von(v_s.anstoss)) then
    raise exception 'tipp_joker_verbraucht' using errcode = 'P0001';
  end if;

  v_neu := not exists (select 1 from public.sva_tipp_tipps x where x.user_id = v_uid and x.spiel_id = p_spiel);
  insert into public.sva_tipp_tipps (user_id, spiel_id, tore_sva, tore_gegner, erster_torschuetze, motm, joker, bonus)
  values (v_uid, p_spiel, p_tore_sva, p_tore_gegner, public.sva_tipp_roster(p_erster), public.sva_tipp_roster(p_motm),
          coalesce(p_joker, false), v_bonus)
  on conflict (user_id, spiel_id) do update
     set tore_sva = excluded.tore_sva, tore_gegner = excluded.tore_gegner,
         erster_torschuetze = excluded.erster_torschuetze, motm = excluded.motm,
         joker = excluded.joker, bonus = excluded.bonus;

  -- Erster Tipp dieses Spieltags → 1 Album-Karte (Paket v20-karten), falls vorhanden.
  if v_neu and to_regprocedure('public.album_karte_gutschreiben(text,uuid)') is not null then
    begin
      execute 'select public.album_karte_gutschreiben($1, $2)::text' into v_res using 'tipp', p_spiel;
      v_karte := coalesce(v_res, '') not in ('', 'false', 'null') and v_res !~ '"ok"\s*:\s*false';
    exception when others then
      v_karte := false; -- die Karte darf den Tipp nie verhindern
    end;
  end if;

  v_abz := public.sva_tipp_abzeichen_pruefen(v_uid);
  return jsonb_build_object('ok', true, 'neu', v_neu, 'karte', v_karte, 'abzeichen', to_jsonb(v_abz),
                            'anzahlTipps', (select count(*) from public.sva_tipp_tipps x where x.spiel_id = p_spiel));
end;
$$;

-- ── 10. Fan: Deine Elf ──────────────────────────────────────────────────────
create or replace function public.tipp_elf_speichern(p_spiel uuid, p_spieler text[], p_kapitaen text, p_frei boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_e public.sva_tipp_einstellungen;
  v_ids uuid[] := '{}';
  v_pos text[] := '{}';
  v_k uuid;
  s text;
  v_id uuid;
begin
  select * into v_e from public.sva_tipp_einstellungen where id = 1;
  if not coalesce(v_e.aktiv, true) then raise exception 'tipp_pausiert' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.sva_tipp_teilnehmer t where t.user_id = v_uid) then
    raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001';
  end if;
  if public.sva_tipp_wertung(p_spiel) is null then raise exception 'tipp_nicht_tippbar' using errcode = 'P0001'; end if;
  if not public.sva_tipp_offen(p_spiel) then raise exception 'tipp_geschlossen' using errcode = 'P0001'; end if;
  if coalesce(cardinality(p_spieler), 0) <> 5 then raise exception 'tipp_ungueltig:elf' using errcode = '22023'; end if;
  foreach s in array p_spieler loop
    v_id := public.sva_tipp_roster(s);
    if v_id is null or v_id = any (v_ids) then raise exception 'tipp_ungueltig:elf' using errcode = '22023'; end if;
    v_ids := v_ids || v_id;
    v_pos := v_pos || (select public.sva_tipp_pos(r.position) from public.sm_roster r where r.id = v_id);
  end loop;
  v_k := public.sva_tipp_roster(p_kapitaen);
  if v_k is null or not (v_k = any (v_ids)) then raise exception 'tipp_ungueltig:kapitaen' using errcode = '22023'; end if;
  if coalesce(p_frei, false) then
    if not coalesce(v_e.elf_frei, true) then raise exception 'tipp_ungueltig:frei' using errcode = '22023'; end if;
  else
    -- 1 TW/ABW · 2 MIT · 2 ANG (Plätze in dieser Reihenfolge)
    if not (v_pos[1] in ('TW', 'ABW') and v_pos[2] = 'MIT' and v_pos[3] = 'MIT' and v_pos[4] = 'ANG' and v_pos[5] = 'ANG') then
      raise exception 'tipp_ungueltig:positionen' using errcode = '22023';
    end if;
  end if;
  insert into public.sva_tipp_elf (user_id, spiel_id, spieler, kapitaen, frei)
  values (v_uid, p_spiel, v_ids, v_k, coalesce(p_frei, false))
  on conflict (user_id, spiel_id) do update
     set spieler = excluded.spieler, kapitaen = excluded.kapitaen, frei = excluded.frei;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 11. Öffentlich: Ranglisten, Duell, Verteilung ───────────────────────────
create or replace function public.tipp_rangliste(p_art text default 'saison', p_bezug text default null, p_liga uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_spiel uuid;
  v_monat date;
  v_saison text := public.sva_tipp_saison_von(now());
  v_res jsonb;
begin
  if p_art not in ('spieltag', 'monat', 'saison', 'winter') then
    raise exception 'tipp_ungueltig:art' using errcode = '22023';
  end if;
  if p_liga is not null and (v_uid is null or not exists (
       select 1 from public.sva_tipp_liga_mitglieder m where m.liga_id = p_liga and m.user_id = v_uid)) then
    raise exception 'tipp_liga_kein_mitglied' using errcode = '42501';
  end if;
  if p_art = 'spieltag' then
    if p_bezug ~ '^[0-9a-f-]{36}$' then
      v_spiel := p_bezug::uuid;
    else
      select t.spiel_id into v_spiel from public.sva_tipp_spieltage t join public.sm_spiele s on s.id = t.spiel_id
       where t.gewertet_at is not null and not s.demo order by s.anstoss desc limit 1;
    end if;
    if v_spiel is not null and not exists (select 1 from public.sva_tipp_spieltage t where t.spiel_id = v_spiel and t.gewertet_at is not null) then
      v_spiel := null;
    end if;
  elsif p_art = 'monat' then
    if p_bezug ~ '^\d{4}-\d{2}$' then
      v_monat := to_date(p_bezug || '-01', 'YYYY-MM-DD');
    else
      v_monat := public.sva_tipp_monat_von(now());
      if not exists (select 1 from public.sva_tipp_punkte p where p.monat = v_monat) then
        select p.monat into v_monat from public.sva_tipp_punkte p order by p.anstoss desc limit 1;
        v_monat := coalesce(v_monat, public.sva_tipp_monat_von(now()));
      end if;
    end if;
  else
    if p_bezug ~ '^\d{4}/\d{2}$' then v_saison := p_bezug; end if;
  end if;
  v_res := public.sva_tipp_rang(p_art, v_spiel, v_monat, v_saison, p_liga, v_uid, 50);
  if p_art = 'spieltag' and v_spiel is not null then
    v_res := v_res || jsonb_build_object('spiel', (select jsonb_build_object('gegner', s.gegner, 'heim', s.heim, 'anstoss', s.anstoss,
                         'toreSva', s.tore_sva, 'toreGegner', s.tore_gegner) from public.sm_spiele s where s.id = v_spiel));
  end if;
  return v_res;
end;
$$;

create or replace function public.tipp_duell()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.sva_tipp_duell_json(null);
$$;

-- „So hat die Liga getippt“ — erst NACH Tippschluss (vorher: Fehler)
create or replace function public.tipp_verteilung(p_spiel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_n integer;
begin
  if public.sva_tipp_offen(p_spiel) then
    raise exception 'tipp_noch_offen' using errcode = 'P0001';
  end if;
  select count(*) into v_n from public.sva_tipp_tipps t where t.spiel_id = p_spiel;
  return jsonb_build_object(
    'n', v_n,
    'ergebnisse', coalesce((select jsonb_agg(jsonb_build_object('toreSva', x.a, 'toreGegner', x.b, 'anteil', round(100.0 * x.n / greatest(v_n, 1)))
                              order by x.n desc, x.a desc)
                              from (select t.tore_sva a, t.tore_gegner b, count(*) n from public.sva_tipp_tipps t
                                     where t.spiel_id = p_spiel group by 1, 2 order by 3 desc, 1 desc limit 5) x), '[]'::jsonb),
    'tendenz', (select jsonb_build_object(
                   'sieg', round(100.0 * count(*) filter (where t.tore_sva > t.tore_gegner) / greatest(v_n, 1)),
                   'remis', round(100.0 * count(*) filter (where t.tore_sva = t.tore_gegner) / greatest(v_n, 1)),
                   'niederlage', round(100.0 * count(*) filter (where t.tore_sva < t.tore_gegner) / greatest(v_n, 1)))
                  from public.sva_tipp_tipps t where t.spiel_id = p_spiel),
    'elf', coalesce((select jsonb_agg(jsonb_build_object('spieler', public.sva_tipp_slug(x.id), 'anteil', x.anteil) order by x.anteil desc)
                       from (select u.id, round(100.0 * count(*) / greatest((select count(*) from public.sva_tipp_elf e2 where e2.spiel_id = p_spiel), 1)) anteil
                               from public.sva_tipp_elf e, unnest(e.spieler) u(id)
                              where e.spiel_id = p_spiel group by u.id order by 2 desc limit 5) x), '[]'::jsonb),
    'kapitaen', (select jsonb_build_object('spieler', public.sva_tipp_slug(e.kapitaen), 'anteil',
                    round(100.0 * count(*) / greatest((select count(*) from public.sva_tipp_elf e2 where e2.spiel_id = p_spiel), 1)))
                   from public.sva_tipp_elf e where e.spiel_id = p_spiel group by e.kapitaen order by count(*) desc limit 1),
    'joker', (select count(*) from public.sva_tipp_tipps t where t.spiel_id = p_spiel and t.joker)
  );
end;
$$;

-- ── 12. Fan: Stammtisch-Ligen ───────────────────────────────────────────────
create or replace function public.tipp_liga_gruenden(p_name text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_name text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_l public.sva_tipp_ligen;
begin
  if not exists (select 1 from public.sva_tipp_teilnehmer t where t.user_id = v_uid) then
    raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001';
  end if;
  if char_length(v_name) < 3 or char_length(v_name) > 40 or v_name ~ '[<>{}\\]' then
    raise exception 'tipp_ungueltig:liganame' using errcode = '22023';
  end if;
  if (select count(*) from public.sva_tipp_ligen l where l.gruender = v_uid) >= 5 then
    raise exception 'tipp_liga_limit' using errcode = 'P0001';
  end if;
  insert into public.sva_tipp_ligen (name, code, gruender) values (v_name, public.sva_tipp_liga_code(), v_uid)
  returning * into v_l;
  insert into public.sva_tipp_liga_mitglieder (liga_id, user_id) values (v_l.id, v_uid);
  return jsonb_build_object('id', v_l.id, 'name', v_l.name, 'code', v_l.code);
end;
$$;

create or replace function public.tipp_liga_beitreten(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_l public.sva_tipp_ligen;
  v_abz text[];
begin
  if not exists (select 1 from public.sva_tipp_teilnehmer t where t.user_id = v_uid) then
    raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001';
  end if;
  select * into v_l from public.sva_tipp_ligen l where l.code = upper(btrim(coalesce(p_code, '')));
  if v_l.id is null then raise exception 'tipp_liga_unbekannt' using errcode = 'P0001'; end if;
  if (select count(*) from public.sva_tipp_liga_mitglieder m where m.liga_id = v_l.id) >= 300 then
    raise exception 'tipp_liga_voll' using errcode = 'P0001';
  end if;
  insert into public.sva_tipp_liga_mitglieder (liga_id, user_id) values (v_l.id, v_uid) on conflict do nothing;
  -- Stammtisch-Abzeichen für alle Mitglieder, sobald die Liga 5 hat
  perform public.sva_tipp_abzeichen_pruefen(m.user_id) from public.sva_tipp_liga_mitglieder m where m.liga_id = v_l.id;
  v_abz := array(select a.abzeichen from public.sva_tipp_abzeichen a where a.user_id = v_uid and a.erreicht_at > now() - interval '5 seconds');
  return jsonb_build_object('id', v_l.id, 'name', v_l.name, 'code', v_l.code, 'abzeichen', to_jsonb(v_abz));
end;
$$;

create or replace function public.tipp_liga_verlassen(p_liga uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
begin
  delete from public.sva_tipp_liga_mitglieder where liga_id = p_liga and user_id = v_uid;
  -- leere Liga aufräumen
  delete from public.sva_tipp_ligen l where l.id = p_liga
     and not exists (select 1 from public.sva_tipp_liga_mitglieder m where m.liga_id = l.id);
  return jsonb_build_object('ok', true);
end;
$$;

-- Einladungs-Vorschau (auch ohne Login: Name + Größe, keine Mitglieder)
create or replace function public.tipp_liga_vorschau(p_code text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object('name', l.name, 'code', l.code,
                            'mitglieder', (select count(*) from public.sva_tipp_liga_mitglieder m where m.liga_id = l.id))
    from public.sva_tipp_ligen l where l.code = upper(btrim(coalesce(p_code, '')));
$$;

create or replace function public.tipp_meine_ligen()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_saison text := public.sva_tipp_saison_von(now());
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object(
             'id', l.id, 'name', l.name, 'code', l.code,
             'gruender', l.gruender = v_uid,
             'mitglieder', (select count(*) from public.sva_tipp_liga_mitglieder m2 where m2.liga_id = l.id),
             'meinPlatz', (public.sva_tipp_rang('saison', null, null, v_saison, l.id, v_uid, 1) -> 'ich' ->> 'platz')::int,
             'fuehrender', (public.sva_tipp_rang('saison', null, null, v_saison, l.id, v_uid, 1) -> 'eintraege' -> 0 ->> 'name'))
           order by m.beigetreten_at)
      from public.sva_tipp_liga_mitglieder m
      join public.sva_tipp_ligen l on l.id = m.liga_id
     where m.user_id = v_uid), '[]'::jsonb);
end;
$$;

-- Tipps der Liga-Mitglieder zu einem Spiel — erst nach Tippschluss
create or replace function public.tipp_liga_tipps(p_liga uuid, p_spiel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
begin
  if not exists (select 1 from public.sva_tipp_liga_mitglieder m where m.liga_id = p_liga and m.user_id = v_uid) then
    raise exception 'tipp_liga_kein_mitglied' using errcode = '42501';
  end if;
  if public.sva_tipp_offen(p_spiel) then
    raise exception 'tipp_noch_offen' using errcode = 'P0001';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'name', public.sva_tipp_name(m.user_id),
             'ich', case when m.user_id = v_uid then true end,
             'toreSva', t.tore_sva, 'toreGegner', t.tore_gegner,
             'joker', case when t.joker then true end,
             'kapitaen', public.sva_tipp_slug(e.kapitaen),
             'punkte', p.gesamt))
           order by p.gesamt desc nulls last, public.sva_tipp_name(m.user_id))
      from public.sva_tipp_liga_mitglieder m
      left join public.sva_tipp_tipps t on t.user_id = m.user_id and t.spiel_id = p_spiel
      left join public.sva_tipp_elf e on e.user_id = m.user_id and e.spiel_id = p_spiel
      left join public.sva_tipp_punkte p on p.user_id = m.user_id and p.spiel_id = p_spiel
     where m.liga_id = p_liga and (t.user_id is not null or e.user_id is not null)), '[]'::jsonb);
end;
$$;

-- ── 13. Admin/Team: Spielbericht ────────────────────────────────────────────
-- Vorbefüllt aus Aufstellung + Ticker; gespeicherter Bericht hat Vorrang.
create or replace function public.tipp_admin_bericht(p_spiel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_t public.sva_tipp_spieltage;
  v_l public.sva_lineup;
  v_zeilen jsonb;
  v_gegentore integer;
  v_auto jsonb;
begin
  perform public.sva_tipp_team_pruefen();
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null then raise exception 'tipp_spiel_unbekannt' using errcode = 'P0001'; end if;
  select * into v_t from public.sva_tipp_spieltage where spiel_id = p_spiel;
  select * into v_l from public.sva_lineup l where l.spiel_id = p_spiel order by l.created_at desc limit 1;
  v_gegentore := coalesce(v_s.tore_gegner, v_s.live_tore_gegner, 0);

  if exists (select 1 from public.sva_tipp_bericht b where b.spiel_id = p_spiel) then
    select jsonb_agg(jsonb_build_object(
             'id', r.slug, 'name', r.name, 'nummer', r.nummer, 'position', public.sva_tipp_pos(r.position),
             'eingesetzt', coalesce(b.eingesetzt, false), 'minuten', b.minuten,
             'tore', coalesce(b.tore, 0), 'vorlagen', coalesce(b.vorlagen, 0),
             'karte', b.karte, 'zuNull', coalesce(b.zu_null, false), 'start', r.id = any (coalesce(v_l.startelf, '{}')))
           order by (b.eingesetzt is true) desc, r.sortierung, r.nummer nulls last, r.name)
      into v_zeilen
      from public.sm_roster r
      left join public.sva_tipp_bericht b on b.roster_id = r.id and b.spiel_id = p_spiel
     where (r.aktiv and r.rolle = 'spieler') or b.roster_id is not null;
  else
    with ev as (
      select * from public.sva_ticker t where t.spiel_id = p_spiel
    ), raus as (
      select ev.roster_id_2 as id, min(coalesce(ev.minute, 90)) as minute from ev where ev.typ = 'wechsel' and ev.roster_id_2 is not null group by 1
    ), rein as (
      select ev.roster_id as id, min(coalesce(ev.minute, 90)) as minute from ev where ev.typ = 'wechsel' and ev.roster_id is not null group by 1
    ), basis as (
      select r.*,
             (r.id = any (coalesce(v_l.startelf, '{}'))) as start,
             (select minute from raus where raus.id = r.id) as raus_min,
             (select minute from rein where rein.id = r.id) as rein_min,
             (select count(*) from ev where ev.typ = 'tor' and ev.roster_id = r.id)::int as tore,
             (select count(*) from ev where ev.typ = 'tor' and ev.roster_id_2 = r.id)::int as vorlagen,
             case when exists (select 1 from ev where ev.roster_id = r.id and ev.typ = 'rot') then 'rot'
                  when exists (select 1 from ev where ev.roster_id = r.id and ev.typ = 'gelbrot') then 'gelbrot'
                  when exists (select 1 from ev where ev.roster_id = r.id and ev.typ = 'gelb') then 'gelb' end as karte
        from public.sm_roster r
       where r.aktiv and r.rolle = 'spieler'
    ), z as (
      select b.*,
             (b.start or b.rein_min is not null or b.tore > 0 or b.vorlagen > 0) as eingesetzt,
             case when b.start then coalesce(b.raus_min, 90)
                  when b.rein_min is not null then greatest(0, coalesce(b.raus_min, 90) - b.rein_min)
                  when b.tore > 0 or b.vorlagen > 0 then null end as minuten
        from basis b
    )
    select jsonb_agg(jsonb_build_object(
             'id', z.slug, 'name', z.name, 'nummer', z.nummer, 'position', public.sva_tipp_pos(z.position),
             'eingesetzt', z.eingesetzt, 'minuten', z.minuten, 'tore', z.tore, 'vorlagen', z.vorlagen, 'karte', z.karte,
             'zuNull', z.eingesetzt and v_gegentore = 0 and public.sva_tipp_pos(z.position) in ('TW', 'ABW') and coalesce(z.minuten, 90) >= 60,
             'start', z.start)
           order by z.eingesetzt desc, z.start desc, z.sortierung, z.nummer nulls last, z.name)
      into v_zeilen from z;
  end if;

  v_auto := public.sva_tipp_aufloesung_auto(p_spiel);
  return jsonb_strip_nulls(jsonb_build_object(
    'spiel', jsonb_strip_nulls(jsonb_build_object(
       'id', v_s.id, 'gegner', v_s.gegner, 'heim', v_s.heim, 'anstoss', v_s.anstoss, 'status', v_s.status,
       'toreSva', coalesce(v_s.tore_sva, case when v_s.status = 'beendet' then v_s.live_tore_sva end),
       'toreGegner', coalesce(v_s.tore_gegner, case when v_s.status = 'beendet' then v_s.live_tore_gegner end),
       'liveSva', v_s.live_tore_sva, 'liveGegner', v_s.live_tore_gegner,
       'demo', case when v_s.demo then true end,
       'motm', public.sva_tipp_slug(v_s.motm_roster_id))),
    'wertung', public.sva_tipp_wertung(p_spiel),
    'offen', public.sva_tipp_offen(p_spiel),
    'gespeichert', v_t.bericht_at is not null,
    'berichtAt', v_t.bericht_at,
    'gewertetAt', v_t.gewertet_at,
    'mitTicker', exists (select 1 from public.sva_ticker t where t.spiel_id = p_spiel),
    'mitAufstellung', v_l.id is not null,
    'zeilen', coalesce(v_zeilen, '[]'::jsonb),
    'fragen', (select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('key', k,
                  'linie', case when k = 'zuschauer' then public.sva_tipp_zuschauer_linie(p_spiel) end)) order by i)
                 from unnest(public.sva_tipp_fragen(p_spiel)) with ordinality f(k, i)),
    'aufloesungAuto', v_auto,
    'aufloesung', coalesce(v_auto, '{}'::jsonb) || coalesce(v_t.aufloesung, '{}'::jsonb),
    'ersterTorschuetze', public.sva_tipp_slug(coalesce(v_t.erster_torschuetze, case when v_t.bericht_at is null then public.sva_tipp_erster_auto(p_spiel) end)),
    'ersterAuto', public.sva_tipp_slug(public.sva_tipp_erster_auto(p_spiel)),
    'checkins', case when v_s.heim then (select count(*) from public.sva_album_checkins c where c.spiel_id = p_spiel) end,
    'anzahlTipps', (select count(*) from public.sva_tipp_tipps x where x.spiel_id = p_spiel),
    'anzahlElf', (select count(*) from public.sva_tipp_elf x where x.spiel_id = p_spiel),
    -- „MOTM-Karte veröffentlichen“ (Album-Modul v20-karten) vorhanden?
    'albumMotm', to_regprocedure('public.album_motm_karte_veroeffentlichen(uuid)') is not null
  ));
end;
$$;

-- Bericht speichern. p_zeilen: [{id: slug, eingesetzt, minuten, tore, vorlagen, karte, zuNull}]
-- p_aufloesung: {frage: antwort}; p_erster/p_motm: slug oder null; p_ergebnis
-- optional {toreSva, toreGegner} für Spiele ohne Ticker-Abpfiff.
create or replace function public.tipp_admin_bericht_speichern(
  p_spiel uuid, p_zeilen jsonb, p_aufloesung jsonb default '{}'::jsonb,
  p_erster text default null, p_motm text default null, p_ergebnis jsonb default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  z jsonb;
  v_id uuid;
  v_auf jsonb := '{}'::jsonb;
  k text;
  v text;
  v_motm uuid;
  v_erster uuid;
begin
  perform public.sva_tipp_team_pruefen();
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null then raise exception 'tipp_spiel_unbekannt' using errcode = 'P0001'; end if;
  if v_s.demo then raise exception 'tipp_demo_spiel' using errcode = 'P0001'; end if;
  if jsonb_typeof(coalesce(p_zeilen, '[]'::jsonb)) <> 'array' then raise exception 'tipp_ungueltig:bericht' using errcode = '22023'; end if;

  if p_aufloesung is not null and jsonb_typeof(p_aufloesung) = 'object' then
    for k, v in select key, value from jsonb_each_text(p_aufloesung) loop
      if v is null or v = '' then continue; end if;
      if not public.sva_tipp_bonus_ok(k, v) then raise exception 'tipp_ungueltig:aufloesung' using errcode = '22023'; end if;
      v_auf := v_auf || jsonb_build_object(k, v);
    end loop;
  end if;

  if p_motm is not null and btrim(p_motm) <> '' then
    select r.id into v_motm from public.sm_roster r where r.slug = p_motm;
    if v_motm is null then raise exception 'tipp_spieler_unbekannt' using errcode = '22023'; end if;
  end if;
  if p_erster is not null and btrim(p_erster) <> '' then
    select r.id into v_erster from public.sm_roster r where r.slug = p_erster;
    if v_erster is null then raise exception 'tipp_spieler_unbekannt' using errcode = '22023'; end if;
  end if;

  delete from public.sva_tipp_bericht where spiel_id = p_spiel;
  for z in select * from jsonb_array_elements(coalesce(p_zeilen, '[]'::jsonb)) loop
    select r.id into v_id from public.sm_roster r where r.slug = z ->> 'id';
    if v_id is null then raise exception 'tipp_spieler_unbekannt' using errcode = '22023'; end if;
    if coalesce((z ->> 'eingesetzt')::boolean, false) or coalesce((z ->> 'tore')::int, 0) > 0 or nullif(z ->> 'karte', '') is not null then
      insert into public.sva_tipp_bericht (spiel_id, roster_id, eingesetzt, minuten, tore, vorlagen, karte, zu_null)
      values (p_spiel, v_id, coalesce((z ->> 'eingesetzt')::boolean, false), nullif(z ->> 'minuten', '')::int,
              coalesce((z ->> 'tore')::int, 0), coalesce((z ->> 'vorlagen')::int, 0),
              nullif(z ->> 'karte', ''), coalesce((z ->> 'zuNull')::boolean, false))
      on conflict (spiel_id, roster_id) do update
        set eingesetzt = excluded.eingesetzt, minuten = excluded.minuten, tore = excluded.tore,
            vorlagen = excluded.vorlagen, karte = excluded.karte, zu_null = excluded.zu_null;
    end if;
  end loop;

  -- Ergebnis nur nachtragen, wenn es (noch) keins gibt bzw. kein Ticker-Abpfiff existiert
  if p_ergebnis is not null and (p_ergebnis ->> 'toreSva') is not null and (p_ergebnis ->> 'toreGegner') is not null
     and not exists (select 1 from public.sva_ticker t where t.spiel_id = p_spiel and t.typ = 'abpfiff') then
    update public.sm_spiele
       set tore_sva = (p_ergebnis ->> 'toreSva')::int, tore_gegner = (p_ergebnis ->> 'toreGegner')::int,
           status = 'beendet', updated_at = now()
     where id = p_spiel;
  end if;

  update public.sm_spiele set motm_roster_id = v_motm, updated_at = now() where id = p_spiel and motm_roster_id is distinct from v_motm;

  insert into public.sva_tipp_spieltage (spiel_id, aufloesung, erster_torschuetze, bericht_at, bericht_von)
  values (p_spiel, v_auf, v_erster, now(), auth.jwt() ->> 'email')
  on conflict (spiel_id) do update
     set aufloesung = excluded.aufloesung, erster_torschuetze = excluded.erster_torschuetze,
         bericht_at = now(), bericht_von = excluded.bericht_von, updated_at = now();
  return jsonb_build_object('ok', true, 'zeilen', (select count(*) from public.sva_tipp_bericht b where b.spiel_id = p_spiel));
end;
$$;

-- Werten (und Neuberechnung bei Korrektur): Punkte aller Tipps + Elfs.
create or replace function public.tipp_admin_werten(p_spiel uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_t public.sva_tipp_spieltage;
  v_wertung text;
  v_fragen text[];
  v_sieg boolean;
  u record;
  v_tipp public.sva_tipp_tipps;
  v_elf public.sva_tipp_elf;
  v_tp jsonb;
  v_ep jsonb;
  v_spieler jsonb;
  v_elf_summe integer;
  v_kap_p integer;
  x uuid;
  b public.sva_tipp_bericht;
  v_pos text;
  v_n integer := 0;
  v_gesamt integer;
begin
  perform public.sva_tipp_team_pruefen();
  select * into v_s from public.sm_spiele where id = p_spiel for update;
  if v_s.id is null then raise exception 'tipp_spiel_unbekannt' using errcode = 'P0001'; end if;
  if v_s.demo then raise exception 'tipp_demo_spiel' using errcode = 'P0001'; end if;
  v_wertung := public.sva_tipp_wertung(p_spiel);
  if v_wertung is null then raise exception 'tipp_nicht_tippbar' using errcode = 'P0001'; end if;
  if public.sva_tipp_offen(p_spiel) then raise exception 'tipp_noch_offen' using errcode = 'P0001'; end if;
  if v_s.tore_sva is null or v_s.tore_gegner is null then raise exception 'tipp_kein_ergebnis' using errcode = 'P0001'; end if;
  select * into v_t from public.sva_tipp_spieltage where spiel_id = p_spiel;
  if v_t.bericht_at is null then raise exception 'tipp_kein_bericht' using errcode = 'P0001'; end if;

  v_fragen := public.sva_tipp_fragen(p_spiel);
  v_sieg := v_s.tore_sva > v_s.tore_gegner;
  delete from public.sva_tipp_punkte where spiel_id = p_spiel;

  for u in
    select x.user_id from public.sva_tipp_tipps x where x.spiel_id = p_spiel
    union
    select e.user_id from public.sva_tipp_elf e where e.spiel_id = p_spiel
  loop
    select * into v_tipp from public.sva_tipp_tipps where spiel_id = p_spiel and user_id = u.user_id;
    select * into v_elf from public.sva_tipp_elf where spiel_id = p_spiel and user_id = u.user_id;

    v_tp := public.sva_tipp_tipp_punkte(v_tipp.tore_sva, v_tipp.tore_gegner, v_tipp.erster_torschuetze, v_tipp.motm,
                                        v_tipp.joker, v_tipp.bonus, v_fragen,
                                        v_s.tore_sva, v_s.tore_gegner, v_t.erster_torschuetze, v_s.motm_roster_id, v_t.aufloesung);
    v_elf_summe := 0;
    v_kap_p := null;
    v_spieler := '[]'::jsonb;
    if v_elf.user_id is not null then
      foreach x in array v_elf.spieler loop
        select * into b from public.sva_tipp_bericht where spiel_id = p_spiel and roster_id = x;
        select r.position into v_pos from public.sm_roster r where r.id = x;
        v_ep := public.sva_tipp_spieler_punkte(b.eingesetzt, b.tore, b.vorlagen, b.zu_null, v_pos, b.minuten, b.karte,
                                               x = v_s.motm_roster_id, v_sieg);
        if x = v_elf.kapitaen then
          v_kap_p := (v_ep ->> 'punkte')::int * 2;
          v_elf_summe := v_elf_summe + v_kap_p;
        else
          v_elf_summe := v_elf_summe + (v_ep ->> 'punkte')::int;
        end if;
        v_spieler := v_spieler || jsonb_build_array(v_ep || jsonb_build_object(
                       'id', public.sva_tipp_slug(x), 'kapitaen', x = v_elf.kapitaen,
                       'gesamt', case when x = v_elf.kapitaen then (v_ep ->> 'punkte')::int * 2 else (v_ep ->> 'punkte')::int end));
      end loop;
    end if;
    v_gesamt := coalesce((v_tp ->> 'gesamt')::int, 0) + v_elf_summe;
    insert into public.sva_tipp_punkte (user_id, spiel_id, wertung, saison, monat, anstoss, tipp, elf, joker, gesamt, exakt, details)
    values (u.user_id, p_spiel, v_wertung, public.sva_tipp_saison_von(v_s.anstoss), public.sva_tipp_monat_von(v_s.anstoss), v_s.anstoss,
            coalesce((v_tp ->> 'summe')::int, 0), v_elf_summe, coalesce(v_tipp.joker, false), v_gesamt,
            (v_tp ->> 'art') = 'exakt',
            jsonb_strip_nulls(jsonb_build_object('tipp', v_tp, 'elf', v_spieler, 'kapitaenPunkte', v_kap_p,
                                                 'hatTipp', v_tipp.user_id is not null, 'hatElf', v_elf.user_id is not null)));
    v_n := v_n + 1;
  end loop;

  update public.sva_tipp_spieltage
     set gewertet_at = now(), gewertet_von = auth.jwt() ->> 'email', updated_at = now()
   where spiel_id = p_spiel;

  perform public.sva_tipp_abzeichen_pruefen(p.user_id) from public.sva_tipp_punkte p where p.spiel_id = p_spiel;

  -- Album-Missionen (Paket v20-karten; idempotent dort, hier gekapselt)
  perform public.sva_tipp_album_ziel('tipp_exakt', p_spiel, p.user_id)
     from public.sva_tipp_punkte p where p.spiel_id = p_spiel and p.exakt;
  perform public.sva_tipp_album_ziel('kapitaen_trifft', p_spiel, e.user_id)
     from public.sva_tipp_elf e
     join public.sva_tipp_bericht kb on kb.spiel_id = e.spiel_id and kb.roster_id = e.kapitaen and kb.eingesetzt and kb.tore > 0
    where e.spiel_id = p_spiel;
  perform public.sva_tipp_album_ziel('tipp_spieltagssieg', p_spiel, p.user_id)
     from public.sva_tipp_punkte p
    where p.spiel_id = p_spiel and p.gesamt > 0
      and p.gesamt = (select max(q.gesamt) from public.sva_tipp_punkte q where q.spiel_id = p_spiel);

  return jsonb_build_object(
    'ok', true, 'teilnehmer', v_n,
    'schnitt', (select round(avg(p.gesamt), 1) from public.sva_tipp_punkte p where p.spiel_id = p_spiel),
    'max', (select max(p.gesamt) from public.sva_tipp_punkte p where p.spiel_id = p_spiel),
    'exakt', (select count(*) from public.sva_tipp_punkte p where p.spiel_id = p_spiel and p.exakt));
end;
$$;

-- ── 14. Admin/Team: Spieltage (Bonusfragen, tippbar) ────────────────────────
create or replace function public.tipp_admin_spieltage()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_tipp_team_pruefen();
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id', s.id, 'gegner', s.gegner, 'heim', s.heim, 'anstoss', s.anstoss, 'wettbewerb', s.wettbewerb,
             'status', s.status, 'toreSva', s.tore_sva, 'toreGegner', s.tore_gegner,
             'pflichtspiel', public.sva_tipp_ist_pflichtspiel(s.gegner, s.wettbewerb),
             'tippbarSchalter', t.tippbar,
             'wertung', public.sva_tipp_wertung(s.id),
             'offen', public.sva_tipp_offen(s.id),
             'fragen', to_jsonb(public.sva_tipp_fragen(s.id)),
             'fragenAuto', t.fragen is null,
             'linie', case when s.heim then public.sva_tipp_zuschauer_linie(s.id) end,
             'linieAuto', t.zuschauer_linie is null,
             'berichtAt', t.bericht_at, 'gewertetAt', t.gewertet_at,
             'anzahlTipps', (select count(*) from public.sva_tipp_tipps x where x.spiel_id = s.id),
             'anzahlElf', (select count(*) from public.sva_tipp_elf x where x.spiel_id = s.id)))
           order by s.anstoss)
      from public.sm_spiele s
      left join public.sva_tipp_spieltage t on t.spiel_id = s.id
     where not s.demo and s.anstoss between now() - interval '21 days' and now() + interval '60 days'), '[]'::jsonb);
end;
$$;

create or replace function public.tipp_admin_spieltag_speichern(p_spiel uuid, p_tippbar boolean, p_fragen text[], p_linie integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_alt text[];
begin
  perform public.sva_tipp_team_pruefen();
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null then raise exception 'tipp_spiel_unbekannt' using errcode = 'P0001'; end if;
  if v_s.demo then raise exception 'tipp_demo_spiel' using errcode = 'P0001'; end if;
  if p_fragen is not null and not public.sva_tipp_fragen_ok(p_fragen) then
    raise exception 'tipp_ungueltig:fragen' using errcode = '22023';
  end if;
  if p_fragen is not null and 'zuschauer' = any (p_fragen) and not v_s.heim then
    raise exception 'tipp_ungueltig:zuschauer_nur_heim' using errcode = '22023';
  end if;
  -- Nach Tippschluss keine anderen Fragen mehr (fair bleiben)
  v_alt := public.sva_tipp_fragen(p_spiel);
  if not public.sva_tipp_offen(p_spiel) and coalesce(p_fragen, public.sva_tipp_fragen_vorschlag(p_spiel)) is distinct from v_alt then
    raise exception 'tipp_fragen_gesperrt' using errcode = 'P0001';
  end if;
  insert into public.sva_tipp_spieltage (spiel_id, tippbar, fragen, zuschauer_linie)
  values (p_spiel, p_tippbar, p_fragen, p_linie)
  on conflict (spiel_id) do update
     set tippbar = excluded.tippbar,
         fragen = case when public.sva_tipp_offen(p_spiel) then excluded.fragen else public.sva_tipp_spieltage.fragen end,
         zuschauer_linie = excluded.zuschauer_linie, updated_at = now();
  return jsonb_build_object('ok', true, 'wertung', public.sva_tipp_wertung(p_spiel), 'fragen', to_jsonb(public.sva_tipp_fragen(p_spiel)));
end;
$$;

-- ── 15. Admin: Teilnehmer + Kabine, Story-Daten ─────────────────────────────
create or replace function public.tipp_admin_teilnehmer(p_suche text default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_q text := lower(btrim(coalesce(p_suche, '')));
begin
  perform public.sva_tipp_admin_pruefen();
  return jsonb_build_object(
    'gesamt', (select count(*) from public.sva_tipp_teilnehmer),
    'kabine', (select count(*) from public.sva_tipp_teilnehmer where kabine),
    'liste', coalesce((
      select jsonb_agg(jsonb_build_object(
               'userId', t.user_id, 'name', f.vorname || ' ' || f.initial || '.', 'email', u.email,
               'kabine', t.kabine, 'sichtbar', t.sichtbar, 'seit', t.created_at,
               'tipps', (select count(*) from public.sva_tipp_tipps x where x.user_id = t.user_id),
               'punkte', (select coalesce(sum(p.gesamt), 0) from public.sva_tipp_punkte p where p.user_id = t.user_id
                            and p.saison = public.sva_tipp_saison_von(now()) and p.wertung = 'saison'))
             order by t.kabine desc, f.vorname, f.initial)
        from public.sva_tipp_teilnehmer t
        join public.sva_album_fans f on f.user_id = t.user_id
        left join auth.users u on u.id = t.user_id
       where v_q = '' or lower(f.vorname) like '%' || v_q || '%' or lower(coalesce(u.email, '')) like '%' || v_q || '%'
       limit 200), '[]'::jsonb));
end;
$$;

create or replace function public.tipp_admin_kabine(p_user uuid, p_kabine boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_tipp_admin_pruefen();
  update public.sva_tipp_teilnehmer set kabine = coalesce(p_kabine, false), updated_at = now() where user_id = p_user;
  if not found then raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- Daten für die Story-Grafiken der Woche (nur öffentlich sichtbare Namen,
-- nur Positives über Einzelne).
create or replace function public.tipp_admin_story()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_e public.sva_tipp_einstellungen;
  v_letzt uuid;
  v_offen uuid;
  v_rang jsonb;
  v_partner jsonb;
begin
  perform public.sva_tipp_admin_pruefen();
  select * into v_e from public.sva_tipp_einstellungen where id = 1;
  select t.spiel_id into v_letzt from public.sva_tipp_spieltage t join public.sm_spiele s on s.id = t.spiel_id
   where t.gewertet_at is not null and not s.demo order by s.anstoss desc limit 1;
  select s.id into v_offen from public.sm_spiele s
   where not s.demo and public.sva_tipp_wertung(s.id) is not null and public.sva_tipp_offen(s.id)
   order by s.anstoss limit 1;
  if v_letzt is not null then
    v_rang := public.sva_tipp_rang('spieltag', v_letzt, null, null, null, null, 3);
  end if;
  if v_e.partner_id is not null then
    select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url)) into v_partner
      from public.sm_sponsoren sp where sp.id = v_e.partner_id;
  end if;
  return jsonb_strip_nulls(jsonb_build_object(
    'partner', v_partner,
    'storyCode', v_e.story_code,
    'preise', v_e.preise,
    'offen', (select jsonb_build_object('id', s.id, 'gegner', s.gegner, 'heim', s.heim, 'anstoss', s.anstoss,
                 'schluss', public.sva_tipp_schluss(s.id),
                 'anzahlTipps', (select count(*) from public.sva_tipp_tipps x where x.spiel_id = s.id))
                from public.sm_spiele s where s.id = v_offen),
    'spieltag', (select jsonb_build_object('id', s.id, 'gegner', s.gegner, 'heim', s.heim, 'anstoss', s.anstoss,
                    'toreSva', s.tore_sva, 'toreGegner', s.tore_gegner,
                    'sieger', coalesce((select jsonb_agg(e) from jsonb_array_elements(v_rang -> 'eintraege') e where (e ->> 'platz')::int = 1), '[]'::jsonb),
                    'teilnehmer', (select count(*) from public.sva_tipp_punkte p where p.spiel_id = s.id),
                    'schnitt', (select round(avg(p.gesamt), 1) from public.sva_tipp_punkte p where p.spiel_id = s.id))
                   from public.sm_spiele s where s.id = v_letzt),
    'top5', public.sva_tipp_rang('saison', null, null, public.sva_tipp_saison_von(now()), null, null, 5) -> 'eintraege',
    'duell', public.sva_tipp_duell_json(v_letzt),
    'teilnehmerGesamt', (select count(*) from public.sva_tipp_teilnehmer)
  ));
end;
$$;

-- ── 16. Rechte ──────────────────────────────────────────────────────────────
-- interne Helfer: niemand außer service_role
revoke all on function public.sva_tipp_offen(uuid), public.sva_tipp_wertung(uuid), public.sva_tipp_schluss(uuid),
  public.sva_tipp_fragen_vorschlag(uuid), public.sva_tipp_fragen(uuid), public.sva_tipp_zuschauer_linie(uuid),
  public.sva_tipp_erster_auto(uuid), public.sva_tipp_aufloesung_auto(uuid), public.sva_tipp_abgabe_waechter(),
  public.sva_tipp_uid(), public.sva_tipp_team_pruefen(), public.sva_tipp_admin_pruefen(), public.sva_tipp_slug(uuid),
  public.sva_tipp_roster(text), public.sva_tipp_name(uuid), public.sva_tipp_liga_code(), public.sva_tipp_kader_json(),
  public.sva_tipp_spiel_json(uuid, uuid), public.sva_tipp_abzeichen_pruefen(uuid),
  public.sva_tipp_rang(text, uuid, date, text, uuid, uuid, integer), public.sva_tipp_duell_json(uuid),
  public.sva_tipp_winterpause(timestamptz), public.sva_tipp_album_ziel(text, uuid, uuid),
  public.sva_tipp_scope(text, uuid, date, text, uuid, uuid)
  from public, anon, authenticated;
-- sva_tipp_offen wird in der RLS-Policy ausgewertet (läuft als SECURITY DEFINER)
grant execute on function public.sva_tipp_offen(uuid) to authenticated;
grant execute on function public.sva_tipp_offen(uuid), public.sva_tipp_wertung(uuid), public.sva_tipp_schluss(uuid),
  public.sva_tipp_fragen_vorschlag(uuid), public.sva_tipp_fragen(uuid), public.sva_tipp_zuschauer_linie(uuid),
  public.sva_tipp_erster_auto(uuid), public.sva_tipp_aufloesung_auto(uuid), public.sva_tipp_slug(uuid),
  public.sva_tipp_name(uuid), public.sva_tipp_kader_json(), public.sva_tipp_spiel_json(uuid, uuid),
  public.sva_tipp_abzeichen_pruefen(uuid), public.sva_tipp_rang(text, uuid, date, text, uuid, uuid, integer),
  public.sva_tipp_duell_json(uuid), public.sva_tipp_winterpause(timestamptz)
  to service_role;

-- reine Rechenfunktionen: unkritisch, aber nicht öffentlich nötig
revoke all on function public.sva_tipp_saison_von(timestamptz), public.sva_tipp_monat_von(timestamptz),
  public.sva_tipp_ist_pflichtspiel(text, text), public.sva_tipp_pos(text), public.sva_tipp_fragen_pool(),
  public.sva_tipp_fragen_ok(text[]), public.sva_tipp_bonus_ok(text, text), public.sva_tipp_ergebnis_punkte(integer, integer, integer, integer),
  public.sva_tipp_tipp_punkte(integer, integer, uuid, uuid, boolean, jsonb, text[], integer, integer, uuid, uuid, jsonb),
  public.sva_tipp_spieler_punkte(boolean, integer, integer, boolean, text, integer, text, boolean, boolean)
  from public, anon;
grant execute on function public.sva_tipp_saison_von(timestamptz), public.sva_tipp_monat_von(timestamptz),
  public.sva_tipp_ist_pflichtspiel(text, text), public.sva_tipp_pos(text), public.sva_tipp_fragen_pool(),
  public.sva_tipp_fragen_ok(text[]), public.sva_tipp_bonus_ok(text, text), public.sva_tipp_ergebnis_punkte(integer, integer, integer, integer),
  public.sva_tipp_tipp_punkte(integer, integer, uuid, uuid, boolean, jsonb, text[], integer, integer, uuid, uuid, jsonb),
  public.sva_tipp_spieler_punkte(boolean, integer, integer, boolean, text, integer, text, boolean, boolean)
  to authenticated, service_role;

-- öffentlich (anon + eingeloggt)
revoke all on function public.tipp_lage(), public.tipp_rangliste(text, text, uuid), public.tipp_duell(),
  public.tipp_verteilung(uuid), public.tipp_liga_vorschau(text) from public;
grant execute on function public.tipp_lage(), public.tipp_rangliste(text, text, uuid), public.tipp_duell(),
  public.tipp_verteilung(uuid), public.tipp_liga_vorschau(text) to anon, authenticated, service_role;

-- nur eingeloggt (prüfen zusätzlich auth.uid() bzw. Team/Admin)
revoke all on function public.tipp_beitreten(text, text, boolean, boolean, boolean),
  public.tipp_profil_speichern(text, text, boolean),
  public.tipp_abgeben(uuid, integer, integer, text, text, boolean, jsonb),
  public.tipp_elf_speichern(uuid, text[], text, boolean),
  public.tipp_liga_gruenden(text), public.tipp_liga_beitreten(text), public.tipp_liga_verlassen(uuid),
  public.tipp_meine_ligen(), public.tipp_liga_tipps(uuid, uuid),
  public.tipp_admin_bericht(uuid), public.tipp_admin_bericht_speichern(uuid, jsonb, jsonb, text, text, jsonb),
  public.tipp_admin_werten(uuid), public.tipp_admin_spieltage(),
  public.tipp_admin_spieltag_speichern(uuid, boolean, text[], integer),
  public.tipp_admin_teilnehmer(text), public.tipp_admin_kabine(uuid, boolean), public.tipp_admin_story()
  from public, anon;
grant execute on function public.tipp_beitreten(text, text, boolean, boolean, boolean),
  public.tipp_profil_speichern(text, text, boolean),
  public.tipp_abgeben(uuid, integer, integer, text, text, boolean, jsonb),
  public.tipp_elf_speichern(uuid, text[], text, boolean),
  public.tipp_liga_gruenden(text), public.tipp_liga_beitreten(text), public.tipp_liga_verlassen(uuid),
  public.tipp_meine_ligen(), public.tipp_liga_tipps(uuid, uuid),
  public.tipp_admin_bericht(uuid), public.tipp_admin_bericht_speichern(uuid, jsonb, jsonb, text, text, jsonb),
  public.tipp_admin_werten(uuid), public.tipp_admin_spieltage(),
  public.tipp_admin_spieltag_speichern(uuid, boolean, text[], integer),
  public.tipp_admin_teilnehmer(text), public.tipp_admin_kabine(uuid, boolean), public.tipp_admin_story()
  to authenticated, service_role;

-- ── 17. Statistik: feste Pfadliste erweitern ───────────────────────────────
-- Stand 20261009100000_sva_statistik.sql + v20-T (/tippen, Ereignisse).
-- Website: src/statistik/zaehlen.ts — gleich halten.
create or replace function public.sva_statistik_pfade()
returns text[]
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select array[
    -- eigene Seiten
    '/', '/live', '/partner', '/album', '/galerie', '/impressum', '/datenschutz',
    '/tippen', '/teilnahmebedingungen',
    -- Karte: Orte + Rundgang
    '/#rundgang', '/#spieltag', '/#training', '/#mannschaft', '/#fans', '/#musik', '/#partner', '/#anfahrt',
    -- Ereignisse (Ziele)
    '#ereignis:kalender-abo', '#ereignis:kalender-termin', '#ereignis:kalender-link',
    '#ereignis:probetraining-start', '#ereignis:probetraining',
    '#ereignis:partner-anfrage', '#ereignis:album-checkin', '#ereignis:instagram',
    -- v20-T Tipp-Liga
    '#ereignis:tipp-abgegeben', '#ereignis:elf-gespeichert', '#ereignis:liga-gegruendet',
    '#ereignis:liga-beigetreten', '#ereignis:tipp-teilen'
  ]::text[];
$$;
