-- ─────────────────────────────────────────────────────────────────────────────
-- v26 · Paket B — Fan-Barometer (Gemeinschaftsziel je Heimspiel)
-- Erreichen alle gemeinsam das Check-in-Ziel, bekommt JEDE/R Eingecheckte ein
-- Event-Pack (v24-Art 'event') + das Ziel „Gemeinsam voll" (barometer_held).
-- Anzeige erst ab Schwelle (barometer_min_anzeige, Standard 5) — kein „2 von 40".
-- Nach 20261021110000 (K). create-or-replace auf dem K-Stand von album_checkin_kern.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Schema ────────────────────────────────────────────────────────────────
alter table public.sva_album_spielcodes
  add column if not exists barometer_ziel integer,
  add column if not exists barometer_erreicht_at timestamptz,
  add column if not exists barometer_pack_at timestamptz;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_album_spielcodes_barometer_chk') then
    alter table public.sva_album_spielcodes add constraint sva_album_spielcodes_barometer_chk
      check (barometer_ziel is null or barometer_ziel between 1 and 999);
  end if;
end $$;
alter table public.sva_album_einstellungen
  add column if not exists barometer_min_anzeige integer not null default 5;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_album_einstellungen_baro_min_chk') then
    alter table public.sva_album_einstellungen add constraint sva_album_einstellungen_baro_min_chk
      check (barometer_min_anzeige between 0 and 999);
  end if;
end $$;

-- ── 2. Verteilung (idempotent): Event-Pack + barometer_held für alle Anwesenden ─
create or replace function public.sva_album_barometer_verteilen(p_spiel uuid)
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_n integer := 0;
  v_c record;
begin
  for v_c in
    select c.fan_user_id as fan from public.sva_album_checkins c
     where c.spiel_id = p_spiel and c.fan_user_id is not null
  loop
    -- Event-Pack je Fan einmalig (quelle-Unique im Pack-Ziehen)
    if public.sva_album_pack_ziehen_v24(v_c.fan, 'event', 'event', p_spiel, null,
         'barometer:' || p_spiel::text, 'Fan-Barometer', null, null, true, null) is not null then
      v_n := v_n + 1;
    end if;
    -- Ziel „Gemeinsam voll" je Spiel einmal pro Fan (wiederholbar, Bezug = Spiel)
    perform public.sva_album_ziel_extern(v_c.fan, 'barometer_held', p_spiel::text);
  end loop;
  return v_n;
end;
$$;
revoke all on function public.sva_album_barometer_verteilen(uuid) from public, anon, authenticated;
grant execute on function public.sva_album_barometer_verteilen(uuid) to service_role;

-- Beim Check-in aufgerufen: prüft Schwelle, verteilt idempotent, gibt Stand zurück.
create or replace function public.sva_album_barometer_checkin(p_spiel uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_code public.sva_album_spielcodes;
  v_stand integer;
begin
  -- Zeilensperre gegen Doppel-Verteilung bei parallelen Check-ins
  select * into v_code from public.sva_album_spielcodes where spiel_id = p_spiel for update;
  if v_code.barometer_ziel is null then
    return null;
  end if;
  select count(*)::int into v_stand from public.sva_album_checkins where spiel_id = p_spiel;
  if v_stand >= v_code.barometer_ziel then
    update public.sva_album_spielcodes
       set barometer_erreicht_at = coalesce(barometer_erreicht_at, now()),
           barometer_pack_at = coalesce(barometer_pack_at, now())
     where spiel_id = p_spiel;
    perform public.sva_album_barometer_verteilen(p_spiel);
  end if;
  return jsonb_build_object('ziel', v_code.barometer_ziel, 'stand', v_stand,
                            'erreicht', v_stand >= v_code.barometer_ziel);
end;
$$;
revoke all on function public.sva_album_barometer_checkin(uuid) from public, anon, authenticated;
grant execute on function public.sva_album_barometer_checkin(uuid) to service_role;

-- ── 3. Öffentliche Anzeige (anon, keine PII) ────────────────────────────────
create or replace function public.album_barometer(p_spiel uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_code public.sva_album_spielcodes;
  v_stand integer;
  v_min integer := coalesce((select barometer_min_anzeige from public.sva_album_einstellungen where id = 1), 5);
begin
  if p_spiel is not null then
    select * into v_code from public.sva_album_spielcodes where spiel_id = p_spiel and barometer_ziel is not null;
  else
    -- nächstes/laufendes Heimspiel mit gesetztem Ziel
    select sc.* into v_code
      from public.sva_album_spielcodes sc
      join public.sm_spiele s on s.id = sc.spiel_id
     where sc.barometer_ziel is not null and s.heim and not coalesce(s.demo, false)
       and s.anstoss > now() - interval '6 hours'
     order by s.anstoss asc
     limit 1;
  end if;
  if v_code.spiel_id is null then
    return null;
  end if;
  select * into v_s from public.sm_spiele where id = v_code.spiel_id;
  select count(*)::int into v_stand from public.sva_album_checkins where spiel_id = v_code.spiel_id;
  return jsonb_strip_nulls(jsonb_build_object(
    'spielId', v_code.spiel_id,
    'gegner', v_s.gegner,
    'anstoss', v_s.anstoss,
    'ziel', v_code.barometer_ziel,
    'stand', case when v_stand >= v_min then v_stand end,
    'text', case when v_stand < v_min then 'Es geht los …' end,
    'erreicht', v_code.barometer_erreicht_at is not null or v_stand >= v_code.barometer_ziel,
    'erreichtAt', v_code.barometer_erreicht_at));
end;
$$;
revoke all on function public.album_barometer(uuid) from public;
grant execute on function public.album_barometer(uuid) to anon, authenticated, service_role;

-- ── 4. Admin: Ziel setzen + Vorschlag (Schnitt × 1,15) ──────────────────────
create or replace function public.album_admin_barometer(p_spiel uuid, p_ziel integer)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_schnitt numeric;
  v_vorschlag integer;
  v_ziel integer;
begin
  perform public.sva_album_admin_pruefen();
  -- p_ziel: null = nur Vorschlag (nichts ändern), 0 = ausschalten, 1..999 = setzen
  if p_ziel is not null and p_ziel not between 0 and 999 then
    raise exception 'album_ungueltig:ziel' using errcode = '22023';
  end if;
  if not exists (select 1 from public.sva_album_spielcodes where spiel_id = p_spiel) then
    raise exception 'album_code_unbekannt' using errcode = 'P0001';
  end if;
  if p_ziel is not null then
    update public.sva_album_spielcodes set barometer_ziel = nullif(p_ziel, 0) where spiel_id = p_spiel;
  end if;
  select barometer_ziel into v_ziel from public.sva_album_spielcodes where spiel_id = p_spiel;
  -- Vorschlag: Ø Check-ins je Heimspiel × 1,15, mind. 10
  select avg(n) into v_schnitt from (
    select count(*)::int as n from public.sva_album_checkins c
      join public.sm_spiele s on s.id = c.spiel_id
     where s.heim and not coalesce(s.demo, false)
     group by c.spiel_id) q;
  v_vorschlag := greatest(10, round(coalesce(v_schnitt, 0) * 1.15))::int;
  return jsonb_build_object('spielId', p_spiel, 'ziel', v_ziel, 'vorschlag', v_vorschlag,
                            'schnitt', round(coalesce(v_schnitt, 0), 1));
end;
$$;
revoke all on function public.album_admin_barometer(uuid, integer) from public, anon;
grant execute on function public.album_admin_barometer(uuid, integer) to authenticated, service_role;

-- ── 5. Check-in-Kern: Barometer anhängen (auf K-Stand aufgesetzt) ───────────
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
  v_baro   jsonb;
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

  -- v26-B: Fan-Barometer (Gemeinschaftsziel) prüfen + ggf. verteilen
  v_baro := public.sva_album_barometer_checkin(v_s.id);

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
    'barometer', v_baro,
    'ziele', v_ziele
  ));
end;
$$;

-- ── 6. Admin-Statistik: Barometer ───────────────────────────────────────────
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
    'barometer', jsonb_build_object(
      'spiele', (select count(*) from public.sva_album_spielcodes where barometer_ziel is not null),
      'erreicht', (select count(*) from public.sva_album_spielcodes where barometer_erreicht_at is not null)),
    'spiele', coalesce((
      select jsonb_agg(jsonb_build_object('spielId', s.id, 'checkins',
               (select count(*) from public.sva_album_checkins c where c.spiel_id = s.id),
               'barometerZiel', sc.barometer_ziel,
               'barometerErreicht', sc.barometer_erreicht_at is not null) order by s.anstoss)
        from public.sm_spiele s
        left join public.sva_album_spielcodes sc on sc.spiel_id = s.id
       where s.heim and s.anstoss > now() - interval '400 days'), '[]'::jsonb),
    'kontakte', coalesce((
      select jsonb_agg(jsonb_build_object('name', f.vorname || ' ' || f.initial || '.', 'email', u.email) order by f.created_at)
        from public.sva_album_fans f
        join auth.users u on u.id = f.user_id
       where f.erinnerung), '[]'::jsonb)
  );
end;
$$;
