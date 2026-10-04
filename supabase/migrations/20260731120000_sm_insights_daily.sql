-- ─────────────────────────────────────────────────────────────────────────────
-- sm_insights_daily — tages-granulare Instagram-ROHDATEN (append-only)
-- ─────────────────────────────────────────────────────────────────────────────
-- Grundsatz (Marvin): ROH SPEICHERN, AUFBEREITET ANZEIGEN. Instagram gibt Historie
-- nur ~60 Tage rückwirkend her; Story-Werte sind nach 24 h endgültig weg. Was hier
-- nicht täglich weggeschrieben wird, ist später unwiederbringlich verloren.
--
-- WARUM EINE NEUE TABELLE (bewusst getrennt):
--   • sm_insights (20260711020000): nur follower/reichweite/top_beitrag/notizen,
--     unique(datum,kanal), MIT update-Policy (Upsert-Handeingabe, Wochenverdichtung).
--     Keine Beitrags-/Story-Ebene, kein Roh-JSON, verdichtete `reichweite` ohne
--     dokumentiertes Bezugsfenster. Strukturell ungeeignet für tages-granulare
--     Mehrebenen-Rohdaten → bleibt UNANGETASTET für die Alt-Handeingaben.
--   • SME-`analytics_snapshots` ist post-granular + SME-spezifisch (anderer Scope,
--     anderes Projekt-Phasenmodell) → hier bewusst nicht mitbenutzt.
--   • Diese Tabelle: eine Zeile je (Ebene, Objekt, snapshot_date), APPEND-ONLY,
--     Roh-JSON für ALLES + typisierte Spalten für die Auswertung.
--
-- APPEND-ONLY-GARANTIE:
--   • BEFORE-UPDATE-Trigger blockiert JEDES Update (auch service_role) → einmal
--     erfasste Zeilen sind unveränderlich ("niemals UPDATE").
--   • Re-Run desselben Tags (Konto/Beitrag): partieller Unique-Index + ON CONFLICT
--     DO NOTHING → erste Erfassung des Tages gewinnt, kein Überschreiben.
--   • Stories: bewusst KEIN Tages-Unique → jeder <24h-Lauf hängt eine neue Zeile mit
--     eigenem captured_at an (Story-Metriken wachsen über die 24h; die Read-Seite
--     nimmt MAX/den letzten Stand vor Ablauf). Nur exakt-gleicher captured_at je
--     Story wird dedupliziert.
--
-- SCHREIBPFAD: der n8n-Writer auf dem VPS schreibt über service_role (bypass RLS)
--   via RPC public.sm_insert_insights_daily(jsonb) — kapselt Batch-Insert + Konflikt-
--   logik in versionierter SQL. Kein anon, keine authenticated-Insert-Policy.
--
-- ANWENDEN: NICHT via CLI/MCP auf das (pausierte) Projekt fwiivwmoyagcdrjvhaou.
--   ANZUWENDEN NACH RESTORE durch Leitstand/MCP. Statisch geprüft, nicht deployed.
--   Idempotent formuliert (create ... if not exists / drop policy if exists).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Tabelle ─────────────────────────────────────────────────────────────────
create table if not exists public.sm_insights_daily (
  id               uuid primary key default gen_random_uuid(),

  -- Diskriminator + Objekt-Identität
  ebene            text not null check (ebene in ('konto','beitrag','story')),
  object_id        text not null,          -- konto: ig-user-id · beitrag/story: ig media-/story-id
  snapshot_date    date not null,          -- fachlicher Erfassungstag (Metrik-Bezugstag)
  captured_at      timestamptz not null default now(),  -- echter Erfassungszeitpunkt (Story-Verlauf)
  period           text,                   -- 'day' | 'lifetime' | 'story' — Metrik-Periode

  -- Beitrags-/Story-Metadaten (nullable, nur wo sinnvoll gefüllt)
  media_type          text,               -- IMAGE | VIDEO | CAROUSEL_ALBUM | STORY ...
  media_product_type  text,               -- FEED | REELS | STORY ...
  permalink           text,
  caption             text,
  media_published_at  timestamptz,        -- Original-Veröffentlichungszeit des Beitrags/der Story

  -- Metrik-Superset (nullable; je Ebene ist nur die relevante Teilmenge gefüllt)
  reach               integer,            -- Konto (period=day) · Beitrag · Story
  impressions         integer,            -- Beitrag (Konto-impressions ab v21 deprecatet)
  follower_count      integer,            -- Konto (period=day, Momentanwert je Tag)
  views               integer,            -- Video/Reel
  likes               integer,
  comments            integer,
  shares              integer,            -- Beitrag + Story
  saved               integer,            -- Beitrag
  engagement          integer,            -- Beitrag (aggregiert, sofern geliefert)
  total_interactions  integer,            -- Beitrag (v21 Ersatz für engagement)
  profile_views       integer,            -- Konto (v21 deprecatet — nur falls noch geliefert)
  website_clicks      integer,            -- Konto (v21 deprecatet — nur falls noch geliefert)
  replies             integer,            -- Story
  exits               integer,            -- Story
  taps_forward        integer,            -- Story
  taps_back           integer,            -- Story

  -- Verteilungen als JSONB (kein sinnvolles typisiertes Skalar)
  online_followers    jsonb,              -- Konto: Stundenverteilung
  audience            jsonb,              -- Konto: follower_demographics (city/country/gender_age/locale)

  -- ROH: ALLES, was die API liefert — auch was heute niemand braucht
  raw                 jsonb not null default '{}'::jsonb,

  created_at          timestamptz not null default now()
);

comment on table  public.sm_insights_daily is
  'Tages-granulare Instagram-Rohdaten, append-only (eine Zeile je Ebene/Objekt/Tag; Stories mehrfach/Tag). Roh in raw jsonb, Auswertung über typisierte Spalten. Getrennt von sm_insights (Alt-Handeingabe).';
comment on column public.sm_insights_daily.ebene is
  'konto | beitrag | story — bestimmt, welche typisierten Spalten gefuellt sind.';
comment on column public.sm_insights_daily.object_id is
  'konto: ig-user-id · beitrag: ig media-id · story: ig story-id. Teil der Eindeutigkeit.';
comment on column public.sm_insights_daily.snapshot_date is
  'Fachlicher Bezugstag der Metrik (nicht zwingend = Kalendertag von captured_at).';
comment on column public.sm_insights_daily.captured_at is
  'Realer Abruf-Zeitpunkt. Bei Stories die Verlaufsachse innerhalb der 24h.';
comment on column public.sm_insights_daily.raw is
  'Ungefilterte API-Antwort je Objekt (Vollstaendigkeit vor Verdichtung).';

-- ── Append-only: Unveraenderlichkeit erzwingen ──────────────────────────────
-- BEFORE UPDATE feuert unabhaengig von der Rolle (auch service_role) → einmal
-- erfasste Rohzeilen sind endgueltig. Korrektur = neue Zeile mit spaeterem
-- captured_at (Historie bleibt sichtbar), nicht Ueberschreiben.
create or replace function public.sm_insights_daily_no_update()
returns trigger
language plpgsql
as $$
begin
  raise exception 'sm_insights_daily ist append-only: UPDATE nicht erlaubt (id=%). Neue Zeile anlegen.', old.id;
end;
$$;

drop trigger if exists sm_insights_daily_no_update on public.sm_insights_daily;
create trigger sm_insights_daily_no_update
  before update on public.sm_insights_daily
  for each row execute function public.sm_insights_daily_no_update();

-- ── Eindeutigkeit + Indizes ─────────────────────────────────────────────────
-- Konto/Beitrag: genau eine Zeile je Objekt und Tag (Re-Run heilt Luecken ohne
-- Doppelzaehlung; ON CONFLICT DO NOTHING greift auf diesen Index).
create unique index if not exists sm_insights_daily_konto_beitrag_uniq
  on public.sm_insights_daily (ebene, object_id, snapshot_date)
  where ebene in ('konto','beitrag');

-- Story: mehrere Captures/Tag erlaubt (Wachstumskurve <24h); nur exakt-gleicher
-- captured_at je Story wird dedupliziert.
create unique index if not exists sm_insights_daily_story_uniq
  on public.sm_insights_daily (ebene, object_id, snapshot_date, captured_at)
  where ebene = 'story';

-- Lese-Indizes fuer die Auswertung (neueste zuerst).
create index if not exists sm_insights_daily_ebene_date_idx
  on public.sm_insights_daily (ebene, snapshot_date desc);
create index if not exists sm_insights_daily_object_date_idx
  on public.sm_insights_daily (object_id, snapshot_date desc);

-- ── RLS: nur Admins lesen; Schreiben ausschliesslich service_role (bypass RLS) ─
alter table public.sm_insights_daily enable row level security;

drop policy if exists sm_insights_daily_select on public.sm_insights_daily;
create policy sm_insights_daily_select on public.sm_insights_daily
  for select to authenticated using (public.is_sm_admin());
-- Bewusst KEINE insert/update/delete-Policy fuer authenticated:
--   • kein Hand-Insert aus dem Client (Rohdaten kommen nur vom n8n-Writer),
--   • UPDATE ist zusaetzlich per Trigger global gesperrt,
--   • service_role (n8n) umgeht RLS und schreibt via RPC (unten).
-- kein anon-Zugriff.

-- ── Append-RPC fuer den n8n-Writer (Batch-Insert, konfliktrobust) ────────────
-- Nimmt ein JSONB-Array von Zeilen-Objekten; extrahiert die bekannten Spalten
-- explizit (Defaults fuer id/captured_at/created_at greifen bei Fehlen). ON
-- CONFLICT DO NOTHING ohne Zieltarget → deckt BEIDE partiellen Unique-Indizes ab.
-- SECURITY DEFINER, damit der Aufruf ueber service_role sauber greift; execute
-- ausschliesslich fuer service_role.
create or replace function public.sm_insert_insights_daily(p_rows jsonb)
returns integer
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_inserted integer;
begin
  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'sm_insert_insights_daily: p_rows muss ein JSONB-Array sein (war %).', jsonb_typeof(p_rows);
  end if;

  insert into public.sm_insights_daily (
    ebene, object_id, snapshot_date, captured_at, period,
    media_type, media_product_type, permalink, caption, media_published_at,
    reach, impressions, follower_count, views, likes, comments, shares, saved,
    engagement, total_interactions, profile_views, website_clicks,
    replies, exits, taps_forward, taps_back,
    online_followers, audience, raw
  )
  select
    e->>'ebene',
    e->>'object_id',
    (e->>'snapshot_date')::date,
    coalesce((e->>'captured_at')::timestamptz, now()),
    e->>'period',
    e->>'media_type',
    e->>'media_product_type',
    e->>'permalink',
    e->>'caption',
    nullif(e->>'media_published_at','')::timestamptz,
    nullif(e->>'reach','')::integer,
    nullif(e->>'impressions','')::integer,
    nullif(e->>'follower_count','')::integer,
    nullif(e->>'views','')::integer,
    nullif(e->>'likes','')::integer,
    nullif(e->>'comments','')::integer,
    nullif(e->>'shares','')::integer,
    nullif(e->>'saved','')::integer,
    nullif(e->>'engagement','')::integer,
    nullif(e->>'total_interactions','')::integer,
    nullif(e->>'profile_views','')::integer,
    nullif(e->>'website_clicks','')::integer,
    nullif(e->>'replies','')::integer,
    nullif(e->>'exits','')::integer,
    nullif(e->>'taps_forward','')::integer,
    nullif(e->>'taps_back','')::integer,
    case when jsonb_typeof(e->'online_followers') in ('object','array') then e->'online_followers' else null end,
    case when jsonb_typeof(e->'audience') in ('object','array') then e->'audience' else null end,
    coalesce(e->'raw', '{}'::jsonb)
  from jsonb_array_elements(p_rows) as e
  where coalesce(e->>'ebene','') in ('konto','beitrag','story')
    and coalesce(e->>'object_id','') <> ''
    and coalesce(e->>'snapshot_date','') <> ''
  on conflict do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$$;

comment on function public.sm_insert_insights_daily(jsonb) is
  'Append-only Batch-Insert fuer sm_insights_daily (n8n-Writer via service_role). ON CONFLICT DO NOTHING deckt beide partiellen Unique-Indizes. Gibt Anzahl neu eingefuegter Zeilen zurueck.';

-- Ausfuehrungsrechte hart begrenzen: nur der Automations-Writer (service_role).
revoke execute on function public.sm_insert_insights_daily(jsonb) from public;
revoke execute on function public.sm_insert_insights_daily(jsonb) from anon;
revoke execute on function public.sm_insert_insights_daily(jsonb) from authenticated;
grant  execute on function public.sm_insert_insights_daily(jsonb) to service_role;
