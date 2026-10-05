-- ─────────────────────────────────────────────────────────────────────────────
-- v19-K (Audit B §2.2): „Was dich am Platz erwartet" — ein optionales, im Admin
-- (Verein & Links) gepflegtes Freitext-Feld, das im Spieltag-Panel und auf
-- /live vor Heimspielen erscheint (Grill, Eintritt, Parken, Kinder …).
--
-- Was diese Migration tut (ADDITIV, nur eigene sva_*-Objekte):
--   1. sva_settings.am_platz (text, optional). Leer/NULL = Block unsichtbar.
--   2. web_snapshot() — Stand 20261010100000_sva_demo_spiel.sql (Demo-Filter
--      unverändert übernommen!), NUR ergänzt um ein Feld in `settings`:
--        'amPlatz' = sva_settings.am_platz (über jsonb_strip_nulls — ist das
--        Feld leer, taucht der Schlüssel NICHT auf → Ausgabe Feld-für-Feld
--        identisch zur bisherigen, solange am_platz nicht gepflegt ist; darum
--        bleiben supabase/tests/demo.test.mjs & Co. grün).
--
-- Der Mini-Spielplan (nächste 3–5 Spiele mit H/A) kommt NICHT aus web_snapshot,
-- sondern beim Build aus web_kalender(true) (scripts/fetch-content.mjs) — das
-- hält die web_snapshot-Ausgabe stabil (keine neuen Top-Level-Schlüssel).
--
-- ACHTUNG beim Mergen: wer web_snapshot() später neu anlegt, MUSS die
-- Demo-Filter (Suchwort „demo") UND dieses amPlatz-Feld übernehmen.
-- NICHT automatisch anwenden — Reihenfolge: nach 20261010100000_sva_demo_spiel.sql.
-- Idempotent (mehrfaches Anwenden schadet nicht).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Feld ─────────────────────────────────────────────────────────────────
alter table public.sva_settings add column if not exists am_platz text;
comment on column public.sva_settings.am_platz is
  'v19-K: „Was dich am Platz erwartet" (Grill/Eintritt/Parken/Kinder). Freitext, optional. Leer = Block unsichtbar.';

-- ── 2. web_snapshot(): Rumpf = 20261010100000_sva_demo_spiel.sql, nur
--      um settings.amPlatz ergänzt (Demo-Filter identisch übernommen). ──────────
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

  -- ── Verein & Links (v15-L: + trainingOrt, Widget-IDs; v19-K: + amPlatz) ─────
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
           'amPlatz',                 nullif(btrim(coalesce(st.am_platz, '')), ''),
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
  'Öffentliche Lese-Schicht der Website (Build-Fetch, anon). v17-D: + galerien. v18-T: ohne Vorführ-Spiele. v19-K: settings.amPlatz.';
