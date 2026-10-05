-- ─────────────────────────────────────────────────────────────────────────────
-- v18-A: Cookiefreie Statistik (eigene, datensparsame Zählung).
--
-- Gespeichert werden NUR Tagessummen: Datum · Pfad · Quelle · Gerätetyp ·
-- Zähler. Keine IP, kein User-Agent, keine Cookies/IDs, kein Zeitstempel je
-- Aufruf → kein Personenbezug, keine Wiedererkennung.
--
--   1. sva_statistik_tage — Tagesaggregate (RLS: lesen nur is_sm_admin(),
--      schreiben nur über web_zaehlen()).
--   2. web_zaehlen(pfad, quelle, geraet) — anon-RPC, +1 auf die Tageszeile.
--      Schutz gegen Missbrauch:
--        · Pfad: feste Liste (Seiten, Karten-Orte, Ereignisse) — sonst abgelehnt
--        · Quelle: feste Liste (+ feste Medien wie „bio“/„story“), sonst
--          „sonstige“ bzw. ohne Medium; Gerät: nur „mobil“/„desktop“
--        · Längen begrenzt, alles klein geschrieben
--        · Deckel: max. 5000 je Tageszeile, max. 50000 je Tag gesamt
--      Die Zahl möglicher Zeilen pro Tag ist damit fest begrenzt.
--   3. web_statistik(p_tage) — Auswertung für den Admin (nur is_sm_admin()).
-- Idempotent (mehrfach anwendbar).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Tabelle ──────────────────────────────────────────────────────────────
create table if not exists public.sva_statistik_tage (
  tag date not null,
  pfad text not null check (char_length(pfad) between 1 and 60),
  quelle text not null check (char_length(quelle) between 1 and 40),
  geraet text not null check (geraet in ('mobil', 'desktop')),
  zaehler integer not null default 0 check (zaehler >= 0),
  constraint sva_statistik_tage_pkey primary key (tag, pfad, quelle, geraet)
);
comment on table public.sva_statistik_tage is
  'v18-A: anonyme Tageszählung der Website (ohne IP/UA/Cookies). Schreiben nur über web_zaehlen().';
alter table public.sva_statistik_tage enable row level security;

drop policy if exists sva_statistik_tage_select on public.sva_statistik_tage;
create policy sva_statistik_tage_select on public.sva_statistik_tage
  for select to authenticated using (public.is_sm_admin());
-- keine insert/update/delete-Policies: direkte Schreibzugriffe sind verboten
revoke all on public.sva_statistik_tage from anon, authenticated;
grant select on public.sva_statistik_tage to authenticated;

-- ── 2. Zählen ───────────────────────────────────────────────────────────────
-- Feste Listen an EINER Stelle (Website: src/statistik/zaehlen.ts — gleich halten).
create or replace function public.sva_statistik_pfade()
returns text[]
language sql
immutable
as $$
  select array[
    -- eigene Seiten
    '/', '/live', '/partner', '/album', '/galerie', '/impressum', '/datenschutz',
    -- Karte: Orte + Rundgang
    '/#rundgang', '/#spieltag', '/#training', '/#mannschaft', '/#fans', '/#musik', '/#partner', '/#anfahrt',
    -- Ereignisse (Ziele)
    '#ereignis:kalender-abo', '#ereignis:kalender-termin', '#ereignis:kalender-link',
    '#ereignis:probetraining-start', '#ereignis:probetraining',
    '#ereignis:partner-anfrage', '#ereignis:album-checkin', '#ereignis:instagram'
  ]::text[];
$$;

create or replace function public.web_zaehlen(pfad text, quelle text, geraet text)
returns boolean
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_pfad   text := lower(btrim(left(coalesce(pfad, ''), 60)));
  v_quelle text := lower(btrim(left(coalesce(quelle, ''), 40)));
  v_geraet text := lower(btrim(left(coalesce(geraet, ''), 10)));
  v_src    text;
  v_med    text;
  v_tag    date := (now() at time zone 'Europe/Berlin')::date;
  v_summe  bigint;
begin
  -- Pfad: nur die feste Liste
  if v_pfad = '' or not (v_pfad = any (public.sva_statistik_pfade())) then
    return false;
  end if;
  if v_geraet not in ('mobil', 'desktop') then
    return false;
  end if;

  -- Quelle normalisieren: „instagram:bio“ → Quelle + Medium (beide aus fester Liste)
  v_src := split_part(v_quelle, ':', 1);
  v_med := nullif(split_part(v_quelle, ':', 2), '');
  if v_src not in ('instagram', 'facebook', 'google', 'whatsapp', 'qr', 'direkt', 'intern', 'sonstige') then
    v_src := 'sonstige';
    v_med := null;
  end if;
  if v_med is not null and v_med not in ('bio', 'story', 'post', 'reel', 'platz', 'plakat', 'flyer', 'status', 'gruppe') then
    v_med := null;
  end if;
  v_quelle := v_src || coalesce(':' || v_med, '');

  -- Tagesdeckel gesamt (Schutz gegen Skript-Fluten)
  select coalesce(sum(t.zaehler), 0) into v_summe
    from public.sva_statistik_tage t
   where t.tag = v_tag;
  if v_summe >= 50000 then
    return false;
  end if;

  insert into public.sva_statistik_tage as t (tag, pfad, quelle, geraet, zaehler)
  values (v_tag, v_pfad, v_quelle, v_geraet, 1)
  on conflict on constraint sva_statistik_tage_pkey
  do update set zaehler = t.zaehler + 1
           where t.zaehler < 5000;   -- Deckel je Tageszeile
  return found;
end;
$$;
revoke all on function public.web_zaehlen(text, text, text) from public;
grant execute on function public.web_zaehlen(text, text, text) to anon, authenticated, service_role;
comment on function public.web_zaehlen(text, text, text) is
  'v18-A: +1 auf die anonyme Tageszählung (Pfad/Quelle/Gerät aus festen Listen, gedeckelt). anon.';

-- ── 3. Auswertung für den Admin ─────────────────────────────────────────────
create or replace function public.web_statistik(p_tage integer default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_tage  integer := greatest(1, least(coalesce(p_tage, 30), 400));
  v_bis   date := (now() at time zone 'Europe/Berlin')::date;
  v_von   date := v_bis - (v_tage - 1);
  v_vvon  date := v_von - v_tage;
  v_vbis  date := v_von - 1;
begin
  if not public.is_sm_admin() then
    raise exception 'nicht_erlaubt: Statistik nur für Admins' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'tage', v_tage,
    'von', v_von,
    'bis', v_bis,
    'aufrufe', (select coalesce(sum(t.zaehler), 0)::int from public.sva_statistik_tage t
                 where t.tag between v_von and v_bis and t.pfad not like '#%'),
    'aufrufeVorher', (select coalesce(sum(t.zaehler), 0)::int from public.sva_statistik_tage t
                       where t.tag between v_vvon and v_vbis and t.pfad not like '#%'),
    'proTag', (select coalesce(jsonb_agg(jsonb_build_object('tag', d.tag, 'aufrufe', d.n) order by d.tag), '[]'::jsonb)
                 from (select g.tag::date as tag,
                              coalesce((select sum(t.zaehler) from public.sva_statistik_tage t
                                         where t.tag = g.tag::date and t.pfad not like '#%'), 0)::int as n
                         from generate_series(v_von::timestamp, v_bis::timestamp, interval '1 day') as g(tag)) d),
    'quellen', (select coalesce(jsonb_agg(jsonb_build_object('quelle', q.src, 'aufrufe', q.n) order by q.n desc, q.src), '[]'::jsonb)
                  from (select split_part(t.quelle, ':', 1) as src, sum(t.zaehler)::int as n
                          from public.sva_statistik_tage t
                         where t.tag between v_von and v_bis and t.pfad not like '#%'
                         group by 1) q),
    'medien', (select coalesce(jsonb_agg(jsonb_build_object('quelle', q.quelle, 'aufrufe', q.n) order by q.n desc, q.quelle), '[]'::jsonb)
                 from (select t.quelle, sum(t.zaehler)::int as n
                         from public.sva_statistik_tage t
                        where t.tag between v_von and v_bis and t.pfad not like '#%' and position(':' in t.quelle) > 0
                        group by 1) q),
    'seiten', (select coalesce(jsonb_agg(jsonb_build_object('pfad', s.pfad, 'aufrufe', s.n) order by s.n desc, s.pfad), '[]'::jsonb)
                 from (select t.pfad, sum(t.zaehler)::int as n
                         from public.sva_statistik_tage t
                        where t.tag between v_von and v_bis and t.pfad not like '#%'
                        group by 1 order by 2 desc, 1 limit 12) s),
    'geraete', (select coalesce(jsonb_agg(jsonb_build_object('geraet', g.geraet, 'aufrufe', g.n) order by g.n desc), '[]'::jsonb)
                  from (select t.geraet, sum(t.zaehler)::int as n
                          from public.sva_statistik_tage t
                         where t.tag between v_von and v_bis and t.pfad not like '#%'
                         group by 1) g),
    'ereignisse', (select coalesce(jsonb_agg(jsonb_build_object('name', e.name, 'anzahl', e.n, 'vonInstagram', e.ig) order by e.n desc, e.name), '[]'::jsonb)
                     from (select substr(t.pfad, 11) as name, sum(t.zaehler)::int as n,
                                  sum(t.zaehler) filter (where t.quelle like 'instagram%')::int as ig
                             from public.sva_statistik_tage t
                            where t.tag between v_von and v_bis and t.pfad like '#ereignis:%'
                            group by 1) e)
  );
end;
$$;
revoke all on function public.web_statistik(integer) from public, anon;
grant execute on function public.web_statistik(integer) to authenticated, service_role;
comment on function public.web_statistik(integer) is
  'v18-A: Auswertung der anonymen Tageszählung (letzte N Tage + Vergleichszeitraum). Nur Admins.';
