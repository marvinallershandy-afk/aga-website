-- ─────────────────────────────────────────────────────────────────────────────
-- v20-K „Sammelkarten“: Karten-Ökonomie, Spezialkarten, Smart-Pack, Tausch,
-- Wunschkarte, Kapitel, Codes (Instagram-Story, Partner, Adventskalender),
-- Freund-Bonus, Tipp-Liga-Schnittstelle, Sammelziele/Missionen, Lose und
-- Verlosungen. Spezifikation: docs/KARTEN.md (Abschnitt „Ökonomie & Ziehung“),
-- SVA_KONZEPT_FANERLEBNIS.md Abschnitt 1 + Update A.
--
-- Grundregeln (mit dem Vorstand abgestimmt, alles im Admin einstellbar):
--   · Seltenheit bewertet NIE einen Spieler: jeder Spieler hat EINE Basis-Karte
--     (füllt seinen Album-Platz). Silber-Glanz-Varianten (variante = true) sind
--     Zusatz-Sammelstücke und füllen keinen Platz. Gold-Basis nur für objektive
--     Rollen (Kapitän, Trainerstab).
--   · Limitierte Karten (limitiert = true: Spieler des Spiels, Derby, Weihnachten)
--     liegen auf der Bonus-Seite und zählen NICHT fürs Album / Kapitel.
--   · Smart-Pack: die erste Karte jedes Zufalls-Packs ist eine noch fehlende
--     Album-Karte (Seltenheit bleibt fair nach Gewicht gezogen).
--   · Belohnungen (Gutscheine) nur an Check-ins: 3 / 6 / 8 (Verlosungs-Los).
--
-- Was diese Migration tut (ADDITIV, nur sva_*-Objekte; idempotent):
--   1. Neue Spalten: sva_album_einstellungen (Packgrößen, Smart-Pack, Tausch,
--      Wunschkarte, Code-Sperre, Schwelle 3, Lose, Teilnahmebedingungen),
--      sva_album_karten (variante, limitiert, Ziehfenster, Derby, „präsentiert
--      von“, Credit, Bildfokus, Rückseite, Serie), sva_album_fans.freund_code,
--      sva_album_packs (quelle = Idempotenz-Schlüssel, titel; neue Arten),
--      sva_album_gutscheine (Stufe schwelle_3).
--   2. Neue Tabellen: _codes, _code_einloesungen, _code_fehler, _freunde,
--      _tausch, _abzeichen, _ziele, _ziel_erreicht, _lose, _verlosungen.
--      Fans haben KEINEN Tabellenzugriff — nur RPCs. Admin per is_sm_admin().
--   3. Ziehung neu (sva_album_pack_ziehen_v20): Smart-Pack, Mindest-Seltenheit,
--      feste Karte, Packgröße, Quelle/Titel, Ziehfenster, Derby über Spiel-Bezug.
--      sva_album_pack_ziehen(uuid, uuid, text) bleibt (Signatur unverändert).
--   4. Fan-RPCs: album_starter_holen, album_code_einloesen, album_freund_code,
--      album_freund_hinzufuegen, album_tausch_anbieten/_ansehen/_annehmen/
--      _zurueckziehen, album_wunschkarte; erweitert: album_katalog, album_mein,
--      album_checkin, album_pack_oeffnen, album_gutschein_einloesen,
--      album_konto_loeschen.
--   5. Tipp-Liga: album_karte_gutschreiben(text, uuid), album_ziel_ausloesen
--      (text, uuid) — EXECUTE nur service_role (Aufruf aus SECURITY-DEFINER-RPC).
--   6. Admin: album_admin_katalog_standard, album_admin_story_code,
--      album_admin_story_codes_massen, album_admin_advent, album_admin_motm,
--      album_admin_ziele_standard, album_admin_ziel_status,
--      album_admin_verlosung_ziehen; album_admin_statistik erweitert.
--
-- Standardwerte per Monte-Carlo-Simulation (scripts/karten-simulation.mjs —
-- muss zu dieser Migration passen) festgelegt.
-- NICHT automatisch anwenden — nach 20261011110000_sva_am_platz.sql.
-- Lokal gegen PGlite mit Supabase-Stubs getestet: supabase/tests/karten.test.mjs,
-- supabase/tests/ziele.test.mjs (und album.test.mjs bleibt grün).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Einstellungen ────────────────────────────────────────────────────────
alter table public.sva_album_einstellungen
  add column if not exists karten_starter integer not null default 5 check (karten_starter between 1 and 10),
  add column if not exists starter_min_silber boolean not null default true,
  add column if not exists karten_heimsieg integer not null default 1 check (karten_heimsieg between 0 and 5),
  add column if not exists karten_tipp integer not null default 1 check (karten_tipp between 0 and 5),
  add column if not exists karten_story integer not null default 1 check (karten_story between 0 and 5),
  add column if not exists karten_freund integer not null default 1 check (karten_freund between 0 and 5),
  add column if not exists karten_kapitel integer not null default 1 check (karten_kapitel between 0 and 5),
  -- Smart-Pack: erste Karte jedes Zufalls-Packs = fehlende Album-Karte
  add column if not exists smart_pack boolean not null default true,
  -- auch in Belohnungs-Packs (Kapitel/Ziele)? Simulation: aus, sonst ist das
  -- Album für Stammfans schon im Winter voll (Belohnungen ziehen Belohnungen nach)
  add column if not exists smart_pack_belohnung boolean not null default false,
  add column if not exists schwelle_3 integer default 8 check (schwelle_3 is null or schwelle_3 between 3 and 60),
  add column if not exists belohnung_3 text not null default 'Los für die Saison-Verlosung (alle Heimspiele)'
    check (char_length(btrim(belohnung_3)) between 2 and 80),
  add column if not exists partner_3_id uuid references public.sm_sponsoren(id) on delete set null,
  add column if not exists tausch_min_tage integer not null default 7 check (tausch_min_tage between 0 and 60),
  add column if not exists tausch_pro_woche integer not null default 5 check (tausch_pro_woche between 0 and 50),
  add column if not exists wunsch_kosten integer not null default 3 check (wunsch_kosten between 2 and 10),
  -- Fehlversuche bei Code-Eingaben pro Stunde, danach gesperrt
  add column if not exists code_fehler_limit integer not null default 10 check (code_fehler_limit between 3 and 100),
  add column if not exists lose_checkin integer not null default 1 check (lose_checkin between 0 and 10),
  add column if not exists lose_komplett integer not null default 5 check (lose_komplett between 0 and 100),
  add column if not exists teilnahme_text text not null default
    'Die Teilnahme ist kostenlos, ein Kauf ist nicht nötig. Teilnahme ab 16 Jahren bzw. mit Einverständnis der Eltern; Preise mit Alkohol gibt es nur ab 18 Jahren. Lose sammelst du im Album (Check-ins, Album komplett, Ziele). Die Gewinnerin oder der Gewinner wird im Album benachrichtigt. Veranstalter: SV Agathenburg-Dollern. Der Rechtsweg ist ausgeschlossen.'
    check (char_length(btrim(teilnahme_text)) between 10 and 1500);

-- Neue Standards (Jugendschutz: „Getränk nach Wahl“). Bestehende Zeile nur
-- anpassen, wenn sie noch auf den ALTEN Standardwerten steht.
alter table public.sva_album_einstellungen alter column schwelle_1 set default 3;
alter table public.sva_album_einstellungen alter column schwelle_2 set default 6;
alter table public.sva_album_einstellungen alter column belohnung_1 set default 'Getränk nach Wahl';
alter table public.sva_album_einstellungen alter column belohnung_2 set default 'Bratwurst + Getränk nach Wahl oder Fanartikel';
alter table public.sva_album_einstellungen alter column doppelte_bremse set default 25;
update public.sva_album_einstellungen
   set schwelle_1 = 3, schwelle_2 = 6,
       belohnung_1 = 'Getränk nach Wahl',
       belohnung_2 = 'Bratwurst + Getränk nach Wahl oder Fanartikel',
       doppelte_bremse = case when doppelte_bremse = 50 then 25 else doppelte_bremse end,
       updated_at = now()
 where id = 1 and schwelle_1 = 5 and schwelle_2 = 10
   and belohnung_1 = 'Freibier oder Bratwurst' and belohnung_2 = 'SVA-Fanartikel';
update public.sva_album_einstellungen set schwelle_3 = null where schwelle_3 is not null and schwelle_3 <= schwelle_2;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_album_einstellungen_schwelle_3') then
    alter table public.sva_album_einstellungen
      add constraint sva_album_einstellungen_schwelle_3 check (schwelle_3 is null or schwelle_3 > schwelle_2);
  end if;
end $$;

-- ── 2. Karten-Katalog: neue Spalten ─────────────────────────────────────────
alter table public.sva_album_karten
  -- Silber-Glanz-Variante: Zusatz-Sammelstück, füllt KEINEN Album-Platz
  add column if not exists variante boolean not null default false,
  -- Bonus-Seite (Spieler des Spiels, Derby, Weihnachten): zählt nicht fürs Album
  add column if not exists limitiert boolean not null default false,
  add column if not exists ziehbar_von timestamptz,
  add column if not exists ziehbar_bis timestamptz,
  -- Derby-Karte: nur in Packs dieses Spiels (Check-in, Heimsieg, Freund)
  add column if not exists nur_spiel_id uuid references public.sm_spiele(id) on delete set null,
  -- „präsentiert von …“ (Partner-Spezial)
  add column if not exists praesentiert_von uuid references public.sm_sponsoren(id) on delete set null,
  add column if not exists credit text check (credit is null or char_length(credit) <= 80),
  -- CSS object-position, z. B. '50% 40%'
  add column if not exists bild_fokus text check (bild_fokus is null or bild_fokus ~ '^(100|[0-9]{1,2})% (100|[0-9]{1,2})%$'),
  -- Steckbrief-Text der Kartenrückseite
  add column if not exists rueckseite text check (rueckseite is null or char_length(rueckseite) <= 400),
  add column if not exists serie text check (serie is null or char_length(serie) <= 40),
  -- „Spieler des Spiels“: zu welchem Spiel (Idempotenz von album_admin_motm)
  add column if not exists motm_spiel_id uuid references public.sm_spiele(id) on delete set null;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_album_karten_fenster') then
    alter table public.sva_album_karten add constraint sva_album_karten_fenster
      check (ziehbar_von is null or ziehbar_bis is null or ziehbar_bis > ziehbar_von);
  end if;
end $$;
-- Eindeutig je Spieler/Seltenheit/Saison — Varianten und limitierte Karten
-- (mehrere „Spieler des Spiels“ für denselben Spieler) kollidieren nicht.
drop index if exists public.sva_album_karten_spieler_uniq;
create unique index sva_album_karten_spieler_uniq
  on public.sva_album_karten (roster_id, seltenheit, variante, coalesce(saison, ''))
  where typ in ('spieler', 'trainer') and roster_id is not null and not limitiert;
create index if not exists sva_album_karten_motm_idx on public.sva_album_karten (roster_id, motm_spiel_id) where limitiert;

-- ── 3. Packs + Gutscheine: neue Arten/Stufen ────────────────────────────────
alter table public.sva_album_packs drop constraint if exists sva_album_packs_art_check;
alter table public.sva_album_packs add constraint sva_album_packs_art_check check (art in (
  'checkin', 'heimsieg', 'geschenk', 'starter', 'tipp', 'story', 'partner', 'advent',
  'freund', 'kapitel', 'wunsch', 'ziel'));
alter table public.sva_album_packs
  -- Idempotenz-Schlüssel je Fan und Art (z. B. 'starter', Code-ID, 'tipp:<id>')
  add column if not exists quelle text check (quelle is null or char_length(quelle) <= 120),
  add column if not exists titel text check (titel is null or char_length(titel) <= 80);
create unique index if not exists sva_album_packs_quelle
  on public.sva_album_packs (fan_user_id, art, quelle) where quelle is not null;

alter table public.sva_album_gutscheine drop constraint if exists sva_album_gutscheine_stufe_check;
alter table public.sva_album_gutscheine add constraint sva_album_gutscheine_stufe_check
  check (stufe in ('schwelle_1', 'schwelle_2', 'schwelle_3', 'komplett'));

-- ── 4. Fan-Freundescode ─────────────────────────────────────────────────────
-- 6 Zeichen ohne 0/O/1/I. Wird per Spalten-Default beim Anlegen des Profils
-- erzeugt (album_mein bleibt dadurch eine reine Lese-Funktion).
create or replace function public.sva_album_freund_code_neu()
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
    exit when not exists (select 1 from public.sva_album_fans f where f.freund_code = v);
  end loop;
  return v;
end;
$$;
alter table public.sva_album_fans add column if not exists freund_code text
  check (freund_code is null or freund_code ~ '^[A-HJ-NP-Z2-9]{6}$');
update public.sva_album_fans set freund_code = public.sva_album_freund_code_neu() where freund_code is null;
alter table public.sva_album_fans alter column freund_code set default public.sva_album_freund_code_neu();
create unique index if not exists sva_album_fans_freund_code on public.sva_album_fans (freund_code);

-- ── 5. Neue Tabellen ────────────────────────────────────────────────────────
-- Aktions-Codes: Instagram-Story (24 h), Partner (im Laden, gezielte Karte),
-- Adventskalender (je Tag einer, Tag 24 = Weihnachtskarte).
create table if not exists public.sva_album_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-Z0-9-]{4,24}$'),
  art text not null check (art in ('story', 'partner', 'advent')),
  titel text not null check (char_length(btrim(titel)) between 2 and 60),
  -- gezielte Karte (Partner-/Weihnachtskarte) — unabhängig vom Ziehfenster
  karte_id uuid references public.sva_album_karten(id) on delete set null,
  karten integer not null default 1 check (karten between 1 and 5),
  gueltig_von timestamptz not null default now(),
  gueltig_bis timestamptz not null default (now() + interval '24 hours'),
  max_einloesungen integer check (max_einloesungen is null or max_einloesungen >= 1),
  aktiv boolean not null default true,
  advent_jahr integer check (advent_jahr is null or advent_jahr between 2024 and 2100),
  advent_tag integer check (advent_tag is null or advent_tag between 1 and 24),
  erzeugt_von text,
  created_at timestamptz not null default now(),
  constraint sva_album_codes_fenster check (gueltig_bis > gueltig_von)
);
comment on table public.sva_album_codes is 'Aktions-Codes (Story/Partner/Advent). 1× pro Konto. Nur Admin; Einlösen über album_code_einloesen().';
create unique index if not exists sva_album_codes_advent on public.sva_album_codes (advent_jahr, advent_tag) where art = 'advent';
alter table public.sva_album_codes enable row level security;

create table if not exists public.sva_album_code_einloesungen (
  code_id uuid not null references public.sva_album_codes(id) on delete cascade,
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (code_id, fan_user_id)
);
comment on table public.sva_album_code_einloesungen is 'Welcher Fan hat welchen Aktions-Code eingelöst (1× pro Konto).';
create index if not exists sva_album_code_einloesungen_fan on public.sva_album_code_einloesungen (fan_user_id);
alter table public.sva_album_code_einloesungen enable row level security;

create table if not exists public.sva_album_code_fehler (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now()
);
comment on table public.sva_album_code_fehler is 'Falsche Code-Eingaben (Sperre nach code_fehler_limit pro Stunde). Nach 1 Tag gelöscht.';
create index if not exists sva_album_code_fehler_idx on public.sva_album_code_fehler (fan_user_id, at desc);
alter table public.sva_album_code_fehler enable row level security;

create table if not exists public.sva_album_freunde (
  fan_a uuid not null references auth.users(id) on delete cascade,
  fan_b uuid not null references auth.users(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (fan_a, fan_b),
  constraint sva_album_freunde_sortiert check (fan_a < fan_b)
);
comment on table public.sva_album_freunde is 'Freundschaften (symmetrisch, fan_a < fan_b). Freund-Bonus bei gemeinsamem Check-in.';
create index if not exists sva_album_freunde_b on public.sva_album_freunde (fan_b);
alter table public.sva_album_freunde enable row level security;

create table if not exists public.sva_album_tausch (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{8}$'),
  von_fan uuid not null references auth.users(id) on delete cascade,
  an_fan uuid references auth.users(id) on delete set null,
  biete_karte uuid not null references public.sva_album_karten(id) on delete cascade,
  wunsch_karte uuid not null references public.sva_album_karten(id) on delete cascade,
  status text not null default 'offen' check (status in ('offen', 'erledigt', 'zurueckgezogen', 'abgelaufen')),
  created_at timestamptz not null default now(),
  gueltig_bis timestamptz not null default (now() + interval '7 days'),
  erledigt_at timestamptz,
  constraint sva_album_tausch_verschieden check (biete_karte <> wunsch_karte)
);
comment on table public.sva_album_tausch is 'Tausch-Angebote 1:1 per Link/Code (nur echte Doppelte, keine limitierten Karten).';
create index if not exists sva_album_tausch_von on public.sva_album_tausch (von_fan, status);
create index if not exists sva_album_tausch_an on public.sva_album_tausch (an_fan, status);
alter table public.sva_album_tausch enable row level security;

create table if not exists public.sva_album_abzeichen (
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  saison text not null,
  kapitel text not null check (kapitel in ('TW', 'ABW', 'MIT', 'ANG', 'stab', 'moment', 'fan', 'partner')),
  at timestamptz not null default now(),
  primary key (fan_user_id, saison, kapitel)
);
comment on table public.sva_album_abzeichen is 'Kapitel komplett (Abzeichen) je Fan und Saison.';
alter table public.sva_album_abzeichen enable row level security;

-- Sammelziele / Missionen
create table if not exists public.sva_album_ziele (
  id uuid primary key default gen_random_uuid(),
  schluessel text not null unique check (schluessel ~ '^[a-z0-9_:-]{2,60}$'),
  typ text not null check (typ in ('set', 'kapitel', 'meilenstein', 'serie_checkin', 'serie_tipp',
                                   'sozial_tausch', 'sozial_freund', 'extern')),
  -- Admin-Vorlage (Frontend), z. B. 'familie' für Familien-Sets
  vorlage text check (vorlage is null or vorlage in ('familie', 'set', 'kapitel', 'serie', 'sozial', 'tipp',
                                                     'challenge', 'meilenstein', 'mission')),
  titel text not null check (char_length(btrim(titel)) between 2 and 60),
  beschreibung text check (beschreibung is null or char_length(beschreibung) <= 200),
  -- set: Karten-IDs und/oder Personen (→ deren Basis-Karte der Saison, auch Trainerstab)
  karten uuid[],
  roster_ids uuid[],
  kapitel text check (kapitel is null or kapitel in ('TW', 'ABW', 'MIT', 'ANG', 'stab', 'moment', 'fan', 'partner')),
  -- set: mind. N aus der Menge · meilenstein: Prozent · serie_*: Länge · sozial_*: Anzahl
  anzahl integer check (anzahl is null or anzahl between 1 and 1000),
  belohnung_karten integer not null default 1 check (belohnung_karten between 0 and 5),
  belohnung_min_seltenheit text check (belohnung_min_seltenheit is null or belohnung_min_seltenheit in ('bronze', 'silber', 'gold', 'spezial')),
  belohnung_lose integer not null default 0 check (belohnung_lose between 0 and 100),
  geheim boolean not null default false,
  wiederholbar boolean not null default false,
  gueltig_von timestamptz,
  gueltig_bis timestamptz,
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  saison text check (saison is null or saison ~ '^[0-9]{4}(/[0-9]{2})?$'),
  created_at timestamptz not null default now(),
  constraint sva_album_ziele_wiederholbar check (not wiederholbar or typ = 'extern'),
  constraint sva_album_ziele_kapitel check (typ <> 'kapitel' or kapitel is not null)
);
comment on table public.sva_album_ziele is 'Sammelziele/Missionen (Sets, Kapitel, Meilensteine, Serien, Sozial, extern = Tipp-Liga). Nur Admin.';
alter table public.sva_album_ziele enable row level security;

create table if not exists public.sva_album_ziel_erreicht (
  ziel_id uuid not null references public.sva_album_ziele(id) on delete cascade,
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  -- Saison bei einmaligen Zielen, Bezug (z. B. Spiel-ID) bei wiederholbaren
  bezug text not null default '',
  saison text,
  at timestamptz not null default now(),
  pack_id uuid references public.sva_album_packs(id) on delete set null,
  lose integer not null default 0,
  primary key (ziel_id, fan_user_id, bezug)
);
comment on table public.sva_album_ziel_erreicht is 'Erreichte Ziele je Fan (idempotent je Ziel, Fan, Bezug).';
create index if not exists sva_album_ziel_erreicht_fan on public.sva_album_ziel_erreicht (fan_user_id, saison);
alter table public.sva_album_ziel_erreicht enable row level security;

-- Lose für Verlosungen
create table if not exists public.sva_album_lose (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  anzahl integer not null check (anzahl between 1 and 1000),
  quelle text not null check (quelle in ('checkin', 'komplett', 'ziel', 'admin')),
  bezug text not null default '',
  saison text not null,
  at timestamptz not null default now(),
  constraint sva_album_lose_einmal unique (fan_user_id, quelle, bezug)
);
comment on table public.sva_album_lose is 'Lose je Fan (Check-in, Album komplett, Ziele). Grundlage der Verlosungen.';
create index if not exists sva_album_lose_saison on public.sva_album_lose (saison, fan_user_id);
alter table public.sva_album_lose enable row level security;

create table if not exists public.sva_album_verlosungen (
  id uuid primary key default gen_random_uuid(),
  titel text not null check (char_length(btrim(titel)) between 2 and 80),
  preis text check (preis is null or char_length(preis) <= 200),
  bild_url text check (bild_url is null or (char_length(bild_url) <= 500 and bild_url ~ '^(https://|/)')),
  partner_id uuid references public.sm_sponsoren(id) on delete set null,
  -- Lose bis zu diesem Zeitpunkt zählen (null = bis zur Ziehung)
  stichtag timestamptz,
  min_lose integer not null default 1 check (min_lose between 1 and 1000),
  -- leer → aktuelle Saison (Trigger unten; ein Funktions-Default liefe mit den
  -- Rechten des Admins, der sva_album_saison() nicht ausführen darf)
  saison text not null,
  status text not null default 'offen' check (status in ('offen', 'gezogen')),
  seed text,
  gezogen_at timestamptz,
  teilnehmer integer,
  lose_gesamt integer,
  gewinner_fan uuid references auth.users(id) on delete set null,
  gewinner_name text,
  protokoll jsonb,
  created_at timestamptz not null default now()
);
comment on table public.sva_album_verlosungen is 'Verlosungen (gewichtet nach Losen, deterministisch aus protokolliertem Seed). Nur Admin.';
alter table public.sva_album_verlosungen enable row level security;
-- Saison ergänzen. Ergebnis-Felder (Status, Seed, Gewinner, Protokoll) setzt
-- NUR album_admin_verlosung_ziehen (bzw. album_konto_loeschen) — erkennbar am
-- transaktionslokalen Schalter sva.verlosung_intern. Direkt im Admin
-- (Tabellen-Update) lassen sie sich nicht fälschen.
create or replace function public.sva_album_verlosung_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_intern boolean := coalesce(current_setting('sva.verlosung_intern', true), '') = 'an';
begin
  if new.saison is null or btrim(new.saison) = '' then
    new.saison := public.sva_album_saison();
  end if;
  if tg_op = 'INSERT' then
    if not v_intern then
      new.status := 'offen'; new.seed := null; new.gezogen_at := null; new.teilnehmer := null; new.lose_gesamt := null;
      new.gewinner_fan := null; new.gewinner_name := null; new.protokoll := null;
    end if;
  elsif not v_intern
        and (new.status, new.seed, new.gezogen_at, new.teilnehmer, new.lose_gesamt, new.gewinner_fan, new.gewinner_name, new.protokoll)
            is distinct from
            (old.status, old.seed, old.gezogen_at, old.teilnehmer, old.lose_gesamt, old.gewinner_fan, old.gewinner_name, old.protokoll)
        -- Ausnahme: Login gelöscht (FK „on delete set null“) → nur gewinner_fan wird leer
        and not (new.gewinner_fan is null
                 and (new.status, new.seed, new.gezogen_at, new.teilnehmer, new.lose_gesamt, new.gewinner_name, new.protokoll)
                     is not distinct from
                     (old.status, old.seed, old.gezogen_at, old.teilnehmer, old.lose_gesamt, old.gewinner_name, old.protokoll)) then
    raise exception 'album_verlosung_ergebnis_gesperrt' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.sva_album_verlosung_trigger() from public, anon, authenticated;
drop trigger if exists sva_album_verlosung_trigger on public.sva_album_verlosungen;
create trigger sva_album_verlosung_trigger
  before insert or update on public.sva_album_verlosungen
  for each row execute function public.sva_album_verlosung_trigger();

-- RLS: Pflege-Tabellen = Admin schreibt/liest; Fan-Daten = Admin liest.
-- Fans haben bewusst KEINE Policy (nur RPCs).
do $$
declare t text;
begin
  foreach t in array array['sva_album_codes', 'sva_album_ziele', 'sva_album_verlosungen'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_sm_admin()) with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_sm_admin())', t);
  end loop;
  foreach t in array array['sva_album_code_einloesungen', 'sva_album_code_fehler', 'sva_album_freunde', 'sva_album_tausch',
                           'sva_album_abzeichen', 'sva_album_ziel_erreicht', 'sva_album_lose'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
  end loop;
end $$;
revoke all on public.sva_album_codes, public.sva_album_code_einloesungen, public.sva_album_code_fehler,
              public.sva_album_freunde, public.sva_album_tausch, public.sva_album_abzeichen,
              public.sva_album_ziele, public.sva_album_ziel_erreicht, public.sva_album_lose,
              public.sva_album_verlosungen
  from anon;

-- ── 6. Interne Helfer ───────────────────────────────────────────────────────
-- Album-Platz einer Karte: Person (Spieler/Trainerstab) = roster_id, sonst die Karte.
create or replace function public.sva_album_platz(p_typ text, p_roster uuid, p_id uuid)
returns uuid
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case when p_typ in ('spieler', 'trainer') and p_roster is not null then p_roster else p_id end;
$$;

-- Kapitel: TW/ABW/MIT/ANG (Spieler nach Position, wie album_katalog), stab,
-- moment, fan (= „Kurve“), partner.
create or replace function public.sva_album_kapitel_von(p_typ text, p_position text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case p_typ
           when 'spieler' then case upper(coalesce(p_position, ''))
                                 when 'TW' then 'TW' when 'TORWART' then 'TW'
                                 when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
                                 when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
                                 else 'MIT' end
           when 'trainer' then 'stab'
           else p_typ end;
$$;

create or replace function public.sva_album_rang(p_s text)
returns integer
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case p_s when 'bronze' then 1 when 'silber' then 2 when 'gold' then 3 when 'spezial' then 4 else 0 end;
$$;

-- „Jetzt“ für reine ANZEIGE-Zwecke (Adventskalender in album_mein). Im Test
-- über set_config('sva.test_jetzt', …) verschiebbar; Code-Gültigkeit,
-- Ziehfenster usw. nutzen immer now().
create or replace function public.sva_album_jetzt()
returns timestamptz
language sql
stable
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(nullif(current_setting('sva.test_jetzt', true), '')::timestamptz, now());
$$;

-- „Vorname I.“
create or replace function public.sva_album_name(p_fan uuid)
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select f.vorname || ' ' || f.initial || '.' from public.sva_album_fans f where f.user_id = p_fan;
$$;

-- Zufallscode aus lesbarem Alphabet (ohne 0/O/1/I)
create or replace function public.sva_album_zufall(p_len integer)
returns text
language sql
volatile
set search_path to 'public', 'pg_temp'
as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
    from generate_series(1, greatest(1, p_len));
$$;

create or replace function public.sva_album_aktionscode_neu(p_prefix text)
returns text
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v text; i int;
begin
  for i in 1 .. 20 loop
    v := upper(p_prefix) || '-' || public.sva_album_zufall(5);
    exit when not exists (select 1 from public.sva_album_codes c where c.code = v);
  end loop;
  return v;
end;
$$;

create or replace function public.sva_album_tauschcode_neu()
returns text
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v text; i int;
begin
  for i in 1 .. 20 loop
    v := public.sva_album_zufall(8);
    exit when not exists (select 1 from public.sva_album_tausch t where t.code = v);
  end loop;
  return v;
end;
$$;

-- Lose buchen (idempotent je Fan/Quelle/Bezug)
create or replace function public.sva_album_lose_buchen(p_fan uuid, p_anzahl integer, p_quelle text, p_bezug text, p_saison text default null)
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_id uuid;
begin
  if coalesce(p_anzahl, 0) <= 0 then
    return 0;
  end if;
  insert into public.sva_album_lose (fan_user_id, anzahl, quelle, bezug, saison)
  values (p_fan, p_anzahl, p_quelle, coalesce(p_bezug, ''), coalesce(p_saison, public.sva_album_saison()))
  on conflict on constraint sva_album_lose_einmal do nothing
  returning id into v_id;
  return case when v_id is null then 0 else p_anzahl end;
end;
$$;

-- Alle Album-Plätze der Saison (ohne Varianten/limitierte) + ob der Fan ihn belegt.
create or replace function public.sva_album_plaetze(p_fan uuid)
returns table (platz uuid, kapitel text, belegt boolean)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with k as (
    select public.sva_album_platz(k.typ, k.roster_id, k.id) as platz,
           public.sva_album_kapitel_von(k.typ, r.position) as kapitel,
           k.id
      from public.sva_album_karten k
      left join public.sm_roster r on r.id = k.roster_id
     where k.aktiv and not k.variante and not k.limitiert
       and (k.saison is null or k.saison = public.sva_album_saison())
  )
  select k.platz, min(k.kapitel),
         bool_or(exists (select 1 from public.sva_album_besitz b where b.fan_user_id = p_fan and b.karte_id = k.id))
    from k
   group by k.platz;
$$;

-- Konto alt genug zum Tauschen?
create or replace function public.sva_album_konto_alt(p_fan uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (select 1 from public.sva_album_fans f
                  where f.user_id = p_fan
                    and f.created_at <= now() - make_interval(days => (select e.tausch_min_tage from public.sva_album_einstellungen e where e.id = 1)));
$$;

-- Erledigte Tausche der letzten 7 Tage
create or replace function public.sva_album_tausch_woche(p_fan uuid)
returns integer
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select count(*)::int from public.sva_album_tausch t
   where (t.von_fan = p_fan or t.an_fan = p_fan) and t.status = 'erledigt'
     and t.erledigt_at > now() - interval '7 days';
$$;

-- ── 7. Ziehung ──────────────────────────────────────────────────────────────
-- Seltenheit nach Gewicht aus den übergebenen Stufen (nur Gewicht > 0).
create or replace function public.sva_album_stufe(p_set public.sva_album_einstellungen, p_stufen text[])
returns text
language plpgsql
volatile
set search_path to 'public', 'pg_temp'
as $$
declare
  v_total numeric := 0;
  v_r numeric;
  v_s text;
  v_w numeric;
  v_letzte text;
begin
  foreach v_s in array array['bronze', 'silber', 'gold', 'spezial'] loop
    if v_s = any (p_stufen) then
      v_w := case v_s when 'bronze' then p_set.gewicht_bronze when 'silber' then p_set.gewicht_silber
                      when 'gold' then p_set.gewicht_gold else p_set.gewicht_spezial end;
      if v_w > 0 then
        v_total := v_total + v_w;
        v_letzte := v_s;
      end if;
    end if;
  end loop;
  if v_total <= 0 then
    return null;
  end if;
  v_r := random() * v_total;
  foreach v_s in array array['bronze', 'silber', 'gold', 'spezial'] loop
    if v_s = any (p_stufen) then
      v_w := case v_s when 'bronze' then p_set.gewicht_bronze when 'silber' then p_set.gewicht_silber
                      when 'gold' then p_set.gewicht_gold else p_set.gewicht_spezial end;
      if v_w > 0 then
        if v_r < v_w then
          return v_s;
        end if;
        v_r := v_r - v_w;
      end if;
    end if;
  end loop;
  return v_letzte;
end;
$$;

-- Eine Karte wählen (scripts/karten-simulation.mjs → karteWaehlen):
--   1. Seltenheit nach Gewicht aus den erlaubten Stufen mit ziehbaren Karten
--   2. Smart: fehlende Album-Karte dieser Stufe; sonst Stufe neu ziehen unter
--      den Stufen, in denen noch Album-Karten fehlen
--   3. Doppelten-Bremse: mit doppelte_bremse % eine Karte, die der Fan nicht hat
--   4. sonst Zufall innerhalb der Stufe
create or replace function public.sva_album_karte_waehlen(
  p_set public.sva_album_einstellungen,
  p_ids uuid[], p_selt text[], p_album boolean[], p_platz uuid[],
  p_erlaubt text[], p_smart boolean,
  p_hat_karten uuid[], p_hat_plaetze uuid[], p_pack_karten uuid[], p_pack_plaetze uuid[])
returns uuid
language plpgsql
volatile
set search_path to 'public', 'pg_temp'
as $$
declare
  v_vorhanden text[];
  v_fehlt text[];
  v_s text;
  v_s2 text;
  v_k uuid;
begin
  select array_agg(distinct t.s) into v_vorhanden from unnest(p_selt) as t(s) where t.s = any (p_erlaubt);
  if v_vorhanden is null then
    return null;
  end if;
  v_s := public.sva_album_stufe(p_set, v_vorhanden);

  if p_smart then
    select t.id into v_k
      from unnest(p_ids, p_selt, p_album, p_platz) as t(id, s, a, p)
     where t.a and t.s = v_s and not (t.p = any (p_hat_plaetze)) and not (t.p = any (p_pack_plaetze))
     order by random() limit 1;
    if v_k is null then
      select array_agg(distinct t.s) into v_fehlt
        from unnest(p_ids, p_selt, p_album, p_platz) as t(id, s, a, p)
       where t.a and t.s = any (p_erlaubt) and not (t.p = any (p_hat_plaetze)) and not (t.p = any (p_pack_plaetze));
      if v_fehlt is not null then
        v_s2 := public.sva_album_stufe(p_set, v_fehlt);
        if v_s2 is not null then
          select t.id into v_k
            from unnest(p_ids, p_selt, p_album, p_platz) as t(id, s, a, p)
           where t.a and t.s = v_s2 and not (t.p = any (p_hat_plaetze)) and not (t.p = any (p_pack_plaetze))
           order by random() limit 1;
        end if;
      end if;
    end if;
    if v_k is not null then
      return v_k;
    end if;
  end if;

  if random() * 100 < coalesce(p_set.doppelte_bremse, 0) then
    select t.id into v_k from unnest(p_ids, p_selt) as t(id, s)
     where (v_s is null or t.s = v_s) and t.s = any (p_erlaubt)
       and not (t.id = any (p_hat_karten)) and not (t.id = any (p_pack_karten))
     order by random() limit 1;
  end if;
  if v_k is null then
    select t.id into v_k from unnest(p_ids, p_selt) as t(id, s)
     where (v_s is null or t.s = v_s) and t.s = any (p_erlaubt)
     order by random() limit 1;
  end if;
  return v_k;
end;
$$;

-- Zieht ein Pack. Idempotent je (Fan, Spiel, Art) bzw. (Fan, Art, Quelle).
-- Gibt die Pack-ID zurück, null wenn es das Pack schon gibt, die Größe 0 ist
-- oder nichts ziehbar ist.
--   p_min_seltenheit: mind. eine Karte dieser Stufe oder besser (Starter, Ziele)
--   p_fest:           feste erste Karte (Partner-/Weihnachts-/Wunschkarte)
--   p_belohnung:      Belohnungs-Pack (Kapitel/Ziel) → Smart nur mit smart_pack_belohnung
create or replace function public.sva_album_pack_ziehen_v20(
  p_fan uuid,
  p_art text,
  p_spiel uuid default null,
  p_anzahl integer default null,
  p_quelle text default null,
  p_titel text default null,
  p_min_seltenheit text default null,
  p_fest uuid default null,
  p_belohnung boolean default false)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_set    public.sva_album_einstellungen;
  v_saison text := public.sva_album_saison();
  v_n      integer;
  v_ids    uuid[];
  v_selt   text[];
  v_album  boolean[];
  v_platz  uuid[];
  v_hat_k  uuid[];
  v_hat_p  uuid[];
  v_karten uuid[] := '{}';
  v_seltn  text[] := '{}';
  v_pp     uuid[] := '{}';
  v_smart  boolean;
  v_fest   public.sva_album_karten;
  v_k      uuid;
  v_s      text;
  v_i      integer;
  v_id     uuid;
  v_erlaubt text[];
begin
  select * into v_set from public.sva_album_einstellungen where id = 1;
  v_n := greatest(0, least(10, coalesce(p_anzahl, v_set.karten_pro_pack, 3)));
  if v_n = 0 then
    return null;
  end if;
  -- schon vorhanden? (spart die Ziehung; die Unique-Indizes sichern zusätzlich ab)
  if p_quelle is not null and exists (select 1 from public.sva_album_packs p
                                       where p.fan_user_id = p_fan and p.art = p_art and p.quelle = p_quelle) then
    return null;
  end if;
  if p_spiel is not null and exists (select 1 from public.sva_album_packs p
                                      where p.fan_user_id = p_fan and p.art = p_art and p.spiel_id = p_spiel) then
    return null;
  end if;

  -- Ziehbar: aktiv, Saison, Zeitfenster, Derby nur im Pack dieses Spiels.
  -- Limitierte Karten ohne Fenster/Spiel (z. B. Weihnachtskarte) nur per Code.
  select coalesce(array_agg(k.id), '{}'), coalesce(array_agg(k.seltenheit), '{}'),
         coalesce(array_agg(not k.variante and not k.limitiert), '{}'),
         coalesce(array_agg(public.sva_album_platz(k.typ, k.roster_id, k.id)), '{}')
    into v_ids, v_selt, v_album, v_platz
    from public.sva_album_karten k
   where k.aktiv and (k.saison is null or k.saison = v_saison)
     and (k.ziehbar_von is null or k.ziehbar_von <= now())
     and (k.ziehbar_bis is null or k.ziehbar_bis > now())
     and (k.nur_spiel_id is null or k.nur_spiel_id = p_spiel)
     and (not k.limitiert or k.ziehbar_von is not null or k.ziehbar_bis is not null or k.nur_spiel_id is not null);

  if p_fest is not null then
    select * into v_fest from public.sva_album_karten k where k.id = p_fest;
  end if;
  if cardinality(v_ids) = 0 and v_fest.id is null then
    return null;
  end if;

  -- Was hat der Fan schon (Besitz + ungeöffnete Packs)?
  select coalesce(array_agg(distinct x.k), '{}') into v_hat_k
    from (select b.karte_id as k from public.sva_album_besitz b where b.fan_user_id = p_fan
          union
          select unnest(p.karten) from public.sva_album_packs p where p.fan_user_id = p_fan and p.geoeffnet_at is null) x;
  select coalesce(array_agg(distinct public.sva_album_platz(k.typ, k.roster_id, k.id)), '{}') into v_hat_p
    from public.sva_album_karten k
   where k.id = any (v_hat_k) and not k.variante and not k.limitiert;

  v_smart := coalesce(v_set.smart_pack, true) and v_fest.id is null
             and (not coalesce(p_belohnung, false) or coalesce(v_set.smart_pack_belohnung, false));

  for v_i in 1 .. v_n loop
    if v_i = 1 and v_fest.id is not null then
      v_k := v_fest.id;
      v_s := v_fest.seltenheit;
      if not v_fest.variante and not v_fest.limitiert then
        v_pp := v_pp || public.sva_album_platz(v_fest.typ, v_fest.roster_id, v_fest.id);
      end if;
    else
      v_k := public.sva_album_karte_waehlen(v_set, v_ids, v_selt, v_album, v_platz,
               array['bronze', 'silber', 'gold', 'spezial'], v_smart and v_i = 1,
               v_hat_k, v_hat_p, v_karten, v_pp);
      exit when v_k is null;
      select t.s into v_s from unnest(v_ids, v_selt) as t(id, s) where t.id = v_k limit 1;
      -- nur Album-Karten belegen einen Platz (keine null-Einträge: „= any“ mit null wäre null)
      v_pp := v_pp || array(select t.p from unnest(v_ids, v_album, v_platz) as t(id, a, p) where t.id = v_k and t.a limit 1);
    end if;
    v_karten := v_karten || v_k;
    v_seltn := v_seltn || v_s;
  end loop;

  -- Mindest-Seltenheit: letzte Karte ersetzen (die feste Karte bleibt immer)
  if p_min_seltenheit in ('silber', 'gold', 'spezial') and cardinality(v_karten) > 0
     and not exists (select 1 from unnest(v_seltn) s where public.sva_album_rang(s) >= public.sva_album_rang(p_min_seltenheit))
     and not (cardinality(v_karten) = 1 and v_fest.id is not null) then
    v_erlaubt := array(select s from unnest(array['silber', 'gold', 'spezial']) s
                        where public.sva_album_rang(s) >= public.sva_album_rang(p_min_seltenheit));
    v_karten := v_karten[1:cardinality(v_karten) - 1];
    v_seltn := v_seltn[1:cardinality(v_seltn) - 1];
    v_pp := array(select t.p from unnest(v_ids, v_album, v_platz) as t(id, a, p) where t.a and t.id = any (v_karten));
    v_k := public.sva_album_karte_waehlen(v_set, v_ids, v_selt, v_album, v_platz, v_erlaubt,
             v_smart and cardinality(v_karten) = 0, v_hat_k, v_hat_p, v_karten, v_pp);
    if v_k is not null then
      v_karten := v_karten || v_k;
      v_seltn := v_seltn || (select t.s from unnest(v_ids, v_selt) as t(id, s) where t.id = v_k limit 1);
    end if;
  end if;
  if cardinality(v_karten) = 0 then
    return null;
  end if;

  insert into public.sva_album_packs (fan_user_id, spiel_id, art, karten, seltenheiten, saison, quelle, titel)
  values (p_fan, p_spiel, p_art, v_karten, v_seltn, v_saison, p_quelle, left(p_titel, 80))
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Alte Signatur (Check-in, Heimsieg-Trigger, Freund, Geschenk). Packgröße je Art.
create or replace function public.sva_album_pack_ziehen(p_fan uuid, p_spiel uuid, p_art text)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_set public.sva_album_einstellungen;
begin
  select * into v_set from public.sva_album_einstellungen where id = 1;
  return public.sva_album_pack_ziehen_v20(
    p_fan, p_art, p_spiel,
    case p_art when 'heimsieg' then v_set.karten_heimsieg
               when 'freund' then v_set.karten_freund
               when 'starter' then v_set.karten_starter
               when 'tipp' then v_set.karten_tipp
               when 'story' then v_set.karten_story
               when 'kapitel' then v_set.karten_kapitel
               else v_set.karten_pro_pack end,
    case when p_art in ('freund', 'starter') then coalesce(p_spiel::text, p_art) end,
    case p_art when 'freund' then 'Freundes-Bonus' when 'heimsieg' then 'Heimsieg-Bonus'
               when 'starter' then 'Starter-Pack' end,
    case when p_art = 'starter' and v_set.starter_min_silber then 'silber' end,
    null,
    p_art = 'kapitel');
end;
$$;

-- ── 8. Album komplett, Kapitel, Belohnungen, Ziele ──────────────────────────
-- Album komplett = jeder SPIELER-Platz der Saison belegt (Basis-Karte; Varianten
-- und limitierte Karten zählen nicht).
create or replace function public.sva_album_komplett(p_fan uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select count(*) > 0 and coalesce(bool_and(p.belegt), false)
    from public.sva_album_plaetze(p_fan) p
   where p.kapitel in ('TW', 'ABW', 'MIT', 'ANG');
$$;

-- Prüft Schwellen (3/6/8) + Album komplett, legt fehlende Gutscheine an,
-- bucht Lose für „Album komplett“. Gibt die NEU angelegten Gutscheine zurück.
create or replace function public.sva_album_belohnungen(p_fan uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_set    public.sva_album_einstellungen;
  v_saison text := public.sva_album_saison();
  v_n      integer;
  v_neu    jsonb := '[]'::jsonb;
  v_row    public.sva_album_gutscheine;
  v_stufe  text;
  v_titel  text;
  v_partner uuid;
begin
  select * into v_set from public.sva_album_einstellungen where id = 1;
  select count(*) into v_n from public.sva_album_checkins c where c.fan_user_id = p_fan and c.saison = v_saison;

  foreach v_stufe in array array['schwelle_1', 'schwelle_2', 'schwelle_3', 'komplett'] loop
    if (v_stufe = 'schwelle_1' and v_n >= v_set.schwelle_1)
       or (v_stufe = 'schwelle_2' and v_n >= v_set.schwelle_2)
       or (v_stufe = 'schwelle_3' and v_set.schwelle_3 is not null and v_n >= v_set.schwelle_3)
       or (v_stufe = 'komplett' and public.sva_album_komplett(p_fan)) then
      v_titel := case v_stufe when 'schwelle_1' then v_set.belohnung_1 when 'schwelle_2' then v_set.belohnung_2
                              when 'schwelle_3' then v_set.belohnung_3 else v_set.belohnung_komplett end;
      v_partner := case v_stufe when 'schwelle_1' then v_set.partner_1_id when 'schwelle_2' then v_set.partner_2_id
                                when 'schwelle_3' then v_set.partner_3_id else v_set.partner_komplett_id end;
      v_row := null;
      insert into public.sva_album_gutscheine (fan_user_id, saison, stufe, titel, partner_id, code)
      values (p_fan, v_saison, v_stufe, v_titel, v_partner, public.sva_album_code())
      on conflict (fan_user_id, saison, stufe) do nothing
      returning * into v_row;
      if v_row.id is not null then
        v_neu := v_neu || jsonb_build_object('id', v_row.id, 'stufe', v_row.stufe, 'titel', v_row.titel, 'code', v_row.code);
        if v_stufe = 'komplett' then
          perform public.sva_album_lose_buchen(p_fan, v_set.lose_komplett, 'komplett', v_saison, v_saison);
        end if;
      end if;
    end if;
  end loop;
  return v_neu;
end;
$$;

-- Kapitel komplett → Abzeichen (+ Bonus-Pack, solange kein aktives Ziel vom
-- Typ 'kapitel' dieses Kapitel belohnt — sonst vergibt das Ziel den Bonus).
create or replace function public.sva_album_kapitel_pruefen(p_fan uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_kap text;
  v_ok text;
  v_pack uuid;
  v_out jsonb := '[]'::jsonb;
begin
  for v_kap in
    select p.kapitel from public.sva_album_plaetze(p_fan) p
     group by p.kapitel having count(*) > 0 and bool_and(p.belegt)
  loop
    v_ok := null;
    insert into public.sva_album_abzeichen (fan_user_id, saison, kapitel) values (p_fan, v_saison, v_kap)
    on conflict do nothing returning kapitel into v_ok;
    if v_ok is not null then
      v_pack := null;
      if not exists (select 1 from public.sva_album_ziele z
                      where z.aktiv and z.typ = 'kapitel' and z.kapitel = v_kap
                        and (z.saison is null or z.saison = v_saison)) then
        v_pack := public.sva_album_pack_ziehen_v20(p_fan, 'kapitel', null,
                    (select e.karten_kapitel from public.sva_album_einstellungen e where e.id = 1),
                    'kapitel:' || v_saison || ':' || v_kap, 'Kapitel komplett', null, null, true);
      end if;
      v_out := v_out || jsonb_build_object('kapitel', v_kap, 'packId', v_pack);
    end if;
  end loop;
  return v_out;
end;
$$;

-- Fortschritt eines Ziels für einen Fan
create or replace function public.sva_album_ziel_stand(p_fan uuid, p_ziel uuid, out fortschritt integer, out benoetigt integer)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  z public.sva_album_ziele;
  v_saison text := public.sva_album_saison();
  v_total integer := 0;
  v_hat integer := 0;
  v_n integer := 0;
  v_w date;
  v_vor integer;
  r record;
begin
  fortschritt := 0;
  benoetigt := 0;
  select * into z from public.sva_album_ziele where id = p_ziel;
  if z.id is null then
    return;
  end if;

  if z.typ = 'set' then
    with menge as (
      select k.id as kid, null::uuid as rid
        from public.sva_album_karten k
       where k.id = any (coalesce(z.karten, '{}')) and k.aktiv and (k.saison is null or k.saison = v_saison)
      union
      select null::uuid, x.rid from unnest(coalesce(z.roster_ids, '{}')) as x(rid)
       where exists (select 1 from public.sva_album_karten k
                      where k.roster_id = x.rid and k.typ in ('spieler', 'trainer') and k.aktiv
                        and not k.variante and not k.limitiert and (k.saison is null or k.saison = v_saison))
    )
    select count(*)::int,
           count(*) filter (where
             (m.kid is not null and exists (select 1 from public.sva_album_besitz b where b.fan_user_id = p_fan and b.karte_id = m.kid))
             or (m.rid is not null and exists (
                   select 1 from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
                    where b.fan_user_id = p_fan and k.roster_id = m.rid and k.typ in ('spieler', 'trainer')
                      and not k.variante and not k.limitiert and (k.saison is null or k.saison = v_saison))))::int
      into v_total, v_hat
      from menge m;
    benoetigt := least(v_total, coalesce(z.anzahl, v_total));
    fortschritt := least(v_hat, benoetigt);

  elsif z.typ in ('kapitel', 'meilenstein') then
    select count(*)::int, count(*) filter (where p.belegt)::int into v_total, v_hat
      from public.sva_album_plaetze(p_fan) p
     where z.typ = 'meilenstein' or p.kapitel = z.kapitel;
    if z.typ = 'kapitel' then
      benoetigt := v_total;
    else
      benoetigt := case when v_total = 0 then 0
                        else ceil(v_total * least(100, coalesce(z.anzahl, 100)) / 100.0)::int end;
    end if;
    fortschritt := least(v_hat, benoetigt);

  elsif z.typ = 'serie_checkin' then
    -- die letzten Heimspiele mit Check-in-Code (Fenster schon offen), lückenlos eingecheckt
    benoetigt := coalesce(z.anzahl, 3);
    select e.fenster_vor_min into v_vor from public.sva_album_einstellungen e where e.id = 1;
    for r in
      select exists (select 1 from public.sva_album_checkins c where c.spiel_id = s.id and c.fan_user_id = p_fan) as da
        from public.sm_spiele s
        join public.sva_album_spielcodes sc on sc.spiel_id = s.id
       where s.heim and not coalesce(s.demo, false)
         and s.anstoss - make_interval(mins => coalesce(v_vor, 60)) <= now()
       order by s.anstoss desc
       limit 60
    loop
      exit when not r.da;
      v_n := v_n + 1;
    end loop;
    fortschritt := least(v_n, benoetigt);

  elsif z.typ = 'serie_tipp' then
    -- ISO-Wochen (Europe/Berlin) in Folge mit Tipp-Pack; die laufende Woche
    -- darf noch fehlen, ohne dass die Serie reißt
    benoetigt := coalesce(z.anzahl, 4);
    v_w := date_trunc('week', now() at time zone 'Europe/Berlin')::date;
    if not exists (select 1 from public.sva_album_packs p where p.fan_user_id = p_fan and p.art = 'tipp'
                     and (p.created_at at time zone 'Europe/Berlin')::date >= v_w
                     and (p.created_at at time zone 'Europe/Berlin')::date < v_w + 7) then
      v_w := v_w - 7;
    end if;
    while v_n < 60 and exists (select 1 from public.sva_album_packs p where p.fan_user_id = p_fan and p.art = 'tipp'
                                  and (p.created_at at time zone 'Europe/Berlin')::date >= v_w
                                  and (p.created_at at time zone 'Europe/Berlin')::date < v_w + 7) loop
      v_n := v_n + 1;
      v_w := v_w - 7;
    end loop;
    fortschritt := least(v_n, benoetigt);

  elsif z.typ = 'sozial_tausch' then
    benoetigt := coalesce(z.anzahl, 1);
    select count(*)::int into v_n from public.sva_album_tausch t
     where (t.von_fan = p_fan or t.an_fan = p_fan) and t.status = 'erledigt';
    fortschritt := least(v_n, benoetigt);

  elsif z.typ = 'sozial_freund' then
    benoetigt := coalesce(z.anzahl, 1);
    select count(*)::int into v_n from public.sva_album_freunde f where f.fan_a = p_fan or f.fan_b = p_fan;
    fortschritt := least(v_n, benoetigt);

  else -- extern: Fortschritt = wie oft erreicht (Saison)
    select count(*)::int into v_n from public.sva_album_ziel_erreicht e
     where e.ziel_id = z.id and e.fan_user_id = p_fan and e.saison = v_saison;
    fortschritt := v_n;
    benoetigt := case when z.wiederholbar then null else 1 end;
  end if;
end;
$$;

-- Ziel vergeben (idempotent je Ziel/Fan/Bezug): Bonus-Pack + Lose.
create or replace function public.sva_album_ziel_vergeben(p_fan uuid, p_ziel uuid, p_bezug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  z public.sva_album_ziele;
  v_saison text := public.sva_album_saison();
  v_ok uuid;
  v_pack uuid;
  v_lose integer := 0;
  v_q text;
begin
  select * into z from public.sva_album_ziele where id = p_ziel;
  if z.id is null then
    return null;
  end if;
  insert into public.sva_album_ziel_erreicht (ziel_id, fan_user_id, bezug, saison)
  values (z.id, p_fan, coalesce(p_bezug, ''), v_saison)
  on conflict do nothing
  returning ziel_id into v_ok;
  if v_ok is null then
    return null;
  end if;
  v_q := z.id::text || ':' || coalesce(p_bezug, '');
  if z.belohnung_karten > 0 then
    v_pack := public.sva_album_pack_ziehen_v20(p_fan, 'ziel', null, z.belohnung_karten, v_q, z.titel,
                z.belohnung_min_seltenheit, null, true);
  end if;
  v_lose := public.sva_album_lose_buchen(p_fan, z.belohnung_lose, 'ziel', v_q, v_saison);
  update public.sva_album_ziel_erreicht set pack_id = v_pack, lose = v_lose
   where ziel_id = z.id and fan_user_id = p_fan and bezug = coalesce(p_bezug, '');
  return jsonb_strip_nulls(jsonb_build_object('zielId', z.id, 'schluessel', z.schluessel, 'typ', z.typ,
           'kapitel', z.kapitel, 'titel', z.titel, 'packId', v_pack, 'lose', v_lose));
end;
$$;

-- Aktive Ziele der genannten Typen prüfen und neu erreichte vergeben.
create or replace function public.sva_album_ziele_pruefen(p_fan uuid, p_typen text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  z public.sva_album_ziele;
  v_st record;
  v_r jsonb;
  v_out jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.sva_album_fans f where f.user_id = p_fan) then
    return v_out;
  end if;
  for z in
    select * from public.sva_album_ziele zz
     where zz.aktiv and zz.typ = any (p_typen) and zz.typ <> 'extern'
       and (zz.saison is null or zz.saison = v_saison)
       and (zz.gueltig_von is null or zz.gueltig_von <= now())
       and (zz.gueltig_bis is null or zz.gueltig_bis > now())
       and not exists (select 1 from public.sva_album_ziel_erreicht e
                        where e.ziel_id = zz.id and e.fan_user_id = p_fan and e.bezug = v_saison)
     order by zz.sortierung, zz.titel
  loop
    select * into v_st from public.sva_album_ziel_stand(p_fan, z.id);
    if v_st.benoetigt > 0 and v_st.fortschritt >= v_st.benoetigt then
      v_r := public.sva_album_ziel_vergeben(p_fan, z.id, v_saison);
      if v_r is not null then
        v_out := v_out || v_r;
      end if;
    end if;
  end loop;
  return v_out;
end;
$$;

-- Externes Ziel (Tipp-Liga, geheime Missionen) für einen Fan auslösen
create or replace function public.sva_album_ziel_extern(p_fan uuid, p_schluessel text, p_bezug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  z public.sva_album_ziele;
  v_r jsonb;
begin
  select * into z from public.sva_album_ziele zz
   where zz.schluessel = p_schluessel and zz.typ = 'extern' and zz.aktiv
     and (zz.saison is null or zz.saison = v_saison)
     and (zz.gueltig_von is null or zz.gueltig_von <= now())
     and (zz.gueltig_bis is null or zz.gueltig_bis > now());
  if z.id is null or not exists (select 1 from public.sva_album_fans f where f.user_id = p_fan) then
    return jsonb_build_object('erreicht', false, 'packId', null, 'lose', 0);
  end if;
  v_r := public.sva_album_ziel_vergeben(p_fan, z.id,
           case when z.wiederholbar then coalesce(nullif(p_bezug, ''), v_saison) else v_saison end);
  if v_r is null then
    return jsonb_build_object('erreicht', false, 'packId', null, 'lose', 0);
  end if;
  return jsonb_build_object('erreicht', true, 'packId', v_r -> 'packId', 'lose', coalesce((v_r ->> 'lose')::int, 0),
                            'titel', z.titel);
end;
$$;

-- Nach Besitz-Änderung: Belohnungen, Kapitel, Sammelziele. Kapitel-Einträge
-- bekommen die Pack-ID des Kapitel-Ziels, falls das Ziel den Bonus vergibt.
create or replace function public.sva_album_nach_besitz(p_fan uuid, p_typen text[] default array['set', 'kapitel', 'meilenstein'])
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_gut jsonb;
  v_kap jsonb;
  v_ziele jsonb;
begin
  v_gut := public.sva_album_belohnungen(p_fan);
  v_kap := public.sva_album_kapitel_pruefen(p_fan);
  v_ziele := public.sva_album_ziele_pruefen(p_fan, p_typen);
  select coalesce(jsonb_agg(case when k.v -> 'packId' = 'null'::jsonb or k.v -> 'packId' is null
                                 then jsonb_set(k.v, '{packId}', coalesce((select z.v -> 'packId' from jsonb_array_elements(v_ziele) as z(v)
                                                                            where z.v ->> 'kapitel' = k.v ->> 'kapitel' and z.v ->> 'typ' = 'kapitel'
                                                                            limit 1), 'null'::jsonb))
                                 else k.v end), '[]'::jsonb)
    into v_kap
    from jsonb_array_elements(v_kap) as k(v);
  return jsonb_build_object('gutscheine', v_gut, 'kapitel', v_kap, 'ziele', v_ziele);
end;
$$;

-- ── 9a. Öffentlich: Katalog + Regeln ────────────────────────────────────────
create or replace function public.album_katalog()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_e public.sva_album_einstellungen;
  v_summe numeric;
  v_stats jsonb;
  v_von timestamptz;
  v_bis timestamptz;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  v_summe := greatest(1, v_e.gewicht_bronze + v_e.gewicht_silber + v_e.gewicht_gold + v_e.gewicht_spezial);

  -- Tore/Vorlagen der Saison aus dem Liveticker (reine Fakten, keine Bewertung)
  if to_regclass('public.sva_ticker') is not null and v_saison ~ '^[0-9]{4}' then
    v_von := make_timestamptz(left(v_saison, 4)::int, 7, 1, 0, 0, 0, 'Europe/Berlin');
    v_bis := v_von + interval '1 year';
    execute $q$
      select coalesce(jsonb_object_agg(x.rid::text, jsonb_build_object('tore', x.tore, 'vorlagen', x.vorlagen)), '{}'::jsonb)
        from (
          select y.rid, sum(y.tore)::int as tore, sum(y.vorlagen)::int as vorlagen
            from (
              select t.roster_id as rid, 1 as tore, 0 as vorlagen
                from public.sva_ticker t join public.sm_spiele s on s.id = t.spiel_id
               where t.typ = 'tor' and t.roster_id is not null and s.anstoss >= $1 and s.anstoss < $2
                 and not coalesce(s.demo, false)
              union all
              select t.roster_id_2, 0, 1
                from public.sva_ticker t join public.sm_spiele s on s.id = t.spiel_id
               where t.typ = 'tor' and t.roster_id_2 is not null and s.anstoss >= $1 and s.anstoss < $2
                 and not coalesce(s.demo, false)
            ) y
           group by y.rid
        ) x
    $q$ into v_stats using v_von, v_bis;
  end if;

  return jsonb_build_object(
    'saison', v_saison,
    'aktiv', coalesce(v_e.aktiv, true),
    'regeln', jsonb_build_object(
      'chancen', jsonb_build_object(
        'bronze',  round(100 * v_e.gewicht_bronze / v_summe, 1),
        'silber',  round(100 * v_e.gewicht_silber / v_summe, 1),
        'gold',    round(100 * v_e.gewicht_gold / v_summe, 1),
        'spezial', round(100 * v_e.gewicht_spezial / v_summe, 1)),
      'kartenProPack', v_e.karten_pro_pack,
      'kartenStarter', v_e.karten_starter,
      'starterMinSilber', v_e.starter_min_silber,
      'kartenHeimsieg', v_e.karten_heimsieg,
      'kartenTipp', v_e.karten_tipp,
      'kartenStory', v_e.karten_story,
      'kartenFreund', v_e.karten_freund,
      'kartenKapitel', v_e.karten_kapitel,
      'smartPack', v_e.smart_pack,
      'tauschMinTage', v_e.tausch_min_tage,
      'tauschProWoche', v_e.tausch_pro_woche,
      'wunschKosten', v_e.wunsch_kosten,
      'loseCheckin', v_e.lose_checkin,
      'loseKomplett', v_e.lose_komplett,
      'teilnahmeText', v_e.teilnahme_text,
      'fensterVorMin', v_e.fenster_vor_min,
      'fensterNachMin', v_e.fenster_nach_min,
      'bonusHeimsieg', v_e.bonus_heimsieg,
      'belohnungen', (
        jsonb_build_array(
          jsonb_strip_nulls(jsonb_build_object('stufe', 'schwelle_1', 'checkins', v_e.schwelle_1, 'titel', v_e.belohnung_1,
            'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                          from public.sm_sponsoren sp where sp.id = v_e.partner_1_id and sp.aktiv))),
          jsonb_strip_nulls(jsonb_build_object('stufe', 'schwelle_2', 'checkins', v_e.schwelle_2, 'titel', v_e.belohnung_2,
            'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                          from public.sm_sponsoren sp where sp.id = v_e.partner_2_id and sp.aktiv))))
        || case when v_e.schwelle_3 is not null then jsonb_build_array(
          jsonb_strip_nulls(jsonb_build_object('stufe', 'schwelle_3', 'checkins', v_e.schwelle_3, 'titel', v_e.belohnung_3,
            'verlosung', true,
            'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                          from public.sm_sponsoren sp where sp.id = v_e.partner_3_id and sp.aktiv)))) else '[]'::jsonb end
        || jsonb_build_array(
          jsonb_strip_nulls(jsonb_build_object('stufe', 'komplett', 'titel', v_e.belohnung_komplett,
            'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                          from public.sm_sponsoren sp where sp.id = v_e.partner_komplett_id and sp.aktiv))))
      )
    ),
    'karten', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id',          k.id,
               'typ',         k.typ,
               'titel',       k.titel,
               'untertitel',  nullif(btrim(coalesce(k.untertitel, '')), ''),
               'bildUrl',     k.bild_url,
               'walkoutUrl',  k.walkout_url,
               'seltenheit',  k.seltenheit,
               'sortierung',  k.sortierung,
               'variante',    k.variante,
               'limitiert',   k.limitiert,
               'kapitel',     public.sva_album_kapitel_von(k.typ, r.position),
               'ziehbarVon',  k.ziehbar_von,
               'ziehbarBis',  k.ziehbar_bis,
               'derby',       k.nur_spiel_id is not null,
               'derbySpiel',  (select jsonb_build_object('gegner', s.gegner, 'anstoss', s.anstoss)
                                 from public.sm_spiele s where s.id = k.nur_spiel_id),
               'serie',       k.serie,
               'credit',      k.credit,
               'bildFokus',   k.bild_fokus,
               'rueckseite',  nullif(btrim(coalesce(k.rueckseite, '')), ''),
               'praesentiertVon', (select jsonb_strip_nulls(jsonb_build_object('name', pv.name, 'logoUrl', pv.logo_url))
                                     from public.sm_sponsoren pv where pv.id = k.praesentiert_von and pv.aktiv),
               'spieler', case when r.id is not null then jsonb_strip_nulls(jsonb_build_object(
                            'slug',      r.slug,
                            'name',      r.name,
                            'nummer',    r.nummer,
                            'position',  case upper(coalesce(r.position, ''))
                                           when 'TW' then 'TW' when 'TORWART' then 'TW'
                                           when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
                                           when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
                                           else 'MIT' end,
                            'fotoUrl',   r.foto_url,
                            'cutoutUrl', r.freisteller_url,
                            'kapitaen',  case when r.kapitaen then true end,
                            'rolle',     case when r.rolle <> 'spieler' then r.rolle end,
                            'seit',      r.im_verein_seit,
                            'neuzugang', case when r.neuzugang then true end,
                            'tore',      case when v_stats is not null and r.rolle = 'spieler'
                                              then coalesce((v_stats -> r.id::text ->> 'tore')::int, 0) end,
                            'vorlagen',  case when v_stats is not null and r.rolle = 'spieler'
                                              then coalesce((v_stats -> r.id::text ->> 'vorlagen')::int, 0) end)) end,
               'partner', case when sp.id is not null then jsonb_strip_nulls(jsonb_build_object(
                            'name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url,
                            'seit', extract(year from sp.laufzeit_von)::int)) end
             )) order by case k.typ when 'spieler' then 0 when 'trainer' then 1 when 'moment' then 2 when 'partner' then 3 else 4 end,
                         k.limitiert, k.sortierung, r.sortierung nulls last, k.titel,
                         case k.seltenheit when 'bronze' then 1 when 'silber' then 2 when 'gold' then 3 else 4 end,
                         k.variante, k.created_at)
        from public.sva_album_karten k
        left join public.sm_roster r on r.id = k.roster_id
        left join public.sm_sponsoren sp on sp.id = k.sponsor_id and sp.aktiv
       where k.aktiv and (k.saison is null or k.saison = v_saison)
    ), '[]'::jsonb)
  );
end;
$$;
comment on function public.album_katalog() is 'Öffentlich: Album-Katalog der Saison + Regeln (Chancen, Packgrößen, Tausch, Belohnungen, Lose). Keine Fan-Daten, keine internen IDs.';

-- ── 9b. Fan: eigenes Album ──────────────────────────────────────────────────
-- Bleibt STABLE (reine Lese-Funktion): der Freundescode entsteht per
-- Spalten-Default beim Anlegen des Profils (Altbestand per Migration befüllt).
create or replace function public.album_mein()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_saison text := public.sva_album_saison();
  v_f public.sva_album_fans;
  v_jetzt timestamp := public.sva_album_jetzt() at time zone 'Europe/Berlin';
  v_ziele jsonb;
  v_advent jsonb;
  v_lose integer;
begin
  select * into v_f from public.sva_album_fans where user_id = v_uid;

  select coalesce(jsonb_agg(x.obj order by x.o1, x.rest nulls last, x.sortierung, x.titel), '[]'::jsonb)
    into v_ziele
    from (
      select jsonb_strip_nulls(jsonb_build_object(
               'id', z.id, 'schluessel', z.schluessel, 'typ', z.typ, 'vorlage', z.vorlage,
               'titel', z.titel, 'beschreibung', z.beschreibung,
               'fortschritt', st.fortschritt, 'benoetigt', st.benoetigt,
               'erreicht', e.n > 0 and not z.wiederholbar,
               'erreichtAt', e.erste,
               'anzahlErreicht', case when z.wiederholbar then e.n end,
               'wiederholbar', case when z.wiederholbar then true end,
               'belohnung', jsonb_strip_nulls(jsonb_build_object('karten', z.belohnung_karten,
                              'minSeltenheit', z.belohnung_min_seltenheit, 'lose', z.belohnung_lose)),
               'gueltigBis', z.gueltig_bis,
               'geheim', z.geheim)) as obj,
             case when e.n > 0 and not z.wiederholbar then 2 when z.typ = 'extern' then 1 else 0 end as o1,
             st.benoetigt - st.fortschritt as rest, z.sortierung, z.titel
        from public.sva_album_ziele z
       cross join lateral public.sva_album_ziel_stand(v_uid, z.id) st
       cross join lateral (select count(*)::int as n, min(ze.at) as erste from public.sva_album_ziel_erreicht ze
                            where ze.ziel_id = z.id and ze.fan_user_id = v_uid and ze.saison = v_saison) e
       where v_f.user_id is not null and z.aktiv and (z.saison is null or z.saison = v_saison)
         and (z.gueltig_von is null or z.gueltig_von <= now())
         and (z.gueltig_bis is null or z.gueltig_bis > now() or e.n > 0)
         and (not z.geheim or e.n > 0)
         and (z.typ = 'extern' or st.benoetigt > 0)
    ) x;

  if extract(month from v_jetzt) = 12 then
    select jsonb_agg(jsonb_build_object('tag', t, 'eingeloest', exists (
             select 1 from public.sva_album_codes c
               join public.sva_album_code_einloesungen ce on ce.code_id = c.id and ce.fan_user_id = v_uid
              where c.art = 'advent' and c.advent_jahr = extract(year from v_jetzt)::int and c.advent_tag = t)) order by t)
      into v_advent
      from generate_series(1, 24) t;
  end if;

  select coalesce(sum(l.anzahl), 0)::int into v_lose from public.sva_album_lose l
   where l.fan_user_id = v_uid and l.saison = v_saison;

  return jsonb_build_object(
    'email', auth.jwt() ->> 'email',
    'saison', v_saison,
    'profil', case when v_f.user_id is null then null else jsonb_build_object(
                'vorname', v_f.vorname, 'initial', v_f.initial,
                'anzeigename', v_f.vorname || ' ' || v_f.initial || '.',
                'rangliste', v_f.rangliste, 'erinnerung', v_f.erinnerung) end,
    'checkins', (select count(*) from public.sva_album_checkins c where c.fan_user_id = v_uid and c.saison = v_saison),
    'checkinsGesamt', (select count(*) from public.sva_album_checkins c where c.fan_user_id = v_uid),
    'spiele', coalesce((
      select jsonb_agg(jsonb_build_object('gegner', s.gegner, 'anstoss', s.anstoss, 'at', c.created_at) order by c.created_at desc)
        from (select * from public.sva_album_checkins c0 where c0.fan_user_id = v_uid order by c0.created_at desc limit 30) c
        join public.sm_spiele s on s.id = c.spiel_id), '[]'::jsonb),
    'besitz', coalesce((
      select jsonb_agg(jsonb_build_object('karteId', b.karte_id, 'anzahl', b.anzahl) order by b.erstmals_at)
        from public.sva_album_besitz b where b.fan_user_id = v_uid), '[]'::jsonb),
    'packs', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', p.id, 'art', p.art, 'anzahl', cardinality(p.karten),
               'titel', p.titel, 'gegner', s.gegner, 'at', p.created_at)) order by p.created_at)
        from public.sva_album_packs p
        left join public.sm_spiele s on s.id = p.spiel_id
       where p.fan_user_id = v_uid and p.geoeffnet_at is null), '[]'::jsonb),
    'gutscheine', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', g.id, 'stufe', g.stufe, 'titel', g.titel, 'code', g.code, 'status', g.status,
               'saison', g.saison, 'eingeloestAt', g.eingeloest_at, 'at', g.created_at,
               'verlosung', case when g.stufe in ('schwelle_3', 'komplett') then true end,
               'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                             from public.sm_sponsoren sp where sp.id = g.partner_id)))
             order by g.created_at desc)
        from public.sva_album_gutscheine g where g.fan_user_id = v_uid), '[]'::jsonb),
    -- v20-K
    'freundCode', v_f.freund_code,
    'freunde', coalesce((
      select jsonb_agg(public.sva_album_name(x.fid) order by x.at)
        from (select case when fr.fan_a = v_uid then fr.fan_b else fr.fan_a end as fid, fr.at
                from public.sva_album_freunde fr where fr.fan_a = v_uid or fr.fan_b = v_uid) x), '[]'::jsonb),
    'abzeichen', coalesce((
      select jsonb_agg(a.kapitel order by a.at) from public.sva_album_abzeichen a
       where a.fan_user_id = v_uid and a.saison = v_saison), '[]'::jsonb),
    'tausche', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'code', t.code, 'biete', t.biete_karte, 'wunsch', t.wunsch_karte,
               'status', case when t.status = 'offen' and t.gueltig_bis <= now() then 'abgelaufen' else t.status end,
               'eigen', t.von_fan = v_uid,
               'partner', public.sva_album_name(case when t.von_fan = v_uid then t.an_fan else t.von_fan end),
               'at', t.created_at, 'gueltigBis', t.gueltig_bis, 'erledigtAt', t.erledigt_at))
             order by t.created_at desc)
        from (
          select t0.* from public.sva_album_tausch t0 where t0.von_fan = v_uid and t0.status = 'offen'
          union all
          (select t1.* from public.sva_album_tausch t1
            where (t1.von_fan = v_uid or t1.an_fan = v_uid) and t1.status <> 'offen'
            order by coalesce(t1.erledigt_at, t1.created_at) desc limit 10)
        ) t), '[]'::jsonb),
    'tauscheWoche', public.sva_album_tausch_woche(v_uid),
    'kontoTage', case when v_f.user_id is not null then floor(extract(epoch from now() - v_f.created_at) / 86400)::int end,
    'starterOffen', v_f.user_id is not null and not exists (
      select 1 from public.sva_album_packs p where p.fan_user_id = v_uid and p.art = 'starter'),
    'advent', v_advent,
    'ziele', v_ziele,
    'naechstesZiel', (select z.v from jsonb_array_elements(v_ziele) with ordinality as z(v, i)
                       where z.v ->> 'typ' <> 'extern' and not coalesce((z.v ->> 'erreicht')::boolean, false)
                       order by z.i limit 1),
    'lose', v_lose,
    'loseVerlauf', coalesce((
      select jsonb_agg(jsonb_build_object('anzahl', l.anzahl, 'quelle', l.quelle, 'at', l.at,
               'titel', case l.quelle when 'checkin' then 'Check-in' when 'komplett' then 'Album komplett'
                              when 'ziel' then coalesce((select z.titel from public.sva_album_ziele z
                                                          where z.id::text = split_part(l.bezug, ':', 1)), 'Ziel')
                              else 'Bonus' end) order by l.at desc)
        from (select * from public.sva_album_lose l0 where l0.fan_user_id = v_uid and l0.saison = v_saison
               order by l0.at desc limit 10) l), '[]'::jsonb),
    'verlosungen', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', vl.id, 'titel', vl.titel, 'preis', vl.preis, 'bildUrl', vl.bild_url,
               'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                             from public.sm_sponsoren sp where sp.id = vl.partner_id and sp.aktiv),
               'stichtag', vl.stichtag, 'status', vl.status, 'minLose', vl.min_lose,
               'gewinnerName', vl.gewinner_name, 'gezogenAt', vl.gezogen_at,
               'gewonnen', vl.gewinner_fan is not null and vl.gewinner_fan = v_uid,
               'teilnahme', coalesce((select sum(l.anzahl) from public.sva_album_lose l
                                       where l.fan_user_id = v_uid and l.saison = vl.saison), 0) >= vl.min_lose))
             order by vl.status, coalesce(vl.stichtag, vl.created_at))
        from public.sva_album_verlosungen vl
       where vl.status = 'offen' or vl.gezogen_at > now() - interval '30 days'), '[]'::jsonb)
  );
end;
$$;

-- Freundescode (Fallback, falls ein Altprofil keinen hat). Volatile.
create or replace function public.album_freund_code()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_code text;
begin
  select f.freund_code into v_code from public.sva_album_fans f where f.user_id = v_uid;
  if not found then
    raise exception 'album_kein_profil' using errcode = 'P0001';
  end if;
  if v_code is null then
    update public.sva_album_fans set freund_code = public.sva_album_freund_code_neu()
     where user_id = v_uid returning freund_code into v_code;
  end if;
  return jsonb_build_object('code', v_code);
end;
$$;

-- ── 9c. Fan: Starter-Pack ───────────────────────────────────────────────────
create or replace function public.album_starter_holen()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
begin
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid)
     or exists (select 1 from public.sva_album_packs p where p.fan_user_id = v_uid and p.art = 'starter') then
    return jsonb_build_object('packId', null);
  end if;
  return jsonb_build_object('packId', public.sva_album_pack_ziehen(v_uid, null, 'starter'));
end;
$$;

-- ── 9d. Fan: Check-in (QR-Code am Eingang) ──────────────────────────────────
create or replace function public.album_checkin(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid    uuid := public.sva_album_uid();
  v_saison text := public.sva_album_saison();
  v_token  text := lower(btrim(coalesce(p_token, '')));
  v_e      public.sva_album_einstellungen;
  v_code   public.sva_album_spielcodes;
  v_s      public.sm_spiele;
  v_start  timestamptz;
  v_ende   timestamptz;
  v_id     uuid;
  v_pack   uuid;
  v_bonus  uuid;
  v_fpack  uuid;
  v_mich   boolean := false;
  v_freunde jsonb := '[]'::jsonb;
  v_fr     record;
  v_ziele  jsonb;
  v_r      jsonb;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  if not coalesce(v_e.aktiv, true) then
    raise exception 'album_pausiert' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    raise exception 'album_kein_profil' using errcode = 'P0001';
  end if;
  if v_token !~ '^[a-z0-9]{16,64}$' then
    raise exception 'album_code_unbekannt' using errcode = 'P0001';
  end if;
  select * into v_code from public.sva_album_spielcodes c where c.token = v_token;
  if v_code.spiel_id is null then
    raise exception 'album_code_unbekannt' using errcode = 'P0001';
  end if;
  select * into v_s from public.sm_spiele s where s.id = v_code.spiel_id;
  if v_s.id is null or not v_s.heim then
    raise exception 'album_code_unbekannt' using errcode = 'P0001';
  end if;

  select f.p_start, f.p_ende into v_start, v_ende from public.sva_album_fenster(v_s.id) f;
  if now() < v_start then
    raise exception 'album_code_zu_frueh|%', to_char(v_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') using errcode = 'P0001';
  end if;
  if now() > v_ende then
    raise exception 'album_code_abgelaufen' using errcode = 'P0001';
  end if;

  insert into public.sva_album_checkins (fan_user_id, spiel_id, saison)
  values (v_uid, v_s.id, v_saison)
  on conflict on constraint sva_album_checkins_einmal do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'album_schon_eingecheckt' using errcode = 'P0001';
  end if;

  v_pack := public.sva_album_pack_ziehen(v_uid, v_s.id, 'checkin');
  -- Wer erst nach einem feststehenden Heimsieg eincheckt, bekommt den Bonus sofort.
  if coalesce(v_e.bonus_heimsieg, true) and v_s.tore_sva is not null and v_s.tore_gegner is not null
     and v_s.tore_sva > v_s.tore_gegner then
    v_bonus := public.sva_album_pack_ziehen(v_uid, v_s.id, 'heimsieg');
  end if;

  -- Freund-Bonus: jeder Freund, der beim selben Spiel schon eingecheckt ist
  for v_fr in
    select x.fid from (
      select case when fr.fan_a = v_uid then fr.fan_b else fr.fan_a end as fid, fr.at
        from public.sva_album_freunde fr where fr.fan_a = v_uid or fr.fan_b = v_uid) x
     where exists (select 1 from public.sva_album_checkins c where c.spiel_id = v_s.id and c.fan_user_id = x.fid)
     order by x.at
  loop
    v_freunde := v_freunde || to_jsonb(public.sva_album_name(v_fr.fid));
    if not v_mich then
      v_fpack := public.sva_album_pack_ziehen(v_uid, v_s.id, 'freund');
      v_mich := true;
    end if;
    perform public.sva_album_pack_ziehen(v_fr.fid, v_s.id, 'freund');
  end loop;

  perform public.sva_album_lose_buchen(v_uid, v_e.lose_checkin, 'checkin', v_s.id::text, v_saison);
  v_ziele := public.sva_album_ziele_pruefen(v_uid, array['serie_checkin']);
  -- geheime Mission „Nachteule“: Flutlichtspiel (Anstoß ab 19 Uhr)
  if extract(hour from v_s.anstoss at time zone 'Europe/Berlin') >= 19 then
    v_r := public.sva_album_ziel_extern(v_uid, 'nachteule', v_s.id::text);
    if coalesce((v_r ->> 'erreicht')::boolean, false) then
      v_ziele := v_ziele || jsonb_build_object('schluessel', 'nachteule', 'titel', v_r ->> 'titel',
                                               'packId', v_r -> 'packId', 'lose', v_r -> 'lose');
    end if;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'packId', v_pack,
    'bonusPackId', v_bonus,
    'freundPackId', v_fpack,
    'freunde', v_freunde,
    'spiel', jsonb_build_object('gegner', v_s.gegner, 'anstoss', v_s.anstoss),
    'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                  from public.sm_sponsoren sp where sp.id = v_code.partner_id and sp.aktiv),
    'checkins', (select count(*) from public.sva_album_checkins c where c.fan_user_id = v_uid and c.saison = v_saison),
    'gutscheine', public.sva_album_belohnungen(v_uid),
    'ziele', v_ziele
  ));
end;
$$;

-- ── 9e. Fan: Pack öffnen (Gutschrift ins Album) ─────────────────────────────
create or replace function public.album_pack_oeffnen(p_pack uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := public.sva_album_uid();
  v_p    public.sva_album_packs;
  v_neu  boolean[] := '{}';
  v_k    uuid;
  v_war  boolean;
  v_nach jsonb := jsonb_build_object('gutscheine', '[]'::jsonb, 'kapitel', '[]'::jsonb, 'ziele', '[]'::jsonb);
begin
  select * into v_p from public.sva_album_packs p where p.id = p_pack and p.fan_user_id = v_uid for update;
  if v_p.id is null then
    raise exception 'album_pack_unbekannt' using errcode = 'P0001';
  end if;

  if v_p.geoeffnet_at is null then
    foreach v_k in array v_p.karten loop
      if not exists (select 1 from public.sva_album_karten k where k.id = v_k) then
        v_neu := v_neu || false;
        continue;
      end if;
      select exists (select 1 from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = v_k) into v_war;
      insert into public.sva_album_besitz (fan_user_id, karte_id, anzahl)
      values (v_uid, v_k, 1)
      on conflict (fan_user_id, karte_id) do update
         set anzahl = public.sva_album_besitz.anzahl + 1, zuletzt_at = now();
      v_neu := v_neu || (not v_war);
    end loop;
    update public.sva_album_packs set geoeffnet_at = now(), neu = v_neu where id = v_p.id;
    v_p.neu := v_neu;
    v_nach := public.sva_album_nach_besitz(v_uid);
  end if;

  return jsonb_build_object(
    'id', v_p.id,
    'art', v_p.art,
    'titel', v_p.titel,
    'gegner', (select s.gegner from public.sm_spiele s where s.id = v_p.spiel_id),
    'karten', coalesce((
      select jsonb_agg(jsonb_build_object(
               'karteId', x.k,
               'seltenheit', coalesce(v_p.seltenheiten[x.i], 'bronze'),
               'neu', coalesce(v_p.neu[x.i], false),
               'anzahl', coalesce((select b.anzahl from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = x.k), 0),
               'variante', kk.variante,
               'limitiert', kk.limitiert
             ) order by x.i)
        from unnest(v_p.karten) with ordinality as x(k, i)
        join public.sva_album_karten kk on kk.id = x.k), '[]'::jsonb),
    'gutscheine', v_nach -> 'gutscheine',
    'kapitel', v_nach -> 'kapitel',
    'ziele', v_nach -> 'ziele'
  );
end;
$$;

-- ── 9f. Fan: Gutschein am Stand einlösen ────────────────────────────────────
-- Verlosungs-Lose (schwelle_3, komplett) sind nicht am Stand einlösbar.
create or replace function public.album_gutschein_einloesen(p_gutschein uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_g   public.sva_album_gutscheine;
begin
  select * into v_g from public.sva_album_gutscheine g
   where g.id = p_gutschein and g.fan_user_id = v_uid
   for update;
  if v_g.id is null then
    raise exception 'album_gutschein_unbekannt' using errcode = 'P0001';
  end if;
  if v_g.stufe in ('komplett', 'schwelle_3') then
    return jsonb_build_object('ok', false, 'grund', 'verlosung');
  end if;
  if v_g.status = 'eingeloest' then
    return jsonb_build_object('ok', false, 'grund', 'schon_eingeloest', 'eingeloestAt', v_g.eingeloest_at);
  end if;

  update public.sva_album_gutscheine
     set status = 'eingeloest', eingeloest_at = now(), eingeloest_durch = 'stand'
   where id = v_g.id;
  return jsonb_build_object('ok', true, 'eingeloestAt', now());
end;
$$;

-- ── 9g. Fan: Aktions-Code einlösen (Story / Partner / Advent) ───────────────
-- Fehlversuch = KEIN raise (sonst würde er zurückgerollt), sondern
-- { ok:false, grund } — so greift die Sperre wirklich.
create or replace function public.album_code_einloesen(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := public.sva_album_uid();
  v_e    public.sva_album_einstellungen;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  v_c    public.sva_album_codes;
  v_n    integer;
  v_ok   uuid;
  v_pack uuid;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  delete from public.sva_album_code_fehler where at < now() - interval '1 day';
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    return jsonb_build_object('ok', false, 'grund', 'kein_profil');
  end if;
  select count(*) into v_n from public.sva_album_code_fehler f
   where f.fan_user_id = v_uid and f.at > now() - interval '1 hour';
  if v_n >= v_e.code_fehler_limit then
    return jsonb_build_object('ok', false, 'grund', 'gesperrt');
  end if;

  if v_code ~ '^[A-Z0-9-]{4,24}$' then
    select * into v_c from public.sva_album_codes c where c.code = v_code and c.aktiv for update;
  end if;
  if v_c.id is null then
    insert into public.sva_album_code_fehler (fan_user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'grund', 'ungueltig', 'versuche', greatest(0, v_e.code_fehler_limit - v_n - 1));
  end if;
  if now() < v_c.gueltig_von then
    return jsonb_build_object('ok', false, 'grund', 'noch_nicht', 'gueltigVon', v_c.gueltig_von);
  end if;
  if now() >= v_c.gueltig_bis then
    return jsonb_build_object('ok', false, 'grund', 'abgelaufen');
  end if;
  if exists (select 1 from public.sva_album_code_einloesungen ce where ce.code_id = v_c.id and ce.fan_user_id = v_uid) then
    return jsonb_build_object('ok', false, 'grund', 'schon');
  end if;
  if v_c.max_einloesungen is not null
     and (select count(*) from public.sva_album_code_einloesungen ce where ce.code_id = v_c.id) >= v_c.max_einloesungen then
    return jsonb_build_object('ok', false, 'grund', 'abgelaufen');
  end if;

  insert into public.sva_album_code_einloesungen (code_id, fan_user_id) values (v_c.id, v_uid)
  on conflict do nothing returning code_id into v_ok;
  if v_ok is null then
    return jsonb_build_object('ok', false, 'grund', 'schon');
  end if;
  v_pack := public.sva_album_pack_ziehen_v20(v_uid, v_c.art, null, v_c.karten, v_c.id::text, v_c.titel, null,
              (select k.id from public.sva_album_karten k where k.id = v_c.karte_id and k.aktiv));
  return jsonb_build_object('ok', true, 'packId', v_pack, 'art', v_c.art, 'titel', v_c.titel);
end;
$$;

-- ── 9h. Fan: Freunde ────────────────────────────────────────────────────────
create or replace function public.album_freund_hinzufuegen(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := public.sva_album_uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  v_f    uuid;
begin
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    raise exception 'album_kein_profil' using errcode = 'P0001';
  end if;
  select f.user_id into v_f from public.sva_album_fans f where f.freund_code = v_code;
  if v_f is null then
    raise exception 'album_freund_unbekannt' using errcode = 'P0001';
  end if;
  if v_f = v_uid then
    raise exception 'album_freund_selbst' using errcode = 'P0001';
  end if;
  insert into public.sva_album_freunde (fan_a, fan_b) values (least(v_uid, v_f), greatest(v_uid, v_f))
  on conflict do nothing;
  -- Ziel „Freund geworben“: der Werbende und der Hinzufügende
  perform public.sva_album_ziele_pruefen(v_f, array['sozial_freund']);
  perform public.sva_album_ziele_pruefen(v_uid, array['sozial_freund']);
  return jsonb_build_object('ok', true, 'name', public.sva_album_name(v_f));
end;
$$;

-- ── 9i. Fan: Tausch (1:1 per Link/Code) ─────────────────────────────────────
create or replace function public.album_tausch_anbieten(p_biete uuid, p_wunsch uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_e   public.sva_album_einstellungen;
  v_saison text := public.sva_album_saison();
  v_code text;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    raise exception 'album_kein_profil' using errcode = 'P0001';
  end if;
  update public.sva_album_tausch set status = 'abgelaufen' where status = 'offen' and gueltig_bis <= now();
  if p_biete is null or p_wunsch is null or p_biete = p_wunsch
     or (select count(*) from public.sva_album_karten k
          where k.id in (p_biete, p_wunsch) and k.aktiv and not k.limitiert
            and (k.saison is null or k.saison = v_saison)) <> 2 then
    raise exception 'album_tausch_karte' using errcode = 'P0001';
  end if;
  if coalesce((select b.anzahl from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = p_biete), 0) < 2 then
    raise exception 'album_tausch_keine_doppelte' using errcode = 'P0001';
  end if;
  if not public.sva_album_konto_alt(v_uid) then
    raise exception 'album_tausch_zu_neu' using errcode = 'P0001';
  end if;
  if public.sva_album_tausch_woche(v_uid)
     + (select count(*) from public.sva_album_tausch t where t.von_fan = v_uid and t.status = 'offen') >= v_e.tausch_pro_woche then
    raise exception 'album_tausch_limit' using errcode = 'P0001';
  end if;
  v_code := public.sva_album_tauschcode_neu();
  insert into public.sva_album_tausch (code, von_fan, biete_karte, wunsch_karte)
  values (v_code, v_uid, p_biete, p_wunsch);
  return jsonb_build_object('code', v_code);
end;
$$;

-- Ansicht eines Angebots (Link). Erledigte/zurückgezogene Tausche sieht nur,
-- wer beteiligt war.
create or replace function public.album_tausch_ansehen(p_code text)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_e   public.sva_album_einstellungen;
  v_t   public.sva_album_tausch;
  v_status text;
  v_grund text;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  select * into v_t from public.sva_album_tausch t where t.code = upper(btrim(coalesce(p_code, '')));
  if v_t.id is null or (v_t.status <> 'offen' and v_uid is distinct from v_t.von_fan and v_uid is distinct from v_t.an_fan) then
    raise exception 'album_tausch_unbekannt' using errcode = 'P0001';
  end if;
  v_status := case when v_t.status = 'offen' and v_t.gueltig_bis <= now() then 'abgelaufen' else v_t.status end;
  v_grund := case
    when v_t.von_fan = v_uid then 'eigen'
    when v_status <> 'offen' then v_status
    when not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then 'kein_profil'
    when not public.sva_album_konto_alt(v_uid) then 'zu_neu'
    when public.sva_album_tausch_woche(v_uid) >= v_e.tausch_pro_woche
      or public.sva_album_tausch_woche(v_t.von_fan) >= v_e.tausch_pro_woche then 'limit'
    when coalesce((select b.anzahl from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = v_t.wunsch_karte), 0) < 2 then 'keine_doppelte'
    when coalesce((select b.anzahl from public.sva_album_besitz b where b.fan_user_id = v_t.von_fan and b.karte_id = v_t.biete_karte), 0) < 2 then 'partner_keine_doppelte'
  end;
  return jsonb_strip_nulls(jsonb_build_object(
    'code', v_t.code,
    'von', public.sva_album_name(v_t.von_fan),
    'biete', v_t.biete_karte,
    'wunsch', v_t.wunsch_karte,
    'status', v_status,
    'gueltigBis', v_t.gueltig_bis,
    'eigen', v_t.von_fan = v_uid,
    'kannAnnehmen', v_grund is null,
    'grund', v_grund));
end;
$$;

create or replace function public.album_tausch_annehmen(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_e   public.sva_album_einstellungen;
  v_t   public.sva_album_tausch;
  v_a   integer;
  v_b   integer;
  v_nach jsonb;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  select * into v_t from public.sva_album_tausch t where t.code = upper(btrim(coalesce(p_code, ''))) for update;
  if v_t.id is null or (v_t.status <> 'offen' and v_uid is distinct from v_t.von_fan and v_uid is distinct from v_t.an_fan) then
    raise exception 'album_tausch_unbekannt' using errcode = 'P0001';
  end if;
  if v_t.von_fan = v_uid then
    raise exception 'album_tausch_eigen' using errcode = 'P0001';
  end if;
  if v_t.status <> 'offen' or v_t.gueltig_bis <= now() then
    raise exception 'album_tausch_abgelaufen' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    raise exception 'album_kein_profil' using errcode = 'P0001';
  end if;
  if not public.sva_album_konto_alt(v_uid) or not public.sva_album_konto_alt(v_t.von_fan) then
    raise exception 'album_tausch_zu_neu' using errcode = 'P0001';
  end if;
  if public.sva_album_tausch_woche(v_uid) >= v_e.tausch_pro_woche
     or public.sva_album_tausch_woche(v_t.von_fan) >= v_e.tausch_pro_woche then
    raise exception 'album_tausch_limit' using errcode = 'P0001';
  end if;
  -- Zeilensperren in fester Reihenfolge (kein Deadlock), dann prüfen
  perform 1 from public.sva_album_besitz b
   where (b.fan_user_id = v_t.von_fan and b.karte_id = v_t.biete_karte)
      or (b.fan_user_id = v_uid and b.karte_id = v_t.wunsch_karte)
   order by b.fan_user_id, b.karte_id
   for update;
  select coalesce((select b.anzahl from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = v_t.wunsch_karte), 0) into v_a;
  select coalesce((select b.anzahl from public.sva_album_besitz b where b.fan_user_id = v_t.von_fan and b.karte_id = v_t.biete_karte), 0) into v_b;
  if v_a < 2 then
    raise exception 'album_tausch_keine_doppelte' using errcode = 'P0001';
  end if;
  if v_b < 2 then
    raise exception 'album_tausch_partner' using errcode = 'P0001';
  end if;

  update public.sva_album_besitz set anzahl = anzahl - 1, zuletzt_at = now()
   where fan_user_id = v_uid and karte_id = v_t.wunsch_karte;
  update public.sva_album_besitz set anzahl = anzahl - 1, zuletzt_at = now()
   where fan_user_id = v_t.von_fan and karte_id = v_t.biete_karte;
  insert into public.sva_album_besitz (fan_user_id, karte_id, anzahl) values (v_uid, v_t.biete_karte, 1)
  on conflict (fan_user_id, karte_id) do update set anzahl = public.sva_album_besitz.anzahl + 1, zuletzt_at = now();
  insert into public.sva_album_besitz (fan_user_id, karte_id, anzahl) values (v_t.von_fan, v_t.wunsch_karte, 1)
  on conflict (fan_user_id, karte_id) do update set anzahl = public.sva_album_besitz.anzahl + 1, zuletzt_at = now();
  update public.sva_album_tausch set status = 'erledigt', an_fan = v_uid, erledigt_at = now() where id = v_t.id;

  perform public.sva_album_nach_besitz(v_t.von_fan, array['set', 'kapitel', 'meilenstein', 'sozial_tausch']);
  v_nach := public.sva_album_nach_besitz(v_uid, array['set', 'kapitel', 'meilenstein', 'sozial_tausch']);
  return jsonb_build_object('ok', true, 'erhalten', v_t.biete_karte, 'abgegeben', v_t.wunsch_karte,
                            'kapitel', v_nach -> 'kapitel', 'ziele', v_nach -> 'ziele', 'gutscheine', v_nach -> 'gutscheine');
end;
$$;

create or replace function public.album_tausch_zurueckziehen(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_t   public.sva_album_tausch;
begin
  select * into v_t from public.sva_album_tausch t where t.code = upper(btrim(coalesce(p_code, ''))) for update;
  if v_t.id is null or v_t.von_fan <> v_uid then
    raise exception 'album_tausch_unbekannt' using errcode = 'P0001';
  end if;
  if v_t.status <> 'offen' then
    raise exception 'album_tausch_nicht_offen' using errcode = 'P0001';
  end if;
  update public.sva_album_tausch set status = 'zurueckgezogen', erledigt_at = now() where id = v_t.id;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 9j. Fan: Wunschkarte (wunsch_kosten Doppelte → 1 Basis-Karte) ───────────
create or replace function public.album_wunschkarte(p_karte uuid, p_gegen uuid[])
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_e   public.sva_album_einstellungen;
  v_saison text := public.sva_album_saison();
  v_r   record;
  v_pack uuid;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    raise exception 'album_kein_profil' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.sva_album_karten k
                  where k.id = p_karte and k.aktiv and not k.variante and not k.limitiert
                    and k.seltenheit in ('bronze', 'silber') and (k.saison is null or k.saison = v_saison)) then
    raise exception 'album_wunsch_karte' using errcode = 'P0001';
  end if;
  if p_gegen is null or cardinality(p_gegen) <> v_e.wunsch_kosten or array_position(p_gegen, null) is not null then
    raise exception 'album_wunsch_doppelte' using errcode = 'P0001';
  end if;
  -- sperren, dann je Karte prüfen: Mehrfach-Nennung braucht entsprechend viele Doppelte
  perform 1 from public.sva_album_besitz b
   where b.fan_user_id = v_uid and b.karte_id = any (p_gegen)
   order by b.karte_id for update;
  for v_r in select g as karte, count(*)::int as n from unnest(p_gegen) g group by g loop
    if coalesce((select b.anzahl from public.sva_album_besitz b
                  join public.sva_album_karten k on k.id = b.karte_id and not k.limitiert
                 where b.fan_user_id = v_uid and b.karte_id = v_r.karte), 0) < v_r.n + 1 then
      raise exception 'album_wunsch_doppelte' using errcode = 'P0001';
    end if;
  end loop;
  for v_r in select g as karte, count(*)::int as n from unnest(p_gegen) g group by g loop
    update public.sva_album_besitz set anzahl = anzahl - v_r.n, zuletzt_at = now()
     where fan_user_id = v_uid and karte_id = v_r.karte;
  end loop;
  v_pack := public.sva_album_pack_ziehen_v20(v_uid, 'wunsch', null, 1, null, 'Wunschkarte', null, p_karte);
  return jsonb_build_object('packId', v_pack);
end;
$$;

-- ── 10. Tipp-Liga-Schnittstelle (nur service_role) ──────────────────────────
-- Aufruf aus der SECURITY-DEFINER-Tipp-Abgabe-RPC des Tipp-Pakets:
--   perform public.album_karte_gutschreiben('tipp', v_tipp_id);
-- Fan = auth.uid(); ohne Album-Profil → null; idempotent je Bezug.
create or replace function public.album_karte_gutschreiben(p_quelle text, p_bezug uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_pack uuid;
begin
  if p_quelle is distinct from 'tipp' then
    raise exception 'album_quelle_unbekannt' using errcode = 'P0001';
  end if;
  if v_uid is null or p_bezug is null or not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    return null;
  end if;
  v_pack := public.sva_album_pack_ziehen_v20(v_uid, 'tipp', null,
              (select e.karten_tipp from public.sva_album_einstellungen e where e.id = 1),
              'tipp:' || p_bezug::text, 'Tipp-Karte');
  if v_pack is not null then
    perform public.sva_album_ziele_pruefen(v_uid, array['serie_tipp']);
  end if;
  return v_pack;
end;
$$;

-- Externe Ziele (typ 'extern', z. B. 'tipp_exakt'): idempotent je (Ziel, Fan,
-- Bezug); nicht wiederholbare Ziele nur einmal je Saison (Bezug ignoriert).
create or replace function public.album_ziel_ausloesen(p_schluessel text, p_bezug uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return jsonb_build_object('erreicht', false, 'packId', null, 'lose', 0);
  end if;
  return public.sva_album_ziel_extern(v_uid, p_schluessel, p_bezug::text) - 'titel';
end;
$$;

-- ── 11. Fan: Konto löschen ──────────────────────────────────────────────────
create or replace function public.album_konto_loeschen()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := public.sva_album_uid();
  v_app  text;
  v_mail text;
  v_auth boolean := false;
begin
  update public.sva_album_checkins set fan_user_id = null where fan_user_id = v_uid;
  delete from public.sva_album_ziel_erreicht where fan_user_id = v_uid;
  delete from public.sva_album_lose where fan_user_id = v_uid;
  perform set_config('sva.verlosung_intern', 'an', true);
  update public.sva_album_verlosungen set gewinner_fan = null where gewinner_fan = v_uid;
  perform set_config('sva.verlosung_intern', '', true);
  delete from public.sva_album_tausch where von_fan = v_uid or an_fan = v_uid;
  delete from public.sva_album_freunde where fan_a = v_uid or fan_b = v_uid;
  delete from public.sva_album_code_einloesungen where fan_user_id = v_uid;
  delete from public.sva_album_code_fehler where fan_user_id = v_uid;
  delete from public.sva_album_abzeichen where fan_user_id = v_uid;
  delete from public.sva_album_packs where fan_user_id = v_uid;
  delete from public.sva_album_besitz where fan_user_id = v_uid;
  delete from public.sva_album_gutscheine where fan_user_id = v_uid;
  delete from public.sva_album_pin_fehler where fan_user_id = v_uid;
  delete from public.sva_album_fans where user_id = v_uid;

  begin
    execute $q$ select u.raw_user_meta_data ->> 'app', u.email from auth.users u where u.id = $1 $q$
      into v_app, v_mail using v_uid;
    if v_app = 'sva-album'
       and not exists (select 1 from public.sm_admins a where lower(a.email) = lower(coalesce(v_mail, ''))) then
      execute $q$ delete from auth.users where id = $1 $q$ using v_uid;
      v_auth := true;
    end if;
  exception when others then
    v_auth := false; -- Album-Daten sind trotzdem gelöscht
  end;
  return jsonb_build_object('ok', true, 'loginGeloescht', v_auth);
end;
$$;

-- ── 12. Admin ───────────────────────────────────────────────────────────────
-- Standard-Katalog v20 der aktuellen Saison (idempotent, bestehende Karten
-- bleiben unberührt). Bilddateien unter /karten/ liefert die Website.
create or replace function public.album_admin_katalog_standard()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_basis integer := 0;
  v_var integer := 0;
  v_stab integer := 0;
  v_mom integer := 0;
  v_kurve integer := 0;
  v_partner integer := 0;
  v_n integer;
begin
  perform public.sva_album_admin_pruefen();

  -- Basis-Karte je Spieler (Kapitän Gold, sonst Bronze) — nur wenn es noch keine gibt
  insert into public.sva_album_karten (typ, roster_id, titel, untertitel, bild_url, seltenheit, saison, sortierung)
  select 'spieler', r.id, left(r.name, 60),
         case when r.kapitaen then 'Kapitän'
              else case upper(coalesce(r.position, '')) when 'TW' then 'Torwart' when 'TORWART' then 'Torwart'
                     when 'ABW' then 'Abwehr' when 'ABWEHR' then 'Abwehr'
                     when 'ANG' then 'Angriff' when 'STURM' then 'Angriff' when 'ANGRIFF' then 'Angriff'
                     else 'Mittelfeld' end end,
         coalesce(r.foto_url, r.freisteller_url), case when r.kapitaen then 'gold' else 'bronze' end, v_saison, r.sortierung
    from public.sm_roster r
   where r.aktiv and r.rolle = 'spieler' and char_length(btrim(r.name)) >= 2
     and not exists (select 1 from public.sva_album_karten k
                      where k.typ = 'spieler' and k.roster_id = r.id and not k.variante and not k.limitiert
                        and coalesce(k.saison, v_saison) = v_saison);
  get diagnostics v_basis = row_count;

  -- Silber-Glanz-Variante je Spieler (Zusatz-Sammelstück)
  insert into public.sva_album_karten (typ, roster_id, titel, untertitel, bild_url, seltenheit, variante, saison, sortierung)
  select 'spieler', r.id, left(r.name, 60), 'Silber-Glanz', coalesce(r.freisteller_url, r.foto_url), 'silber', true, v_saison, r.sortierung
    from public.sm_roster r
   where r.aktiv and r.rolle = 'spieler' and char_length(btrim(r.name)) >= 2
     and not exists (select 1 from public.sva_album_karten k
                      where k.typ = 'spieler' and k.roster_id = r.id and k.variante
                        and coalesce(k.saison, v_saison) = v_saison);
  get diagnostics v_var = row_count;

  -- Trainerstab: Basis Gold
  insert into public.sva_album_karten (typ, roster_id, titel, untertitel, bild_url, seltenheit, saison, sortierung)
  select 'trainer', r.id, left(r.name, 60),
         case r.rolle when 'trainer' then 'Trainer' when 'co-trainer' then 'Co-Trainer'
                      when 'torwart-trainer' then 'Torwart-Trainer' else 'Teammanager' end,
         coalesce(r.foto_url, r.freisteller_url), 'gold', v_saison, r.sortierung
    from public.sm_roster r
   where r.aktiv and r.rolle <> 'spieler' and char_length(btrim(r.name)) >= 2
     and not exists (select 1 from public.sva_album_karten k
                      where k.typ = 'trainer' and k.roster_id = r.id and not k.variante and not k.limitiert
                        and coalesce(k.saison, v_saison) = v_saison);
  get diagnostics v_stab = row_count;

  -- Momente (Fotos: picture by Nele) + Kurve
  insert into public.sva_album_karten (typ, titel, seltenheit, bild_url, bild_fokus, serie, credit, saison, sortierung)
  select m.typ, m.titel, m.selt, m.bild, case when m.bild is not null then '50% 40%' end, m.serie, m.credit, v_saison, m.sort
    from (values
      ('moment', 'Die Meister-Elf',  'spezial', '/karten/meister-elf.webp',       'Meister 2026',       'picture by Nele', 10),
      ('moment', 'Meister-Shirt',    'gold',    '/karten/meister-shirt.webp',     'Meister 2026',       'picture by Nele', 11),
      ('moment', 'Ab in die Kurve',  'gold',    '/karten/lauf-zu-den-fans.webp',  'Meister 2026',       'picture by Nele', 12),
      ('moment', 'Die Umarmung',     'silber',  '/karten/umarmung.webp',          'Meister 2026',       'picture by Nele', 13),
      ('moment', 'Der Pokal',        'spezial', '/karten/pokal.webp',             'Urknall-Pokal 2026', 'picture by Nele', 20),
      ('moment', 'Siegerfoto',       'gold',    '/karten/siegerfoto.webp',        'Urknall-Pokal 2026', 'picture by Nele', 21),
      ('moment', 'Einer fliegt',     'gold',    '/karten/hochwerfen.webp',        'Urknall-Pokal 2026', 'picture by Nele', 22),
      ('moment', 'Die Parade',       'silber',  '/karten/parade.webp',            'Urknall-Pokal 2026', 'picture by Nele', 23)
    ) as m(typ, titel, selt, bild, serie, credit, sort)
   where not exists (select 1 from public.sva_album_karten k
                      where k.typ = m.typ and k.titel = m.titel and coalesce(k.saison, v_saison) = v_saison);
  get diagnostics v_mom = row_count;

  insert into public.sva_album_karten (typ, titel, seltenheit, bild_url, bild_fokus, saison, sortierung)
  select m.typ, m.titel, m.selt, m.bild, case when m.bild is not null then '50% 50%' end, v_saison, m.sort
    from (values
      ('fan', 'Die Kurve',  'silber', '/karten/kurve.webp', 10),
      ('fan', 'Die Fahne',  'bronze', '/karten/fahne.webp', 11),
      ('fan', 'Dodos Raum', 'silber', null::text,           12)
    ) as m(typ, titel, selt, bild, sort)
   where not exists (select 1 from public.sva_album_karten k
                      where k.typ = m.typ and k.titel = m.titel and coalesce(k.saison, v_saison) = v_saison);
  get diagnostics v_kurve = row_count;

  -- Partnerkarte je aktivem Sponsor (Bronze, per Simulation: Partner sollen
  -- früh im Album kleben — Sichtbarkeit für den Sponsor)
  insert into public.sva_album_karten (typ, sponsor_id, titel, seltenheit, saison, sortierung)
  select 'partner', sp.id, left(btrim(sp.name), 60), 'bronze', v_saison, sp.sortierung
    from public.sm_sponsoren sp
   where sp.aktiv and char_length(btrim(sp.name)) >= 2
     and not exists (select 1 from public.sva_album_karten k
                      where k.typ = 'partner' and coalesce(k.saison, v_saison) = v_saison
                        and (k.sponsor_id = sp.id or k.titel = left(btrim(sp.name), 60)));
  get diagnostics v_partner = row_count;

  select count(*) into v_n from public.sva_album_plaetze(null);
  return jsonb_build_object('saison', v_saison, 'spielerBasis', v_basis, 'varianten', v_var, 'trainer', v_stab,
                            'momente', v_mom, 'kurve', v_kurve, 'partner', v_partner, 'albumPlaetze', v_n);
end;
$$;

-- Aktions-Code anlegen (Story 24 h, Partner im Laden, …)
create or replace function public.album_admin_story_code(
  p_art text, p_titel text, p_karte uuid default null, p_karten integer default null,
  p_stunden integer default 24, p_code text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_code text := nullif(upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g')), '');
  v_c public.sva_album_codes;
begin
  perform public.sva_album_admin_pruefen();
  if p_art not in ('story', 'partner', 'advent') then
    raise exception 'album_ungueltig:art' using errcode = '22023';
  end if;
  if p_titel is null or char_length(btrim(p_titel)) not between 2 and 60 then
    raise exception 'album_ungueltig:titel' using errcode = '22023';
  end if;
  if coalesce(p_stunden, 24) not between 1 and 8760 then
    raise exception 'album_ungueltig:stunden' using errcode = '22023';
  end if;
  if p_karte is not null and not exists (select 1 from public.sva_album_karten k where k.id = p_karte) then
    raise exception 'album_ungueltig:karte' using errcode = '22023';
  end if;
  if v_code is null then
    v_code := public.sva_album_aktionscode_neu(case p_art when 'story' then 'STORY' when 'partner' then 'PARTNER' else 'ADVENT' end);
  elsif v_code !~ '^[A-Z0-9-]{4,24}$' then
    raise exception 'album_ungueltig:code' using errcode = '22023';
  elsif exists (select 1 from public.sva_album_codes c where c.code = v_code) then
    raise exception 'album_code_vergeben' using errcode = 'P0001';
  end if;
  insert into public.sva_album_codes (code, art, titel, karte_id, karten, gueltig_von, gueltig_bis, erzeugt_von)
  values (v_code, p_art, btrim(p_titel), p_karte,
          greatest(1, least(5, coalesce(p_karten, case when p_art = 'story'
                                                       then (select e.karten_story from public.sva_album_einstellungen e where e.id = 1)
                                                       else 1 end))),
          now(), now() + make_interval(hours => coalesce(p_stunden, 24)), auth.jwt() ->> 'email')
  returning * into v_c;
  return jsonb_build_object('id', v_c.id, 'code', v_c.code, 'gueltigBis', v_c.gueltig_bis);
end;
$$;

-- Story-Codes auf Vorrat: je Tag ein Code, gültig an diesem Tag (Europe/Berlin)
create or replace function public.album_admin_story_codes_massen(p_start date, p_tage integer, p_titel text, p_karten integer default 1)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_out jsonb := '[]'::jsonb;
  v_d date;
  v_c public.sva_album_codes;
  v_von timestamptz;
begin
  perform public.sva_album_admin_pruefen();
  if p_start is null or coalesce(p_tage, 0) not between 1 and 92 then
    raise exception 'album_ungueltig:tage' using errcode = '22023';
  end if;
  if p_titel is null or char_length(btrim(p_titel)) not between 2 and 60 then
    raise exception 'album_ungueltig:titel' using errcode = '22023';
  end if;
  for v_d in select (p_start + g)::date from generate_series(0, p_tage - 1) g loop
    v_von := v_d::timestamp at time zone 'Europe/Berlin';
    insert into public.sva_album_codes (code, art, titel, karten, gueltig_von, gueltig_bis, erzeugt_von)
    values (public.sva_album_aktionscode_neu('STORY'), 'story', btrim(p_titel), greatest(1, least(5, coalesce(p_karten, 1))),
            v_von, (v_d + 1)::timestamp at time zone 'Europe/Berlin', auth.jwt() ->> 'email')
    returning * into v_c;
    v_out := v_out || jsonb_build_object('id', v_c.id, 'datum', v_d, 'code', v_c.code,
                                         'gueltigVon', v_c.gueltig_von, 'gueltigBis', v_c.gueltig_bis);
  end loop;
  return v_out;
end;
$$;

-- Adventskalender: 24 Codes (Tag n gilt am n.12. 00:00–24:00 Europe/Berlin),
-- Tag 24 liefert die Weihnachts-Spezialkarte. Idempotent.
create or replace function public.album_admin_advent(p_jahr integer, p_karte uuid default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_t integer;
  v_von timestamptz;
begin
  perform public.sva_album_admin_pruefen();
  if p_jahr is null or p_jahr not between 2024 and 2100 then
    raise exception 'album_ungueltig:jahr' using errcode = '22023';
  end if;
  if p_karte is not null and not exists (select 1 from public.sva_album_karten k where k.id = p_karte) then
    raise exception 'album_ungueltig:karte' using errcode = '22023';
  end if;
  for v_t in 1 .. 24 loop
    v_von := make_timestamptz(p_jahr, 12, v_t, 0, 0, 0, 'Europe/Berlin');
    insert into public.sva_album_codes (code, art, titel, karte_id, karten, gueltig_von, gueltig_bis,
                                        advent_jahr, advent_tag, erzeugt_von)
    values (public.sva_album_aktionscode_neu('ADVENT'), 'advent',
            case when v_t = 24 then 'Adventskalender · Heiligabend' else 'Adventskalender · Türchen ' || v_t end,
            case when v_t = 24 then p_karte end, 1,
            v_von, make_timestamptz(p_jahr, 12, v_t, 0, 0, 0, 'Europe/Berlin') + interval '1 day',
            p_jahr, v_t, auth.jwt() ->> 'email')
    on conflict (advent_jahr, advent_tag) where art = 'advent' do nothing;
  end loop;
  if p_karte is not null then
    update public.sva_album_codes set karte_id = p_karte where art = 'advent' and advent_jahr = p_jahr and advent_tag = 24;
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('tag', c.advent_tag, 'code', c.code) order by c.advent_tag)
                     from public.sva_album_codes c where c.art = 'advent' and c.advent_jahr = p_jahr), '[]'::jsonb);
end;
$$;

-- „Spieler des Spiels“: limitierte Spezialkarte, ziehbar Mo 00:00 bis So
-- 23:59:59 (Europe/Berlin) der AKTUELLEN Woche (oder p_tage ab jetzt).
-- Idempotent je (Spieler, Spiel).
drop function if exists public.album_admin_motm(uuid, text, integer, text);
create or replace function public.album_admin_motm(p_roster uuid, p_spiel uuid default null, p_bild text default null, p_tage integer default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_r public.sm_roster;
  v_s public.sm_spiele;
  v_k public.sva_album_karten;
  v_mo timestamp;
  v_von timestamptz;
  v_bis timestamptz;
begin
  perform public.sva_album_admin_pruefen();
  select * into v_r from public.sm_roster where id = p_roster;
  if v_r.id is null or char_length(btrim(v_r.name)) < 2 then
    raise exception 'album_ungueltig:spieler' using errcode = '22023';
  end if;
  if p_spiel is not null then
    select * into v_s from public.sm_spiele where id = p_spiel;
    if v_s.id is null then
      raise exception 'album_spiel_unbekannt' using errcode = 'P0001';
    end if;
    select * into v_k from public.sva_album_karten k
     where k.limitiert and k.roster_id = p_roster and k.motm_spiel_id = p_spiel;
    if v_k.id is not null then
      return jsonb_build_object('id', v_k.id, 'neu', false, 'ziehbarVon', v_k.ziehbar_von, 'ziehbarBis', v_k.ziehbar_bis);
    end if;
  end if;
  if p_bild is not null and (char_length(p_bild) > 500 or p_bild !~ '^(https://|/)') then
    raise exception 'album_ungueltig:bild' using errcode = '22023';
  end if;
  if p_tage is not null then
    if p_tage not between 1 and 30 then
      raise exception 'album_ungueltig:tage' using errcode = '22023';
    end if;
    v_von := now();
    v_bis := now() + make_interval(days => p_tage);
  else
    v_mo := date_trunc('week', now() at time zone 'Europe/Berlin');
    v_von := v_mo at time zone 'Europe/Berlin';
    v_bis := (v_mo + interval '7 days') at time zone 'Europe/Berlin';
  end if;
  insert into public.sva_album_karten (typ, roster_id, titel, untertitel, bild_url, seltenheit, limitiert, serie,
                                       ziehbar_von, ziehbar_bis, motm_spiel_id, saison, sortierung)
  values ('spieler', v_r.id, left(v_r.name, 60),
          case when v_s.id is not null
               then left('MOTM · ' || coalesce(v_s.spieltag_nr || '. Spieltag · ', '') || v_s.gegner, 80)
               else 'Spieler des Spiels' end,
          coalesce(p_bild, v_r.freisteller_url, v_r.foto_url), 'spezial', true, 'Spieler des Spiels',
          v_von, v_bis, v_s.id, public.sva_album_saison(), 900)
  returning * into v_k;
  return jsonb_build_object('id', v_k.id, 'neu', true, 'ziehbarVon', v_k.ziehbar_von, 'ziehbarBis', v_k.ziehbar_bis);
end;
$$;

-- Standard-Ziele (idempotent über den Schlüssel; Set-Mitglieder werden
-- aktualisiert, Titel/Belohnungen aus dem Admin bleiben unberührt).
create or replace function public.album_admin_ziele_standard()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_vorher integer;
  v_nachher integer;
  v_familie uuid[];
begin
  perform public.sva_album_admin_pruefen();
  select count(*) into v_vorher from public.sva_album_ziele;

  create temporary table if not exists sva_tmp_ziele (
    schluessel text, typ text, vorlage text, titel text, beschreibung text, karten uuid[], roster_ids uuid[],
    kapitel text, anzahl integer, b_karten integer, b_min text, b_lose integer, geheim boolean,
    wiederholbar boolean, sortierung integer) on commit drop;
  delete from sva_tmp_ziele;

  select array_agg(r.id) into v_familie from public.sm_roster r
   where r.slug in ('p-pejas-e', 'p-pejas-n', 'p-warkehr-i', 'p-warkehr-a', 's-ebeling-a', 'p-ebeling-t');

  insert into sva_tmp_ziele values
    ('zwillinge', 'set', 'familie', 'Die Zwillinge', 'Elias und Noah Pejas im Album.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-pejas-e', 'p-pejas-n')), null, null, 1, null, 0, false, false, 10),
    ('warkehr', 'set', 'familie', 'Die Warkehr-Brüder', 'Isaak und Aaron Warkehr im Album.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-warkehr-i', 'p-warkehr-a')), null, null, 1, null, 0, false, false, 11),
    ('vater_sohn', 'set', 'familie', 'Vater & Sohn', 'Adolf (Trainerstab) und Tino Ebeling im Album.', null,
      array(select r.id from public.sm_roster r where r.slug in ('s-ebeling-a', 'p-ebeling-t')), null, null, 1, null, 0, false, false, 12),
    ('familie_sva', 'set', 'familie', 'Familie SVA', 'Alle Familien-Paare komplett.', null,
      v_familie, null, null, 3, 'gold', 0, false, false, 13),
    ('meister_2026', 'set', 'set', 'Meister 2026', 'Alle Momente der Meistersaison.',
      array(select k.id from public.sva_album_karten k where k.typ = 'moment' and k.serie = 'Meister 2026' and not k.limitiert
              and k.aktiv and coalesce(k.saison, v_saison) = v_saison), null, null, null, 1, 'spezial', 0, false, false, 20),
    ('rueckennummern', 'set', 'set', 'Rückennummern 1–11', 'Alle Spieler mit den Nummern 1 bis 11.', null,
      array(select r.id from public.sm_roster r where r.aktiv and r.rolle = 'spieler' and r.nummer between 1 and 11),
      null, null, 1, null, 0, false, false, 21),
    ('die_kurve', 'set', 'set', 'Die Kurve', 'Alle Karten der Kurve.',
      array(select k.id from public.sva_album_karten k where k.typ = 'fan' and not k.limitiert and not k.variante
              and k.aktiv and coalesce(k.saison, v_saison) = v_saison), null, null, null, 1, null, 0, false, false, 22),
    ('partner_set', 'set', 'set', 'Partner-Set', 'Alle Partnerkarten.',
      array(select k.id from public.sva_album_karten k where k.typ = 'partner' and not k.limitiert and not k.variante
              and k.aktiv and coalesce(k.saison, v_saison) = v_saison), null, null, null, 1, null, 0, false, false, 23),
    ('kapitel_tw', 'kapitel', 'kapitel', 'Kapitel komplett: Torwart', null, null, null, 'TW', null, 1, null, 0, false, false, 30),
    ('kapitel_abw', 'kapitel', 'kapitel', 'Kapitel komplett: Abwehr', null, null, null, 'ABW', null, 1, null, 0, false, false, 31),
    ('kapitel_mit', 'kapitel', 'kapitel', 'Kapitel komplett: Mittelfeld', null, null, null, 'MIT', null, 1, null, 0, false, false, 32),
    ('kapitel_ang', 'kapitel', 'kapitel', 'Kapitel komplett: Angriff', null, null, null, 'ANG', null, 1, null, 0, false, false, 33),
    ('kapitel_stab', 'kapitel', 'kapitel', 'Kapitel komplett: Trainerstab', null, null, null, 'stab', null, 1, null, 0, false, false, 34),
    ('kapitel_moment', 'kapitel', 'kapitel', 'Kapitel komplett: Momente', null, null, null, 'moment', null, 1, null, 0, false, false, 35),
    ('kapitel_fan', 'kapitel', 'kapitel', 'Kapitel komplett: Kurve', null, null, null, 'fan', null, 1, null, 0, false, false, 36),
    ('kapitel_partner', 'kapitel', 'kapitel', 'Kapitel komplett: Partner', null, null, null, 'partner', null, 1, null, 0, false, false, 37),
    ('meilenstein_10', 'meilenstein', 'meilenstein', '10 % gesammelt', null, null, null, null, 10, 1, null, 1, false, false, 40),
    ('meilenstein_25', 'meilenstein', 'meilenstein', '25 % gesammelt', null, null, null, null, 25, 1, null, 1, false, false, 41),
    ('meilenstein_50', 'meilenstein', 'meilenstein', 'Halbzeit: 50 %', null, null, null, null, 50, 1, null, 2, false, false, 42),
    ('meilenstein_75', 'meilenstein', 'meilenstein', '75 % gesammelt', null, null, null, null, 75, 1, null, 3, false, false, 43),
    ('meilenstein_100', 'meilenstein', 'meilenstein', 'Album komplett: 100 %', null, null, null, null, 100, 1, null, 5, false, false, 44),
    ('dauerkarte', 'serie_checkin', 'serie', 'Dauerkarte', '3 Heimspiele in Folge eingecheckt.', null, null, null, 3, 1, 'gold', 0, false, false, 50),
    ('tipp_serie', 'serie_tipp', 'serie', 'Tipp-Serie', '4 Wochen in Folge getippt.', null, null, null, 4, 1, null, 0, false, false, 51),
    ('erster_tausch', 'sozial_tausch', 'sozial', 'Erster Tausch', 'Eine Karte mit einem Freund getauscht.', null, null, null, 1, 1, null, 0, false, false, 60),
    ('freund_geworben', 'sozial_freund', 'sozial', 'Freund geworben', 'Freundescode geteilt oder eingelöst.', null, null, null, 1, 1, null, 0, false, false, 61),
    ('tipp_exakt', 'extern', 'tipp', 'Exakt getippt', 'Ergebnis exakt getippt.', null, null, null, null, 1, 'silber', 0, false, true, 70),
    ('tipp_kapitaen_trifft', 'extern', 'tipp', 'Kapitän trifft', 'Richtig getippt: der Kapitän trifft.', null, null, null, null, 1, null, 0, false, true, 71),
    ('tipp_spieltagssieg', 'extern', 'tipp', 'Spieltagssieg', 'Beste Punktzahl des Spieltags in der Tipp-Liga.', null, null, null, null, 0, null, 2, false, true, 72),
    ('nachteule', 'extern', 'mission', 'Nachteule', 'Check-in bei einem Flutlichtspiel (Anstoß ab 19 Uhr).', null, null, null, null, 1, 'silber', 0, true, false, 80);

  insert into public.sva_album_ziele (schluessel, typ, vorlage, titel, beschreibung, karten, roster_ids, kapitel, anzahl,
                                      belohnung_karten, belohnung_min_seltenheit, belohnung_lose, geheim, wiederholbar, sortierung)
  select t.schluessel, t.typ, t.vorlage, t.titel, t.beschreibung, t.karten, t.roster_ids, t.kapitel, t.anzahl,
         t.b_karten, t.b_min, t.b_lose, t.geheim, t.wiederholbar, t.sortierung
    from sva_tmp_ziele t
  on conflict (schluessel) do update
     set karten = excluded.karten, roster_ids = excluded.roster_ids;

  select count(*) into v_nachher from public.sva_album_ziele;
  return jsonb_build_object('angelegt', v_nachher - v_vorher, 'gesamt', v_nachher,
                            'standard', (select count(*) from sva_tmp_ziele));
end;
$$;

-- Wer hat welches Ziel erreicht?
create or replace function public.album_admin_ziel_status(p_ziel uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
begin
  perform public.sva_album_admin_pruefen();
  return jsonb_build_object(
    'saison', v_saison,
    'ziele', coalesce((
      select jsonb_agg(jsonb_build_object('id', z.id, 'schluessel', z.schluessel, 'typ', z.typ, 'titel', z.titel,
               'aktiv', z.aktiv, 'geheim', z.geheim,
               'erreicht', (select count(*) from public.sva_album_ziel_erreicht e where e.ziel_id = z.id and e.saison = v_saison),
               'fans', (select count(distinct e.fan_user_id) from public.sva_album_ziel_erreicht e where e.ziel_id = z.id and e.saison = v_saison))
             order by z.sortierung, z.titel)
        from public.sva_album_ziele z where p_ziel is null or z.id = p_ziel), '[]'::jsonb),
    'erreicht', coalesce((
      select jsonb_agg(jsonb_build_object('ziel', x.schluessel, 'titel', x.titel, 'name', x.name, 'at', x.at, 'bezug', x.bezug,
               'lose', x.lose, 'pack', x.pack_id is not null) order by x.at desc)
        from (select z.schluessel, z.titel, coalesce(public.sva_album_name(e.fan_user_id), 'gelöscht') as name, e.at, e.bezug, e.lose, e.pack_id
                from public.sva_album_ziel_erreicht e join public.sva_album_ziele z on z.id = e.ziel_id
               where (p_ziel is null or e.ziel_id = p_ziel) and e.saison = v_saison
               order by e.at desc limit case when p_ziel is null then 50 else 1000 end) x), '[]'::jsonb)
  );
end;
$$;

-- Verlosung ziehen: fair, gewichtet nach Losen der Saison (bis Stichtag bzw.
-- jetzt), deterministisch aus Seed. Verfahren: Teilnehmer in fester Reihenfolge
-- (Profil-Anlage), Lose kumuliert; Los-Nummer = (erste 52 Bit von
-- SHA-256(seed)) mod Lose gesamt; gewonnen hat, in dessen Los-Bereich die Nummer fällt.
create or replace function public.sva_album_los_nummer(p_seed text, p_gesamt integer)
returns integer
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select (('x' || substr(encode(sha256(convert_to(p_seed, 'UTF8')), 'hex'), 1, 13))::bit(52)::bigint % greatest(1, p_gesamt))::int;
$$;

create or replace function public.album_admin_verlosung_ziehen(p_id uuid, p_seed text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_v public.sva_album_verlosungen;
  v_seed text := nullif(btrim(coalesce(p_seed, '')), '');
  v_stich timestamptz;
  v_fans uuid[];
  v_namen text[];
  v_lose integer[];
  v_gesamt integer;
  v_nummer integer;
  v_idx integer := 0;
  v_kum integer := 0;
  v_i integer;
  v_teiln jsonb;
  v_prot jsonb;
begin
  perform public.sva_album_admin_pruefen();
  select * into v_v from public.sva_album_verlosungen where id = p_id for update;
  if v_v.id is null then
    raise exception 'album_verlosung_unbekannt' using errcode = 'P0001';
  end if;
  if v_v.status = 'gezogen' then
    raise exception 'album_verlosung_schon_gezogen' using errcode = 'P0001';
  end if;
  if v_seed is null then
    v_seed := replace(gen_random_uuid()::text, '-', '');
  end if;
  if char_length(v_seed) > 200 then
    raise exception 'album_ungueltig:seed' using errcode = '22023';
  end if;
  v_stich := least(coalesce(v_v.stichtag, now()), now());

  select array_agg(x.user_id order by x.created_at, x.user_id), array_agg(x.name order by x.created_at, x.user_id),
         array_agg(x.lose order by x.created_at, x.user_id), sum(x.lose)::int
    into v_fans, v_namen, v_lose, v_gesamt
    from (select f.user_id, f.created_at, f.vorname || ' ' || f.initial || '.' as name, sum(l.anzahl)::int as lose
            from public.sva_album_lose l join public.sva_album_fans f on f.user_id = l.fan_user_id
           where l.saison = v_v.saison and l.at <= v_stich
           group by f.user_id, f.created_at, f.vorname, f.initial
          having sum(l.anzahl) >= v_v.min_lose) x;
  if coalesce(v_gesamt, 0) = 0 then
    raise exception 'album_verlosung_keine_teilnehmer' using errcode = 'P0001';
  end if;

  v_nummer := public.sva_album_los_nummer(v_seed, v_gesamt);
  for v_i in 1 .. cardinality(v_lose) loop
    v_kum := v_kum + v_lose[v_i];
    if v_nummer < v_kum then
      v_idx := v_i - 1;
      exit;
    end if;
  end loop;

  select jsonb_agg(jsonb_build_object('name', v_namen[i], 'lose', v_lose[i]) order by i) into v_teiln
    from generate_series(1, cardinality(v_lose)) i;
  v_prot := jsonb_build_object(
    'zeit', now(), 'seed', v_seed, 'stichtag', v_stich, 'teilnehmer', cardinality(v_lose), 'loseGesamt', v_gesamt,
    'losNummer', v_nummer, 'gewinnerIndex', v_idx, 'liste', v_teiln,
    'verfahren', 'Teilnehmer = Fans mit mind. ' || v_v.min_lose || ' Los(en) der Saison ' || v_v.saison
                 || ' bis Stichtag, Reihenfolge nach Profil-Anlage. Los-Nummer = (erste 52 Bit von SHA-256(Seed)) mod Lose gesamt (0-basiert); '
                 || 'gewonnen hat, in dessen kumulierten Los-Bereich die Nummer fällt. Gleicher Seed + gleiche Liste = gleiches Ergebnis.');
  perform set_config('sva.verlosung_intern', 'an', true);
  update public.sva_album_verlosungen
     set status = 'gezogen', seed = v_seed, gezogen_at = now(), teilnehmer = cardinality(v_lose), lose_gesamt = v_gesamt,
         gewinner_fan = v_fans[v_idx + 1], gewinner_name = v_namen[v_idx + 1], protokoll = v_prot
   where id = v_v.id;
  perform set_config('sva.verlosung_intern', '', true);
  return jsonb_build_object('gewinner', jsonb_build_object('name', v_namen[v_idx + 1], 'lose', v_lose[v_idx + 1]),
                            'teilnehmer', v_teiln, 'gewinnerIndex', v_idx, 'seed', v_seed, 'loseGesamt', v_gesamt,
                            'losNummer', v_nummer);
end;
$$;

-- Kennzahlen + Live-Zähler für den Admin (bisherige Felder unverändert).
create or replace function public.album_admin_statistik()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
begin
  perform public.sva_album_admin_pruefen();
  return jsonb_build_object(
    'saison', v_saison,
    'fans', (select count(*) from public.sva_album_fans),
    'fansRangliste', (select count(*) from public.sva_album_fans where rangliste),
    'fansErinnerung', (select count(*) from public.sva_album_fans where erinnerung),
    'checkinsSaison', (select count(*) from public.sva_album_checkins where saison = v_saison),
    'packsOffen', (select count(*) from public.sva_album_packs where geoeffnet_at is null),
    'gutscheineOffen', (select count(*) from public.sva_album_gutscheine where status = 'offen' and saison = v_saison),
    'gutscheineEingeloest', (select count(*) from public.sva_album_gutscheine where status = 'eingeloest' and saison = v_saison),
    'albenKomplett', (select count(*) from public.sva_album_gutscheine where stufe = 'komplett' and saison = v_saison),
    'codesEingeloest', (select count(*) from public.sva_album_code_einloesungen),
    'tauscheErledigt', (select count(*) from public.sva_album_tausch where status = 'erledigt'),
    'starterGeholt', (select count(*) from public.sva_album_packs where art = 'starter'),
    'zieleErreicht', (select count(*) from public.sva_album_ziel_erreicht where saison = v_saison),
    'loseSaison', (select coalesce(sum(anzahl), 0) from public.sva_album_lose where saison = v_saison),
    'spiele', coalesce((
      select jsonb_agg(jsonb_build_object('spielId', s.id, 'checkins',
               (select count(*) from public.sva_album_checkins c where c.spiel_id = s.id)) order by s.anstoss)
        from public.sm_spiele s
       where s.heim and s.anstoss > now() - interval '400 days'), '[]'::jsonb),
    -- E-Mail NUR von Fans, die einer Erinnerung zugestimmt haben
    'kontakte', coalesce((
      select jsonb_agg(jsonb_build_object('name', f.vorname || ' ' || f.initial || '.', 'email', u.email) order by f.created_at)
        from public.sva_album_fans f
        join auth.users u on u.id = f.user_id
       where f.erinnerung), '[]'::jsonb)
  );
end;
$$;

-- ── 13. Funktionsrechte ─────────────────────────────────────────────────────
-- Supabase vergibt EXECUTE per Default-Privileg an anon/authenticated →
-- explizit entziehen und gezielt neu vergeben.
do $$
declare f text;
begin
  -- intern: nur service_role
  foreach f in array array[
    'public.sva_album_freund_code_neu()',
    'public.sva_album_platz(text, uuid, uuid)',
    'public.sva_album_kapitel_von(text, text)',
    'public.sva_album_rang(text)',
    'public.sva_album_jetzt()',
    'public.sva_album_name(uuid)',
    'public.sva_album_zufall(integer)',
    'public.sva_album_aktionscode_neu(text)',
    'public.sva_album_tauschcode_neu()',
    'public.sva_album_lose_buchen(uuid, integer, text, text, text)',
    'public.sva_album_plaetze(uuid)',
    'public.sva_album_konto_alt(uuid)',
    'public.sva_album_tausch_woche(uuid)',
    'public.sva_album_stufe(public.sva_album_einstellungen, text[])',
    'public.sva_album_karte_waehlen(public.sva_album_einstellungen, uuid[], text[], boolean[], uuid[], text[], boolean, uuid[], uuid[], uuid[], uuid[])',
    'public.sva_album_pack_ziehen_v20(uuid, text, uuid, integer, text, text, text, uuid, boolean)',
    'public.sva_album_pack_ziehen(uuid, uuid, text)',
    'public.sva_album_komplett(uuid)',
    'public.sva_album_belohnungen(uuid)',
    'public.sva_album_kapitel_pruefen(uuid)',
    'public.sva_album_ziel_stand(uuid, uuid)',
    'public.sva_album_ziel_vergeben(uuid, uuid, text)',
    'public.sva_album_ziele_pruefen(uuid, text[])',
    'public.sva_album_ziel_extern(uuid, text, text)',
    'public.sva_album_nach_besitz(uuid, text[])',
    'public.sva_album_los_nummer(text, integer)',
    -- Tipp-Liga-Schnittstelle: nur aus SECURITY-DEFINER-RPCs (Eigentümer) bzw. service_role
    'public.album_karte_gutschreiben(text, uuid)',
    'public.album_ziel_ausloesen(text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;

  -- nur eingeloggt (prüfen zusätzlich auth.uid() bzw. is_sm_admin())
  foreach f in array array[
    'public.album_mein()',
    'public.album_freund_code()',
    'public.album_starter_holen()',
    'public.album_checkin(text)',
    'public.album_pack_oeffnen(uuid)',
    'public.album_gutschein_einloesen(uuid)',
    'public.album_code_einloesen(text)',
    'public.album_freund_hinzufuegen(text)',
    'public.album_tausch_anbieten(uuid, uuid)',
    'public.album_tausch_ansehen(text)',
    'public.album_tausch_annehmen(text)',
    'public.album_tausch_zurueckziehen(text)',
    'public.album_wunschkarte(uuid, uuid[])',
    'public.album_konto_loeschen()',
    'public.album_admin_katalog_standard()',
    'public.album_admin_story_code(text, text, uuid, integer, integer, text)',
    'public.album_admin_story_codes_massen(date, integer, text, integer)',
    'public.album_admin_advent(integer, uuid)',
    'public.album_admin_motm(uuid, uuid, text, integer)',
    'public.album_admin_ziele_standard()',
    'public.album_admin_ziel_status(uuid)',
    'public.album_admin_verlosung_ziehen(uuid, text)',
    'public.album_admin_statistik()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;

  -- öffentlich (anon + eingeloggt)
  execute 'revoke all on function public.album_katalog() from public';
  execute 'grant execute on function public.album_katalog() to anon, authenticated, service_role';
end $$;
