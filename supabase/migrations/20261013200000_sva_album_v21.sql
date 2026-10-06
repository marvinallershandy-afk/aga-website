-- ─────────────────────────────────────────────────────────────────────────────
-- v21-A: Sammelalbum nach dem ersten echten Test.
--   1. Kurve- und Moment-Karten bekommen eigene, auf das Foto-Fenster der Karte
--      zugeschnittene Fotos (picture by Nele) unter /album/karten/.
--      „Dodos Raum“ (kein Foto zu bekommen) wird zu „Das Urknall-Banner“ —
--      GLEICHE Karten-ID, d. h. wer die Karte schon hat, behält sie.
--   2. Neues Sammelziel „Die Rote Familie“ (Brettschneider, Nauerz, Brünjes).
--
-- Nachziehen in der echten DB (idempotent, ändert keinen Besitz):
--   · Diese Migration ruft am Ende public.sva_album_v21_nachziehen() selbst auf.
--   · Später/erneut als Admin: select public.album_admin_katalog_v21();
--     (bzw. Admin → Album → „Standard-Ziele anlegen“ für die Rote Familie).
-- Eigene Bilder aus dem Admin (bild_url ≠ alter Standardpfad) bleiben unberührt.
-- Nach 20261012110000_sva_karten.sql anwenden.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Interne Nachzieh-Funktion (nur service_role / SECURITY-DEFINER-RPCs) ──
create or replace function public.sva_album_v21_nachziehen()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_umbenannt integer := 0;
  v_bilder integer := 0;
  v_texte integer := 0;
  v_ziel integer := 0;
begin
  -- „Dodos Raum“ → „Das Urknall-Banner“ (nur die Standard-Karte ohne eigenes Bild)
  update public.sva_album_karten k
     set titel = 'Das Urknall-Banner'
   where k.typ = 'fan' and k.titel = 'Dodos Raum' and k.bild_url is null
     and coalesce(k.saison, v_saison) = v_saison
     and not exists (select 1 from public.sva_album_karten x
                      where x.typ = 'fan' and x.titel = 'Das Urknall-Banner' and coalesce(x.saison, v_saison) = v_saison);
  get diagnostics v_umbenannt = row_count;

  -- Neue Bilder: nur wo noch kein Bild oder noch das alte Standardbild steht
  update public.sva_album_karten k
     set bild_url = m.neu, bild_fokus = '50% 50%', credit = coalesce(k.credit, 'picture by Nele')
    from (values
      ('moment', 'Die Meister-Elf',    '/karten/meister-elf.webp',      '/album/karten/meister-elf.webp'),
      ('moment', 'Meister-Shirt',      '/karten/meister-shirt.webp',    '/album/karten/meister-shirt.webp'),
      ('moment', 'Ab in die Kurve',    '/karten/lauf-zu-den-fans.webp', '/album/karten/ab-in-die-kurve.webp'),
      ('moment', 'Die Umarmung',       '/karten/umarmung.webp',         '/album/karten/umarmung.webp'),
      ('moment', 'Der Pokal',          '/karten/pokal.webp',            '/album/karten/pokal.webp'),
      ('moment', 'Siegerfoto',         '/karten/siegerfoto.webp',       '/album/karten/siegerfoto.webp'),
      ('moment', 'Einer fliegt',       '/karten/hochwerfen.webp',       '/album/karten/einer-fliegt.webp'),
      ('moment', 'Die Parade',         '/karten/parade.webp',           '/album/karten/parade.webp'),
      ('fan',    'Die Kurve',          '/karten/kurve.webp',            '/album/karten/kurve.webp'),
      ('fan',    'Die Fahne',          '/karten/fahne.webp',            '/album/karten/fahne.webp'),
      ('fan',    'Das Urknall-Banner', null::text,                      '/album/karten/urknall-banner.webp')
    ) as m(typ, titel, alt, neu)
   where k.typ = m.typ and k.titel = m.titel and not k.limitiert and not k.variante
     and coalesce(k.saison, v_saison) = v_saison
     and (k.bild_url is null or k.bild_url = m.alt);
  get diagnostics v_bilder = row_count;

  -- Rückseiten-Texte der Kurve (nur wenn leer)
  update public.sva_album_karten k
     set rueckseite = m.txt
    from (values
      ('Die Kurve', 'Hinter der Bande am Waldsportplatz: Banner hoch, Arme hoch, jedes Tor gehört auch euch. Die Kurve ist der zwölfte Mann des SVA.'),
      ('Die Fahne', 'Schwarz-Rot über dem Mannschaftskreis. Wenn die Fahne weht, weiß der ganze Platz, wer hier zu Hause ist.'),
      ('Das Urknall-Banner', 'AGA Urknall, est. 2024: das Banner der Kurve. Hängt am Zaun, am Tor, auf jeder Feier — und ist bei jedem Heimspiel dabei.')
    ) as m(titel, txt)
   where k.typ = 'fan' and k.titel = m.titel and k.rueckseite is null and coalesce(k.saison, v_saison) = v_saison;
  get diagnostics v_texte = row_count;

  -- „Die Rote Familie“ — nur wenn die Standard-Ziele schon angelegt sind
  -- (sonst legt album_admin_ziele_standard() sie mit an)
  insert into public.sva_album_ziele (schluessel, typ, vorlage, titel, beschreibung, roster_ids, belohnung_karten,
                                      belohnung_min_seltenheit, belohnung_lose, geheim, wiederholbar, sortierung)
  select 'rote_familie', 'set', 'set', 'Die Rote Familie',
         'Drei Mann, drei Platzverweise – sammle die Rote Familie: Brettschneider, Nauerz und Brünjes.',
         array(select r.id from public.sm_roster r where r.slug in ('p-brettschneider', 'p-nauerz', 'p-bruenjes') order by r.slug),
         1, 'silber', 0, false, false, 14
   where exists (select 1 from public.sva_album_ziele z where z.schluessel = 'familie_sva')
  on conflict (schluessel) do update set roster_ids = excluded.roster_ids;
  get diagnostics v_ziel = row_count;

  return jsonb_build_object('saison', v_saison, 'umbenannt', v_umbenannt, 'bilder', v_bilder,
                            'rueckseiten', v_texte, 'roteFamilie', v_ziel > 0);
end;
$$;

-- ── 2. Admin-RPC zum (erneuten) Nachziehen ──────────────────────────────────
create or replace function public.album_admin_katalog_v21()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_album_admin_pruefen();
  return public.sva_album_v21_nachziehen();
end;
$$;

-- ── 3. Standard-Katalog: neue Bilder, „Das Urknall-Banner“ statt „Dodos Raum“ ─
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

  -- Momente (Fotos: picture by Nele, v21-A: Ausschnitt im Karten-Format)
  insert into public.sva_album_karten (typ, titel, seltenheit, bild_url, bild_fokus, serie, credit, saison, sortierung)
  select m.typ, m.titel, m.selt, m.bild, '50% 50%', m.serie, 'picture by Nele', v_saison, m.sort
    from (values
      ('moment', 'Die Meister-Elf',  'spezial', '/album/karten/meister-elf.webp',     'Meister 2026',       10),
      ('moment', 'Meister-Shirt',    'gold',    '/album/karten/meister-shirt.webp',   'Meister 2026',       11),
      ('moment', 'Ab in die Kurve',  'gold',    '/album/karten/ab-in-die-kurve.webp', 'Meister 2026',       12),
      ('moment', 'Die Umarmung',     'silber',  '/album/karten/umarmung.webp',        'Meister 2026',       13),
      ('moment', 'Der Pokal',        'spezial', '/album/karten/pokal.webp',           'Urknall-Pokal 2026', 20),
      ('moment', 'Siegerfoto',       'gold',    '/album/karten/siegerfoto.webp',      'Urknall-Pokal 2026', 21),
      ('moment', 'Einer fliegt',     'gold',    '/album/karten/einer-fliegt.webp',    'Urknall-Pokal 2026', 22),
      ('moment', 'Die Parade',       'silber',  '/album/karten/parade.webp',          'Urknall-Pokal 2026', 23)
    ) as m(typ, titel, selt, bild, serie, sort)
   where not exists (select 1 from public.sva_album_karten k
                      where k.typ = m.typ and k.titel = m.titel and coalesce(k.saison, v_saison) = v_saison);
  get diagnostics v_mom = row_count;

  -- Kurve: jede Karte mit echtem Foto (v21-A: „Das Urknall-Banner“ statt „Dodos Raum“)
  insert into public.sva_album_karten (typ, titel, seltenheit, bild_url, bild_fokus, credit, rueckseite, saison, sortierung)
  select m.typ, m.titel, m.selt, m.bild, '50% 50%', 'picture by Nele', m.txt, v_saison, m.sort
    from (values
      ('fan', 'Die Kurve',          'silber', '/album/karten/kurve.webp',          10,
       'Hinter der Bande am Waldsportplatz: Banner hoch, Arme hoch, jedes Tor gehört auch euch. Die Kurve ist der zwölfte Mann des SVA.'),
      ('fan', 'Die Fahne',          'bronze', '/album/karten/fahne.webp',          11,
       'Schwarz-Rot über dem Mannschaftskreis. Wenn die Fahne weht, weiß der ganze Platz, wer hier zu Hause ist.'),
      ('fan', 'Das Urknall-Banner', 'silber', '/album/karten/urknall-banner.webp', 12,
       'AGA Urknall, est. 2024: das Banner der Kurve. Hängt am Zaun, am Tor, auf jeder Feier — und ist bei jedem Heimspiel dabei.')
    ) as m(typ, titel, selt, bild, sort, txt)
   where not exists (select 1 from public.sva_album_karten k
                      where k.typ = m.typ and coalesce(k.saison, v_saison) = v_saison
                        and (k.titel = m.titel or (m.titel = 'Das Urknall-Banner' and k.titel = 'Dodos Raum')));
  get diagnostics v_kurve = row_count;

  -- Partnerkarte je aktivem Sponsor (Bronze — Partner sollen früh im Album kleben)
  insert into public.sva_album_karten (typ, sponsor_id, titel, seltenheit, saison, sortierung)
  select 'partner', sp.id, left(btrim(sp.name), 60), 'bronze', v_saison, sp.sortierung
    from public.sm_sponsoren sp
   where sp.aktiv and char_length(btrim(sp.name)) >= 2
     and not exists (select 1 from public.sva_album_karten k
                      where k.typ = 'partner' and coalesce(k.saison, v_saison) = v_saison
                        and (k.sponsor_id = sp.id or k.titel = left(btrim(sp.name), 60)));
  get diagnostics v_partner = row_count;

  -- Bestand aus v20 (alte Pfade, „Dodos Raum“) gleich mitziehen
  perform public.sva_album_v21_nachziehen();

  select count(*) into v_n from public.sva_album_plaetze(null);
  return jsonb_build_object('saison', v_saison, 'spielerBasis', v_basis, 'varianten', v_var, 'trainer', v_stab,
                            'momente', v_mom, 'kurve', v_kurve, 'partner', v_partner, 'albumPlaetze', v_n);
end;
$$;

-- ── 4. Standard-Ziele: + „Die Rote Familie“ ──────────────────────────────────
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
    ('rote_familie', 'set', 'set', 'Die Rote Familie',
      'Drei Mann, drei Platzverweise – sammle die Rote Familie: Brettschneider, Nauerz und Brünjes.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-brettschneider', 'p-nauerz', 'p-bruenjes') order by r.slug),
      null, null, 1, 'silber', 0, false, false, 14),
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

-- ── 5. Rechte ────────────────────────────────────────────────────────────────
revoke all on function public.sva_album_v21_nachziehen() from public, anon, authenticated;
grant execute on function public.sva_album_v21_nachziehen() to service_role;
revoke all on function public.album_admin_katalog_v21() from public, anon;
grant execute on function public.album_admin_katalog_v21() to authenticated, service_role;
revoke all on function public.album_admin_katalog_standard() from public, anon;
grant execute on function public.album_admin_katalog_standard() to authenticated, service_role;
revoke all on function public.album_admin_ziele_standard() from public, anon;
grant execute on function public.album_admin_ziele_standard() to authenticated, service_role;

-- ── 6. Bestand der echten DB sofort nachziehen (idempotent) ──────────────────
select public.sva_album_v21_nachziehen();
