-- ─────────────────────────────────────────────────────────────────────────────
-- v26 · Paket Z1 — Ziel-Maschine (bestand/woche/monat), Katalog, Tipp-Hooks
-- Setzt auf dem v24/v25-Endstand auf (album_checkin_kern, sva_album_pack_typen,
-- _sva_tipp_werten_kern). Alle Funktionen per create-or-replace auf Basis der
-- jeweils NEUESTEN Fassung (R1/R6 der Spec). Additiv + idempotent.
--
-- Enthält den Pflicht-Hotfix §0.4: _sva_tipp_werten_kern löste bisher das Album-
-- Ziel 'kapitaen_trifft' aus, der Katalog kennt aber 'tipp_kapitaen_trifft' →
-- „Kapitän trifft“ wurde nie vergeben. Hier auf den richtigen Schlüssel gefasst.
--
-- Scope-Entscheidung (Marvin 06.10.): Ziel 'auswaertsfahrt' wird NICHT gebaut
-- (kein Katalog-Eintrag, kein heim=false-Trigger). Set 'pejas_kollektion' legt
-- V26-K an (braucht die Kult-Spalten). Standard-Katalog nach Z1 = 68 Ziele,
-- nach V26-K = 69. Die Migration ist die einzige Quelle der Wahrheit.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Schema: Ziel-Spalten + Constraints ───────────────────────────────────
alter table public.sva_album_ziele
  add column if not exists kategorie text,
  add column if not exists hinweis text,
  add column if not exists bedingung jsonb,
  add column if not exists belohnung_kult integer not null default 0;

do $$
begin
  -- Kategorie-Check (Filter im UI)
  if not exists (select 1 from pg_constraint where conname = 'sva_album_ziele_kategorie_chk') then
    alter table public.sva_album_ziele add constraint sva_album_ziele_kategorie_chk
      check (kategorie is null or kategorie in
        ('start','platz','woche','monat','sammeln','sets','tipp','sozial','geheim'));
  end if;
  -- Hinweis-Länge (Rätselzeile der ???-Kachel)
  if not exists (select 1 from pg_constraint where conname = 'sva_album_ziele_hinweis_chk') then
    alter table public.sva_album_ziele add constraint sva_album_ziele_hinweis_chk
      check (hinweis is null or char_length(hinweis) <= 120);
  end if;
  -- Belohnung Kult-Karten 0..2
  if not exists (select 1 from pg_constraint where conname = 'sva_album_ziele_kult_chk') then
    alter table public.sva_album_ziele add constraint sva_album_ziele_kult_chk
      check (belohnung_kult between 0 and 2);
  end if;
  -- bedingung nur mit erlaubten was-Werten (typ='bestand'/'woche'/'monat')
  if not exists (select 1 from pg_constraint where conname = 'sva_album_ziele_bedingung_chk') then
    alter table public.sva_album_ziele add constraint sva_album_ziele_bedingung_chk
      check (bedingung is null or (
        jsonb_typeof(bedingung) = 'object' and (bedingung ->> 'was') in
          ('karten','seltenheit','glanz','limitiert','motm','doppelte','pack_art',
           'checkins','kult','geheimkarten','code','advent','woche_tipp','woche_voll','monat_aktiv')));
  end if;
end $$;

-- Typ-Check um bestand/woche/monat erweitern
alter table public.sva_album_ziele drop constraint if exists sva_album_ziele_typ_check;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_album_ziele_typ_chk') then
    alter table public.sva_album_ziele add constraint sva_album_ziele_typ_chk
      check (typ in ('set','kapitel','meilenstein','serie_checkin','serie_tipp',
                     'sozial_tausch','sozial_freund','extern','bestand','woche','monat'));
  end if;
end $$;

-- Wiederholbar: extern + woche + monat erlaubt
alter table public.sva_album_ziele drop constraint if exists sva_album_ziele_wiederholbar;
alter table public.sva_album_ziele add constraint sva_album_ziele_wiederholbar
  check (not wiederholbar or typ in ('extern','woche','monat'));

comment on column public.sva_album_ziele.kategorie is 'v26: UI-Filter (start/platz/woche/monat/sammeln/sets/tipp/sozial/geheim). Kapitel/Meilenstein → sammeln.';
comment on column public.sva_album_ziele.bedingung is 'v26: nur typ bestand/woche/monat. {"was":...,"n":...}.';
comment on column public.sva_album_ziele.hinweis is 'v26: Rätselzeile der ???-Kachel (geheime offene Ziele). Nie Schlüssel/Bedingung an den Client.';

-- ── 2. Prüf-Logik: sva_album_ziel_stand (+ bestand/woche/monat) ──────────────
create or replace function public.sva_album_ziel_stand(p_fan uuid, p_ziel uuid, out fortschritt integer, out benoetigt integer)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  z public.sva_album_ziele;
  v_saison text := public.sva_album_saison();
  v_total integer := 0;
  v_hat integer := 0;
  v_n integer := 0;
  v_w date;
  v_vor integer;
  v_was text;
  v_pstart timestamp;
  v_pend timestamp;
  v_tipp boolean;
  v_elf boolean;
  v_pack boolean;
  r record;
begin
  fortschritt := 0;
  benoetigt := 0;
  select * into z from public.sva_album_ziele where id = p_ziel;
  if z.id is null then
    return;
  end if;

  if z.typ = 'set' then
    with menge as (
      select k.id as kid, null::uuid as rid
        from public.sva_album_karten k
       where k.id = any (coalesce(z.karten, '{}')) and k.aktiv and (k.saison is null or k.saison = v_saison)
      union
      select null::uuid, x.rid from unnest(coalesce(z.roster_ids, '{}')) as x(rid)
       where exists (select 1 from public.sva_album_karten k
                      where k.roster_id = x.rid and k.typ in ('spieler', 'trainer') and k.aktiv
                        and not k.variante and not k.limitiert and (k.saison is null or k.saison = v_saison))
    )
    select count(*)::int,
           count(*) filter (where
             (m.kid is not null and exists (select 1 from public.sva_album_besitz b where b.fan_user_id = p_fan and b.karte_id = m.kid))
             or (m.rid is not null and exists (
                   select 1 from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
                    where b.fan_user_id = p_fan and k.roster_id = m.rid and k.typ in ('spieler', 'trainer')
                      and not k.variante and not k.limitiert and (k.saison is null or k.saison = v_saison))))::int
      into v_total, v_hat
      from menge m;
    benoetigt := least(v_total, coalesce(z.anzahl, v_total));
    fortschritt := least(v_hat, benoetigt);

  elsif z.typ in ('kapitel', 'meilenstein') then
    select count(*)::int, count(*) filter (where p.belegt)::int into v_total, v_hat
      from public.sva_album_plaetze(p_fan) p
     where z.typ = 'meilenstein' or p.kapitel = z.kapitel;
    if z.typ = 'kapitel' then
      benoetigt := v_total;
    else
      benoetigt := case when v_total = 0 then 0
                        else ceil(v_total * least(100, coalesce(z.anzahl, 100)) / 100.0)::int end;
    end if;
    fortschritt := least(v_hat, benoetigt);

  elsif z.typ = 'serie_checkin' then
    benoetigt := coalesce(z.anzahl, 3);
    select e.fenster_vor_min into v_vor from public.sva_album_einstellungen e where e.id = 1;
    for r in
      select exists (select 1 from public.sva_album_checkins c where c.spiel_id = s.id and c.fan_user_id = p_fan) as da
        from public.sm_spiele s
        join public.sva_album_spielcodes sc on sc.spiel_id = s.id
       where s.heim and not coalesce(s.demo, false)
         and s.anstoss - make_interval(mins => coalesce(v_vor, 60)) <= now()
       order by s.anstoss desc
       limit 60
    loop
      exit when not r.da;
      v_n := v_n + 1;
    end loop;
    fortschritt := least(v_n, benoetigt);

  elsif z.typ = 'serie_tipp' then
    benoetigt := coalesce(z.anzahl, 4);
    v_w := date_trunc('week', now() at time zone 'Europe/Berlin')::date;
    if not exists (select 1 from public.sva_album_packs p where p.fan_user_id = p_fan and p.art = 'tipp'
                     and (p.created_at at time zone 'Europe/Berlin')::date >= v_w
                     and (p.created_at at time zone 'Europe/Berlin')::date < v_w + 7) then
      v_w := v_w - 7;
    end if;
    while v_n < 60 and exists (select 1 from public.sva_album_packs p where p.fan_user_id = p_fan and p.art = 'tipp'
                                  and (p.created_at at time zone 'Europe/Berlin')::date >= v_w
                                  and (p.created_at at time zone 'Europe/Berlin')::date < v_w + 7) loop
      v_n := v_n + 1;
      v_w := v_w - 7;
    end loop;
    fortschritt := least(v_n, benoetigt);

  elsif z.typ = 'sozial_tausch' then
    benoetigt := coalesce(z.anzahl, 1);
    select count(*)::int into v_n from public.sva_album_tausch t
     where (t.von_fan = p_fan or t.an_fan = p_fan) and t.status = 'erledigt';
    fortschritt := least(v_n, benoetigt);

  elsif z.typ = 'sozial_freund' then
    benoetigt := coalesce(z.anzahl, 1);
    select count(*)::int into v_n from public.sva_album_freunde f where f.fan_a = p_fan or f.fan_b = p_fan;
    fortschritt := least(v_n, benoetigt);

  elsif z.typ = 'bestand' then
    -- generische Besitz-/Aktivitäts-Zählung über bedingung
    benoetigt := greatest(1, coalesce((z.bedingung ->> 'n')::int, 1));
    v_was := coalesce(z.bedingung ->> 'was', '');
    if v_was = 'karten' then
      select coalesce(sum(b.anzahl), 0)::int into v_n from public.sva_album_besitz b where b.fan_user_id = p_fan;
    elsif v_was = 'doppelte' then
      select coalesce(sum(b.anzahl - 1), 0)::int into v_n from public.sva_album_besitz b where b.fan_user_id = p_fan and b.anzahl > 1;
    elsif v_was = 'seltenheit' then
      select count(*)::int into v_n from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
       where b.fan_user_id = p_fan and k.seltenheit = (z.bedingung ->> 'stufe');
    elsif v_was = 'glanz' then
      select count(*)::int into v_n from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
       where b.fan_user_id = p_fan and k.variante;
    elsif v_was = 'limitiert' then
      -- Kult-Karten sind zwar limitiert, werden aber in V26-K ausgenommen (dort neu gefasst)
      select count(*)::int into v_n from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
       where b.fan_user_id = p_fan and k.limitiert;
    elsif v_was = 'motm' then
      select count(*)::int into v_n from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
       where b.fan_user_id = p_fan and k.limitiert and k.motm_spiel_id is not null;
    elsif v_was = 'geheimkarten' then
      select count(*)::int into v_n from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
       where b.fan_user_id = p_fan and coalesce(k.geheim, false);
    elsif v_was = 'checkins' then
      select count(*)::int into v_n from public.sva_album_checkins c where c.fan_user_id = p_fan and c.saison = v_saison;
    elsif v_was = 'pack_art' then
      select count(*)::int into v_n from public.sva_album_packs p where p.fan_user_id = p_fan and p.art = (z.bedingung ->> 'art');
    elsif v_was = 'advent' then
      select count(distinct c.advent_tag)::int into v_n
        from public.sva_album_code_einloesungen ce
        join public.sva_album_codes c on c.id = ce.code_id
       where ce.fan_user_id = p_fan and c.art = 'advent';
    elsif v_was = 'code' then
      select count(*)::int into v_n from public.sva_album_code_einloesungen ce where ce.fan_user_id = p_fan;
    else
      v_n := 0;
    end if;
    fortschritt := least(v_n, benoetigt);

  elsif z.typ in ('woche', 'monat') then
    benoetigt := 1;
    if z.typ = 'woche' then
      v_pstart := date_trunc('week', now() at time zone 'Europe/Berlin');
      v_pend := v_pstart + interval '7 days';
    else
      v_pstart := date_trunc('month', now() at time zone 'Europe/Berlin');
      v_pend := v_pstart + interval '1 month';
    end if;
    v_was := coalesce(z.bedingung ->> 'was', '');
    v_tipp := exists (select 1 from public.sva_album_packs p where p.fan_user_id = p_fan and p.art = 'tipp'
                        and (p.created_at at time zone 'Europe/Berlin') >= v_pstart
                        and (p.created_at at time zone 'Europe/Berlin') < v_pend);
    v_pack := exists (select 1 from public.sva_album_packs p where p.fan_user_id = p_fan and p.geoeffnet_at is not null
                        and (p.geoeffnet_at at time zone 'Europe/Berlin') >= v_pstart
                        and (p.geoeffnet_at at time zone 'Europe/Berlin') < v_pend);
    v_elf := false;
    if to_regclass('public.sva_tipp_elf') is not null then
      select exists (select 1 from public.sva_tipp_elf e where e.user_id = p_fan
                       and (e.created_at at time zone 'Europe/Berlin') >= v_pstart
                       and (e.created_at at time zone 'Europe/Berlin') < v_pend) into v_elf;
    end if;
    if v_was = 'woche_tipp' then
      fortschritt := case when v_tipp then 1 else 0 end;
    elsif v_was = 'woche_voll' then
      fortschritt := case when v_tipp and v_elf then 1 else 0 end;
    elsif v_was = 'monat_aktiv' then
      fortschritt := case when v_pack and v_tipp then 1 else 0 end;
    else
      fortschritt := 0;
    end if;

  else -- extern: Fortschritt = wie oft erreicht (Saison)
    select count(*)::int into v_n from public.sva_album_ziel_erreicht e
     where e.ziel_id = z.id and e.fan_user_id = p_fan and e.saison = v_saison;
    fortschritt := v_n;
    benoetigt := case when z.wiederholbar then null else 1 end;
  end if;
end;
$$;

-- ── 3. Prüf-Logik: sva_album_ziele_pruefen (Perioden-Bezug für woche/monat) ──
create or replace function public.sva_album_ziele_pruefen(p_fan uuid, p_typen text[])
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  z public.sva_album_ziele;
  v_st record;
  v_r jsonb;
  v_bezug text;
  v_out jsonb := '[]'::jsonb;
begin
  if not exists (select 1 from public.sva_album_fans f where f.user_id = p_fan) then
    return v_out;
  end if;
  for z in
    select * from public.sva_album_ziele zz
     where zz.aktiv and zz.typ = any (p_typen) and zz.typ <> 'extern'
       and (zz.saison is null or zz.saison = v_saison)
       and (zz.gueltig_von is null or zz.gueltig_von <= now())
       and (zz.gueltig_bis is null or zz.gueltig_bis > now())
     order by zz.sortierung, zz.titel
  loop
    -- Periodenbezug: woche/monat je laufender Periode, sonst Saison
    if z.typ = 'woche' then
      v_bezug := 'woche:' || to_char(now() at time zone 'Europe/Berlin', 'IYYY"-W"IW');
    elsif z.typ = 'monat' then
      v_bezug := 'monat:' || to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM');
    else
      v_bezug := v_saison;
    end if;
    continue when exists (select 1 from public.sva_album_ziel_erreicht e
                           where e.ziel_id = z.id and e.fan_user_id = p_fan and e.bezug = v_bezug);
    select * into v_st from public.sva_album_ziel_stand(p_fan, z.id);
    if v_st.benoetigt > 0 and v_st.fortschritt >= v_st.benoetigt then
      v_r := public.sva_album_ziel_vergeben(p_fan, z.id, v_bezug);
      if v_r is not null then
        v_out := v_out || v_r;
      end if;
    end if;
  end loop;
  return v_out;
end;
$$;

-- ── 4. Aufrufstellen: Pack öffnen (+ bestand/woche/monat + shiny_fund) ───────
-- sva_album_pack_oeffnen_v22 ist die Kernfassung (v24 ruft sie). Neu gefasst:
-- erweiterter Typen-Satz bei nach_besitz + Extern-Ziel 'shiny_fund' beim ersten Shiny.
create or replace function public.sva_album_pack_oeffnen_v22(p_pack uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := public.sva_album_uid();
  v_p    public.sva_album_packs;
  v_neu  boolean[] := '{}';
  v_k    uuid;
  v_war  boolean;
  v_i    integer;
  v_kk   public.sva_album_karten;
  v_shiny_neu boolean := false;
  v_nach jsonb := jsonb_build_object('gutscheine', '[]'::jsonb, 'kapitel', '[]'::jsonb, 'ziele', '[]'::jsonb);
begin
  select * into v_p from public.sva_album_packs p where p.id = p_pack and p.fan_user_id = v_uid for update;
  if v_p.id is null then
    raise exception 'album_pack_unbekannt' using errcode = 'P0001';
  end if;

  if v_p.geoeffnet_at is null then
    foreach v_k in array v_p.karten loop
      if not exists (select 1 from public.sva_album_karten k where k.id = v_k) then
        v_neu := v_neu || false;
        continue;
      end if;
      select exists (select 1 from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = v_k) into v_war;
      insert into public.sva_album_besitz (fan_user_id, karte_id, anzahl)
      values (v_uid, v_k, 1)
      on conflict (fan_user_id, karte_id) do update
         set anzahl = public.sva_album_besitz.anzahl + 1, zuletzt_at = now();
      v_neu := v_neu || (not v_war);
    end loop;
    -- v22: Shiny obendrauf (Vitrine + Erstfund)
    for v_i in 1 .. coalesce(cardinality(v_p.karten), 0) loop
      continue when not coalesce(v_p.shiny[v_i], false);
      select * into v_kk from public.sva_album_karten k where k.id = v_p.karten[v_i];
      continue when v_kk.id is null or v_kk.roster_id is null;
      insert into public.sva_album_shiny (fan_user_id, roster_id, saison, karte_id, anzahl, pack_id)
      values (v_uid, v_kk.roster_id, v_p.saison, v_kk.id, 1, v_p.id)
      on conflict (fan_user_id, roster_id, saison) do update
         set anzahl = public.sva_album_shiny.anzahl + 1, zuletzt_at = now();
      insert into public.sva_album_shiny_erstfund (roster_id, saison, fan_user_id, name, karte_id)
      values (v_kk.roster_id, v_p.saison, v_uid, coalesce(public.sva_album_name(v_uid), 'Ein SVA-Fan'), v_kk.id)
      on conflict (roster_id, saison) do nothing;
      v_shiny_neu := true;
    end loop;
    update public.sva_album_packs set geoeffnet_at = now(), neu = v_neu where id = v_p.id;
    v_p.neu := v_neu;
    -- v26: periodische + bestand-Ziele mitprüfen
    v_nach := public.sva_album_nach_besitz(v_uid, array['set', 'kapitel', 'meilenstein', 'bestand', 'woche', 'monat']);
    -- v26: Ziel „Sternenstaub“ beim ersten Shiny
    if v_shiny_neu then
      perform public.sva_album_ziel_extern(v_uid, 'shiny_fund', v_p.id::text);
    end if;
  end if;

  return jsonb_build_object(
    'id', v_p.id,
    'art', v_p.art,
    'titel', v_p.titel,
    'gegner', (select s.gegner from public.sm_spiele s where s.id = v_p.spiel_id),
    'karten', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'karteId', x.k,
               'seltenheit', coalesce(v_p.seltenheiten[x.i], 'bronze'),
               'neu', coalesce(v_p.neu[x.i], false),
               'anzahl', coalesce((select b.anzahl from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = x.k), 0),
               'variante', kk.variante,
               'limitiert', kk.limitiert,
               'geheim', case when kk.geheim then true end,
               'shiny', coalesce(v_p.shiny[x.i], false),
               'erstfund', case when coalesce(v_p.shiny[x.i], false) then (
                             select jsonb_build_object('name', e.name, 'at', e.at, 'ich', e.fan_user_id is not distinct from v_uid)
                               from public.sva_album_shiny_erstfund e where e.roster_id = kk.roster_id and e.saison = v_p.saison) end,
               'karte', case when kk.geheim then public.sva_album_karte_json(kk.id) end
             )) order by x.i)
        from unnest(v_p.karten) with ordinality as x(k, i)
        join public.sva_album_karten kk on kk.id = x.k), '[]'::jsonb),
    'gutscheine', v_nach -> 'gutscheine',
    'kapitel', v_nach -> 'kapitel',
    'ziele', v_nach -> 'ziele'
  );
end;
$$;

-- ── 5. Aufrufstelle: Check-in-Kern (+ bestand + fruehaufsteher) ──────────────
-- album_checkin_kern ist seit v25-D die interne Logik (Wrapper album_checkin
-- prüft Rotation). Hier neu gefasst. Rechte bleiben (create or replace erhält sie).
create or replace function public.album_checkin_kern(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid    uuid := public.sva_album_uid();
  v_saison text := public.sva_album_saison();
  v_token  text := lower(btrim(coalesce(p_token, '')));
  v_e      public.sva_album_einstellungen;
  v_code   public.sva_album_spielcodes;
  v_s      public.sm_spiele;
  v_start  timestamptz;
  v_ende   timestamptz;
  v_id     uuid;
  v_pack   uuid;
  v_bonus  uuid;
  v_fpack  uuid;
  v_mich   boolean := false;
  v_freunde jsonb := '[]'::jsonb;
  v_fr     record;
  v_ziele  jsonb;
  v_r      jsonb;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  if not coalesce(v_e.aktiv, true) then
    raise exception 'album_pausiert' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    raise exception 'album_kein_profil' using errcode = 'P0001';
  end if;
  if v_token !~ '^[a-z0-9]{16,64}$' then
    raise exception 'album_code_unbekannt' using errcode = 'P0001';
  end if;
  select * into v_code from public.sva_album_spielcodes c where c.token = v_token;
  if v_code.spiel_id is null then
    raise exception 'album_code_unbekannt' using errcode = 'P0001';
  end if;
  select * into v_s from public.sm_spiele s where s.id = v_code.spiel_id;
  if v_s.id is null or not v_s.heim then
    raise exception 'album_code_unbekannt' using errcode = 'P0001';
  end if;

  select f.p_start, f.p_ende into v_start, v_ende from public.sva_album_fenster(v_s.id) f;
  if now() < v_start then
    raise exception 'album_code_zu_frueh|%', to_char(v_start at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"') using errcode = 'P0001';
  end if;
  if now() > v_ende then
    raise exception 'album_code_abgelaufen' using errcode = 'P0001';
  end if;

  insert into public.sva_album_checkins (fan_user_id, spiel_id, saison)
  values (v_uid, v_s.id, v_saison)
  on conflict on constraint sva_album_checkins_einmal do nothing
  returning id into v_id;
  if v_id is null then
    raise exception 'album_schon_eingecheckt' using errcode = 'P0001';
  end if;

  v_pack := public.sva_album_pack_ziehen(v_uid, v_s.id, 'checkin');
  if coalesce(v_e.bonus_heimsieg, true) and v_s.tore_sva is not null and v_s.tore_gegner is not null
     and v_s.tore_sva > v_s.tore_gegner then
    v_bonus := public.sva_album_pack_ziehen(v_uid, v_s.id, 'heimsieg');
  end if;

  for v_fr in
    select x.fid from (
      select case when fr.fan_a = v_uid then fr.fan_b else fr.fan_a end as fid, fr.at
        from public.sva_album_freunde fr where fr.fan_a = v_uid or fr.fan_b = v_uid) x
     where exists (select 1 from public.sva_album_checkins c where c.spiel_id = v_s.id and c.fan_user_id = x.fid)
     order by x.at
  loop
    v_freunde := v_freunde || to_jsonb(public.sva_album_name(v_fr.fid));
    if not v_mich then
      v_fpack := public.sva_album_pack_ziehen(v_uid, v_s.id, 'freund');
      v_mich := true;
    end if;
    perform public.sva_album_pack_ziehen(v_fr.fid, v_s.id, 'freund');
  end loop;

  perform public.sva_album_lose_buchen(v_uid, v_e.lose_checkin, 'checkin', v_s.id::text, v_saison);
  -- v26: Check-in-Serie + bestand-Ziele (erster_checkin, checkin_3/5/8)
  v_ziele := public.sva_album_ziele_pruefen(v_uid, array['serie_checkin', 'bestand']);

  -- geheime Mission „Nachteule“: Flutlichtspiel (Anstoß ab 19 Uhr)
  if extract(hour from v_s.anstoss at time zone 'Europe/Berlin') >= 19 then
    v_r := public.sva_album_ziel_extern(v_uid, 'nachteule', v_s.id::text);
    if coalesce((v_r ->> 'erreicht')::boolean, false) then
      v_ziele := v_ziele || jsonb_build_object('schluessel', 'nachteule', 'titel', v_r ->> 'titel',
                                               'packId', v_r -> 'packId', 'lose', v_r -> 'lose');
    end if;
  end if;
  -- v26: geheime Mission „Der Frühaufsteher“ — Check-in in den ersten 15 min des Fensters
  if now() <= v_start + interval '15 minutes' then
    v_r := public.sva_album_ziel_extern(v_uid, 'fruehaufsteher', v_s.id::text);
    if coalesce((v_r ->> 'erreicht')::boolean, false) then
      v_ziele := v_ziele || jsonb_build_object('schluessel', 'fruehaufsteher', 'titel', v_r ->> 'titel',
                                               'packId', v_r -> 'packId', 'lose', v_r -> 'lose');
    end if;
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'packId', v_pack,
    'bonusPackId', v_bonus,
    'freundPackId', v_fpack,
    'freunde', v_freunde,
    'spiel', jsonb_build_object('gegner', v_s.gegner, 'anstoss', v_s.anstoss),
    'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                  from public.sm_sponsoren sp where sp.id = v_code.partner_id and sp.aktiv),
    'checkins', (select count(*) from public.sva_album_checkins c where c.fan_user_id = v_uid and c.saison = v_saison),
    'gutscheine', public.sva_album_belohnungen(v_uid),
    'ziele', v_ziele
  ));
end;
$$;

-- ── 6. Aufrufstelle: Tipp-Pack-Gutschrift (+ woche/monat/bestand) ────────────
create or replace function public.album_karte_gutschreiben(p_quelle text, p_bezug uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_pack uuid;
begin
  if p_quelle is distinct from 'tipp' then
    raise exception 'album_quelle_unbekannt' using errcode = 'P0001';
  end if;
  if v_uid is null or p_bezug is null or not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    return null;
  end if;
  v_pack := public.sva_album_pack_ziehen_v24(v_uid, 'tipp', 'tipp', null, null, 'tipp:' || p_bezug::text,
              coalesce((select t.titel from public.sva_album_pack_typen t where t.typ = 'tipp'), 'Tipp-Pack'));
  if v_pack is not null then
    perform public.sva_album_ziele_pruefen(v_uid, array['serie_tipp', 'woche', 'monat', 'bestand']);
  end if;
  return v_pack;
end;
$$;

-- ── 7. Tipp-Hooks + HOTFIX §0.4 (tipp_kapitaen_trifft) ───────────────────────
-- _sva_tipp_werten_kern neu gefasst auf Basis v24 (20261018100000): Fix des
-- Schlüssels + neue Hooks tipp_erster_torschuetze, tipp_bonus_perfekt,
-- tipp_hellseher, elf_aufgestellt. Alles über die fehlertolerante Brücke.
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
  v_aufgeloest integer := 0;
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
  -- Anzahl aufgelöster Bonusfragen (für „Dreimal richtig“)
  select count(*)::int into v_aufgeloest
    from unnest(coalesce(v_fragen, '{}'::text[])) k
   where coalesce(v_t.aufloesung ->> k, '') <> '';
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

  -- ── Album-Missionen (idempotent in der Brücke/Ziel-Vergabe) ──────────────
  -- Exakt getippt
  perform public.sva_tipp_album_ziel('tipp_exakt', p_spiel, p.user_id)
     from public.sva_tipp_punkte p where p.spiel_id = p_spiel and p.exakt;
  -- HOTFIX §0.4: korrekter Schlüssel 'tipp_kapitaen_trifft' (vorher 'kapitaen_trifft' → nie vergeben)
  perform public.sva_tipp_album_ziel('tipp_kapitaen_trifft', p_spiel, e.user_id)
     from public.sva_tipp_elf e
     join public.sva_tipp_bericht kb on kb.spiel_id = e.spiel_id and kb.roster_id = e.kapitaen and kb.eingesetzt and kb.tore > 0
    where e.spiel_id = p_spiel;
  -- Spieltagssieg (beste Punktzahl)
  perform public.sva_tipp_album_ziel('tipp_spieltagssieg', p_spiel, p.user_id)
     from public.sva_tipp_punkte p
    where p.spiel_id = p_spiel and p.gesamt > 0
      and p.gesamt = (select max(q.gesamt) from public.sva_tipp_punkte q where q.spiel_id = p_spiel);
  -- v26: „Trainerfuchs“ — erste gewertete eigene Elf
  perform public.sva_tipp_album_ziel('elf_aufgestellt', p_spiel, p.user_id)
     from public.sva_tipp_punkte p
    where p.spiel_id = p_spiel and coalesce((p.details ->> 'hatElf')::boolean, false);
  -- v26: „Der Riecher“ — ersten SVA-Torschützen richtig (wiederholbar)
  perform public.sva_tipp_album_ziel('tipp_erster_torschuetze', p_spiel, p.user_id)
     from public.sva_tipp_punkte p
    where p.spiel_id = p_spiel and coalesce((p.details #>> '{tipp,torschuetze}')::int, 0) > 0;
  -- v26: „Dreimal richtig“ — alle aufgelösten Bonusfragen richtig (wiederholbar)
  perform public.sva_tipp_album_ziel('tipp_bonus_perfekt', p_spiel, p.user_id)
     from public.sva_tipp_punkte p
    where p.spiel_id = p_spiel
      and v_aufgeloest > 0
      and coalesce((p.details #>> '{tipp,bonusRichtig}')::int, 0) = v_aufgeloest;
  -- v26: „Der Hellseher“ — 3. exakter Tipp der Saison
  perform public.sva_tipp_album_ziel('tipp_hellseher', p_spiel, p.user_id)
     from public.sva_tipp_punkte p
    where p.spiel_id = p_spiel and p.exakt
      and (select count(*) from public.sva_tipp_punkte q
            where q.user_id = p.user_id and q.saison = p.saison and q.exakt) >= 3;

  return jsonb_build_object(
    'ok', true, 'teilnehmer', v_n,
    'schnitt', (select round(avg(p.gesamt), 1) from public.sva_tipp_punkte p where p.spiel_id = p_spiel),
    'max', (select max(p.gesamt) from public.sva_tipp_punkte p where p.spiel_id = p_spiel),
    'exakt', (select count(*) from public.sva_tipp_punkte p where p.spiel_id = p_spiel and p.exakt));
end;
$$;

-- ── 8. album_mein: Ziele mit kategorie/periode/belohnung.kult + geheimZiele ──
-- sva_album_mein_v21 baut das Ziele-Array (v22/v24 setzen nur obendrauf).
create or replace function public.sva_album_mein_v21()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_saison text := public.sva_album_saison();
  v_f public.sva_album_fans;
  v_jetzt timestamp := public.sva_album_jetzt() at time zone 'Europe/Berlin';
  v_ziele jsonb;
  v_geheim jsonb;
  v_advent jsonb;
  v_lose integer;
  v_woche text := 'woche:' || to_char(now() at time zone 'Europe/Berlin', 'IYYY"-W"IW');
  v_monat text := 'monat:' || to_char(now() at time zone 'Europe/Berlin', 'YYYY-MM');
begin
  select * into v_f from public.sva_album_fans where user_id = v_uid;

  select coalesce(jsonb_agg(x.obj order by x.o1, x.rest nulls last, x.sortierung, x.titel), '[]'::jsonb)
    into v_ziele
    from (
      select jsonb_strip_nulls(jsonb_build_object(
               'id', z.id, 'schluessel', z.schluessel, 'typ', z.typ, 'vorlage', z.vorlage,
               'kategorie', z.kategorie,
               'titel', z.titel, 'beschreibung', z.beschreibung,
               'fortschritt', st.fortschritt, 'benoetigt', st.benoetigt,
               'erreicht', e.n > 0 and not z.wiederholbar,
               'erreichtAt', e.erste,
               'anzahlErreicht', case when z.wiederholbar then e.n end,
               'wiederholbar', case when z.wiederholbar then true end,
               'periode', case when z.typ = 'woche' then v_woche when z.typ = 'monat' then v_monat end,
               'belohnung', jsonb_strip_nulls(jsonb_build_object('karten', z.belohnung_karten,
                              'minSeltenheit', z.belohnung_min_seltenheit, 'lose', z.belohnung_lose,
                              'kult', nullif(z.belohnung_kult, 0))),
               'gueltigBis', z.gueltig_bis,
               'geheim', z.geheim)) as obj,
             case when e.n > 0 and not z.wiederholbar then 2 when z.typ = 'extern' then 1 else 0 end as o1,
             st.benoetigt - st.fortschritt as rest, z.sortierung, z.titel
        from public.sva_album_ziele z
       cross join lateral public.sva_album_ziel_stand(v_uid, z.id) st
       cross join lateral (select count(*)::int as n, min(ze.at) as erste from public.sva_album_ziel_erreicht ze
                            where ze.ziel_id = z.id and ze.fan_user_id = v_uid and ze.saison = v_saison) e
       where v_f.user_id is not null and z.aktiv and (z.saison is null or z.saison = v_saison)
         and (z.gueltig_von is null or z.gueltig_von <= now())
         and (z.gueltig_bis is null or z.gueltig_bis > now() or e.n > 0)
         and (not z.geheim or e.n > 0)
         and (z.typ = 'extern' or st.benoetigt > 0)
    ) x;

  -- Geheime OFFENE Ziele: nur id + hinweis (nie Schlüssel/Titel/Bedingung)
  select coalesce(jsonb_agg(jsonb_build_object('id', g.id, 'hinweis', g.hinweis, 'erreicht', false)
                            order by g.sortierung, g.id), '[]'::jsonb)
    into v_geheim
    from public.sva_album_ziele g
   where v_f.user_id is not null and g.aktiv and g.geheim and g.hinweis is not null
     and (g.saison is null or g.saison = v_saison)
     and (g.gueltig_von is null or g.gueltig_von <= now())
     and (g.gueltig_bis is null or g.gueltig_bis > now())
     and not exists (select 1 from public.sva_album_ziel_erreicht e
                      where e.ziel_id = g.id and e.fan_user_id = v_uid and e.saison = v_saison);

  if extract(month from v_jetzt) = 12 then
    select jsonb_agg(jsonb_build_object('tag', t, 'eingeloest', exists (
             select 1 from public.sva_album_codes c
               join public.sva_album_code_einloesungen ce on ce.code_id = c.id and ce.fan_user_id = v_uid
              where c.art = 'advent' and c.advent_jahr = extract(year from v_jetzt)::int and c.advent_tag = t)) order by t)
      into v_advent
      from generate_series(1, 24) t;
  end if;

  select coalesce(sum(l.anzahl), 0)::int into v_lose from public.sva_album_lose l
   where l.fan_user_id = v_uid and l.saison = v_saison;

  return jsonb_build_object(
    'email', auth.jwt() ->> 'email',
    'saison', v_saison,
    'profil', case when v_f.user_id is null then null else jsonb_build_object(
                'vorname', v_f.vorname, 'initial', v_f.initial,
                'anzeigename', v_f.vorname || ' ' || v_f.initial || '.',
                'rangliste', v_f.rangliste, 'erinnerung', v_f.erinnerung) end,
    'checkins', (select count(*) from public.sva_album_checkins c where c.fan_user_id = v_uid and c.saison = v_saison),
    'checkinsGesamt', (select count(*) from public.sva_album_checkins c where c.fan_user_id = v_uid),
    'spiele', coalesce((
      select jsonb_agg(jsonb_build_object('gegner', s.gegner, 'anstoss', s.anstoss, 'at', c.created_at) order by c.created_at desc)
        from (select * from public.sva_album_checkins c0 where c0.fan_user_id = v_uid order by c0.created_at desc limit 30) c
        join public.sm_spiele s on s.id = c.spiel_id), '[]'::jsonb),
    'besitz', coalesce((
      select jsonb_agg(jsonb_build_object('karteId', b.karte_id, 'anzahl', b.anzahl) order by b.erstmals_at)
        from public.sva_album_besitz b where b.fan_user_id = v_uid), '[]'::jsonb),
    'packs', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', p.id, 'art', p.art, 'anzahl', cardinality(p.karten),
               'titel', p.titel, 'gegner', s.gegner, 'at', p.created_at)) order by p.created_at)
        from public.sva_album_packs p
        left join public.sm_spiele s on s.id = p.spiel_id
       where p.fan_user_id = v_uid and p.geoeffnet_at is null), '[]'::jsonb),
    'gutscheine', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', g.id, 'stufe', g.stufe, 'titel', g.titel, 'code', g.code, 'status', g.status,
               'saison', g.saison, 'eingeloestAt', g.eingeloest_at, 'at', g.created_at,
               'verlosung', case when g.stufe in ('schwelle_3', 'komplett') then true end,
               'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                             from public.sm_sponsoren sp where sp.id = g.partner_id)))
             order by g.created_at desc)
        from public.sva_album_gutscheine g where g.fan_user_id = v_uid), '[]'::jsonb),
    'freundCode', v_f.freund_code,
    'freunde', coalesce((
      select jsonb_agg(public.sva_album_name(x.fid) order by x.at)
        from (select case when fr.fan_a = v_uid then fr.fan_b else fr.fan_a end as fid, fr.at
                from public.sva_album_freunde fr where fr.fan_a = v_uid or fr.fan_b = v_uid) x), '[]'::jsonb),
    'abzeichen', coalesce((
      select jsonb_agg(a.kapitel order by a.at) from public.sva_album_abzeichen a
       where a.fan_user_id = v_uid and a.saison = v_saison), '[]'::jsonb),
    'tausche', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'code', t.code, 'biete', t.biete_karte, 'wunsch', t.wunsch_karte,
               'status', case when t.status = 'offen' and t.gueltig_bis <= now() then 'abgelaufen' else t.status end,
               'eigen', t.von_fan = v_uid,
               'partner', public.sva_album_name(case when t.von_fan = v_uid then t.an_fan else t.von_fan end),
               'at', t.created_at, 'gueltigBis', t.gueltig_bis, 'erledigtAt', t.erledigt_at))
             order by t.created_at desc)
        from (
          select t0.* from public.sva_album_tausch t0 where t0.von_fan = v_uid and t0.status = 'offen'
          union all
          (select t1.* from public.sva_album_tausch t1
            where (t1.von_fan = v_uid or t1.an_fan = v_uid) and t1.status <> 'offen'
            order by coalesce(t1.erledigt_at, t1.created_at) desc limit 10)
        ) t), '[]'::jsonb),
    'tauscheWoche', public.sva_album_tausch_woche(v_uid),
    'kontoTage', case when v_f.user_id is not null then floor(extract(epoch from now() - v_f.created_at) / 86400)::int end,
    'starterOffen', v_f.user_id is not null and not exists (
      select 1 from public.sva_album_packs p where p.fan_user_id = v_uid and p.art = 'starter'),
    'advent', v_advent,
    'ziele', v_ziele,
    'geheimZiele', v_geheim,
    'naechstesZiel', (select z.v from jsonb_array_elements(v_ziele) with ordinality as z(v, i)
                       where z.v ->> 'typ' not in ('extern', 'woche', 'monat')
                         and not coalesce((z.v ->> 'erreicht')::boolean, false)
                       order by z.i limit 1),
    'lose', v_lose,
    'loseVerlauf', coalesce((
      select jsonb_agg(jsonb_build_object('anzahl', l.anzahl, 'quelle', l.quelle, 'at', l.at,
               'titel', case l.quelle when 'checkin' then 'Check-in' when 'komplett' then 'Album komplett'
                              when 'ziel' then coalesce((select z.titel from public.sva_album_ziele z
                                                          where z.id::text = split_part(l.bezug, ':', 1)), 'Ziel')
                              else 'Bonus' end) order by l.at desc)
        from (select * from public.sva_album_lose l0 where l0.fan_user_id = v_uid and l0.saison = v_saison
               order by l0.at desc limit 10) l), '[]'::jsonb),
    'verlosungen', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', vl.id, 'titel', vl.titel, 'preis', vl.preis, 'bildUrl', vl.bild_url,
               'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                             from public.sm_sponsoren sp where sp.id = vl.partner_id and sp.aktiv),
               'stichtag', vl.stichtag, 'status', vl.status, 'minLose', vl.min_lose,
               'gewinnerName', vl.gewinner_name, 'gezogenAt', vl.gezogen_at,
               'gewonnen', vl.gewinner_fan is not null and vl.gewinner_fan = v_uid,
               'teilnahme', coalesce((select sum(l.anzahl) from public.sva_album_lose l
                                       where l.fan_user_id = v_uid and l.saison = vl.saison), 0) >= vl.min_lose))
             order by vl.status, coalesce(vl.stichtag, vl.created_at))
        from public.sva_album_verlosungen vl
       where vl.status = 'offen' or vl.gezogen_at > now() - interval '30 days'), '[]'::jsonb)
  );
end;
$$;

-- ── 9. Admin-Statistik: zieleJeKategorie ─────────────────────────────────────
create or replace function public.album_admin_statistik()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
begin
  perform public.sva_album_admin_pruefen();
  return jsonb_build_object(
    'saison', v_saison,
    'fans', (select count(*) from public.sva_album_fans),
    'fansRangliste', (select count(*) from public.sva_album_fans where rangliste),
    'fansErinnerung', (select count(*) from public.sva_album_fans where erinnerung),
    'checkinsSaison', (select count(*) from public.sva_album_checkins where saison = v_saison),
    'packsOffen', (select count(*) from public.sva_album_packs where geoeffnet_at is null),
    'gutscheineOffen', (select count(*) from public.sva_album_gutscheine where status = 'offen' and saison = v_saison),
    'gutscheineEingeloest', (select count(*) from public.sva_album_gutscheine where status = 'eingeloest' and saison = v_saison),
    'albenKomplett', (select count(*) from public.sva_album_gutscheine where stufe = 'komplett' and saison = v_saison),
    'codesEingeloest', (select count(*) from public.sva_album_code_einloesungen),
    'tauscheErledigt', (select count(*) from public.sva_album_tausch where status = 'erledigt'),
    'starterGeholt', (select count(*) from public.sva_album_packs where art = 'starter'),
    'zieleErreicht', (select count(*) from public.sva_album_ziel_erreicht where saison = v_saison),
    'loseSaison', (select coalesce(sum(anzahl), 0) from public.sva_album_lose where saison = v_saison),
    'zieleJeKategorie', coalesce((
      select jsonb_object_agg(k, n) from (
        select coalesce(z.kategorie, 'sonstige') as k, count(*)::int as n
          from public.sva_album_ziele z where z.aktiv group by 1) q), '{}'::jsonb),
    'spiele', coalesce((
      select jsonb_agg(jsonb_build_object('spielId', s.id, 'checkins',
               (select count(*) from public.sva_album_checkins c where c.spiel_id = s.id)) order by s.anstoss)
        from public.sm_spiele s
       where s.heim and s.anstoss > now() - interval '400 days'), '[]'::jsonb),
    'kontakte', coalesce((
      select jsonb_agg(jsonb_build_object('name', f.vorname || ' ' || f.initial || '.', 'email', u.email) order by f.created_at)
        from public.sva_album_fans f
        join auth.users u on u.id = f.user_id
       where f.erinnerung), '[]'::jsonb)
  );
end;
$$;

-- ── 10. Standard-Katalog v26 (68 Ziele; pejas_kollektion folgt in V26-K → 69) ─
-- Gemeinsamer Upsert (ohne Admin-Prüfung). Admin-RPC + Nachzieher rufen ihn auf.
create or replace function public._sva_album_ziele_upsert_v26()
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
begin
  select count(*) into v_vorher from public.sva_album_ziele;

  create temporary table if not exists sva_tmp_ziele26 (
    schluessel text, typ text, vorlage text, titel text, beschreibung text, karten uuid[], roster_ids uuid[],
    kapitel text, anzahl integer, b_karten integer, b_min text, b_lose integer, b_kult integer,
    geheim boolean, wiederholbar boolean, hinweis text, kategorie text, bedingung jsonb, sortierung integer
  ) on commit drop;
  delete from sva_tmp_ziele26;

  -- Bestand (30 ✦): unveränderte Definition, nur kategorie (+ Hinweis bei nachteule) ergänzt
  insert into sva_tmp_ziele26 values
    ('zwillinge','set','familie','Die Zwillinge','Elias und Noah Pejas im Album.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-pejas-e','p-pejas-n')), null, null, 1, null, 0, 0, false, false, null, 'sets', null, 10),
    ('warkehr','set','familie','Die Warkehr-Brüder','Isaak und Aaron Warkehr im Album.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-warkehr-i','p-warkehr-a')), null, null, 1, null, 0, 0, false, false, null, 'sets', null, 11),
    ('vater_sohn','set','familie','Vater & Sohn','Adolf (Trainerstab) und Tino Ebeling im Album.', null,
      array(select r.id from public.sm_roster r where r.slug in ('s-ebeling-a','p-ebeling-t')), null, null, 1, null, 0, 0, false, false, null, 'sets', null, 12),
    ('familie_sva','set','familie','Familie SVA','Alle Familien-Paare komplett.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-pejas-e','p-pejas-n','p-warkehr-i','p-warkehr-a','s-ebeling-a','p-ebeling-t')),
      null, null, 3, 'gold', 0, 0, false, false, null, 'sets', null, 13),
    ('rote_familie','set','set','Die Rote Familie',
      'Drei Mann, drei Platzverweise – sammle die Rote Familie: Brettschneider, Nauerz und Brünjes.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-brettschneider','p-nauerz','p-bruenjes') order by r.slug),
      null, null, 1, 'silber', 0, 0, false, false, null, 'sets', null, 14),
    ('meister_2026','set','set','Meister 2026','Alle Momente der Meistersaison.',
      array(select k.id from public.sva_album_karten k where k.typ = 'moment' and k.serie = 'Meister 2026' and not k.limitiert
              and k.aktiv and coalesce(k.saison, v_saison) = v_saison), null, null, null, 1, 'spezial', 0, 0, false, false, null, 'sammeln', null, 20),
    ('rueckennummern','set','set','Rückennummern 1–11','Alle Spieler mit den Nummern 1 bis 11.', null,
      array(select r.id from public.sm_roster r where r.aktiv and r.rolle = 'spieler' and r.nummer between 1 and 11),
      null, null, 1, null, 0, 0, false, false, null, 'sammeln', null, 21),
    ('die_kurve','set','set','Die Kurve','Alle Karten der Kurve.',
      array(select k.id from public.sva_album_karten k where k.typ = 'fan' and not k.limitiert and not k.variante
              and k.aktiv and coalesce(k.saison, v_saison) = v_saison), null, null, null, 1, null, 0, 0, false, false, null, 'sammeln', null, 22),
    ('partner_set','set','set','Partner-Set','Alle Partnerkarten.',
      array(select k.id from public.sva_album_karten k where k.typ = 'partner' and not k.limitiert and not k.variante
              and k.aktiv and coalesce(k.saison, v_saison) = v_saison), null, null, null, 1, null, 0, 0, false, false, null, 'sammeln', null, 23),
    ('kapitel_tw','kapitel','kapitel','Kapitel komplett: Torwart', null, null, null, 'TW', null, 1, null, 0, 0, false, false, null, 'sammeln', null, 30),
    ('kapitel_abw','kapitel','kapitel','Kapitel komplett: Abwehr', null, null, null, 'ABW', null, 1, null, 0, 0, false, false, null, 'sammeln', null, 31),
    ('kapitel_mit','kapitel','kapitel','Kapitel komplett: Mittelfeld', null, null, null, 'MIT', null, 1, null, 0, 0, false, false, null, 'sammeln', null, 32),
    ('kapitel_ang','kapitel','kapitel','Kapitel komplett: Angriff', null, null, null, 'ANG', null, 1, null, 0, 0, false, false, null, 'sammeln', null, 33),
    ('kapitel_stab','kapitel','kapitel','Kapitel komplett: Trainerstab', null, null, null, 'stab', null, 1, null, 0, 0, false, false, null, 'sammeln', null, 34),
    ('kapitel_moment','kapitel','kapitel','Kapitel komplett: Momente', null, null, null, 'moment', null, 1, null, 0, 0, false, false, null, 'sammeln', null, 35),
    ('kapitel_fan','kapitel','kapitel','Kapitel komplett: Kurve', null, null, null, 'fan', null, 1, null, 0, 0, false, false, null, 'sammeln', null, 36),
    ('kapitel_partner','kapitel','kapitel','Kapitel komplett: Partner', null, null, null, 'partner', null, 1, null, 0, 0, false, false, null, 'sammeln', null, 37),
    ('meilenstein_10','meilenstein','meilenstein','10 % gesammelt', null, null, null, null, 10, 1, null, 1, 0, false, false, null, 'sammeln', null, 40),
    ('meilenstein_25','meilenstein','meilenstein','25 % gesammelt', null, null, null, null, 25, 1, null, 1, 0, false, false, null, 'sammeln', null, 41),
    ('meilenstein_50','meilenstein','meilenstein','Halbzeit: 50 %', null, null, null, null, 50, 1, null, 2, 0, false, false, null, 'sammeln', null, 42),
    ('meilenstein_75','meilenstein','meilenstein','75 % gesammelt', null, null, null, null, 75, 1, null, 3, 0, false, false, null, 'sammeln', null, 43),
    ('meilenstein_100','meilenstein','meilenstein','Album komplett: 100 %', null, null, null, null, 100, 1, null, 5, 0, false, false, null, 'sammeln', null, 44),
    ('dauerkarte','serie_checkin','serie','Dauerkarte','3 Heimspiele in Folge eingecheckt.', null, null, null, 3, 1, 'gold', 0, 0, false, false, null, 'platz', null, 50),
    ('tipp_serie','serie_tipp','serie','Tipp-Serie','4 Wochen in Folge getippt.', null, null, null, 4, 1, null, 0, 0, false, false, null, 'tipp', null, 51),
    ('erster_tausch','sozial_tausch','sozial','Erster Tausch','Eine Karte mit einem Freund getauscht.', null, null, null, 1, 1, null, 0, 0, false, false, null, 'sozial', null, 60),
    ('freund_geworben','sozial_freund','sozial','Freund geworben','Freundescode geteilt oder eingelöst.', null, null, null, 1, 1, null, 0, 0, false, false, null, 'sozial', null, 61),
    ('tipp_exakt','extern','tipp','Exakt getippt','Ergebnis exakt getippt.', null, null, null, null, 1, 'silber', 0, 0, false, true, null, 'tipp', null, 70),
    ('tipp_kapitaen_trifft','extern','tipp','Kapitän trifft','Richtig getippt: der Kapitän trifft.', null, null, null, null, 1, null, 0, 0, false, true, null, 'tipp', null, 71),
    ('tipp_spieltagssieg','extern','tipp','Spieltagssieg','Beste Punktzahl des Spieltags in der Tipp-Liga.', null, null, null, null, 0, null, 2, 0, false, true, null, 'tipp', null, 72),
    ('nachteule','extern','mission','Nachteule','Check-in bei einem Flutlichtspiel (Anstoß ab 19 Uhr).', null, null, null, null, 1, 'silber', 0, 0, true, false,
      'Wenn das Flutlicht angeht …', 'geheim', null, 80);

  -- Neu (38): Start, Platz, Woche/Monat, Sammeln, Sets, Tipp, Sozial, Geheim
  insert into sva_tmp_ziele26 values
    -- Start (bestand, kategorie start)
    ('karten_25','bestand','challenge','25 im Schuber','25 Karten gesammelt (inkl. Doppelte).', null, null, null, null, 0, null, 1, 0, false, false, null, 'start', '{"was":"karten","n":25}'::jsonb, 100),
    ('karten_50','bestand','challenge','Halbes Hundert','50 Karten gesammelt.', null, null, null, null, 0, null, 2, 0, false, false, null, 'start', '{"was":"karten","n":50}'::jsonb, 101),
    ('erste_silber','bestand','challenge','Silberstreif','Erste Silber-Karte im Album.', null, null, null, null, 0, null, 1, 0, false, false, null, 'start', '{"was":"seltenheit","stufe":"silber","n":1}'::jsonb, 102),
    ('erste_gold','bestand','challenge','Goldrichtig','Erste Gold-Karte im Album.', null, null, null, null, 0, null, 1, 0, false, false, null, 'start', '{"was":"seltenheit","stufe":"gold","n":1}'::jsonb, 103),
    ('erste_spezial','bestand','challenge','Sternstunde','Erste Spezial-Karte im Album.', null, null, null, null, 0, null, 2, 0, false, false, null, 'start', '{"was":"seltenheit","stufe":"spezial","n":1}'::jsonb, 104),
    ('erster_glanz','bestand','challenge','Glanzleistung','Erste Glanz-Variante gezogen.', null, null, null, null, 0, null, 1, 0, false, false, null, 'start', '{"was":"glanz","n":1}'::jsonb, 105),
    ('erster_code','bestand','challenge','Codeknacker','Ersten Code eingelöst.', null, null, null, null, 0, null, 1, 0, false, false, null, 'start', '{"was":"code","n":1}'::jsonb, 106),
    ('erster_tipp','bestand','challenge','Angetippt','Erstes Tipp-Pack erhalten.', null, null, null, null, 0, null, 1, 0, false, false, null, 'start', '{"was":"pack_art","art":"tipp","n":1}'::jsonb, 107),
    -- Platz & Check-in
    ('erster_checkin','bestand','challenge','Moin, Waldsportplatz','Erster Check-in der Saison.', null, null, null, null, 0, null, 0, 1, false, false, null, 'platz', '{"was":"checkins","n":1}'::jsonb, 110),
    ('checkin_3','bestand','challenge','Stammplatz','3 Check-ins in der Saison.', null, null, null, null, 0, null, 1, 1, false, false, null, 'platz', '{"was":"checkins","n":3}'::jsonb, 111),
    ('checkin_5','bestand','challenge','Halbe Miete','5 Check-ins in der Saison.', null, null, null, null, 0, null, 2, 1, false, false, null, 'platz', '{"was":"checkins","n":5}'::jsonb, 112),
    ('checkin_8','bestand','challenge','Immer da','8 Check-ins in der Saison.', null, null, null, null, 1, 'gold', 3, 0, false, false, null, 'platz', '{"was":"checkins","n":8}'::jsonb, 113),
    ('dauerkarte_5','serie_checkin','serie','Eisern','5 Heimspiele in Folge eingecheckt.', null, null, null, 5, 1, 'gold', 2, 0, false, false, null, 'platz', null, 114),
    ('barometer_held','extern','challenge','Gemeinsam voll','Beim erreichten Fan-Barometer eingecheckt.', null, null, null, null, 0, null, 1, 0, false, true, null, 'platz', null, 115),
    -- Woche & Monat (wiederholbar)
    ('woche_tipp','woche','challenge','Tipp der Woche','Diese Woche in der Tipp-Liga getippt.', null, null, null, null, 0, null, 1, 0, false, true, null, 'woche', '{"was":"woche_tipp"}'::jsonb, 120),
    ('woche_voll','woche','challenge','Volles Programm','Diese Woche getippt und eine Elf aufgestellt.', null, null, null, null, 0, null, 2, 0, false, true, null, 'woche', '{"was":"woche_voll"}'::jsonb, 121),
    ('monat_aktiv','monat','challenge','Monatsabschluss','Diesen Monat ein Pack geöffnet und getippt.', null, null, null, null, 0, null, 2, 0, false, true, null, 'monat', '{"was":"monat_aktiv"}'::jsonb, 122),
    -- Sammeln
    ('glanz_5','bestand','challenge','Glanzstücke','5 Glanz-Varianten gesammelt.', null, null, null, null, 0, null, 1, 0, false, false, null, 'sammeln', '{"was":"glanz","n":5}'::jsonb, 130),
    ('glanz_24','bestand','challenge','Alles glänzt','Alle 24 Glanz-Varianten.', null, null, null, null, 1, 'spezial', 3, 0, false, false, null, 'sammeln', '{"was":"glanz","n":24}'::jsonb, 131),
    ('motm_3','bestand','challenge','Wochenwahl-Sammler','3 „Spieler des Spiels“-Karten.', null, null, null, null, 0, null, 2, 0, false, false, null, 'sammeln', '{"was":"motm","n":3}'::jsonb, 132),
    ('bonus_seite_5','bestand','challenge','Bonusjäger','5 limitierte Karten gesammelt.', null, null, null, null, 0, null, 1, 0, false, false, null, 'sammeln', '{"was":"limitiert","n":5}'::jsonb, 133),
    ('doppelte_10','bestand','challenge','Tauschware','10 Doppelte gleichzeitig im Besitz.', null, null, null, null, 0, null, 1, 0, false, false, null, 'sammeln', '{"was":"doppelte","n":10}'::jsonb, 134),
    ('wunsch_erfuellt','bestand','challenge','Wunsch erfüllt','Erste Wunschkarte geholt.', null, null, null, null, 0, null, 1, 0, false, false, null, 'sammeln', '{"was":"pack_art","art":"wunsch","n":1}'::jsonb, 135),
    ('shiny_fund','extern','challenge','Sternenstaub','Deine erste Shiny-Karte gezogen.', null, null, null, null, 0, null, 3, 0, false, false, null, 'sammeln', null, 136),
    -- Sets & Familien (G1: Neuber = Brüder)
    ('neuber','set','familie','Die Neuber-Brüder','Marcel und Dawid Neuber im Album.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-neuber-m','p-neuber-d')), null, null, 0, null, 1, 0, false, false, null, 'sets', null, 140),
    ('drei_justins','set','set','Das Justin-Trio','Justin Hüttry, Justin Sladek und Justin Kalwa.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-huettry','p-sladek','p-kalwa')), null, null, 0, null, 1, 0, false, false, null, 'sets', null, 141),
    ('die_neuen','set','set','Die Neuen','Alle Neuzugänge der Saison 26/27.', null,
      array(select r.id from public.sm_roster r where r.slug in ('p-litwitz','p-jochim','p-biedermann','p-warkehr-i')), null, null, 0, null, 1, 0, false, false, null, 'sets', null, 142),
    ('die_achse','set','set','Die Achse','Trainer Junge, Co-Trainer Ebeling und Kapitän Helck.', null,
      array(select r.id from public.sm_roster r where r.slug in ('s-junge','s-ebeling-a','p-helck')), null, null, 0, null, 2, 0, false, false, null, 'sets', null, 143),
    ('hohe_nummern','set','set','Hohe Hausnummern','Alle Spieler mit Rückennummer ab 29.', null,
      array(select r.id from public.sm_roster r where r.aktiv and r.rolle = 'spieler' and r.nummer >= 29), null, null, 0, null, 1, 0, false, false, null, 'sets', null, 144),
    -- Tipp-Liga
    ('elf_aufgestellt','extern','tipp','Trainerfuchs','Deine erste eigene Elf wurde gewertet.', null, null, null, null, 0, null, 1, 0, false, false, null, 'tipp', null, 150),
    ('tipp_bonus_perfekt','extern','tipp','Dreimal richtig','Alle Bonusfragen eines Spieltags richtig.', null, null, null, null, 0, null, 1, 0, false, true, null, 'tipp', null, 151),
    ('tipp_erster_torschuetze','extern','tipp','Der Riecher','Ersten SVA-Torschützen richtig getippt.', null, null, null, null, 0, null, 1, 0, false, true, null, 'tipp', null, 152),
    ('tipp_hellseher','extern','tipp','Der Hellseher','Dreimal in der Saison exakt getippt.', null, null, null, null, 1, 'gold', 0, 0, false, false, null, 'tipp', null, 153),
    -- Sozial
    ('tausch_3','sozial_tausch','sozial','Tauschbörse','3 Tausche erledigt.', null, null, null, 3, 0, null, 1, 0, false, false, null, 'sozial', null, 160),
    ('freunde_3','sozial_freund','sozial','Deine Kurve','3 Freunde im Album.', null, null, null, 3, 0, null, 1, 0, false, false, null, 'sozial', null, 161),
    -- Geheim (???-Kacheln)
    ('fruehaufsteher','extern','mission','Der Frühaufsteher','Check-in in den ersten 15 Minuten des Check-in-Fensters.', null, null, null, null, 1, 'silber', 0, 0, true, false,
      'Wer zuerst kommt, klebt zuerst.', 'geheim', null, 170),
    ('entdecker','bestand','mission','Der Entdecker','Alle vier Geheimkarten gefunden.', null, null, null, null, 1, 'gold', 2, 0, true, false,
      'Vier Rätsel, ein Titel.', 'geheim', '{"was":"geheimkarten","n":4}'::jsonb, 171),
    ('winterkoenig','bestand','mission','Der Winterkönig','Alle 24 Advent-Türchen eingelöst.', null, null, null, null, 1, 'gold', 0, 0, true, false,
      '24 Türen, eine Krone.', 'geheim', '{"was":"advent","n":24}'::jsonb, 172);

  insert into public.sva_album_ziele (schluessel, typ, vorlage, titel, beschreibung, karten, roster_ids, kapitel, anzahl,
                                      belohnung_karten, belohnung_min_seltenheit, belohnung_lose, belohnung_kult,
                                      geheim, wiederholbar, hinweis, kategorie, bedingung, sortierung)
  select t.schluessel, t.typ, t.vorlage, t.titel, t.beschreibung, t.karten, t.roster_ids, t.kapitel, t.anzahl,
         t.b_karten, t.b_min, t.b_lose, t.b_kult, t.geheim, t.wiederholbar, t.hinweis, t.kategorie, t.bedingung, t.sortierung
    from sva_tmp_ziele26 t
  on conflict (schluessel) do update
     set karten = excluded.karten, roster_ids = excluded.roster_ids,
         kategorie = excluded.kategorie, bedingung = excluded.bedingung,
         belohnung_kult = excluded.belohnung_kult,
         hinweis = coalesce(public.sva_album_ziele.hinweis, excluded.hinweis);

  select count(*) into v_nachher from public.sva_album_ziele;
  return jsonb_build_object('angelegt', v_nachher - v_vorher, 'gesamt', v_nachher,
                            'standard', (select count(*) from sva_tmp_ziele26));
end;
$$;

-- Admin-RPC: wie bisher, nur jetzt auf dem v26-Katalog
create or replace function public.album_admin_ziele_standard()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_album_admin_pruefen();
  return public._sva_album_ziele_upsert_v26();
end;
$$;

-- Bestand der echten DB nachziehen: nur wenn die Standard-Ziele schon existieren
-- (sonst legt der Admin sie per Knopf an — wie seit v21).
create or replace function public.sva_album_v26_nachziehen()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not exists (select 1 from public.sva_album_ziele where schluessel = 'meilenstein_100') then
    return jsonb_build_object('angelegt', 0, 'gesamt', (select count(*) from public.sva_album_ziele), 'nachgezogen', false);
  end if;
  return public._sva_album_ziele_upsert_v26() || jsonb_build_object('nachgezogen', true);
end;
$$;

-- ── 11. Rechte ───────────────────────────────────────────────────────────────
revoke all on function public._sva_album_ziele_upsert_v26() from public, anon, authenticated;
grant execute on function public._sva_album_ziele_upsert_v26() to service_role;
revoke all on function public.sva_album_v26_nachziehen() from public, anon, authenticated;
grant execute on function public.sva_album_v26_nachziehen() to service_role;
revoke all on function public.album_admin_ziele_standard() from public, anon;
grant execute on function public.album_admin_ziele_standard() to authenticated, service_role;

-- ── 12. Bestand sofort nachziehen (idempotent) ──────────────────────────────
select public.sva_album_v26_nachziehen();
