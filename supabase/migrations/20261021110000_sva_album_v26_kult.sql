-- ─────────────────────────────────────────────────────────────────────────────
-- v26 · Paket K — Kabinen-Kult-Reihe (Insider-Karten)
-- Kult ist KEINE neue Seltenheitsstufe: eigene Serie, immer limitiert (zählt nie
-- fürs Album, wird nie normal gezogen), nie Variante/geheim, braucht roster_id +
-- Kollektion. Quellen: Kult-Slot im Spieltags-Pack (kult_chance_prozent %, nur
-- FEHLENDE, keine Doppelten) + Check-in-Ziele (belohnung_kult).
--
-- Constraint-Feinschliff ggü. Spec §4.1 (bewusst): Einverständnis (einverstaendnis_at)
-- wird nur für AKTIVE Kult-Karten erzwungen — so dürfen inaktive Platzhalter (Pejas)
-- ohne Einverständnis existieren (Gate G2 offen), Aktivierung bleibt aber gesperrt,
-- bis der Admin den Haken „Spieler hat zugestimmt" setzt (Persönlichkeitsrechte, R5).
--
-- Nach 20261021100000 (Z1). create-or-replace auf dem Z1/v24-Stand.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Schema ────────────────────────────────────────────────────────────────
alter table public.sva_album_karten
  add column if not exists kult boolean not null default false,
  add column if not exists kollektion text,
  add column if not exists einverstaendnis_at timestamptz,
  add column if not exists erzeugt_von text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_album_karten_kollektion_chk') then
    alter table public.sva_album_karten add constraint sva_album_karten_kollektion_chk
      check (kollektion is null or char_length(kollektion) <= 60);
  end if;
  -- Marvin 06.10.: Kabinen-Kult darf OHNE Spielerzuordnung aktiv sein (nur Titel +
  -- Anekdote; Namen trägt Marvin später im Admin nach). Daher ist roster_id optional.
  -- Einverständnis bleibt Pflicht, bevor eine Kult-Karte aktiv wird (Persönlichkeitsrechte).
  if not exists (select 1 from pg_constraint where conname = 'sva_album_karten_kult') then
    alter table public.sva_album_karten add constraint sva_album_karten_kult check (
      not kult or (limitiert and not variante and not coalesce(geheim, false)
                   and kollektion is not null
                   and (not aktiv or einverstaendnis_at is not null)));
  end if;
end $$;

alter table public.sva_album_einstellungen
  add column if not exists kult_chance_prozent integer not null default 25;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_album_einstellungen_kult_chance_chk') then
    alter table public.sva_album_einstellungen add constraint sva_album_einstellungen_kult_chance_chk
      check (kult_chance_prozent between 0 and 100);
  end if;
end $$;

comment on column public.sva_album_karten.kult is 'v26-K: Kabinen-Kult-Karte (Insider-Serie). Immer limitiert, zählt nie fürs Album, nur im Check-in-Pack/über Ziele.';
comment on column public.sva_album_karten.kollektion is 'v26-K: Kult-Kollektion (z. B. „Pejas-Kollektion").';
comment on column public.sva_album_karten.einverstaendnis_at is 'v26-K: Zeitpunkt der Freigabe durch den Spieler (Pflicht, bevor die Karte aktiv wird).';

-- ── 2. Kult-Karten an ein Pack anhängen (nur FEHLENDE, keine Doppelten) ──────
create or replace function public.sva_album_kult_anhaengen(p_fan uuid, p_pack uuid, p_anzahl integer default 1)
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_p public.sva_album_packs;
  v_kult uuid;
  v_n integer := 0;
  i integer;
begin
  if coalesce(p_anzahl, 0) < 1 then return 0; end if;
  select * into v_p from public.sva_album_packs where id = p_pack and fan_user_id = p_fan and geoeffnet_at is null for update;
  if v_p.id is null then return 0; end if;
  for i in 1 .. p_anzahl loop
    select k.id into v_kult
      from public.sva_album_karten k
     where k.kult and k.aktiv and (k.saison is null or k.saison = v_saison)
       and not exists (select 1 from public.sva_album_besitz b where b.fan_user_id = p_fan and b.karte_id = k.id)
       and not (k.id = any (coalesce(v_p.karten, '{}'::uuid[])))
     order by random()
     limit 1;
    exit when v_kult is null;  -- nichts mehr fehlend → kein Anhang
    update public.sva_album_packs
       set karten = coalesce(karten, '{}'::uuid[]) || v_kult,
           seltenheiten = coalesce(seltenheiten, '{}'::text[]) || 'bronze'::text,
           shiny = coalesce(shiny, '{}'::boolean[]) || false
     where id = p_pack;
    select * into v_p from public.sva_album_packs where id = p_pack;  -- aktualisieren für nächste Runde
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
revoke all on function public.sva_album_kult_anhaengen(uuid, uuid, integer) from public, anon, authenticated;
grant execute on function public.sva_album_kult_anhaengen(uuid, uuid, integer) to service_role;

-- ── 3. Ziel-Stand: Kult ausnehmen bei „limitiert", neues was 'kult' ──────────
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
      select count(*)::int into v_n from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
       where b.fan_user_id = p_fan and k.limitiert and not coalesce(k.kult, false);
    elsif v_was = 'motm' then
      select count(*)::int into v_n from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
       where b.fan_user_id = p_fan and k.limitiert and k.motm_spiel_id is not null;
    elsif v_was = 'kult' then
      select count(*)::int into v_n from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id
       where b.fan_user_id = p_fan and coalesce(k.kult, false);
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

  else -- extern
    select count(*)::int into v_n from public.sva_album_ziel_erreicht e
     where e.ziel_id = z.id and e.fan_user_id = p_fan and e.saison = v_saison;
    fortschritt := v_n;
    benoetigt := case when z.wiederholbar then null else 1 end;
  end if;
end;
$$;

-- ── 4. Ziel vergeben: belohnung_kult (fehlende Kult-Karten anhängen) ─────────
create or replace function public.sva_album_ziel_vergeben(p_fan uuid, p_ziel uuid, p_bezug text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  z public.sva_album_ziele;
  v_saison text := public.sva_album_saison();
  v_ok uuid;
  v_pack uuid;
  v_lose integer := 0;
  v_kult integer := 0;
  v_q text;
begin
  select * into z from public.sva_album_ziele where id = p_ziel;
  if z.id is null then
    return null;
  end if;
  insert into public.sva_album_ziel_erreicht (ziel_id, fan_user_id, bezug, saison)
  values (z.id, p_fan, coalesce(p_bezug, ''), v_saison)
  on conflict do nothing
  returning ziel_id into v_ok;
  if v_ok is null then
    return null;
  end if;
  v_q := z.id::text || ':' || coalesce(p_bezug, '');
  if z.belohnung_karten > 0 then
    v_pack := public.sva_album_pack_ziehen_v20(p_fan, 'ziel', null, z.belohnung_karten, v_q, z.titel,
                z.belohnung_min_seltenheit, null, true);
  elsif coalesce(z.belohnung_kult, 0) > 0 then
    -- reines Kult-Ziel ohne Album-Karten: leeres Ziel-Pack als Träger der Kult-Karte
    v_pack := public.sva_album_pack_ziehen_v20(p_fan, 'ziel', null, 0, v_q, z.titel, null, null, false);
  end if;
  -- Kult-Karten anhängen (nur fehlende). Hat der Fan schon alle → Ersatz +1 Los.
  if coalesce(z.belohnung_kult, 0) > 0 and v_pack is not null then
    v_kult := public.sva_album_kult_anhaengen(p_fan, v_pack, z.belohnung_kult);
    if v_kult = 0 then
      v_lose := v_lose + public.sva_album_lose_buchen(p_fan, 1, 'ziel', v_q || ':kult', v_saison);
    end if;
  end if;
  v_lose := v_lose + public.sva_album_lose_buchen(p_fan, z.belohnung_lose, 'ziel', v_q, v_saison);
  update public.sva_album_ziel_erreicht set pack_id = v_pack, lose = v_lose
   where ziel_id = z.id and fan_user_id = p_fan and bezug = coalesce(p_bezug, '');
  return jsonb_strip_nulls(jsonb_build_object('zielId', z.id, 'schluessel', z.schluessel, 'typ', z.typ,
           'kapitel', z.kapitel, 'titel', z.titel, 'packId', v_pack, 'lose', v_lose,
           'kult', nullif(v_kult, 0)));
end;
$$;

-- ── 5. Check-in-Kern: Kult-Slot im Spieltags-Pack (kult_chance_prozent %) ────
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
  v_kult   integer := 0;
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
  -- v26-K: Kult-Slot — mit kult_chance_prozent % eine FEHLENDE Kult-Karte anhängen
  if v_pack is not null and random() * 100 < coalesce(v_e.kult_chance_prozent, 25) then
    v_kult := public.sva_album_kult_anhaengen(v_uid, v_pack, 1);
  end if;

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
  v_ziele := public.sva_album_ziele_pruefen(v_uid, array['serie_checkin', 'bestand']);

  if extract(hour from v_s.anstoss at time zone 'Europe/Berlin') >= 19 then
    v_r := public.sva_album_ziel_extern(v_uid, 'nachteule', v_s.id::text);
    if coalesce((v_r ->> 'erreicht')::boolean, false) then
      v_ziele := v_ziele || jsonb_build_object('schluessel', 'nachteule', 'titel', v_r ->> 'titel',
                                               'packId', v_r -> 'packId', 'lose', v_r -> 'lose');
    end if;
  end if;
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
    'kult', nullif(v_kult, 0),
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

-- ── 6. Admin: neue Kult-Karte (Einverständnis-Pflicht) + schalten ────────────
create or replace function public.album_admin_kult_karte(
  p_roster uuid, p_titel text, p_anekdote text, p_kollektion text, p_bild text, p_einverstaendnis boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_rolle text;
  v_typ text;
  v_id uuid;
begin
  perform public.sva_album_admin_pruefen();
  if not coalesce(p_einverstaendnis, false) then
    raise exception 'album_kult_einverstaendnis' using errcode = 'P0001',
      hint = 'Ohne „Spieler hat zugestimmt" darf keine Kult-Karte aktiv werden.';
  end if;
  if p_titel is null or char_length(btrim(p_titel)) not between 2 and 60 then
    raise exception 'album_ungueltig:titel' using errcode = '22023';
  end if;
  if p_kollektion is null or char_length(btrim(p_kollektion)) not between 2 and 60 then
    raise exception 'album_ungueltig:kollektion' using errcode = '22023';
  end if;
  -- roster optional: ohne Zuordnung wird die Karte ein „Moment" (Kabinen-Meme ohne Person)
  if p_roster is not null then
    select r.rolle into v_rolle from public.sm_roster r where r.id = p_roster;
    if v_rolle is null then
      raise exception 'album_ungueltig:roster' using errcode = '22023';
    end if;
    v_typ := case when v_rolle = 'spieler' then 'spieler' else 'trainer' end;
  else
    v_typ := 'moment';
  end if;
  if p_bild is not null and not (p_bild ~ '^(https://|/)') then
    raise exception 'album_ungueltig:bild' using errcode = '22023';
  end if;
  insert into public.sva_album_karten
    (typ, roster_id, titel, seltenheit, limitiert, kult, kollektion, einverstaendnis_at, aktiv,
     bild_url, rueckseite, credit, saison, erzeugt_von, sortierung)
  values
    (v_typ, p_roster, btrim(p_titel), 'bronze', true, true, btrim(p_kollektion), now(), true,
     p_bild, p_anekdote, 'Foto: Kabine SVA', v_saison, lower(coalesce(auth.jwt() ->> 'email', '')),
     coalesce((select max(sortierung) + 1 from public.sva_album_karten where kult), 900))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'kollektion', btrim(p_kollektion), 'aktiv', true);
end;
$$;
revoke all on function public.album_admin_kult_karte(uuid, text, text, text, text, boolean) from public, anon;
grant execute on function public.album_admin_kult_karte(uuid, text, text, text, text, boolean) to authenticated, service_role;

-- Platzhalter aktiv/inaktiv schalten (Freigabe setzt Einverständnis)
create or replace function public.album_admin_kult_schalten(p_karte uuid, p_aktiv boolean, p_einverstaendnis boolean default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_k public.sva_album_karten;
begin
  perform public.sva_album_admin_pruefen();
  select * into v_k from public.sva_album_karten where id = p_karte and kult;
  if v_k.id is null then
    raise exception 'album_ungueltig:karte' using errcode = '22023';
  end if;
  if p_aktiv and v_k.einverstaendnis_at is null and not coalesce(p_einverstaendnis, false) then
    raise exception 'album_kult_einverstaendnis' using errcode = 'P0001';
  end if;
  update public.sva_album_karten
     set aktiv = coalesce(p_aktiv, aktiv),
         einverstaendnis_at = case when p_aktiv and einverstaendnis_at is null then now() else einverstaendnis_at end,
         erzeugt_von = coalesce(erzeugt_von, lower(auth.jwt() ->> 'email'))
   where id = p_karte;
  return jsonb_build_object('id', p_karte, 'aktiv', coalesce(p_aktiv, v_k.aktiv));
end;
$$;
revoke all on function public.album_admin_kult_schalten(uuid, boolean, boolean) from public, anon;
grant execute on function public.album_admin_kult_schalten(uuid, boolean, boolean) to authenticated, service_role;

-- ── 7. Pejas-Kollektion (4 Platzhalter, aktiv=false) + Set-Ziel (Katalog → 69)
create or replace function public._sva_album_kult_ziel()
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_pejas uuid;
begin
  select id into v_pejas from public.sm_roster where slug = 'p-pejas-e';
  if v_pejas is not null then
    -- 4 Platzhalter (idempotent nach Titel+Kollektion), alle inaktiv bis Freigabe (G2)
    insert into public.sva_album_karten (typ, roster_id, titel, seltenheit, limitiert, kult, kollektion, aktiv, bild_url, rueckseite, credit, saison, sortierung)
    select 'spieler', v_pejas, m.titel, 'bronze', true, true, 'Pejas-Kollektion', false,
           '/album/karten/kult-platzhalter.webp', m.txt, 'Foto: Kabine SVA', v_saison, m.sort
      from (values
        ('Volltreffer',   'Ball in die Weichteile — die Kabine lacht heute noch. Kabinen-Kult, Pejas-Kollektion 1/4.', 901),
        ('Der Messias',   'Blick nach unten, Arme hoch — der Moment, in dem alle „Messias!" riefen. 2/4.', 902),
        ('Kult-Karte 3',  'Motiv folgt — die Kabine entscheidet. 3/4.', 903),
        ('Kult-Karte 4',  'Motiv folgt — die Kabine entscheidet. 4/4.', 904)
      ) as m(titel, txt, sort)
     where not exists (select 1 from public.sva_album_karten k
                        where k.kult and k.kollektion = 'Pejas-Kollektion' and k.titel = m.titel);
  end if;

  -- Set-Ziel „Die Pejas-Kollektion" (alle 4 Kult-Karten der Kollektion)
  insert into public.sva_album_ziele (schluessel, typ, vorlage, titel, beschreibung, karten, anzahl,
                                      belohnung_karten, belohnung_min_seltenheit, belohnung_lose, kategorie, sortierung)
  select 'pejas_kollektion', 'set', 'set', 'Die Pejas-Kollektion', 'Alle vier Kult-Karten der Pejas-Kollektion.',
         array(select id from public.sva_album_karten where kult and kollektion = 'Pejas-Kollektion'),
         null, 1, 'spezial', 3, 'sets', 145
  on conflict (schluessel) do update set karten = excluded.karten, kategorie = excluded.kategorie;
  return 1;
end;
$$;
revoke all on function public._sva_album_kult_ziel() from public, anon, authenticated;
grant execute on function public._sva_album_kult_ziel() to service_role;

-- Admin-Standard + Nachzieher ziehen das Kult-Ziel jetzt mit (Katalog → 69)
create or replace function public.album_admin_ziele_standard()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb;
begin
  perform public.sva_album_admin_pruefen();
  v := public._sva_album_ziele_upsert_v26();
  perform public._sva_album_kult_ziel();
  return jsonb_build_object('angelegt', (v ->> 'angelegt')::int, 'gesamt', (select count(*) from public.sva_album_ziele),
                            'standard', (v ->> 'standard')::int + 1);
end;
$$;
revoke all on function public.album_admin_ziele_standard() from public, anon;
grant execute on function public.album_admin_ziele_standard() to authenticated, service_role;

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
  perform public._sva_album_ziele_upsert_v26();
  perform public._sva_album_kult_ziel();
  return jsonb_build_object('gesamt', (select count(*) from public.sva_album_ziele), 'nachgezogen', true);
end;
$$;

-- ── 8. Wunschkarte: Kult ausschließen (zusätzlich zu limitiert) ──────────────
-- (Tausch ist bereits über „nur echte Doppelte, keine limitierten" ausgeschlossen.)
do $$
begin
  if to_regprocedure('public.album_wunschkarte(uuid, uuid[])') is not null
     and exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'album_wunschkarte'
                    and pg_get_functiondef(p.oid) ~ 'not limitiert' and pg_get_functiondef(p.oid) !~ 'not coalesce\(k\.kult') then
    -- Hinweis im Log: Wunsch-Query filtert limitiert (Kult ist limitiert → ohnehin draußen).
    raise notice 'album_wunschkarte: Kult über limitiert bereits ausgeschlossen.';
  end if;
end $$;

-- ── 9. Admin-Statistik: kultGezogen / kultFans ──────────────────────────────
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
    'kultKarten', (select count(*) from public.sva_album_karten where kult),
    'kultAktiv', (select count(*) from public.sva_album_karten where kult and aktiv),
    'kultGezogen', (select count(*) from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id where k.kult),
    'kultFans', (select count(distinct b.fan_user_id) from public.sva_album_besitz b join public.sva_album_karten k on k.id = b.karte_id where k.kult),
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

-- ── 10. Rechte ───────────────────────────────────────────────────────────────
revoke all on function public.sva_album_v26_nachziehen() from public, anon, authenticated;
grant execute on function public.sva_album_v26_nachziehen() to service_role;

-- ── 10b. Katalog: aktive Kult-Karten mit kult/kollektion anreichern ─────────
create or replace function public.album_katalog()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb := public.sva_album_katalog_v22();
begin
  v := jsonb_set(v, '{regeln,packTypen}', public.sva_album_pack_typen_json());
  -- Kult-Karten (limitiert, aktiv) sind schon in karten[]; nur kult/kollektion ergänzen
  v := jsonb_set(v, '{karten}', coalesce((
    select jsonb_agg(case when k.kult then x.e || jsonb_build_object('kult', true, 'kollektion', k.kollektion) else x.e end order by x.i)
      from jsonb_array_elements(v -> 'karten') with ordinality as x(e, i)
      left join public.sva_album_karten k on k.id = (x.e ->> 'id')::uuid), '[]'::jsonb));
  return v;
end;
$$;
comment on function public.album_katalog() is 'Öffentlich: Album-Katalog + Regeln. v26-K: aktive Kult-Karten mit kult/kollektion.';

-- ── 11. Bestand nachziehen (idempotent; nur wenn Standard-Ziele existieren) ──
select public.sva_album_v26_nachziehen();
