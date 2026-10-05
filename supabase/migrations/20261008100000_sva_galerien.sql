-- ─────────────────────────────────────────────────────────────────────────────
-- v17-D „Spieltag in Bildern“: Galerien der offiziellen Vereinsfotografin
-- (picture by Nele) — gepflegt im Admin unter „Galerien“, öffentlich auf der
-- Karte (Fans-Panel) und unter /galerie.
--
-- Was diese Migration tut (alles ADDITIV, nur eigene sva_*-Objekte):
--   1. sva_galerien: Titel, Untertitel, Datum, optional Spiel (sm_spiele),
--      Fotograf + Link, veröffentlicht ja/nein, Sortierung, Slug (URL).
--   2. sva_galerie_bilder: Pfad (Storage sva_public, Ordner galerien/…) +
--      Vorschau-Pfad, Breite/Höhe, Reihenfolge, Alt-Text, Titelbild (max.
--      eins je Galerie). Bilder werden im Browser verkleinert (2000 px +
--      800 px Vorschau, WebP) — der Bucket sva_public (5 MB, image/webp|png|
--      jpeg, Schreiben nur Admin) aus 20261004100000 reicht dafür.
--   3. RLS: Lesen/Schreiben nur Admin (is_sm_admin()). Öffentlich NUR über
--      web_snapshot().galerien (veröffentlichte Galerien mit ≥ 1 Bild).
--   4. web_snapshot(): komplett neu angelegt = Stand aus
--      20261007100000_sva_album.sql (inkl. partner aus 20261006100000 und
--      Album-Check-ins in partner.mediadaten) + Feld „galerien“. Der
--      Check-in-Block ist jetzt gegen fehlende Album-Tabellen abgesichert.
--
-- NICHT automatisch anwenden — Reihenfolge: nach 20261007100000_sva_album.sql.
-- Idempotent formuliert. Lokal gegen PGlite mit Supabase-Stubs getestet:
-- supabase/tests/galerien.test.mjs (prüft auch, dass kein bestehendes Feld
-- von web_snapshot() verloren geht).
-- ACHTUNG beim Mergen paralleler Stränge: wer web_snapshot() ebenfalls neu
-- anlegt, muss den Galerien-Block übernehmen.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Galerien ──────────────────────────────────────────────────────────────
create table if not exists public.sva_galerien (
  id uuid primary key default gen_random_uuid(),
  slug text not null check (slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  titel text not null check (char_length(btrim(titel)) between 2 and 120),
  untertitel text check (untertitel is null or char_length(untertitel) <= 200),
  datum date,
  spiel_id uuid references public.sm_spiele(id) on delete set null,
  fotograf text not null default 'picture by Nele' check (char_length(btrim(fotograf)) between 2 and 80),
  fotograf_url text check (fotograf_url is null or (char_length(fotograf_url) <= 300 and fotograf_url ~ '^https://[^[:space:]]+$')),
  veroeffentlicht boolean not null default false,
  sortierung integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sva_galerien is
  'v17-D Galerien „Spieltag in Bildern“ (Admin → Galerien). Öffentlich nur über web_snapshot().galerien.';
create unique index if not exists sva_galerien_slug_key on public.sva_galerien (slug);
create index if not exists sva_galerien_datum_idx on public.sva_galerien (datum desc, sortierung);
alter table public.sva_galerien enable row level security;

-- ── 2. Bilder ────────────────────────────────────────────────────────────────
create table if not exists public.sva_galerie_bilder (
  id uuid primary key default gen_random_uuid(),
  galerie_id uuid not null references public.sva_galerien(id) on delete cascade,
  -- Storage-Pfad in sva_public (z. B. galerien/<slug>/01-abc.webp) oder volle https-URL
  pfad text not null check (char_length(pfad) between 3 and 400),
  vorschau_pfad text check (vorschau_pfad is null or char_length(vorschau_pfad) between 3 and 400),
  breite integer check (breite is null or breite between 1 and 10000),
  hoehe integer check (hoehe is null or hoehe between 1 and 10000),
  reihenfolge integer not null default 0,
  alt_text text check (alt_text is null or char_length(alt_text) <= 300),
  titelbild boolean not null default false,
  created_at timestamptz not null default now()
);
comment on table public.sva_galerie_bilder is 'v17-D Bilder einer Galerie (Reihenfolge, Alt-Text, Titelbild).';
create index if not exists sva_galerie_bilder_galerie_idx on public.sva_galerie_bilder (galerie_id, reihenfolge);
-- höchstens EIN Titelbild je Galerie
create unique index if not exists sva_galerie_bilder_titelbild_key
  on public.sva_galerie_bilder (galerie_id) where titelbild;
alter table public.sva_galerie_bilder enable row level security;

-- ── 3. RLS: alles nur Admin ─────────────────────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['sva_galerien', 'sva_galerie_bilder'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_sm_admin()) with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_sm_admin())', t);
  end loop;
end $$;
grant select, insert, update, delete on public.sva_galerien, public.sva_galerie_bilder to authenticated;

-- ── 4. web_snapshot(): + galerien ───────────────────────────────────────────
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
            join public.sm_spiele s on s.id = c.spiel_id and s.heim
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
                                 from public.sm_spiele s where s.id = ga.spiel_id),
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
  'Öffentliche Lese-Schicht der Website (Build-Fetch, anon). v17-D: + galerien.';
