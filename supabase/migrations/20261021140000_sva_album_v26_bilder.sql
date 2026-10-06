-- ─────────────────────────────────────────────────────────────────────────────
-- v26 · Content-RPC — Kabinen-Kult-Karten (aktiv) + Monats-Moment-Pool (inaktiv)
-- Bilder: picture by Nele, auf ≤ 1600px/webp verkleinert (scripts/kult-bilder.mjs).
-- Freigabe der Kabinen-Bilder durch Marvin 06.10. („nimm sie erstmal", niemand
-- verletzt) → aktiv=true, Einverständnis gesetzt, OHNE Spielerzuordnung (roster_id
-- null, typ 'moment'); Namen trägt Marvin später im Admin nach. Nur geprüft scharfe
-- Motive (Laplacian-Varianz + Sichtprüfung, siehe BUILD_LOG_V26).
--
-- Monats-Moment-Pool (Audit I11): inaktiv (aktiv=false) + limitiert → verändert die
-- Album-Ökonomie NICHT; der Admin schaltet je Monat eines frei.
--
-- WICHTIG: wie der Standard-Katalog NICHT beim Migrieren seeden (sonst zählen alle
-- Tests die Karten mit) — der Admin ruft album_admin_kult_standard() einmal auf
-- (Knopf im Backend). Idempotent über bild_url. Nach 20261021110000 (Kult-Spalten).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.album_admin_kult_standard()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_kult integer := 0;
  v_pool integer := 0;
begin
  perform public.sva_album_admin_pruefen();

  -- Kabinen-Kult (aktiv, Serie „Kabinen-Kult")
  insert into public.sva_album_karten
    (typ, titel, seltenheit, limitiert, kult, kollektion, einverstaendnis_at, aktiv, bild_url, bild_fokus, rueckseite, credit, saison, sortierung)
  select 'moment', m.titel, 'bronze', true, true, 'Kabinen-Kult', now(), true, m.bild, '50% 38%', m.txt, 'picture by Nele', v_saison, m.sort
    from (values
      ('Bromance',          '/album/karten/kult/kult-bromance.webp',        'Zwei Mann, ein Pokal, ein Kuss — Bromance seit 2024.', 910),
      ('Der Pokalträger',   '/album/karten/kult/kult-pokaltraeger.webp',     'Wer den Pott trägt, grinst. Immer.', 911),
      ('Der Freudenhaufen', '/album/karten/kult/kult-freudenhaufen.webp',    'Abpfiff, und alle liegen übereinander. Finde den Ball.', 912),
      ('Alle drauf!',       '/album/karten/kult/kult-alle-drauf.webp',       'Einer springt, alle machen mit. Kabinen-Physik.', 913),
      ('Der Krampf',        '/album/karten/kult/kult-der-krampf.webp',       'Liegen bleiben ist auch eine Taktik.', 914),
      ('Der Salto',         '/album/karten/kult/kult-der-salto.webp',        'Ungeplant, aber mit Haltungsnote.', 915),
      ('Trikot hoch',       '/album/karten/kult/kult-trikot-hoch.webp',      'Die Nummer gehört heute allen.', 916),
      ('König der Latte',   '/album/karten/kult/kult-koenig-der-latte.webp', 'Oben sitzt sich''s am besten.', 917),
      ('Psst!',             '/album/karten/kult/kult-psst.webp',             'Wenn die Gästekurve zu laut wird.', 918)
    ) as m(titel, bild, txt, sort)
   where not exists (select 1 from public.sva_album_karten k where k.bild_url = m.bild);
  get diagnostics v_kult = row_count;

  -- Monats-Moment-Pool (inaktiv, limitiert → album-neutral; Admin schaltet monatlich frei)
  insert into public.sva_album_karten
    (typ, titel, seltenheit, limitiert, aktiv, serie, bild_url, bild_fokus, credit, saison, sortierung)
  select 'moment', m.titel, 'gold', true, false, 'Monats-Moment', m.bild, '50% 40%', 'picture by Nele', v_saison, m.sort
    from (values
      ('Monats-Moment: Parade',          '/album/karten/moment-pool/action-01.webp', 950),
      ('Monats-Moment: Faustabwehr',     '/album/karten/moment-pool/action-02.webp', 951),
      ('Monats-Moment: Klärung',         '/album/karten/moment-pool/action-03.webp', 952),
      ('Monats-Moment: Zweikampf',       '/album/karten/moment-pool/action-04.webp', 953),
      ('Monats-Moment: Kopfballduell',   '/album/karten/moment-pool/action-05.webp', 954),
      ('Monats-Moment: Grätsche',        '/album/karten/moment-pool/action-06.webp', 955),
      ('Monats-Moment: Lauf',            '/album/karten/moment-pool/action-07.webp', 956),
      ('Monats-Moment: Flanke',          '/album/karten/moment-pool/action-08.webp', 957),
      ('Monats-Moment: Mannschaftsfoto', '/album/karten/moment-pool/moment-01.webp', 958),
      ('Monats-Moment: Kreis',           '/album/karten/moment-pool/moment-02.webp', 959),
      ('Monats-Moment: Urknall-Banner',  '/album/karten/moment-pool/moment-03.webp', 960),
      ('Monats-Moment: Hochgenommen',    '/album/karten/moment-pool/moment-04.webp', 961),
      ('Monats-Moment: Jubeltraube',     '/album/karten/moment-pool/moment-05.webp', 962),
      ('Monats-Moment: Pokaljubel',      '/album/karten/moment-pool/moment-06.webp', 963),
      ('Monats-Moment: Schwur',          '/album/karten/moment-pool/moment-07.webp', 964),
      ('Monats-Moment: Torjubel',        '/album/karten/moment-pool/moment-08.webp', 965)
    ) as m(titel, bild, sort)
   where not exists (select 1 from public.sva_album_karten k where k.bild_url = m.bild);
  get diagnostics v_pool = row_count;

  return jsonb_build_object('kultNeu', v_kult, 'momentPoolNeu', v_pool,
                            'kultGesamt', (select count(*) from public.sva_album_karten where kult),
                            'momentPool', (select count(*) from public.sva_album_karten where serie = 'Monats-Moment'));
end;
$$;
revoke all on function public.album_admin_kult_standard() from public, anon;
grant execute on function public.album_admin_kult_standard() to authenticated, service_role;
