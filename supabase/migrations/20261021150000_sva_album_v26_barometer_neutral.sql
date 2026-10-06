-- ─────────────────────────────────────────────────────────────────────────────
-- v26 · G6 (Leitstand 06.10.): Fan-Barometer-Belohnung ALBUM-NEUTRAL.
-- Das Barometer-Pack bleibt ein Event-Pack (3 Karten, eigene Optik „Gemeinschafts-
-- Pack"), zieht aber NUR aus album-neutralen Quellen: Silber-Glanz-Varianten,
-- aktive Kabinen-Kult-Karten (ohne Doppelte) und die gerade ziehbare Wochenkarte
-- (MOTM/Derby, limitiert) mit Event-Chance. KEINE Basis-Album-Karten. Fällt eine
-- Quelle leer, gibt es für den Slot ein Los statt einer Karte.
-- Damit zählt das Barometer nie fürs Album-% (Dramaturgie „Stammfan ~April", Gate G6).
-- Nach 20261021120000 (B). create-or-replace von sva_album_barometer_verteilen.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.sva_album_barometer_pack(p_fan uuid, p_spiel uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_quelle text := 'barometer:' || p_spiel::text;
  v_n integer := coalesce((select nullif(karten, 0) from public.sva_album_pack_typen where typ = 'event'), 3);
  v_lim_chance integer := coalesce((select limitiert_chance from public.sva_album_pack_typen where typ = 'event'), 60);
  v_karten uuid[] := '{}';
  v_selt text[] := '{}';
  v_woche uuid; v_woche_s text;
  v_var uuid[]; v_var_s text[];
  v_kult uuid[];
  v_kult_benutzt uuid[] := '{}';
  v_lose integer := 0;
  v_id uuid; v_k uuid; v_s text; i integer;
begin
  -- je Fan und Spiel nur einmal
  if exists (select 1 from public.sva_album_packs where fan_user_id = p_fan and quelle = v_quelle) then
    return null;
  end if;

  -- Quelle 1: ziehbare Wochenkarte (MOTM/Derby, limitiert, nicht Kult/geheim)
  select k.id, k.seltenheit into v_woche, v_woche_s
    from public.sva_album_karten k
   where k.aktiv and k.limitiert and not coalesce(k.geheim, false) and not coalesce(k.kult, false)
     and (k.ziehbar_von is not null or k.ziehbar_bis is not null or k.nur_spiel_id is not null)
     and (k.ziehbar_von is null or k.ziehbar_von <= now())
     and (k.ziehbar_bis is null or k.ziehbar_bis > now())
     and (k.nur_spiel_id is null or k.nur_spiel_id = p_spiel)
     and (k.saison is null or k.saison = v_saison)
   order by random() limit 1;

  -- Quelle 2: Silber-Glanz-Varianten (füllen keinen Album-Platz)
  select coalesce(array_agg(k.id), '{}'), coalesce(array_agg(k.seltenheit), '{}') into v_var, v_var_s
    from public.sva_album_karten k
   where k.variante and k.aktiv and (k.saison is null or k.saison = v_saison);

  -- Quelle 3: aktive Kabinen-Kult-Karten, die der Fan noch nicht hat (keine Doppelten)
  select coalesce(array_agg(k.id), '{}') into v_kult
    from public.sva_album_karten k
   where k.kult and k.aktiv and (k.saison is null or k.saison = v_saison)
     and not exists (select 1 from public.sva_album_besitz b where b.fan_user_id = p_fan and b.karte_id = k.id);

  for i in 1 .. v_n loop
    v_k := null; v_s := null;
    if v_woche is not null and random() * 100 < v_lim_chance then
      v_k := v_woche; v_s := v_woche_s;  -- Wochenkarte darf doppelt kommen (limitiert-Sammler)
    elsif cardinality(v_kult) > cardinality(v_kult_benutzt) then
      -- eine noch nicht in diesem Pack benutzte fehlende Kult-Karte
      select x into v_k from unnest(v_kult) x where not (x = any (v_kult_benutzt)) order by random() limit 1;
      if v_k is not null then v_s := 'bronze'; v_kult_benutzt := v_kult_benutzt || v_k; end if;
    end if;
    if v_k is null and cardinality(v_var) > 0 then
      v_k := v_var[1 + floor(random() * cardinality(v_var))::int];
      v_s := coalesce((select vs from unnest(v_var, v_var_s) as u(vid, vs) where vid = v_k limit 1), 'silber');
    end if;
    if v_k is null then
      v_lose := v_lose + 1;  -- keine album-neutrale Quelle frei → Los
    else
      v_karten := v_karten || v_k; v_selt := v_selt || coalesce(v_s, 'bronze');
    end if;
  end loop;

  if v_lose > 0 then
    perform public.sva_album_lose_buchen(p_fan, v_lose, 'ziel', v_quelle || ':lose', v_saison);
  end if;
  if cardinality(v_karten) = 0 then
    return null;  -- rein Lose (alle Quellen leer)
  end if;

  insert into public.sva_album_packs (fan_user_id, spiel_id, art, karten, seltenheiten, saison, quelle, titel, typ)
  values (p_fan, p_spiel, 'event', v_karten, v_selt, v_saison, v_quelle, 'Gemeinschafts-Pack', 'event')
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.sva_album_barometer_pack(uuid, uuid) from public, anon, authenticated;
grant execute on function public.sva_album_barometer_pack(uuid, uuid) to service_role;

-- Verteilung nutzt jetzt das album-neutrale Gemeinschafts-Pack
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
    if public.sva_album_barometer_pack(v_c.fan, p_spiel) is not null then
      v_n := v_n + 1;
    end if;
    perform public.sva_album_ziel_extern(v_c.fan, 'barometer_held', p_spiel::text);
  end loop;
  return v_n;
end;
$$;
