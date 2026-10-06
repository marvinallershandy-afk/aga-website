-- ─────────────────────────────────────────────────────────────────────────────
-- v23-L „Live verzahnt": FuPa-Live-Bot (schaltbar), Reaktionen, Konferenz.
--
-- Diese Migration ist das Datenmodell + die Lese-/Schreib-RPCs. Der Bot selbst
-- (Edge Function fupa-live) und der Zeitplan (pg_cron) sind getrennt:
--   · Function: supabase/functions/fupa-live/
--   · Cron:     20261015110000_sva_live_v23_cron.sql (braucht pg_cron + pg_net)
--
-- Sicherheitsleitplanken (hart):
--   1. fupa_live_modus steht nach dieser Migration auf 'aus'. Scharf schaltet
--      nur ein Admin — und nur, wenn eine FuPa-Erlaubnis-Notiz eingetragen ist
--      (Trigger sva_settings_fupa_waechter). Ohne Notiz kein 'an'.
--   2. Der Bot (service_role) fasst im Ticker NUR quelle='fupa' an. Von Hand
--      bearbeitete Bot-Zeilen werden gesperrt und nie wieder angefasst.
--   3. sm_spiele.fupa_* schreibt nur die service_role (Spalten-Wächter).
--   4. Reaktionen laufen ausschließlich über RPCs (keine Tabellen-Policies),
--      1 pro Konto+Ereignis, Limit 30/Spiel, Verdichtung nach Abpfiff+7 Tage.
--
-- NICHT automatisch anwenden (Builder-Regel: Migrationen als Dateien).
-- Reihenfolge: nach 20261013200000_sva_album_v21.sql. Idempotent formuliert,
-- gegen PGlite mit Supabase-Stubs getestet (supabase/tests/live_v23.test.mjs).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. sva_settings: Live-Modus, Erlaubnis-Gate, Reporter-Texte, Schalter ─────
alter table public.sva_settings add column if not exists fupa_live_modus text not null default 'aus';
alter table public.sva_settings add column if not exists fupa_texte_autoren text[] not null default '{}';
alter table public.sva_settings add column if not exists fupa_erlaubnis_notiz text;
alter table public.sva_settings add column if not exists fupa_erlaubnis_datum date;
alter table public.sva_settings add column if not exists fupa_erlaubnis_art text;
alter table public.sva_settings add column if not exists konferenz_an boolean not null default true;
alter table public.sva_settings add column if not exists reaktionen_an boolean not null default true;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_settings_fupa_live_modus_check') then
    alter table public.sva_settings add constraint sva_settings_fupa_live_modus_check
      check (fupa_live_modus in ('aus', 'an'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sva_settings_fupa_erlaubnis_art_check') then
    alter table public.sva_settings add constraint sva_settings_fupa_erlaubnis_art_check
      check (fupa_erlaubnis_art is null or fupa_erlaubnis_art in ('vorlaeufig', 'dauerhaft'));
  end if;
end $$;

comment on column public.sva_settings.fupa_live_modus is
  'v23-L: Live-Bot an/aus. „an" nur mit fupa_erlaubnis_notiz (Trigger). Nach Migration: aus.';
comment on column public.sva_settings.fupa_texte_autoren is
  'v23-L: FuPa-tickerAuthor.id (als Text), deren Reportertexte 1:1 gezeigt werden dürfen (Einwilligung liegt vor).';
comment on column public.sva_settings.fupa_erlaubnis_notiz is
  'v23-L: Pflicht, bevor der Bot auf „an" geht — wer/wann/wie hat FuPa zugestimmt (Ziffer 4.1.4).';
comment on column public.sva_settings.fupa_erlaubnis_art is 'v23-L: vorlaeufig | dauerhaft.';

-- Wächter: Modus „an" nur mit nicht-leerer Erlaubnis-Notiz, und nur Admin darf
-- die FuPa-Live-Felder überhaupt ändern.
create or replace function public.sva_settings_fupa_waechter()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user = 'authenticated' then
    if (new.fupa_live_modus, new.fupa_texte_autoren, new.fupa_erlaubnis_notiz,
        new.fupa_erlaubnis_datum, new.fupa_erlaubnis_art, new.konferenz_an, new.reaktionen_an)
       is distinct from
       (old.fupa_live_modus, old.fupa_texte_autoren, old.fupa_erlaubnis_notiz,
        old.fupa_erlaubnis_datum, old.fupa_erlaubnis_art, old.konferenz_an, old.reaktionen_an)
       and not public.is_sm_admin() then
      raise exception 'fupa_live_nur_admin: Nur ein Admin darf die FuPa-Live-Einstellungen ändern.'
        using errcode = '42501';
    end if;
  end if;
  if new.fupa_live_modus = 'an' and coalesce(btrim(new.fupa_erlaubnis_notiz), '') = '' then
    raise exception 'fupa_erlaubnis_fehlt: Der Live-Bot lässt sich nur mit eingetragener FuPa-Erlaubnis einschalten.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists sva_settings_fupa_waechter on public.sva_settings;
create trigger sva_settings_fupa_waechter
  before update on public.sva_settings
  for each row execute function public.sva_settings_fupa_waechter();

-- ── 2. sm_spiele: FuPa-Live-Felder + effektive Quelle ─────────────────────────
alter table public.sm_spiele add column if not exists fupa_id bigint;
alter table public.sm_spiele add column if not exists live_quelle text not null default 'auto';
alter table public.sm_spiele add column if not exists fupa_section text;
alter table public.sm_spiele add column if not exists fupa_minute integer;
alter table public.sm_spiele add column if not exists fupa_nachspielzeit integer;
alter table public.sm_spiele add column if not exists fupa_minute_at timestamptz;
alter table public.sm_spiele add column if not exists fupa_tore_heim integer;
alter table public.sm_spiele add column if not exists fupa_tore_gast integer;
alter table public.sm_spiele add column if not exists fupa_ticker_typ text;
alter table public.sm_spiele add column if not exists fupa_stream_ts bigint;
alter table public.sm_spiele add column if not exists fupa_autor_id bigint;
alter table public.sm_spiele add column if not exists fupa_autor_name text;
alter table public.sm_spiele add column if not exists fupa_abruf_at timestamptz;
alter table public.sm_spiele add column if not exists fupa_fehler text;
alter table public.sm_spiele add column if not exists fupa_fehler_serie integer not null default 0;
alter table public.sm_spiele add column if not exists fupa_pause_bis timestamptz;
alter table public.sm_spiele add column if not exists fupa_post_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sm_spiele_live_quelle_check') then
    alter table public.sm_spiele add constraint sm_spiele_live_quelle_check
      check (live_quelle in ('auto', 'fupa', 'pult'));
  end if;
end $$;

-- Backfill fupa_id aus notizen 'fupa:<id>' (fupa-sync schreibt das heute).
update public.sm_spiele
   set fupa_id = (regexp_replace(notizen, '^fupa:', ''))::bigint
 where fupa_id is null
   and notizen ~ '^fupa:[0-9]+$';

create unique index if not exists sm_spiele_fupa_id_uq on public.sm_spiele (fupa_id) where fupa_id is not null;

comment on column public.sm_spiele.live_quelle is 'v23-L: auto | fupa | pult — wer führt den Ticker (Admin stellt um).';
comment on column public.sm_spiele.fupa_minute_at is 'v23-L: Abrufzeit, zu der fupa_minute galt (für die laufende Live-Minute).';
comment on column public.sm_spiele.fupa_autor_name is 'v23-L: Vorname des Reporters — nur gesetzt, wenn Einwilligung vorliegt (Text-Credit).';

-- Effektive Quelle: entscheidet, ob der Bot schreiben darf und woher die Minute kommt.
create or replace function public.sva_live_quelle(s public.sm_spiele)
returns text
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_modus text;
begin
  select fupa_live_modus into v_modus from public.sva_settings where id = 1;
  if s.live_quelle = 'pult' or coalesce(v_modus, 'aus') = 'aus'
     or s.fupa_id is null or coalesce(s.demo, false) then
    return 'pult';
  end if;
  if s.live_quelle = 'fupa' then return 'fupa'; end if;
  -- auto:
  if s.fupa_ticker_typ in ('live', 'soft') then return 'fupa'; end if;
  return 'pult';
end;
$$;
revoke all on function public.sva_live_quelle(public.sm_spiele) from public;
grant execute on function public.sva_live_quelle(public.sm_spiele) to anon, authenticated, service_role;

-- Team-Wächter erweitern: Team/authenticated darf live_quelle setzen, aber keine
-- anderen fupa_*-Felder (die schreibt nur die service_role bzw. der Bot per RPC).
create or replace function public.sva_spiele_team_waechter()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user = 'authenticated' and not public.is_sm_admin() then
    if (new.id, new.gegner, new.heim, new.anstoss, new.ort, new.wettbewerb, new.spieltag_nr, new.notizen, new.created_at)
       is distinct from
       (old.id, old.gegner, old.heim, old.anstoss, old.ort, old.wettbewerb, old.spieltag_nr, old.notizen, old.created_at) then
      raise exception 'sva_team_nur_live_felder: Team-Zugang darf nur Ergebnis, Live-Stand und Spieler des Spiels ändern.'
        using errcode = '42501';
    end if;
    -- fupa_*-Felder (außer live_quelle) sind für authenticated tabu.
    if (new.fupa_id, new.fupa_section, new.fupa_minute, new.fupa_nachspielzeit, new.fupa_minute_at,
        new.fupa_tore_heim, new.fupa_tore_gast, new.fupa_ticker_typ, new.fupa_stream_ts, new.fupa_autor_id,
        new.fupa_autor_name, new.fupa_abruf_at, new.fupa_fehler, new.fupa_fehler_serie, new.fupa_pause_bis, new.fupa_post_at)
       is distinct from
       (old.fupa_id, old.fupa_section, old.fupa_minute, old.fupa_nachspielzeit, old.fupa_minute_at,
        old.fupa_tore_heim, old.fupa_tore_gast, old.fupa_ticker_typ, old.fupa_stream_ts, old.fupa_autor_id,
        old.fupa_autor_name, old.fupa_abruf_at, old.fupa_fehler, old.fupa_fehler_serie, old.fupa_pause_bis, old.fupa_post_at) then
      raise exception 'sva_team_fupa_felder: FuPa-Live-Felder schreibt nur der Bot.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

-- ── 3. sva_ticker: Quelle, Bot-Felder, Hand-Schutz ───────────────────────────
alter table public.sva_ticker add column if not exists quelle text not null default 'pult';
alter table public.sva_ticker add column if not exists fupa_event_id bigint;
alter table public.sva_ticker add column if not exists versteckt boolean not null default false;
alter table public.sva_ticker add column if not exists duplikat_von uuid references public.sva_ticker(id) on delete set null;
alter table public.sva_ticker add column if not exists gesperrt boolean not null default false;
alter table public.sva_ticker add column if not exists platzhalter boolean not null default false;
alter table public.sva_ticker add column if not exists text_quelle text;
alter table public.sva_ticker add column if not exists fupa_name text;
alter table public.sva_ticker add column if not exists fupa_name_2 text;
alter table public.sva_ticker add column if not exists team text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_ticker_quelle_check') then
    alter table public.sva_ticker add constraint sva_ticker_quelle_check check (quelle in ('pult', 'fupa'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sva_ticker_team_check') then
    alter table public.sva_ticker add constraint sva_ticker_team_check check (team is null or team in ('sva', 'gegner'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sva_ticker_text_quelle_check') then
    alter table public.sva_ticker add constraint sva_ticker_text_quelle_check
      check (text_quelle is null or text_quelle in ('vorlage', 'reporter', 'pult', 'ki'));
  end if;
end $$;

-- Typen erweitern: + 'elfmeter_verschossen', + 'wechsel_gegner'.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'sva_ticker_typ_check') then
    alter table public.sva_ticker drop constraint sva_ticker_typ_check;
  end if;
  alter table public.sva_ticker add constraint sva_ticker_typ_check check (typ in (
    'anpfiff', 'tor', 'gegentor', 'gelb', 'gelbrot', 'rot', 'wechsel',
    'halbzeit', 'wiederanpfiff', 'abpfiff', 'elfmeter', 'kommentar',
    'elfmeter_verschossen', 'wechsel_gegner'));
end $$;

-- Backfill team='gegner' für bestehende „Gegenspieler"-Zeilen ohne Kader-Match.
update public.sva_ticker
   set team = 'gegner'
 where team is null and roster_id is null and text ilike 'Gegenspieler%';

create unique index if not exists sva_ticker_fupa_uq on public.sva_ticker (fupa_event_id) where fupa_event_id is not null;
create index if not exists sva_ticker_sichtbar_idx on public.sva_ticker (spiel_id, versteckt);

comment on column public.sva_ticker.quelle is 'v23-L: pult (Ticker-Pult) | fupa (Bot). Der Bot fasst nur quelle=fupa an.';
comment on column public.sva_ticker.versteckt is 'v23-L: Duplikat einer Pult-Zeile oder vom Admin ausgeblendete Bot-Zeile — zählt nicht.';
comment on column public.sva_ticker.gesperrt is 'v23-L: Von Hand bearbeitet → der Bot ändert/löscht die Zeile nie wieder.';
comment on column public.sva_ticker.platzhalter is 'v23-L: Tor aus Soft-Ticker-Stand ohne Ereignis („Torschütze folgt").';

-- Ableitung zählt künftig NUR sichtbare Zeilen (versteckt=false). Status weiter
-- über die Pfiff-Reihenfolge nach zeitpunkt (bei Bot-Zeilen synthetisch gesetzt).
create or replace function public.sva_spiel_live_sync(p_spiel uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_sva     integer;
  v_geg     integer;
  v_last    text;
  v_anpfiff timestamptz;
  v_wieder  timestamptz;
  v_status  text;
begin
  if p_spiel is null then return; end if;

  select count(*) filter (where t.typ = 'tor' and not t.versteckt),
         count(*) filter (where t.typ = 'gegentor' and not t.versteckt),
         min(t.zeitpunkt) filter (where t.typ = 'anpfiff' and not t.versteckt),
         max(t.zeitpunkt) filter (where t.typ = 'wiederanpfiff' and not t.versteckt)
    into v_sva, v_geg, v_anpfiff, v_wieder
    from public.sva_ticker t
   where t.spiel_id = p_spiel;

  select t.typ into v_last
    from public.sva_ticker t
   where t.spiel_id = p_spiel
     and not t.versteckt
     and t.typ in ('anpfiff', 'halbzeit', 'wiederanpfiff', 'abpfiff')
   order by t.zeitpunkt desc, t.created_at desc
   limit 1;

  v_status := case v_last
                when 'anpfiff' then 'live'
                when 'wiederanpfiff' then 'live'
                when 'halbzeit' then 'halbzeit'
                when 'abpfiff' then 'beendet'
                else 'geplant'
              end;

  update public.sm_spiele s
     set live_tore_sva    = v_sva,
         live_tore_gegner = v_geg,
         status           = case when v_last is null and s.tore_sva is not null and s.tore_gegner is not null
                                 then 'beendet' else v_status end,
         anpfiff_at       = v_anpfiff,
         wiederanpfiff_at = v_wieder,
         tore_sva         = case when v_status = 'beendet' then v_sva
                                 when v_last is not null then null
                                 else s.tore_sva end,
         tore_gegner      = case when v_status = 'beendet' then v_geg
                                 when v_last is not null then null
                                 else s.tore_gegner end,
         live_updated_at  = now(),
         updated_at       = now()
   where s.id = p_spiel;
end;
$$;
revoke execute on function public.sva_spiel_live_sync(uuid) from public, anon, authenticated;
grant  execute on function public.sva_spiel_live_sync(uuid) to service_role;

-- Hand-Schutz: Ein UPDATE durch authenticated auf eine fupa-Zeile sperrt sie
-- (und markiert geänderten Text als 'pult'). Ein DELETE durch authenticated auf
-- eine fupa-Zeile wird in „verstecken + sperren" umgewandelt (kein echter Delete,
-- damit der Bot die Zeile nicht beim nächsten Tick neu einfügt). service_role
-- (Bot) ist davon ausgenommen.
-- NICHT security definer: so ist current_user die aufrufende Rolle ('authenticated'
-- bei Pult-Änderungen, der Definer-Owner bei Bot-Schreibvorgängen via RPC).
create or replace function public.sva_ticker_pult_waechter()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if current_user <> 'authenticated' then
    return case tg_op when 'DELETE' then old else new end;
  end if;
  if tg_op = 'UPDATE' then
    if old.quelle = 'fupa' then
      new.gesperrt := true;
      if new.text is distinct from old.text then new.text_quelle := 'pult'; end if;
    end if;
    return new;
  elsif tg_op = 'DELETE' then
    if old.quelle = 'fupa' then
      update public.sva_ticker
         set versteckt = true, gesperrt = true
       where id = old.id;
      return null;  -- echten Delete abbrechen
    end if;
    return old;
  end if;
  return new;
end;
$$;
revoke execute on function public.sva_ticker_pult_waechter() from public, anon, authenticated;

drop trigger if exists sva_ticker_pult_waechter_upd on public.sva_ticker;
create trigger sva_ticker_pult_waechter_upd
  before update on public.sva_ticker
  for each row execute function public.sva_ticker_pult_waechter();
drop trigger if exists sva_ticker_pult_waechter_del on public.sva_ticker;
create trigger sva_ticker_pult_waechter_del
  before delete on public.sva_ticker
  for each row execute function public.sva_ticker_pult_waechter();

-- ── 4. sm_roster: FuPa-Spieler-Zuordnung ─────────────────────────────────────
alter table public.sm_roster add column if not exists fupa_spieler_id bigint;
create unique index if not exists sm_roster_fupa_uq on public.sm_roster (fupa_spieler_id) where fupa_spieler_id is not null;

-- ── 5. Neue Tabellen ─────────────────────────────────────────────────────────
create table if not exists public.sva_konferenz (
  datum date primary key,
  saison text not null,
  spieltag integer,
  spiele jsonb not null default '[]',
  basis jsonb,
  standings jsonb,
  tabelle jsonb,
  aktualisiert_at timestamptz not null default now()
);
comment on table public.sva_konferenz is 'v23-L: Kreisliga-Spieltag (ein Datensatz je Datum), vom Bot überschrieben. Lesen über web_live().';
alter table public.sva_konferenz enable row level security;

create table if not exists public.sva_fupa_aufstellung (
  spiel_id uuid primary key references public.sm_spiele(id) on delete cascade,
  spieler jsonb not null,
  abgerufen_at timestamptz not null default now()
);
comment on table public.sva_fupa_aufstellung is 'v23-L: FuPa-Aufstellung + Statistik (nur SVA-Seite) nach Abpfiff. Vorbefüllung Spielbericht.';
alter table public.sva_fupa_aufstellung enable row level security;

create table if not exists public.sva_reaktion (
  ticker_id uuid not null references public.sva_ticker(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null check (emoji in ('tor', 'feuer', 'applaus', 'schock', 'wut')),
  created_at timestamptz not null default now(),
  primary key (ticker_id, user_id)
);
comment on table public.sva_reaktion is 'v23-L: Mitjubeln — 1 Emoji pro Konto und Ereignis. Nur über RPCs. Verdichtet nach Abpfiff+7 Tage.';
alter table public.sva_reaktion enable row level security;
create index if not exists sva_reaktion_ticker_idx on public.sva_reaktion (ticker_id);

create table if not exists public.sva_reaktion_summe (
  ticker_id uuid not null references public.sva_ticker(id) on delete cascade,
  emoji text not null,
  anzahl integer not null,
  primary key (ticker_id, emoji)
);
comment on table public.sva_reaktion_summe is 'v23-L: Verdichtete Reaktions-Zähler (nach Abpfiff+7 Tage, Einzelzeilen gelöscht).';
alter table public.sva_reaktion_summe enable row level security;

-- Keine anon/authenticated-Policies auf diese vier Tabellen: Lesen/Schreiben
-- ausschließlich über die RPCs unten (SECURITY DEFINER). Der Bot nutzt service_role.

-- sva_sync_log.quelle-Check erweitern.
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'sva_sync_log_quelle_check') then
    alter table public.sva_sync_log drop constraint sva_sync_log_quelle_check;
  end if;
  alter table public.sva_sync_log add constraint sva_sync_log_quelle_check
    check (quelle in ('fupa', 'fupa_live', 'fupa_konferenz'));
end $$;

-- ── 6. RPC: Bot schreibt Ticker-Operationen in einer Transaktion ─────────────
-- p_ops = { "einfuegen":[zeile…], "aendern":[{id, patch}…], "loeschen":[id…],
--           "verstecken":[{id, duplikat_von}…], "stream_ts": <bigint|null> }
-- „zeile" = { fupa_event_id, typ, minute, nachspielzeit, roster_id, roster_id_2,
--             text, text_quelle, fupa_name, fupa_name_2, team, platzhalter, zeitpunkt }
create or replace function public.sva_fupa_ticker_anwenden(p_spiel uuid, p_ops jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  z jsonb;
  v_txt text;
  v_neu integer := 0; v_geaendert integer := 0; v_geloescht integer := 0; v_versteckt integer := 0;
begin
  -- Schutz: EXECUTE ist nur der service_role (Bot) erteilt (grant unten).
  for z in select * from jsonb_array_elements(coalesce(p_ops->'einfuegen', '[]'::jsonb)) loop
    insert into public.sva_ticker (
      spiel_id, quelle, fupa_event_id, typ, minute, nachspielzeit,
      roster_id, roster_id_2, text, text_quelle, fupa_name, fupa_name_2, team, platzhalter, zeitpunkt)
    values (
      p_spiel, 'fupa', nullif(z->>'fupa_event_id', '')::bigint, z->>'typ',
      nullif(z->>'minute', '')::int, nullif(z->>'nachspielzeit', '')::int,
      nullif(z->>'roster_id', '')::uuid, nullif(z->>'roster_id_2', '')::uuid,
      nullif(z->>'text', ''), z->>'text_quelle', nullif(z->>'fupa_name', ''),
      nullif(z->>'fupa_name_2', ''), nullif(z->>'team', ''), coalesce((z->>'platzhalter')::boolean, false),
      coalesce(nullif(z->>'zeitpunkt', '')::timestamptz, now()))
    on conflict (fupa_event_id) where fupa_event_id is not null do nothing;
    v_neu := v_neu + 1;
  end loop;

  for z in select * from jsonb_array_elements(coalesce(p_ops->'aendern', '[]'::jsonb)) loop
    update public.sva_ticker t set
      typ          = coalesce(z->'patch'->>'typ', t.typ),
      minute       = coalesce(nullif(z->'patch'->>'minute', '')::int, t.minute),
      nachspielzeit= case when z->'patch' ? 'nachspielzeit' then nullif(z->'patch'->>'nachspielzeit', '')::int else t.nachspielzeit end,
      roster_id    = case when z->'patch' ? 'roster_id' then nullif(z->'patch'->>'roster_id', '')::uuid else t.roster_id end,
      roster_id_2  = case when z->'patch' ? 'roster_id_2' then nullif(z->'patch'->>'roster_id_2', '')::uuid else t.roster_id_2 end,
      text         = case when z->'patch' ? 'text' then nullif(z->'patch'->>'text', '') else t.text end,
      text_quelle  = coalesce(z->'patch'->>'text_quelle', t.text_quelle),
      fupa_name    = case when z->'patch' ? 'fupa_name' then nullif(z->'patch'->>'fupa_name', '') else t.fupa_name end,
      fupa_name_2  = case when z->'patch' ? 'fupa_name_2' then nullif(z->'patch'->>'fupa_name_2', '') else t.fupa_name_2 end,
      team         = coalesce(nullif(z->'patch'->>'team', ''), t.team),
      zeitpunkt    = coalesce(nullif(z->'patch'->>'zeitpunkt', '')::timestamptz, t.zeitpunkt)
     where t.id = (z->>'id')::uuid and t.quelle = 'fupa' and not t.gesperrt;
    if found then v_geaendert := v_geaendert + 1; end if;
  end loop;

  for v_txt in select * from jsonb_array_elements_text(coalesce(p_ops->'loeschen', '[]'::jsonb)) loop
    delete from public.sva_ticker t where t.id = v_txt::uuid and t.quelle = 'fupa' and not t.gesperrt;
    if found then v_geloescht := v_geloescht + 1; end if;
  end loop;

  for z in select * from jsonb_array_elements(coalesce(p_ops->'verstecken', '[]'::jsonb)) loop
    update public.sva_ticker t
       set versteckt = true, duplikat_von = nullif(z->>'duplikat_von', '')::uuid
     where t.id = (z->>'id')::uuid and t.quelle = 'fupa' and not t.gesperrt;
    if found then v_versteckt := v_versteckt + 1; end if;
  end loop;

  if p_ops ? 'stream_ts' then
    update public.sm_spiele set fupa_stream_ts = nullif(p_ops->>'stream_ts', '')::bigint where id = p_spiel;
  end if;

  return jsonb_build_object('neu', v_neu, 'geaendert', v_geaendert, 'geloescht', v_geloescht, 'versteckt', v_versteckt);
end;
$$;
revoke all on function public.sva_fupa_ticker_anwenden(uuid, jsonb) from public, anon, authenticated;
grant  execute on function public.sva_fupa_ticker_anwenden(uuid, jsonb) to service_role;

-- ── 7. RPC: Reaktionen ───────────────────────────────────────────────────────
create or replace function public.sva_reagieren(p_ticker uuid, p_emoji text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_spiel uuid;
  v_typ text;
  v_status text;
  v_abpfiff timestamptz;
  v_demo boolean;
  v_an boolean;
  v_anzahl integer;
begin
  if v_uid is null then raise exception 'nicht_angemeldet' using errcode = '42501'; end if;
  select reaktionen_an into v_an from public.sva_settings where id = 1;
  if not coalesce(v_an, false) then raise exception 'reaktionen_aus' using errcode = 'P0001'; end if;

  select t.spiel_id, t.typ into v_spiel, v_typ from public.sva_ticker t where t.id = p_ticker;
  if v_spiel is null then raise exception 'ereignis_unbekannt' using errcode = 'P0001'; end if;
  if v_typ not in ('tor', 'gegentor', 'gelb', 'gelbrot', 'rot', 'abpfiff', 'elfmeter', 'elfmeter_verschossen') then
    raise exception 'reaktion_typ' using errcode = 'P0001';
  end if;

  select s.status, s.demo,
         (select max(zeitpunkt) from public.sva_ticker t where t.spiel_id = s.id and t.typ = 'abpfiff' and not t.versteckt)
    into v_status, v_demo, v_abpfiff
    from public.sm_spiele s where s.id = v_spiel;
  if coalesce(v_demo, false) then raise exception 'reaktion_demo' using errcode = 'P0001'; end if;
  if not (v_status in ('live', 'halbzeit') or (v_abpfiff is not null and v_abpfiff > now() - interval '24 hours')) then
    raise exception 'reaktion_spiel_vorbei' using errcode = 'P0001';
  end if;

  if p_emoji is null then
    delete from public.sva_reaktion where ticker_id = p_ticker and user_id = v_uid;
  else
    if p_emoji not in ('tor', 'feuer', 'applaus', 'schock', 'wut') then
      raise exception 'reaktion_emoji' using errcode = 'P0001';
    end if;
    -- Limit 30 pro Konto und Spiel (eine schon vorhandene Reaktion zählt nicht neu).
    if not exists (select 1 from public.sva_reaktion where ticker_id = p_ticker and user_id = v_uid) then
      select count(*) into v_anzahl
        from public.sva_reaktion r
        join public.sva_ticker t on t.id = r.ticker_id
       where t.spiel_id = v_spiel and r.user_id = v_uid;
      if v_anzahl >= 30 then raise exception 'reaktion_limit' using errcode = 'P0001'; end if;
    end if;
    insert into public.sva_reaktion (ticker_id, user_id, emoji)
    values (p_ticker, v_uid, p_emoji)
    on conflict (ticker_id, user_id) do update set emoji = excluded.emoji, created_at = now();
  end if;

  return (
    select coalesce(jsonb_object_agg(e.emoji, e.n), '{}'::jsonb)
      from (select emoji, count(*)::int n from public.sva_reaktion where ticker_id = p_ticker group by emoji) e
  );
end;
$$;
revoke all on function public.sva_reagieren(uuid, text) from public, anon;
grant  execute on function public.sva_reagieren(uuid, text) to authenticated;

create or replace function public.sva_meine_reaktionen(p_spiel uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('tickerId', r.ticker_id, 'emoji', r.emoji)), '[]'::jsonb)
    from public.sva_reaktion r
    join public.sva_ticker t on t.id = r.ticker_id
   where t.spiel_id = p_spiel and r.user_id = auth.uid();
$$;
revoke all on function public.sva_meine_reaktionen(uuid) from public, anon;
grant  execute on function public.sva_meine_reaktionen(uuid) to authenticated;

create or replace function public.sva_reaktion_verdichten()
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_n integer := 0;
begin
  create temporary table _faellig on commit drop as
    select distinct t.id as ticker_id
      from public.sva_ticker t
      join public.sm_spiele s on s.id = t.spiel_id
     where exists (select 1 from public.sva_reaktion r where r.ticker_id = t.id)
       and exists (select 1 from public.sva_ticker a where a.spiel_id = s.id and a.typ = 'abpfiff'
                     and not a.versteckt and a.zeitpunkt < now() - interval '7 days');

  insert into public.sva_reaktion_summe (ticker_id, emoji, anzahl)
  select r.ticker_id, r.emoji, count(*)::int
    from public.sva_reaktion r
   where r.ticker_id in (select ticker_id from _faellig)
   group by r.ticker_id, r.emoji
  on conflict (ticker_id, emoji) do update set anzahl = excluded.anzahl;

  delete from public.sva_reaktion r where r.ticker_id in (select ticker_id from _faellig);
  select count(*) into v_n from _faellig;
  drop table if exists _faellig;
  return v_n;
end;
$$;
revoke all on function public.sva_reaktion_verdichten() from public, anon, authenticated;
grant  execute on function public.sva_reaktion_verdichten() to service_role;

-- ── 8. RPC: tipp_live_kurz (öffentlich, nur Zahl bis Tippschluss) ─────────────
create or replace function public.tipp_live_kurz(p_spiel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_pflicht boolean;
  v_offen boolean;
  v_tipps integer;
  v_sieg integer; v_remis integer; v_nied integer;
begin
  if p_spiel is null then return null; end if;
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null or coalesce(v_s.demo, false) then return null; end if;
  v_pflicht := exists (select 1 from public.sva_tipp_spieltage st where st.spiel_id = p_spiel);
  if not v_pflicht then return null; end if;

  select count(*) into v_tipps from public.sva_tipp_tipps where spiel_id = p_spiel;
  v_offen := (v_s.status = 'geplant' and v_s.anpfiff_at is null and now() < v_s.anstoss);
  if v_offen then
    return jsonb_build_object('tipps', v_tipps);
  end if;

  select count(*) filter (where tore_sva > tore_gegner),
         count(*) filter (where tore_sva = tore_gegner),
         count(*) filter (where tore_sva < tore_gegner)
    into v_sieg, v_remis, v_nied
    from public.sva_tipp_tipps where spiel_id = p_spiel;
  return jsonb_build_object(
    'tipps', v_tipps,
    'sieg',  case when v_tipps > 0 then round(100.0 * v_sieg  / v_tipps) else 0 end,
    'remis', case when v_tipps > 0 then round(100.0 * v_remis / v_tipps) else 0 end,
    'niederlage', case when v_tipps > 0 then round(100.0 * v_nied / v_tipps) else 0 end);
end;
$$;
revoke all on function public.tipp_live_kurz(uuid) from public;
grant  execute on function public.tipp_live_kurz(uuid) to anon, authenticated, service_role;

-- ── 9. RPC: Admin-Live-Status + Quelle umschalten ────────────────────────────
create or replace function public.sva_admin_live_status(p_spiel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_modus text;
  v_letztes timestamptz;
  v_unzugeordnet integer;
begin
  perform public.sva_tipp_team_pruefen();
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null then raise exception 'spiel_unbekannt' using errcode = 'P0001'; end if;
  select fupa_live_modus into v_modus from public.sva_settings where id = 1;
  select max(zeitpunkt) into v_letztes
    from public.sva_ticker where spiel_id = p_spiel and quelle = 'fupa' and not versteckt;
  select count(*) into v_unzugeordnet
    from public.sva_ticker
   where spiel_id = p_spiel and quelle = 'fupa' and roster_id is null and team = 'sva' and fupa_name is not null;

  return jsonb_strip_nulls(jsonb_build_object(
    'modus',            coalesce(v_modus, 'aus'),
    'quelleEffektiv',   public.sva_live_quelle(v_s),
    'quelleEingestellt',v_s.live_quelle,
    'hatFupaId',        v_s.fupa_id is not null,
    'section',          v_s.fupa_section,
    'tickerTyp',        v_s.fupa_ticker_typ,
    'letzterAbruf',     v_s.fupa_abruf_at,
    'fehler',           v_s.fupa_fehler,
    'fehlerSerie',      v_s.fupa_fehler_serie,
    'pauseBis',         v_s.fupa_pause_bis,
    'fupaToreSva',      case when v_s.heim then v_s.fupa_tore_heim else v_s.fupa_tore_gast end,
    'fupaToreGegner',   case when v_s.heim then v_s.fupa_tore_gast else v_s.fupa_tore_heim end,
    'unsereToreSva',    v_s.live_tore_sva,
    'unsereToreGegner', v_s.live_tore_gegner,
    'sekundenSeitEreignis', case when v_letztes is not null then floor(extract(epoch from (now() - v_letztes)))::int end,
    'unzugeordnet',     v_unzugeordnet
  ));
end;
$$;
revoke all on function public.sva_admin_live_status(uuid) from public, anon;
grant  execute on function public.sva_admin_live_status(uuid) to authenticated;

create or replace function public.sva_admin_live_quelle(p_spiel uuid, p_quelle text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_tipp_team_pruefen();
  if p_quelle not in ('auto', 'fupa', 'pult') then raise exception 'quelle_ungueltig' using errcode = 'P0001'; end if;
  update public.sm_spiele set live_quelle = p_quelle, updated_at = now() where id = p_spiel;
  if not found then raise exception 'spiel_unbekannt' using errcode = 'P0001'; end if;
  return public.sva_admin_live_status(p_spiel);
end;
$$;
revoke all on function public.sva_admin_live_quelle(uuid, text) from public, anon;
grant  execute on function public.sva_admin_live_quelle(uuid, text) to authenticated;

-- ── 10. Namens-Normalisierung + FuPa-Spieler ↔ Kader zuordnen ────────────────
-- Kleinschreibung, Umlaute → ae/oe/ue/ss, Akzente weg, Bindestriche → Leerzeichen.
create or replace function public.sva_name_norm(p text)
returns text
language sql
immutable
set search_path to 'pg_temp'
as $$
  select btrim(regexp_replace(
    replace(replace(replace(replace(
      translate(lower(coalesce(p, '')), 'áàâãéèêíìîóòôõúùû-', 'aaaaeeeiiioooouuu '),
      'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss'),
    '\s+', ' ', 'g'));
$$;
revoke all on function public.sva_name_norm(text) from public;
grant  execute on function public.sva_name_norm(text) to anon, authenticated, service_role;

create or replace function public.sva_admin_fupa_zuordnung(p_roster uuid, p_fupa bigint)
returns void
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_tipp_team_pruefen();
  update public.sm_roster set fupa_spieler_id = p_fupa, updated_at = now() where id = p_roster;
  if not found then raise exception 'spieler_unbekannt' using errcode = 'P0001'; end if;
  -- Bestehende, noch nicht gesperrte Bot-Zeilen dieses FuPa-Spielers nachtragen.
  update public.sva_ticker t set roster_id = p_roster
   where t.quelle = 'fupa' and not t.gesperrt and t.roster_id is null and t.team = 'sva'
     and t.fupa_name is not null
     and public.sva_name_norm(t.fupa_name)
         = (select public.sva_name_norm(r.name) from public.sm_roster r where r.id = p_roster);
end;
$$;
revoke all on function public.sva_admin_fupa_zuordnung(uuid, bigint) from public, anon;
grant  execute on function public.sva_admin_fupa_zuordnung(uuid, bigint) to authenticated;

create or replace function public.sva_admin_fupa_kandidaten(p_spiel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_res jsonb;
begin
  perform public.sva_tipp_team_pruefen();
  with fupa_spieler as (
    select (s->>'fupaId')::bigint as fupa_id,
           btrim(concat_ws(' ', s->>'vorname', s->>'nachname')) as name,
           (s->>'nummer')::int as nummer
      from public.sva_fupa_aufstellung a,
           jsonb_array_elements(a.spieler) s
     where a.spiel_id = p_spiel
    union
    select null::bigint, t.fupa_name, null::int
      from public.sva_ticker t
     where t.spiel_id = p_spiel and t.quelle = 'fupa' and t.team = 'sva'
       and t.roster_id is null and t.fupa_name is not null
  ), offen as (
    select fs.fupa_id, fs.name, fs.nummer
      from fupa_spieler fs
     where fs.name is not null and fs.name <> ''
       and not exists (select 1 from public.sm_roster r
                         where fs.fupa_id is not null and r.fupa_spieler_id = fs.fupa_id)
  ), vorschlaege as (
    select o.fupa_id, o.name, o.nummer,
           (select r.id from public.sm_roster r
             where r.aktiv and r.rolle = 'spieler'
               and public.sva_name_norm(r.name) = public.sva_name_norm(o.name)
             limit 1) as voll_match,
           (select max(r.id::text)::uuid from public.sm_roster r
             where r.aktiv and r.rolle = 'spieler'
               and public.sva_name_norm(split_part(r.name, ' ', array_length(string_to_array(r.name, ' '), 1)))
                 = public.sva_name_norm(split_part(o.name, ' ', array_length(string_to_array(o.name, ' '), 1)))
             having count(*) = 1) as nach_match
      from offen o
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'fupaId', fupa_id, 'name', name, 'nummer', nummer,
           'vorschlag', (select r.slug from public.sm_roster r where r.id = coalesce(voll_match, nach_match)),
           'vorschlagId', coalesce(voll_match, nach_match)
         )) order by name), '[]'::jsonb)
    into v_res from vorschlaege;
  return v_res;
end;
$$;
revoke all on function public.sva_admin_fupa_kandidaten(uuid) from public, anon;
grant  execute on function public.sva_admin_fupa_kandidaten(uuid) to authenticated;

-- ── 11. sva_live_daten() v2 (Engine hinter web_live + web_live_demo) ──────────
-- Erweitert die v18-T-Engine um die v23-Felder: match.source/fupaUrl/fupaAutor,
-- Minute aus fupa_minute (bei Quelle fupa), je Ereignis source/team/name/name2/
-- textSource/placeholder, versteckte Zeilen raus, reactions, conference, tipp.
-- Demo-Trennung, Partner und das demo-Flag bleiben erhalten. version: 2.
create or replace function public.sva_live_daten(p_demo boolean)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s        public.sm_spiele;
  v_status   text;
  v_minute   integer;
  v_half     integer;
  v_lineup   public.sva_lineup;
  v_lfor     boolean := false;
  v_ids      uuid[] := '{}';
  v_events   jsonb := '[]'::jsonb;
  v_players  jsonb := '[]'::jsonb;
  v_staff    jsonb := '[]'::jsonb;
  v_settings jsonb := '{}'::jsonb;
  v_prev     jsonb;
  v_match    jsonb;
  v_lj       jsonb;
  v_partner  jsonb;
  v_quelle   text := 'pult';
  v_autoren  text[];
  v_reactions jsonb := '{}'::jsonb;
  v_conf     jsonb;
  v_tipp     jsonb;
  v_konf_an  boolean;
  v_reakt_an boolean;
begin
  if p_demo then
    select * into v_s from public.sm_spiele s where s.demo order by s.created_at desc limit 1;
  else
    select * into v_s from public.sm_spiele s
     where s.status in ('live', 'halbzeit') and not s.demo
     order by s.anstoss desc limit 1;
    if v_s.id is null then
      select * into v_s from public.sm_spiele s
       where (s.status = 'beendet' or (s.tore_sva is not null and s.tore_gegner is not null))
         and s.anstoss between now() - interval '12 hours' and now() + interval '1 hour' and not s.demo
       order by s.anstoss desc limit 1;
    end if;
    if v_s.id is null then
      select * into v_s from public.sm_spiele s
       where s.anstoss >= now() - interval '3 hours' and s.status <> 'beendet'
         and (s.tore_sva is null or s.tore_gegner is null) and not s.demo
       order by s.anstoss asc limit 1;
    end if;
    if v_s.id is null then
      select * into v_s from public.sm_spiele s
       where (s.status = 'beendet' or (s.tore_sva is not null and s.tore_gegner is not null)) and not s.demo
       order by s.anstoss desc limit 1;
    end if;
  end if;

  select jsonb_strip_nulls(jsonb_build_object(
           'address',          st.adresse,
           'fussballDeTeamId', st.fussball_de_team_id,
           'widgetTabelle',    st.fussball_de_widget_tabelle,
           'widgetSpielplan',  st.fussball_de_widget_spielplan,
           'fupaUrl',          st.fupa_url,
           'instagram',        st.instagram,
           'saison',           st.saison
         )), st.konferenz_an, st.reaktionen_an, st.fupa_texte_autoren
    into v_settings, v_konf_an, v_reakt_an, v_autoren
    from public.sva_settings st where st.id = 1;

  if v_s.id is not null then
    v_quelle := public.sva_live_quelle(v_s);
    v_status := case
                  when v_s.status in ('live', 'halbzeit') then v_s.status
                  when v_s.status = 'beendet' or (v_s.tore_sva is not null and v_s.tore_gegner is not null) then 'beendet'
                  else 'geplant'
                end;

    if v_quelle = 'fupa' and v_s.fupa_minute is not null and v_status in ('live', 'halbzeit') then
      v_minute := v_s.fupa_minute + case when v_s.fupa_minute_at is not null and v_status = 'live'
                        then floor(extract(epoch from (now() - v_s.fupa_minute_at)) / 60)::int else 0 end;
      if v_s.fupa_minute <= 45 then v_minute := least(v_minute, 60); v_half := 1;
      else v_minute := least(v_minute, 105); v_half := 2; end if;
    elsif v_status = 'live' and v_s.wiederanpfiff_at is not null then
      v_half := 2;
      v_minute := 45 + greatest(1, floor(extract(epoch from (now() - v_s.wiederanpfiff_at)) / 60)::int + 1);
    elsif v_status = 'live' and v_s.anpfiff_at is not null then
      v_half := 1;
      v_minute := greatest(1, floor(extract(epoch from (now() - v_s.anpfiff_at)) / 60)::int + 1);
    elsif v_status = 'halbzeit' then
      v_half := 1;
      v_minute := 45;
    end if;

    select * into v_lineup from public.sva_lineup l
     where l.spiel_id = v_s.id order by l.created_at desc limit 1;
    if v_lineup.id is not null then
      v_lfor := true;
    else
      select * into v_lineup from public.sva_lineup l
       where not exists (select 1 from public.sm_spiele d where d.id = l.spiel_id and d.demo)
       order by l.created_at desc limit 1;
    end if;

    -- Ticker: neueste zuerst, nur sichtbare, max. 200
    select coalesce(jsonb_agg(e.obj order by e.zeitpunkt desc, e.created_at desc), '[]'::jsonb)
      into v_events
      from (
        select t.zeitpunkt, t.created_at,
               jsonb_strip_nulls(jsonb_build_object(
                 'id',         t.id,
                 'type',       t.typ,
                 'minute',     t.minute,
                 'extra',      nullif(t.nachspielzeit, 0),
                 'player',     r1.slug,
                 'player2',    r2.slug,
                 'name',       case when r1.slug is null then t.fupa_name end,
                 'name2',      case when r2.slug is null then t.fupa_name_2 end,
                 'text',       nullif(btrim(coalesce(t.text, '')), ''),
                 'source',     case when t.quelle = 'fupa' then 'fupa' end,
                 'team',       t.team,
                 'textSource', t.text_quelle,
                 'placeholder',case when t.platzhalter then true end,
                 'at',         t.zeitpunkt
               )) as obj
          from public.sva_ticker t
          left join public.sm_roster r1 on r1.id = t.roster_id
          left join public.sm_roster r2 on r2.id = t.roster_id_2
         where t.spiel_id = v_s.id and not t.versteckt
         order by t.zeitpunkt desc, t.created_at desc
         limit 200
      ) e;

    if coalesce(v_reakt_an, false) then
      select coalesce(jsonb_object_agg(x.id, x.summe), '{}'::jsonb) into v_reactions
        from (
          select t.id::text as id, jsonb_object_agg(q.emoji, q.anzahl) as summe
            from public.sva_ticker t
            join (
              select ticker_id, emoji, count(*)::int as anzahl from public.sva_reaktion group by ticker_id, emoji
              union all
              select ticker_id, emoji, anzahl from public.sva_reaktion_summe
            ) q on q.ticker_id = t.id
           where t.spiel_id = v_s.id and not t.versteckt
             and t.typ in ('tor', 'gegentor', 'gelb', 'gelbrot', 'rot', 'abpfiff', 'elfmeter', 'elfmeter_verschossen')
           group by t.id
        ) x;
    end if;

    v_ids := coalesce(v_lineup.startelf, '{}') || coalesce(v_lineup.bank, '{}')
             || coalesce((select array_agg(x) from (
                  select t.roster_id as x from public.sva_ticker t where t.spiel_id = v_s.id and t.roster_id is not null
                  union
                  select t.roster_id_2 from public.sva_ticker t where t.spiel_id = v_s.id and t.roster_id_2 is not null
                ) q), '{}');
    if v_s.motm_roster_id is not null then v_ids := v_ids || v_s.motm_roster_id; end if;

    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id', r.slug, 'name', r.name, 'number', r.nummer,
             'position', case upper(coalesce(r.position, ''))
                            when 'TW' then 'TW' when 'TORWART' then 'TW'
                            when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
                            when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
                            else 'MIT' end,
             'photoUrl', r.foto_url, 'cutoutUrl', r.freisteller_url,
             'isCaptain', case when r.kapitaen then true end
           )) order by r.sortierung, r.name), '[]'::jsonb)
      into v_players from public.sm_roster r where r.id = any (v_ids);

    if v_lineup.id is not null then
      v_lj := jsonb_build_object(
        'formation',  v_lineup.formation,
        'startelf',   coalesce((select jsonb_agg(r.slug order by e.i)
                                  from unnest(v_lineup.startelf) with ordinality as e(pid, i)
                                  join public.sm_roster r on r.id = e.pid), '[]'::jsonb),
        'bank',       coalesce((select jsonb_agg(r.slug order by e.i)
                                  from unnest(v_lineup.bank) with ordinality as e(pid, i)
                                  join public.sm_roster r on r.id = e.pid), '[]'::jsonb),
        'forMatch',   v_lfor,
        'matchLabel', nullif(btrim(coalesce(v_lineup.match_label, '')), ''),
        'updatedAt',  v_lineup.created_at);
    end if;

    v_match := jsonb_strip_nulls(jsonb_build_object(
      'id', v_s.id, 'opponent', v_s.gegner, 'home', v_s.heim, 'kickoff', v_s.anstoss,
      'venue', v_s.ort, 'competition', v_s.wettbewerb, 'matchday', v_s.spieltag_nr,
      'status', v_status, 'half', v_half, 'minute', v_minute,
      'anpfiffAt', v_s.anpfiff_at, 'wiederanpfiffAt', v_s.wiederanpfiff_at,
      'motm', (select r.slug from public.sm_roster r where r.id = v_s.motm_roster_id),
      'updatedAt', v_s.live_updated_at,
      'demo', case when v_s.demo then true end,
      'source', v_quelle,
      'fupaUrl', case when v_quelle = 'fupa' and v_s.fupa_id is not null
                      then 'https://www.fupa.net/match/' || v_s.fupa_id end,
      'fupaAutor', case when v_quelle = 'fupa' and v_s.fupa_autor_id is not null
                        and v_s.fupa_autor_id::text = any (coalesce(v_autoren, '{}'))
                        then v_s.fupa_autor_name end
    )) || jsonb_build_object(
      'goalsFor',     case when v_status = 'beendet' and v_s.tore_sva is not null then v_s.tore_sva else v_s.live_tore_sva end,
      'goalsAgainst', case when v_status = 'beendet' and v_s.tore_gegner is not null then v_s.tore_gegner else v_s.live_tore_gegner end
    );

    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id', r.slug, 'name', r.name, 'role', r.rolle,
             'photoUrl', r.foto_url, 'cutoutUrl', r.freisteller_url
           )) order by r.sortierung, r.name), '[]'::jsonb)
      into v_staff from public.sm_roster r where r.aktiv and r.rolle <> 'spieler';

    -- Konferenz: nur echte Spiele, nur wenn an, Daten ≤ 10 min alt.
    if not p_demo and coalesce(v_konf_an, false) then
      select coalesce(k.tabelle, '{}'::jsonb) || jsonb_build_object('spiele', k.spiele, 'spieltag', k.spieltag)
        into v_conf
        from public.sva_konferenz k
       where k.datum = (v_s.anstoss at time zone 'Europe/Berlin')::date
         and k.aktualisiert_at > now() - interval '10 minutes';
    end if;

    if not p_demo then v_tipp := public.tipp_live_kurz(v_s.id); end if;
  end if;

  select jsonb_build_object(
           'opponent', s.gegner, 'home', s.heim, 'kickoff', s.anstoss,
           'goalsFor', s.tore_sva, 'goalsAgainst', s.tore_gegner)
    into v_prev
    from public.sm_spiele s
   where s.tore_sva is not null and s.tore_gegner is not null and not s.demo
     and (v_s.id is null or s.id <> v_s.id)
     and s.anstoss < coalesce(v_s.anstoss, now())
   order by s.anstoss desc limit 1;

  select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url))
    into v_partner
    from public.sva_partner_info pi
    join public.sm_sponsoren sp on sp.id = pi.live_partner_id and sp.aktiv
   where pi.id = 1;

  -- Kein strip_nulls am Top-Level: match/partner/previous bleiben als null-Form
  -- erhalten (Abwärtskompatibilität, wie v1). Die v2-Felder (source, reactions,
  -- conference, tipp) kommen additiv dazu.
  return jsonb_build_object(
    'version',    2,
    'serverNow',  now(),
    'match',      v_match,
    'events',     v_events,
    'lineup',     v_lj,
    'players',    v_players,
    'staff',      v_staff,
    'previous',   v_prev,
    'reactions',  case when v_reactions = '{}'::jsonb then null else v_reactions end,
    'conference', v_conf,
    'tipp',       v_tipp,
    'settings',   coalesce(v_settings, '{}'::jsonb),
    'partner',    v_partner
  );
end;
$$;
revoke all on function public.sva_live_daten(boolean) from public, anon, authenticated;
grant execute on function public.sva_live_daten(boolean) to service_role;
comment on function public.sva_live_daten(boolean) is
  'v23-L: Engine hinter web_live()/web_live_demo(), jetzt v2 (Quelle, Reaktionen, Konferenz, Tipp-Kurz). Demo-Trennung + Partner bleiben.';
comment on function public.web_live() is
  'v23-L: öffentliche Live-Lese-Schicht v2 (/live, Spieltag-Leiste, /tippen). Delegiert an sva_live_daten(false).';

-- ── 12. P7: Spielbericht-Vorschlag aus FuPa-Aufstellung ──────────────────────
-- Additiver Begleit-RPC zu tipp_admin_bericht (die große Funktion bleibt
-- unverändert). Liefert je Kader-Spieler mit FuPa-Zuordnung die FuPa-Werte
-- (Minuten, Tore, Vorlagen, Start). Die Admin-Seite füllt damit leere Felder
-- vor („FuPa-Werte übernehmen") — gewertet wird weiter nur per „Werten".
create or replace function public.tipp_admin_fupa_vorschlag(p_spiel uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_res jsonb;
begin
  perform public.sva_tipp_team_pruefen();
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id',       r.slug,
           'minuten',  (sp->'statistics'->>'minutes')::int,
           'tore',     (sp->'statistics'->>'goals')::int,
           'vorlagen', (sp->'statistics'->>'assists')::int,
           'gelb',     ((sp->'statistics'->>'yellowCard')::int > 0),
           'gelbrot',  ((sp->'statistics'->>'yellowRedCard')::int > 0),
           'rot',      ((sp->'statistics'->>'redCard')::int > 0),
           'start',    (sp->>'start')::boolean
         ))), '[]'::jsonb)
    into v_res
    from public.sva_fupa_aufstellung a,
         jsonb_array_elements(a.spieler) sp
    join public.sm_roster r on r.fupa_spieler_id = (sp->>'fupaId')::bigint
   where a.spiel_id = p_spiel;
  return v_res;
end;
$$;
revoke all on function public.tipp_admin_fupa_vorschlag(uuid) from public, anon;
grant  execute on function public.tipp_admin_fupa_vorschlag(uuid) to authenticated;
