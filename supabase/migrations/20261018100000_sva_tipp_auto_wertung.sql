-- ─────────────────────────────────────────────────────────────────────────────
-- v25-B: Auto-Wertung der Tipp-Liga (Betrieb „Auflösung am selben Abend“).
--
-- Befund aus AUDIT_V25_ERLEBNIS.md (#2): Spieltag 9 war zwei Tage nach Abpfiff
-- ungewertet — das Kernversprechen „Auflösung meist am selben Abend“ brach in
-- Woche 1 des Echtbetriebs. Dieses Paket wertet jedes beendete Pflichtspiel
-- automatisch, sobald es ≥ 30 min beendet ist, aus Spielbericht/Ticker:
--   · Ergebnis, Torschützen, Karten, Einsätze (aus sva_ticker, wie der
--     Admin-Spielbericht-Vorbefüllung),
--   · Bonusfragen + erster Torschütze über die vorhandenen Auto-Funktionen.
-- Gilt als „vorläufig“, bis MOTM eingetragen ist; Eintrag MOTM oder Änderung am
-- Bericht (bericht_at > gewertet_at) → automatisch neu werten (idempotent, nutzt
-- die bestehende Neuberechnung). Spiele mit 0 Tipps werden ebenfalls als gewertet
-- markiert, damit /tippen weiterschaltet. Vorführ-/Testspiele ausgeschlossen
-- (nur sva_tipp_wertung = 'saison'). Per Admin-Einstellung abschaltbar (Standard an).
--
-- Reihenfolge: nach 20261017100000 (Pack-System v24). Der Cron-Zeitplan liegt in
-- 20261018110000_sva_tipp_auto_wertung_cron.sql (separat, wie v23-L).
-- PGlite-Test: supabase/tests/tipp_auto_wertung.test.mjs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Einstellung: Auto-Wertung an/aus (Standard an) ───────────────────────
alter table public.sva_tipp_einstellungen
  add column if not exists auto_wertung boolean not null default true;
comment on column public.sva_tipp_einstellungen.auto_wertung is
  'v25-B: Spiele automatisch werten, sobald ≥ 30 min beendet (vorläufig bis MOTM). Standard an.';

-- ── 2. Marker: wurde dieser Spieltag automatisch gewertet? ──────────────────
alter table public.sva_tipp_spieltage
  add column if not exists auto_gewertet boolean not null default false;
comment on column public.sva_tipp_spieltage.auto_gewertet is
  'v25-B: true = zuletzt vom Auto-Werter gewertet (vorläufig bis MOTM; Nachwertung bei bericht_at > gewertet_at).';

-- ── 3. Wertungs-Kern (ohne Admin-Prüfung) ───────────────────────────────────
-- Exakt die Rechenlogik aus tipp_admin_werten, nur: KEINE Admin-/Team-Prüfung und
-- gewertet_von ist Parameter. Nur service_role/cron (bzw. die beiden SECURITY-
-- DEFINER-Aufrufer tipp_admin_werten / sva_tipp_auto_tick) rufen diesen Kern.
create or replace function public._sva_tipp_werten_kern(p_spiel uuid, p_von text)
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
     set gewertet_at = now(), gewertet_von = p_von, updated_at = now()
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
revoke all on function public._sva_tipp_werten_kern(uuid, text) from public, anon, authenticated;

-- Admin-RPC bleibt die öffentliche Tür (Team/Admin), delegiert an den Kern.
create or replace function public.tipp_admin_werten(p_spiel uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_tipp_team_pruefen();
  -- Hand gewinnt: eine manuelle Wertung übernimmt den Spieltag wieder (Auto-Werter
  -- lässt ihn künftig in Ruhe, solange kein neuer Bericht kommt).
  update public.sva_tipp_spieltage set auto_gewertet = false where spiel_id = p_spiel;
  return public._sva_tipp_werten_kern(p_spiel, auth.jwt() ->> 'email');
end;
$$;

-- ── 4. Bericht automatisch aus dem Ticker (nur leere Felder) ────────────────
-- Entspricht dem else-Zweig von tipp_admin_bericht: Einsätze/Minuten/Tore/
-- Vorlagen/Karten/Zu-null aus sva_ticker + letzter Aufstellung. Dazu Ergebnis
-- aus dem Live-Stand sichern, Auflösung + erster Torschütze automatisch.
create or replace function public._sva_tipp_auto_bericht(p_spiel uuid)
returns void
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_l public.sva_lineup;
  v_gegentore integer;
  v_erster uuid;
  v_auf jsonb;
begin
  select * into v_s from public.sm_spiele where id = p_spiel for update;
  if v_s.id is null or v_s.demo then return; end if;

  -- Ergebnis sichern (beendetes Spiel ohne Endergebnis → Live-Stand übernehmen)
  if (v_s.tore_sva is null or v_s.tore_gegner is null) and v_s.status = 'beendet' then
    update public.sm_spiele
       set tore_sva = coalesce(v_s.tore_sva, v_s.live_tore_sva, 0),
           tore_gegner = coalesce(v_s.tore_gegner, v_s.live_tore_gegner, 0),
           updated_at = now()
     where id = p_spiel;
    select * into v_s from public.sm_spiele where id = p_spiel;
  end if;

  -- Bericht aus dem Ticker nur anlegen, wenn noch keiner existiert (Hand nicht überschreiben)
  if not exists (select 1 from public.sva_tipp_bericht b where b.spiel_id = p_spiel) then
    select * into v_l from public.sva_lineup l where l.spiel_id = p_spiel order by l.created_at desc limit 1;
    v_gegentore := coalesce(v_s.tore_gegner, v_s.live_tore_gegner, 0);
    insert into public.sva_tipp_bericht (spiel_id, roster_id, eingesetzt, minuten, tore, vorlagen, karte, zu_null)
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
    select p_spiel, z.id, z.eingesetzt, z.minuten, z.tore, z.vorlagen, z.karte,
           (z.eingesetzt and v_gegentore = 0 and public.sva_tipp_pos(z.position) in ('TW', 'ABW') and coalesce(z.minuten, 90) >= 60)
      from z
     where z.eingesetzt or z.tore > 0 or z.karte is not null;
  end if;

  -- Auflösung + erster Torschütze automatisch; nur leere Felder füllen.
  v_erster := public.sva_tipp_erster_auto(p_spiel);
  v_auf := coalesce(public.sva_tipp_aufloesung_auto(p_spiel), '{}'::jsonb);
  insert into public.sva_tipp_spieltage (spiel_id, aufloesung, erster_torschuetze, bericht_at, bericht_von)
  values (p_spiel, v_auf, v_erster, now(), 'auto')
  on conflict (spiel_id) do update
     set aufloesung = case when public.sva_tipp_spieltage.aufloesung is null or public.sva_tipp_spieltage.aufloesung = '{}'::jsonb
                           then excluded.aufloesung else public.sva_tipp_spieltage.aufloesung end,
         erster_torschuetze = coalesce(public.sva_tipp_spieltage.erster_torschuetze, excluded.erster_torschuetze),
         bericht_at = coalesce(public.sva_tipp_spieltage.bericht_at, now()),
         bericht_von = coalesce(public.sva_tipp_spieltage.bericht_von, 'auto'),
         updated_at = now();
end;
$$;
revoke all on function public._sva_tipp_auto_bericht(uuid) from public, anon, authenticated;

-- ── 5. Abpfiff-Zeitpunkt (für „seit ≥ 30 min beendet“) ──────────────────────
create or replace function public.sva_tipp_abpfiff_at(p_spiel uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
    (select max(t.zeitpunkt) from public.sva_ticker t where t.spiel_id = p_spiel and t.typ = 'abpfiff'),
    (select s.anstoss + interval '2 hours' from public.sm_spiele s where s.id = p_spiel));
$$;

-- ── 6. Auto-Tick (vom Cron alle 10 min) ─────────────────────────────────────
-- 1) Neue Wertungen: saison-wertbare, beendete Spiele seit ≥ 30 min, ungewertet.
-- 2) Nachwertung: auto-gewertete Spiele mit bericht_at > gewertet_at (MOTM-Eintrag
--    oder Bericht-Korrektur) — idempotent neu rechnen.
create or replace function public.sva_tipp_auto_tick()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_an boolean;
  s record;
  v_neu integer := 0;
  v_re integer := 0;
  v_fehler jsonb := '[]'::jsonb;
begin
  select coalesce(auto_wertung, true) into v_an from public.sva_tipp_einstellungen where id = 1;
  if not coalesce(v_an, true) then
    return jsonb_build_object('aus', true, 'gewertet', 0, 're', 0);
  end if;

  -- 1) Neue Auto-Wertungen
  for s in
    select sp.id, public.sva_tipp_abpfiff_at(sp.id) as abpfiff
      from public.sm_spiele sp
      left join public.sva_tipp_spieltage tt on tt.spiel_id = sp.id
     where coalesce(sp.demo, false) = false
       and sp.status = 'beendet'
       and public.sva_tipp_wertung(sp.id) = 'saison'  -- schließt Demo + Testspiele (winter) aus
       and tt.gewertet_at is null
  loop
    if s.abpfiff is null or s.abpfiff > now() - interval '30 minutes' then
      continue;
    end if;
    begin
      perform public._sva_tipp_auto_bericht(s.id);
      perform public._sva_tipp_werten_kern(s.id, 'auto');
      update public.sva_tipp_spieltage set auto_gewertet = true where spiel_id = s.id;
      v_neu := v_neu + 1;
    exception when others then
      v_fehler := v_fehler || jsonb_build_array(jsonb_build_object('spiel', s.id, 'fehler', sqlerrm));
    end;
  end loop;

  -- 2) Nachwertung (MOTM/Bericht-Änderung nach einer Auto-Wertung)
  for s in
    select tt.spiel_id as id
      from public.sva_tipp_spieltage tt
     where tt.auto_gewertet is true
       and tt.gewertet_at is not null
       and tt.bericht_at is not null
       and tt.bericht_at > tt.gewertet_at
  loop
    begin
      perform public._sva_tipp_werten_kern(s.id, 'auto');
      v_re := v_re + 1;
    exception when others then
      v_fehler := v_fehler || jsonb_build_array(jsonb_build_object('spiel', s.id, 'fehler', sqlerrm));
    end;
  end loop;

  return jsonb_build_object('gewertet', v_neu, 're', v_re, 'fehler', v_fehler);
end;
$$;
revoke all on function public.sva_tipp_auto_tick() from public, anon, authenticated;

-- ── 7. Admin-Status für das Mahnbanner („ungewertet seit X Std“ / „vorläufig“) ─
-- Team/Admin: offene (beendet, saison, ungewertet) + vorläufige (auto, MOTM fehlt).
create or replace function public.tipp_admin_wertung_status()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_tipp_team_pruefen();
  return jsonb_build_object(
    'autoAktiv', coalesce((select auto_wertung from public.sva_tipp_einstellungen where id = 1), true),
    'offen', coalesce((
      select jsonb_agg(jsonb_build_object(
               'spielId', sp.id, 'gegner', sp.gegner, 'heim', sp.heim, 'spieltag', sp.spieltag_nr,
               'anstoss', sp.anstoss,
               'stunden', floor(extract(epoch from (now() - public.sva_tipp_abpfiff_at(sp.id))) / 3600)::int)
             order by sp.anstoss)
        from public.sm_spiele sp
        left join public.sva_tipp_spieltage tt on tt.spiel_id = sp.id
       where coalesce(sp.demo, false) = false
         and sp.status = 'beendet'
         and public.sva_tipp_wertung(sp.id) = 'saison'
         and tt.gewertet_at is null
         and public.sva_tipp_abpfiff_at(sp.id) < now() - interval '30 minutes'
    ), '[]'::jsonb),
    'vorlaeufig', coalesce((
      select jsonb_agg(jsonb_build_object(
               'spielId', sp.id, 'gegner', sp.gegner, 'heim', sp.heim, 'spieltag', sp.spieltag_nr,
               'anstoss', sp.anstoss)
             order by sp.anstoss)
        from public.sm_spiele sp
        join public.sva_tipp_spieltage tt on tt.spiel_id = sp.id
       where tt.auto_gewertet is true
         and tt.gewertet_at is not null
         and sp.motm_roster_id is null
    ), '[]'::jsonb));
end;
$$;
revoke all on function public.tipp_admin_wertung_status() from public, anon;
grant execute on function public.tipp_admin_wertung_status() to authenticated;
