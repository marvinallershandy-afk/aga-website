-- ─────────────────────────────────────────────────────────────────────────────
-- v18-T „Vorführ-Spiel“: ein Testspiel, das ein Admin jederzeit per Knopf
-- starten kann, um /live und das Ticker-Pult zu zeigen — für normale Besucher
-- UNSICHTBAR.
--
-- Was diese Migration tut (alles ADDITIV, nur eigene sm_*/sva_*-Objekte):
--   1. sm_spiele.demo (boolean, Standard false) + Teil-Index: höchstens EIN
--      Vorführ-Spiel gleichzeitig.
--   2. Wächter-Trigger: Vorführ-Spiele entstehen nur über die RPC
--      sva_demo_starten() (Admin). Eingeloggte/anon dürfen das Kennzeichen
--      weder beim Anlegen setzen noch später umschalten (sonst könnte man ein
--      echtes Spiel verstecken oder die Vorführung öffentlich machen).
--   3. Album: für Vorführ-Spiele gibt es keine Check-in-Codes und keine
--      Check-ins (Trigger, falls die Album-Tabellen existieren).
--   4. web_snapshot() — Stand 20261008100000_sva_galerien.sql, NUR ergänzt um
--      „and not s.demo“ (nächstes/letztes Spiel, Form, Check-in-Zahlen,
--      Galerie-Spiel) und: keine Aufstellung, die an einem Vorführ-Spiel hängt.
--   5. web_live() — Stand 20261006100000_sva_partner.sql. Der Rumpf heißt
--      jetzt sva_live_daten(p_demo) (intern, nicht für anon/authenticated):
--        · web_live()      = sva_live_daten(false) → Vorführ-Spiele NIE dabei
--        · web_live_demo() = sva_live_daten(true)  → NUR das Vorführ-Spiel
--          (für /live?vorfuehrung=1), match.demo = true
--      Ohne Vorführ-Spiel ist die Antwort von web_live() Feld für Feld gleich
--      der bisherigen (supabase/tests/demo.test.mjs).
--   6. web_kalender() — Stand 20261009090000_sva_alltag.sql + „and not s.demo“
--      (damit auch die Edge Function `kalender` sie nie ausliefert).
--   7. Admin-RPCs (nur is_sm_admin()):
--        sva_demo_starten(p_gegner, p_beispiele, p_anpfiff) — legt das
--          Vorführ-Spiel an bzw. setzt das vorhandene zurück (Heimspiel,
--          Ticker geleert; Anpfiff jetzt → live; optional Beispiel-Ereignisse
--          mit echten Spielern aus der aktuellen Aufstellung bzw. dem Kader)
--        sva_demo_beenden() — Abpfiff
--        sva_demo_loeschen() — Spiel samt Ticker weg
--
-- ACHTUNG beim Mergen paralleler Stränge: wer web_snapshot(), web_live() bzw.
-- sva_live_daten() oder web_kalender() später neu anlegt, MUSS die Demo-Filter
-- übernehmen (Suchwort „demo“). supabase/tests/demo.test.mjs wendet alle
-- Migrationen der Reihe nach an und schlägt fehl, wenn ein Vorführ-Spiel
-- irgendwo öffentlich auftaucht.
--
-- NICHT automatisch anwenden — Reihenfolge: nach 20261009100000_sva_statistik.sql.
-- Idempotent formuliert (mehrfaches Anwenden schadet nicht).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Kennzeichen am Spiel ──────────────────────────────────────────────────
alter table public.sm_spiele add column if not exists demo boolean not null default false;
comment on column public.sm_spiele.demo is
  'v18-T: Vorführ-Spiel (Admin → „Vorführ-Spiel starten“). Nie öffentlich außer über web_live_demo() (/live?vorfuehrung=1). Höchstens eins.';
create unique index if not exists sm_spiele_hoechstens_ein_demo on public.sm_spiele (demo) where demo;

-- ── 2. Wächter: Kennzeichen nur über die RPC ────────────────────────────────
create or replace function public.sva_spiele_demo_waechter()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Die RPCs (SECURITY DEFINER) und Wartung (service_role) laufen nicht als
  -- anon/authenticated und sind deshalb nicht betroffen.
  if current_user in ('anon', 'authenticated') then
    if tg_op = 'INSERT' and new.demo then
      raise exception 'sva_demo_nur_per_knopf: Vorführ-Spiele nur über „Vorführ-Spiel starten“.'
        using errcode = '42501';
    elsif tg_op = 'UPDATE' and new.demo is distinct from old.demo then
      raise exception 'sva_demo_unveraenderlich: Ein Spiel kann nicht nachträglich zum Vorführ-Spiel werden (oder umgekehrt).'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.sva_spiele_demo_waechter() from public, anon, authenticated;

drop trigger if exists sva_spiele_demo_waechter on public.sm_spiele;
create trigger sva_spiele_demo_waechter
  before insert or update on public.sm_spiele
  for each row execute function public.sva_spiele_demo_waechter();

-- ── 3. Album: keine Codes/Check-ins für Vorführ-Spiele ──────────────────────
create or replace function public.sva_album_kein_demo()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if exists (select 1 from public.sm_spiele s where s.id = new.spiel_id and s.demo) then
    raise exception 'album_demo_spiel: Für ein Vorführ-Spiel gibt es keinen Check-in.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.sva_album_kein_demo() from public, anon, authenticated;

do $$
begin
  if to_regclass('public.sva_album_spielcodes') is not null then
    execute 'drop trigger if exists sva_album_kein_demo on public.sva_album_spielcodes';
    execute 'create trigger sva_album_kein_demo before insert or update of spiel_id on public.sva_album_spielcodes
               for each row execute function public.sva_album_kein_demo()';
  end if;
  if to_regclass('public.sva_album_checkins') is not null then
    execute 'drop trigger if exists sva_album_kein_demo on public.sva_album_checkins';
    execute 'create trigger sva_album_kein_demo before insert or update of spiel_id on public.sva_album_checkins
               for each row execute function public.sva_album_kein_demo()';
  end if;
end $$;

-- ── 4. web_snapshot(): Vorführ-Spiele ausgeschlossen ────────────────────────
-- Rumpf = 20261008100000_sva_galerien.sql, geändert NUR an den Stellen mit
-- „not s.demo“ / „d.demo“.
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
  v_partner  jsonb;
  v_ci_spiele  integer;
  v_ci_schnitt integer;
  v_galerien   jsonb := '[]'::jsonb;
begin
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
             )) || jsonb_build_object('number', r.nummer) as obj
        from public.sm_roster r
       where r.aktiv and r.rolle = 'spieler'
    ) p;

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
   -- v18-T: keine Aufstellung, die an einem Vorführ-Spiel hängt
   where not exists (select 1 from public.sm_spiele d where d.id = l.spiel_id and d.demo)
   order by l.created_at desc
   limit 1;

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
     and not s.demo
   order by s.anstoss asc
   limit 1;

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
     and not s.demo
   order by s.anstoss desc
   limit 1;

  select coalesce(jsonb_agg(f.res order by f.anstoss asc), '[]'::jsonb)
    into v_form
    from (
      select s.anstoss,
             case when s.tore_sva > s.tore_gegner then 'W'
                  when s.tore_sva = s.tore_gegner then 'U'
                  else 'N' end as res
        from public.sm_spiele s
       where s.tore_sva is not null and s.tore_gegner is not null
         and not s.demo
       order by s.anstoss desc
       limit 5
    ) f;

  -- v16-S: + stufe (Partner-Wand); Hauptpartner zuerst (auch auf der Bande)
  select coalesce(jsonb_agg(x.obj order by x.rang, x.sortierung, x.name), '[]'::jsonb)
    into v_sponsors
    from (
      select sp.sortierung, sp.name,
             case sp.stufe when 'hauptpartner' then 0 when 'partner' then 1 else 2 end as rang,
             jsonb_strip_nulls(jsonb_build_object(
               'name',    sp.name,
               'logoUrl', sp.logo_url,
               'url',     sp.website_url,
               'bande',   sp.bande,
               'stufe',   sp.stufe
             )) as obj
        from public.sm_sponsoren sp
       where sp.aktiv
    ) x;

  -- v17-A: gezählte Zuschauer (Album-Check-ins) je Heimspiel der Saison
  if to_regclass('public.sva_album_checkins') is not null then
    execute $q$
      select count(*)::int, round(avg(x.n))::int
        from (
          select c.spiel_id, count(*) as n
            from public.sva_album_checkins c
            join public.sm_spiele s on s.id = c.spiel_id and s.heim and not s.demo
           where c.saison = public.sva_album_saison()
           group by c.spiel_id
        ) x
    $q$ into v_ci_spiele, v_ci_schnitt;
  end if;
  if coalesce(v_ci_spiele, 0) = 0 then
    v_ci_spiele := null;
    v_ci_schnitt := null;
  end if;

  -- v16-S: Partner-Bereich (/partner) — Pakete (sichtbar), Mediadaten (nur
  -- gepflegte Felder), „Live-Ticker präsentiert von“. Keine Anfragen, keine
  -- Kontakte, keine internen IDs außer der Paket-ID (Formular-Auswahl).
  select jsonb_build_object(
           'pakete', coalesce((
             select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                      'id',            pk.id,
                      'name',          pk.name,
                      'beschreibung',  nullif(btrim(coalesce(pk.beschreibung, '')), ''),
                      'leistungen',    to_jsonb(pk.leistungen),
                      'preisAb',       pk.preis_ab,
                      'preisEinheit',  pk.preis_einheit,
                      'plaetze',       pk.plaetze,
                      'frei',          case when pk.plaetze is null then null
                                            else greatest(0, pk.plaetze - (
                                              select count(*)::int from public.sm_sponsoren s2
                                               where s2.aktiv and s2.partner_paket_id = pk.id)) end,
                      'hervorgehoben', case when pk.hervorgehoben then true end
                    )) order by pk.sortierung, pk.name)
               from public.sva_partner_pakete pk
              where pk.sichtbar), '[]'::jsonb),
           'mediadaten', (
             select jsonb_strip_nulls(jsonb_build_object(
                      'instagramFollower',   pi.instagram_follower,
                      'reichweiteMonat',     pi.reichweite_monat,
                      'zuschauerHeim',       pi.zuschauer_heim,
                      'websiteBesucheMonat', pi.website_besuche_monat,
                      'heimspieleSaison',    pi.heimspiele_saison,
                      'stand',               pi.stand,
                      'checkinsSchnitt',     v_ci_schnitt,
                      'checkinsSpiele',      v_ci_spiele
                    ))
               from public.sva_partner_info pi where pi.id = 1),
           'livePartner', (
             select jsonb_strip_nulls(jsonb_build_object(
                      'name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url))
               from public.sva_partner_info pi
               join public.sm_sponsoren sp on sp.id = pi.live_partner_id and sp.aktiv
              where pi.id = 1)
         )
    into v_partner;

  -- v17-D: Galerien „Spieltag in Bildern“ (nur veröffentlichte, neueste
  -- zuerst; Bilder in Reihenfolge, Titelbild markiert). `pfad`/`vorschau`
  -- sind Storage-Pfade im öffentlichen Bucket sva_public (oder volle URLs);
  -- der Build (scripts/fetch-content.mjs) lädt sie nach public/generated/.
  select coalesce(jsonb_agg(g.obj order by g.datum desc nulls last, g.sortierung, g.titel), '[]'::jsonb)
    into v_galerien
    from (
      select ga.datum, ga.sortierung, ga.titel,
             jsonb_strip_nulls(jsonb_build_object(
               'slug',        ga.slug,
               'titel',       ga.titel,
               'untertitel',  nullif(btrim(coalesce(ga.untertitel, '')), ''),
               'datum',       ga.datum,
               'fotograf',    ga.fotograf,
               'fotografUrl', nullif(btrim(coalesce(ga.fotograf_url, '')), ''),
               'spiel',       (select jsonb_build_object('opponent', s.gegner, 'home', s.heim, 'kickoff', s.anstoss)
                                 from public.sm_spiele s where s.id = ga.spiel_id and not s.demo),
               'bilder',      coalesce((
                                select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                                         'pfad',     b.pfad,
                                         'vorschau', b.vorschau_pfad,
                                         'w',        b.breite,
                                         'h',        b.hoehe,
                                         'alt',      nullif(btrim(coalesce(b.alt_text, '')), ''),
                                         'cover',    case when b.titelbild then true end
                                       )) order by b.reihenfolge, b.created_at)
                                  from public.sva_galerie_bilder b
                                 where b.galerie_id = ga.id), '[]'::jsonb)
             )) as obj
        from public.sva_galerien ga
       where ga.veroeffentlicht
         and exists (select 1 from public.sva_galerie_bilder b where b.galerie_id = ga.id)
    ) g;

  -- ── Verein & Links (v15-L: + trainingOrt, Widget-IDs) ──────────────────────
  select jsonb_strip_nulls(jsonb_build_object(
           'fussballDeTeamId',        st.fussball_de_team_id,
           'fussballDeWidgetTabelle', st.fussball_de_widget_tabelle,
           'fussballDeWidgetSpielplan', st.fussball_de_widget_spielplan,
           'fupaUrl',                 st.fupa_url,
           'instagram',               st.instagram,
           'whatsapp',                st.whatsapp,
           'email',                   st.email,
           'training',                st.training,
           'trainingOrt',             nullif(btrim(coalesce(st.training_ort, '')), ''),
           'address',                 st.adresse,
           'saison',                  st.saison,
           'updatedAt',               st.updated_at
         )), st.saison
    into v_settings, v_saison
    from public.sva_settings st
   where st.id = 1;

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
    'sections',    coalesce(v_sections, '[]'::jsonb),
    'partner',     jsonb_strip_nulls(v_partner),
    'galerien',    coalesce(v_galerien, '[]'::jsonb)
  );
end;
$$;

revoke all on function public.web_snapshot() from public;
grant execute on function public.web_snapshot() to anon, authenticated, service_role;

comment on function public.web_snapshot() is
  'Öffentliche Lese-Schicht der Website (Build-Fetch, anon). v17-D: + galerien. v18-T: ohne Vorführ-Spiele.';

-- ── 5. Live-Daten: echte Spiele (web_live) / Vorführung (web_live_demo) ─────
-- Rumpf = web_live() aus 20261006100000_sva_partner.sql, geändert NUR an den
-- Stellen mit „p_demo“ / „demo“.
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
begin
  -- v18-T: Vorführ-Spiel NUR auf ausdrückliche Anforderung (web_live_demo()),
  -- sonst sind Vorführ-Spiele in jeder Auswahl unten ausgeschlossen.
  if p_demo then
    select * into v_s from public.sm_spiele s
     where s.demo
     order by s.created_at desc limit 1;
  else
  -- echte Spiele: Auswahl wie bisher, nur jeweils + „not s.demo“
  select * into v_s from public.sm_spiele s
   where s.status in ('live', 'halbzeit')
     and not s.demo
   order by s.anstoss desc limit 1;

  if v_s.id is null then
    select * into v_s from public.sm_spiele s
     where (s.status = 'beendet' or (s.tore_sva is not null and s.tore_gegner is not null))
       and s.anstoss between now() - interval '12 hours' and now() + interval '1 hour'
       and not s.demo
     order by s.anstoss desc limit 1;
  end if;

  if v_s.id is null then
    select * into v_s from public.sm_spiele s
     where s.anstoss >= now() - interval '3 hours'
       and s.status <> 'beendet'
       and (s.tore_sva is null or s.tore_gegner is null)
       and not s.demo
     order by s.anstoss asc limit 1;
  end if;

  if v_s.id is null then
    select * into v_s from public.sm_spiele s
     where (s.status = 'beendet' or (s.tore_sva is not null and s.tore_gegner is not null))
       and not s.demo
     order by s.anstoss desc limit 1;
  end if;
  end if; -- p_demo

  -- Verein & Links (immer, auch ohne Spiel)
  select jsonb_strip_nulls(jsonb_build_object(
           'address',          st.adresse,
           'fussballDeTeamId', st.fussball_de_team_id,
           'widgetTabelle',    st.fussball_de_widget_tabelle,
           'widgetSpielplan',  st.fussball_de_widget_spielplan,
           'fupaUrl',          st.fupa_url,
           'instagram',        st.instagram,
           'saison',           st.saison
         ))
    into v_settings
    from public.sva_settings st where st.id = 1;

  if v_s.id is not null then
    v_status := case
                  when v_s.status in ('live', 'halbzeit') then v_s.status
                  when v_s.status = 'beendet' or (v_s.tore_sva is not null and v_s.tore_gegner is not null) then 'beendet'
                  else 'geplant'
                end;

    if v_status = 'live' and v_s.wiederanpfiff_at is not null then
      v_half := 2;
      v_minute := 45 + greatest(1, floor(extract(epoch from (now() - v_s.wiederanpfiff_at)) / 60)::int + 1);
    elsif v_status = 'live' and v_s.anpfiff_at is not null then
      v_half := 1;
      v_minute := greatest(1, floor(extract(epoch from (now() - v_s.anpfiff_at)) / 60)::int + 1);
    elsif v_status = 'halbzeit' then
      v_half := 1;
      v_minute := 45;
    end if;

    -- Aufstellung zum Spiel, sonst die aktuelle
    select * into v_lineup from public.sva_lineup l
     where l.spiel_id = v_s.id order by l.created_at desc limit 1;
    if v_lineup.id is not null then
      v_lfor := true;
    else
      select * into v_lineup from public.sva_lineup l
       where not exists (select 1 from public.sm_spiele d where d.id = l.spiel_id and d.demo)
       order by l.created_at desc limit 1;
    end if;

    -- Ticker: neueste zuerst, max. 200
    select coalesce(jsonb_agg(e.obj order by e.zeitpunkt desc, e.created_at desc), '[]'::jsonb)
      into v_events
      from (
        select t.zeitpunkt, t.created_at,
               jsonb_strip_nulls(jsonb_build_object(
                 'id',      t.id,
                 'type',    t.typ,
                 'minute',  t.minute,
                 'extra',   nullif(t.nachspielzeit, 0),
                 'player',  r1.slug,
                 'player2', r2.slug,
                 'text',    nullif(btrim(coalesce(t.text, '')), ''),
                 'at',      t.zeitpunkt
               )) as obj
          from public.sva_ticker t
          left join public.sm_roster r1 on r1.id = t.roster_id
          left join public.sm_roster r2 on r2.id = t.roster_id_2
         where t.spiel_id = v_s.id
         order by t.zeitpunkt desc, t.created_at desc
         limit 200
      ) e;

    -- Alle Spieler, die irgendwo vorkommen (Aufstellung, Ticker, MOTM)
    v_ids := coalesce(v_lineup.startelf, '{}') || coalesce(v_lineup.bank, '{}')
             || coalesce((select array_agg(x) from (
                  select t.roster_id as x from public.sva_ticker t where t.spiel_id = v_s.id and t.roster_id is not null
                  union
                  select t.roster_id_2 from public.sva_ticker t where t.spiel_id = v_s.id and t.roster_id_2 is not null
                ) q), '{}');
    if v_s.motm_roster_id is not null then
      v_ids := v_ids || v_s.motm_roster_id;
    end if;

    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id',        r.slug,
             'name',      r.name,
             'number',    r.nummer,
             'position',  case upper(coalesce(r.position, ''))
                            when 'TW' then 'TW' when 'TORWART' then 'TW'
                            when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
                            when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
                            else 'MIT' end,
             'photoUrl',  r.foto_url,
             'cutoutUrl', r.freisteller_url,
             'isCaptain', case when r.kapitaen then true end
           )) order by r.sortierung, r.name), '[]'::jsonb)
      into v_players
      from public.sm_roster r
     where r.id = any (v_ids);

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
        'updatedAt',  v_lineup.created_at
      );
    end if;

    v_match := jsonb_strip_nulls(jsonb_build_object(
      'id',              v_s.id,
      'opponent',        v_s.gegner,
      'home',            v_s.heim,
      'kickoff',         v_s.anstoss,
      'venue',           v_s.ort,
      'competition',     v_s.wettbewerb,
      'matchday',        v_s.spieltag_nr,
      'status',          v_status,
      'half',            v_half,
      'minute',          v_minute,
      'anpfiffAt',       v_s.anpfiff_at,
      'wiederanpfiffAt', v_s.wiederanpfiff_at,
      'motm',            (select r.slug from public.sm_roster r where r.id = v_s.motm_roster_id),
      'updatedAt',       v_s.live_updated_at,
      'demo',            case when v_s.demo then true end
    )) || jsonb_build_object(
      'goalsFor',     case when v_status = 'beendet' and v_s.tore_sva is not null then v_s.tore_sva else v_s.live_tore_sva end,
      'goalsAgainst', case when v_status = 'beendet' and v_s.tore_gegner is not null then v_s.tore_gegner else v_s.live_tore_gegner end
    );

    -- Trainerstab (für die Aufstellung)
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id', r.slug, 'name', r.name, 'role', r.rolle,
             'photoUrl', r.foto_url, 'cutoutUrl', r.freisteller_url
           )) order by r.sortierung, r.name), '[]'::jsonb)
      into v_staff
      from public.sm_roster r
     where r.aktiv and r.rolle <> 'spieler';
  end if;

  -- Letztes beendetes Spiel vor dem aktuellen (für „Zuletzt: 2:1 gegen …")
  select jsonb_build_object(
           'opponent',     s.gegner,
           'home',         s.heim,
           'kickoff',      s.anstoss,
           'goalsFor',     s.tore_sva,
           'goalsAgainst', s.tore_gegner
         )
    into v_prev
    from public.sm_spiele s
   where s.tore_sva is not null and s.tore_gegner is not null
     and not s.demo
     and (v_s.id is null or s.id <> v_s.id)
     and s.anstoss < coalesce(v_s.anstoss, now())
   order by s.anstoss desc
   limit 1;

  -- v16-S: „Live-Ticker präsentiert von“ (nur aktiver Sponsor, nur öffentliche Felder)
  select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url))
    into v_partner
    from public.sva_partner_info pi
    join public.sm_sponsoren sp on sp.id = pi.live_partner_id and sp.aktiv
   where pi.id = 1;

  return jsonb_build_object(
    'version',   1,
    'serverNow', now(),
    'match',     v_match,
    'events',    v_events,
    'lineup',    v_lj,
    'players',   v_players,
    'staff',     v_staff,
    'previous',  v_prev,
    'settings',  coalesce(v_settings, '{}'::jsonb),
    'partner',   v_partner
  );
end;
$$;

revoke all on function public.sva_live_daten(boolean) from public, anon, authenticated;
grant execute on function public.sva_live_daten(boolean) to service_role;
comment on function public.sva_live_daten(boolean) is
  'v18-T: Rumpf von web_live() (p_demo = false: nur echte Spiele) und web_live_demo() (p_demo = true: nur das Vorführ-Spiel). Intern.';

create or replace function public.web_live()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.sva_live_daten(false);
$$;
comment on function public.web_live() is
  'Öffentliche Live-Lese-Schicht (/live, Spieltag-Leiste): aktuelles/nächstes Spiel, Spielstand, Minute, Ticker, Aufstellung. Nur veröffentlichbare Felder. v18-T: nie ein Vorführ-Spiel.';
revoke all on function public.web_live() from public;
grant execute on function public.web_live() to anon, authenticated, service_role;

create or replace function public.web_live_demo()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.sva_live_daten(true);
$$;
comment on function public.web_live_demo() is
  'v18-T: wie web_live(), aber NUR das Vorführ-Spiel (match.demo = true) — für /live?vorfuehrung=1. Ohne Vorführ-Spiel: match = null.';
revoke all on function public.web_live_demo() from public;
grant execute on function public.web_live_demo() to anon, authenticated, service_role;

-- ── 6. web_kalender(): Vorführ-Spiele ausgeschlossen ────────────────────────
-- Rumpf = 20261009090000_sva_alltag.sql + „and not s.demo“.
create or replace function public.web_kalender(p_alle boolean default false)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'version', 1,
    'erzeugt', now(),
    'verein', coalesce((
      select jsonb_strip_nulls(jsonb_build_object(
               'adresse', nullif(btrim(coalesce(st.adresse, '')), '')))
        from public.sva_settings st where st.id = 1), '{}'::jsonb),
    'spiele', coalesce((
      select jsonb_agg(x.obj order by x.anstoss)
        from (
          select s.anstoss,
                 jsonb_strip_nulls(jsonb_build_object(
                   'id',         s.id,
                   'gegner',     btrim(s.gegner),
                   'heim',       s.heim,
                   'anstoss',    s.anstoss,
                   'ort',        nullif(btrim(coalesce(s.ort, '')), ''),
                   'wettbewerb', nullif(btrim(coalesce(s.wettbewerb, '')), ''),
                   'spieltag',   s.spieltag_nr,
                   'toreSva',    case when s.tore_sva is not null and s.tore_gegner is not null then s.tore_sva end,
                   'toreGegner', case when s.tore_sva is not null and s.tore_gegner is not null then s.tore_gegner end,
                   'seq',        s.kalender_seq,
                   'geaendert',  coalesce(s.kalender_geaendert_at, s.created_at)
                 )) as obj
            from public.sm_spiele s
           where (coalesce(p_alle, false) or s.heim)
             and position('(test)' in lower(s.gegner)) = 0
             and not s.demo
             and s.anstoss between now() - interval '400 days' and now() + interval '400 days'
           order by s.anstoss
           limit 500
        ) x), '[]'::jsonb)
  );
$$;

revoke all on function public.web_kalender(boolean) from public;
grant execute on function public.web_kalender(boolean) to anon, authenticated, service_role;
comment on function public.web_kalender(boolean) is
  'v18-A: Öffentlicher Spielplan für das Kalender-Abo (Edge Function kalender). Ohne Notizen, ohne Testspiele. v18-T: ohne Vorführ-Spiele.';

-- ── 7. Admin: Vorführ-Spiel starten / beenden / löschen ─────────────────────
-- Position grob wie auf der Website (TW / ABW / MIT / ANG).
create or replace function public.sva_demo_position(p text)
returns text
language sql
immutable
as $$
  select case upper(coalesce(p, ''))
           when 'TW' then 'TW' when 'TORWART' then 'TW'
           when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
           when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
           else 'MIT' end;
$$;
revoke all on function public.sva_demo_position(text) from public, anon, authenticated;

create or replace function public.sva_demo_starten(
  p_gegner text default null,
  p_beispiele boolean default false,
  p_anpfiff boolean default true
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_gegner  text := btrim(coalesce(p_gegner, ''));
  v_anpfiff boolean := coalesce(p_anpfiff, true);
  v_beisp   boolean := coalesce(p_beispiele, false) and coalesce(p_anpfiff, true);
  v_start   timestamptz;
  v_id      uuid;
  v_pool    uuid[];
  v_tor     uuid;
  v_vorlage uuid;
  v_gelb    uuid;
  v_s       public.sm_spiele;
begin
  if not public.is_sm_admin() then
    raise exception 'nicht_erlaubt: Vorführ-Spiel nur für Admins' using errcode = '42501';
  end if;
  if v_gegner = '' then
    v_gegner := 'FC Vorführung';
  end if;
  if char_length(v_gegner) > 60 then
    raise exception 'sva_demo_gegner: Gegnername höchstens 60 Zeichen' using errcode = '22023';
  end if;

  -- Anpfiff jetzt (Ticker nur „Anpfiff“) · mit Beispielen vor 24 min (damit
  -- die Ereignisse zur laufenden Minute passen) · ohne Anpfiff: Anstoß in
  -- 15 min (Countdown, „ANPFIFF“ im Ticker-Pult drücken).
  v_start := case when not v_anpfiff then now() + interval '15 minutes'
                  when v_beisp then now() - interval '24 minutes'
                  else now() end;

  select s.id into v_id from public.sm_spiele s where s.demo for update;
  if v_id is not null then
    -- zurücksetzen (gleiche ID → ein offenes Ticker-Pult bleibt gültig)
    delete from public.sva_ticker t where t.spiel_id = v_id;
    delete from public.sva_lineup l where l.spiel_id = v_id;
    update public.sm_spiele s
       set gegner = v_gegner, heim = true, anstoss = v_start, ort = null, wettbewerb = null,
           spieltag_nr = null, notizen = 'Vorführ-Spiel — nur über /live?vorfuehrung=1 sichtbar',
           tore_sva = null, tore_gegner = null, motm_roster_id = null, status = 'geplant',
           live_tore_sva = 0, live_tore_gegner = 0, anpfiff_at = null, wiederanpfiff_at = null,
           live_updated_at = now(), updated_at = now()
     where s.id = v_id;
  else
    insert into public.sm_spiele (gegner, heim, anstoss, notizen, demo)
    values (v_gegner, true, v_start, 'Vorführ-Spiel — nur über /live?vorfuehrung=1 sichtbar', true)
    returning id into v_id;
  end if;

  if v_anpfiff then
    insert into public.sva_ticker (spiel_id, typ, minute, zeitpunkt)
    values (v_id, 'anpfiff', 1, v_start);
  end if;

  if v_beisp then
    -- Echte Spieler: Startelf der aktuellen (echten) Aufstellung, sonst aktiver Kader
    select l.startelf into v_pool
      from public.sva_lineup l
     where not exists (select 1 from public.sm_spiele d where d.id = l.spiel_id and d.demo)
     order by l.created_at desc limit 1;
    if v_pool is null then
      select array_agg(r.id) into v_pool
        from public.sm_roster r where r.aktiv and r.rolle = 'spieler';
    end if;

    select r.id into v_tor from public.sm_roster r
     where r.id = any (coalesce(v_pool, '{}'))
     order by case public.sva_demo_position(r.position) when 'ANG' then 0 when 'MIT' then 1 when 'ABW' then 2 else 3 end,
              r.nummer nulls last, r.name
     limit 1;
    select r.id into v_vorlage from public.sm_roster r
     where r.id = any (coalesce(v_pool, '{}')) and r.id is distinct from v_tor
     order by case public.sva_demo_position(r.position) when 'MIT' then 0 when 'ANG' then 1 when 'ABW' then 2 else 3 end,
              r.nummer nulls last, r.name
     limit 1;
    select r.id into v_gelb from public.sm_roster r
     where r.id = any (coalesce(v_pool, '{}')) and r.id is distinct from v_tor and r.id is distinct from v_vorlage
     order by case public.sva_demo_position(r.position) when 'ABW' then 0 when 'MIT' then 1 when 'ANG' then 2 else 3 end,
              r.nummer nulls last, r.name
     limit 1;

    insert into public.sva_ticker (spiel_id, typ, minute, roster_id, roster_id_2, text, zeitpunkt) values
      (v_id, 'kommentar', 6, null, null, 'Erste Chance für den SVA — der Ball streicht knapp am Pfosten vorbei.', v_start + interval '5 minutes'),
      (v_id, 'tor', 13, v_tor, v_vorlage, 'Flach ins lange Eck', v_start + interval '12 minutes'),
      (v_id, 'gelb', 19, v_gelb, null, 'Taktisches Foul im Mittelfeld', v_start + interval '18 minutes'),
      (v_id, 'kommentar', 23, null, null, 'Der SVA bleibt am Drücker.', v_start + interval '22 minutes');
  end if;

  select * into v_s from public.sm_spiele s where s.id = v_id;
  return jsonb_build_object('id', v_s.id, 'gegner', v_s.gegner, 'anstoss', v_s.anstoss, 'status', v_s.status,
                            'toreSva', v_s.live_tore_sva, 'toreGegner', v_s.live_tore_gegner);
end;
$$;

create or replace function public.sva_demo_beenden()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s      public.sm_spiele;
  v_minute integer;
begin
  if not public.is_sm_admin() then
    raise exception 'nicht_erlaubt: Vorführ-Spiel nur für Admins' using errcode = '42501';
  end if;
  select * into v_s from public.sm_spiele s where s.demo for update;
  if v_s.id is null then
    raise exception 'sva_demo_fehlt: Es gibt gerade kein Vorführ-Spiel.' using errcode = 'P0001';
  end if;
  if v_s.status <> 'beendet' then
    v_minute := case
                  when v_s.wiederanpfiff_at is not null then 45 + floor(extract(epoch from (now() - v_s.wiederanpfiff_at)) / 60)::int + 1
                  when v_s.anpfiff_at is not null then floor(extract(epoch from (now() - v_s.anpfiff_at)) / 60)::int + 1
                  else 90 end;
    insert into public.sva_ticker (spiel_id, typ, minute, zeitpunkt)
    values (v_s.id, 'abpfiff', greatest(1, least(130, v_minute)), now());
    select * into v_s from public.sm_spiele s where s.id = v_s.id;
  end if;
  return jsonb_build_object('id', v_s.id, 'status', v_s.status, 'toreSva', v_s.tore_sva, 'toreGegner', v_s.tore_gegner);
end;
$$;

create or replace function public.sva_demo_loeschen()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_n integer;
begin
  if not public.is_sm_admin() then
    raise exception 'nicht_erlaubt: Vorführ-Spiel nur für Admins' using errcode = '42501';
  end if;
  -- Aufstellungen hängen mit „on delete set null“ am Spiel → vorher weg, sonst
  -- würden sie zur „aktuellen“ Aufstellung.
  delete from public.sva_lineup l where l.spiel_id in (select s.id from public.sm_spiele s where s.demo);
  delete from public.sm_spiele s where s.demo;
  get diagnostics v_n = row_count;
  return jsonb_build_object('geloescht', v_n);
end;
$$;

revoke all on function public.sva_demo_starten(text, boolean, boolean) from public, anon;
revoke all on function public.sva_demo_beenden() from public, anon;
revoke all on function public.sva_demo_loeschen() from public, anon;
grant execute on function public.sva_demo_starten(text, boolean, boolean), public.sva_demo_beenden(), public.sva_demo_loeschen()
  to authenticated, service_role;
comment on function public.sva_demo_starten(text, boolean, boolean) is
  'v18-T: Vorführ-Spiel anlegen bzw. zurücksetzen (nur Admin). p_beispiele = Anpfiff vor 24 min + Chance, Tor, Gelb mit echten Spielern.';
comment on function public.sva_demo_beenden() is 'v18-T: Vorführ-Spiel abpfeifen (nur Admin).';
comment on function public.sva_demo_loeschen() is 'v18-T: Vorführ-Spiel samt Ticker löschen (nur Admin).';
