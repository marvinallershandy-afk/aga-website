-- ─────────────────────────────────────────────────────────────────────────────
-- v26 · Paket E — Endgame: Goldene Seite + Wall of Fame (Audit I6)
-- 100 %: das Heft bekommt eine goldene Abschluss-Seite; wer zustimmt, kommt mit
-- Namen an die öffentliche Wall of Fame — sonst als „Fan aus Agathenburg" (G5,
-- Marvin 06.10.: eigener Opt-in, sonst anonym). Name als Snapshot (überlebt
-- Konto-Löschung). Nach 20261021110000 (K). create-or-replace auf K-Stand.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Opt-in + Tabelle ──────────────────────────────────────────────────────
alter table public.sva_album_fans
  add column if not exists wall_opt_in boolean not null default false;

create table if not exists public.sva_album_wall_of_fame (
  saison text not null,
  fan_user_id uuid references auth.users(id) on delete set null,
  name text not null,                 -- Snapshot „Lena B." (überlebt Konto-Löschung)
  at timestamptz not null default now(),
  primary key (saison, name, at)
);
comment on table public.sva_album_wall_of_fame is 'v26-E: volle Alben je Saison. Name = Snapshot (Opt-in: Klarname, sonst „Fan aus Agathenburg").';
alter table public.sva_album_wall_of_fame enable row level security;
-- Lesen über die anon-RPC; Schreiben nur security-definer-intern.

-- ── 2. Ziel vergeben: Wall-Eintrag bei meilenstein_100 (auf K-Stand) ────────
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
  v_name text;
  v_opt boolean;
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
    v_pack := public.sva_album_pack_ziehen_v20(p_fan, 'ziel', null, 0, v_q, z.titel, null, null, false);
  end if;
  if coalesce(z.belohnung_kult, 0) > 0 and v_pack is not null then
    v_kult := public.sva_album_kult_anhaengen(p_fan, v_pack, z.belohnung_kult);
    if v_kult = 0 then
      v_lose := v_lose + public.sva_album_lose_buchen(p_fan, 1, 'ziel', v_q || ':kult', v_saison);
    end if;
  end if;
  v_lose := v_lose + public.sva_album_lose_buchen(p_fan, z.belohnung_lose, 'ziel', v_q, v_saison);
  update public.sva_album_ziel_erreicht set pack_id = v_pack, lose = v_lose
   where ziel_id = z.id and fan_user_id = p_fan and bezug = coalesce(p_bezug, '');

  -- v26-E: Album komplett → Wall of Fame (Name per Opt-in, sonst „Fan aus Agathenburg")
  if z.schluessel = 'meilenstein_100' then
    select f.wall_opt_in into v_opt from public.sva_album_fans f where f.user_id = p_fan;
    v_name := case when coalesce(v_opt, false) then coalesce(public.sva_album_name(p_fan), 'Fan aus Agathenburg')
                   else 'Fan aus Agathenburg' end;
    insert into public.sva_album_wall_of_fame (saison, fan_user_id, name, at)
    values (v_saison, p_fan, v_name, now())
    on conflict do nothing;
  end if;

  return jsonb_strip_nulls(jsonb_build_object('zielId', z.id, 'schluessel', z.schluessel, 'typ', z.typ,
           'kapitel', z.kapitel, 'titel', z.titel, 'packId', v_pack, 'lose', v_lose,
           'kult', nullif(v_kult, 0)));
end;
$$;

-- ── 3. Opt-in setzen (+ eigenen Wall-Eintrag nachziehen) ────────────────────
create or replace function public.album_wall_optin(p_opt boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_saison text := public.sva_album_saison();
  v_name text;
begin
  if v_uid is null or not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    raise exception 'album_kein_profil' using errcode = 'P0001';
  end if;
  update public.sva_album_fans set wall_opt_in = coalesce(p_opt, false) where user_id = v_uid;
  -- bereits auf der Wall? Namen an den Opt-in anpassen (nur eigener, laufende Saison)
  if exists (select 1 from public.sva_album_wall_of_fame w where w.fan_user_id = v_uid and w.saison = v_saison) then
    v_name := case when coalesce(p_opt, false) then coalesce(public.sva_album_name(v_uid), 'Fan aus Agathenburg')
                   else 'Fan aus Agathenburg' end;
    update public.sva_album_wall_of_fame set name = v_name
     where fan_user_id = v_uid and saison = v_saison;
  end if;
  return jsonb_build_object('wallOptIn', coalesce(p_opt, false));
end;
$$;
revoke all on function public.album_wall_optin(boolean) from public, anon;
grant execute on function public.album_wall_optin(boolean) to authenticated, service_role;

-- ── 4. Öffentliche Wall of Fame (anon) ──────────────────────────────────────
create or replace function public.album_wall_of_fame()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_build_object('saison', w.saison, 'name', w.name, 'at', w.at)
                            order by w.saison desc, w.at asc), '[]'::jsonb)
    from public.sva_album_wall_of_fame w;
$$;
revoke all on function public.album_wall_of_fame() from public;
grant execute on function public.album_wall_of_fame() to anon, authenticated, service_role;

-- ── 5. album_mein: wallOptIn + komplett-Flag + komplettAt ───────────────────
-- (als dünne Hülle über die bestehende Fassung, ergänzt nur neue Felder)
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'sva_album_mein_v25e') then
    alter function public.album_mein() rename to sva_album_mein_v25e;
  end if;
end $$;

create or replace function public.album_mein()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_saison text := public.sva_album_saison();
  v jsonb := public.sva_album_mein_v25e();
  v_opt boolean;
  v_komplett timestamptz;
begin
  select f.wall_opt_in into v_opt from public.sva_album_fans f where f.user_id = v_uid;
  select e.at into v_komplett from public.sva_album_ziel_erreicht e
    join public.sva_album_ziele z on z.id = e.ziel_id
   where e.fan_user_id = v_uid and z.schluessel = 'meilenstein_100' and e.saison = v_saison
   limit 1;
  if v -> 'profil' is not null and jsonb_typeof(v -> 'profil') = 'object' then
    v := jsonb_set(v, '{profil,wallOptIn}', to_jsonb(coalesce(v_opt, false)));
  end if;
  return v || jsonb_strip_nulls(jsonb_build_object('komplett', v_komplett is not null, 'komplettAt', v_komplett));
end;
$$;

-- ── 6. Admin-Statistik: komplettFans je Saison (Wall) ───────────────────────
do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'sva_album_statistik_v25e') then
    alter function public.album_admin_statistik() rename to sva_album_statistik_v25e;
  end if;
end $$;
create or replace function public.album_admin_statistik()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb := public.sva_album_statistik_v25e();
begin
  return v || jsonb_build_object(
    'komplettFans', (select count(*) from public.sva_album_wall_of_fame where saison = public.sva_album_saison()),
    'wallGesamt', (select count(*) from public.sva_album_wall_of_fame));
end;
$$;
