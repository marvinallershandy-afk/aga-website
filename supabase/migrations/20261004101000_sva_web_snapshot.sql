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
