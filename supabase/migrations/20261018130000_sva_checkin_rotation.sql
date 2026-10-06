-- ─────────────────────────────────────────────────────────────────────────────
-- v25-D: Rotierender Check-in-Code gegen Fern-Check-in + Vormerken über die Scan-
-- Landing (damit der Check-in einen Login im „fremden Browser“ überlebt).
--
-- Warum: Der statische QR-Token kann abfotografiert und von zu Hause eingelöst
-- werden. Lösung: Die Check-in-Anzeige am Eingang zeigt einen Code, der alle paar
-- Minuten wechselt (zeitbasiert aus dem geheimen Spiel-Token). Der Server akzeptiert
-- das aktuelle ± 1 Intervall. Der statische Token bleibt als Notfall-Fallback.
--
-- Scan-Landing für Neulinge: Beim Scan steht der Fan oft noch nicht im eigenen
-- Browser-Login. Gibt er auf der Landing seine E-Mail ein, wird der Check-in
-- SERVERSEITIG für diese E-Mail vorgemerkt (30 min ab Scan) — nur mit gültigem
-- Rotationscode. Nach dem Login (egal welcher Browser, Magic-Link ODER Code) löst
-- album_checkin_offen_einloesen() die offene Vormerkung ein (ruft intern das
-- bestehende album_checkin — Pack-Gutschrift v24 wird NICHT angefasst).
--
-- Reihenfolge: nach 20261018120000. PGlite-Test: supabase/tests/checkin_rotation.test.mjs.
-- Kein pgcrypto nötig (md5 ist eingebaut; der Code ist kurzlebig + aus geheimem Token).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Einstellungen: Rotation an (Standard) + Intervall ────────────────────
alter table public.sva_album_einstellungen
  add column if not exists checkin_rotation boolean not null default true;
alter table public.sva_album_einstellungen
  add column if not exists checkin_rotation_minuten integer not null default 3;
do $$ begin
  alter table public.sva_album_einstellungen
    add constraint sva_album_checkin_rot_min_check check (checkin_rotation_minuten between 1 and 10);
exception when duplicate_object then null; end $$;
comment on column public.sva_album_einstellungen.checkin_rotation is
  'v25-D: Fern-Check-in verhindern — Code rotiert (Standard an). Statischer QR nur Notfall.';
comment on column public.sva_album_einstellungen.checkin_rotation_minuten is
  'v25-D: Rotationsintervall in Minuten (1–10, Standard 3).';

-- ── 2. Zeitbasierter Code aus dem geheimen Spiel-Token ──────────────────────
-- Index = Zeitfenster seit Epoch. Code = 6 Hex-Zeichen aus md5(token:index) —
-- ohne den geheimen Token (24 Zufallszeichen) nicht vorhersagbar, wechselt je Fenster.
create or replace function public.sva_album_rot_index(p_ts timestamptz, p_min integer)
returns bigint language sql immutable
set search_path to 'public', 'pg_temp'
as $$ select floor(extract(epoch from p_ts) / (greatest(1, p_min) * 60))::bigint $$;

create or replace function public.sva_album_rot_code(p_token text, p_index bigint)
returns text language sql immutable
set search_path to 'public', 'pg_temp'
as $$ select upper(substr(md5(coalesce(p_token, '') || ':' || p_index::text), 1, 6)) $$;

-- Stimmt der eingegebene Code für dieses Spiel (aktuelles ± 1 Intervall)?
create or replace function public.sva_album_rot_gueltig(p_spiel uuid, p_code text)
returns boolean
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_token text;
  v_min   integer;
  v_idx   bigint;
  v_c     text := upper(btrim(coalesce(p_code, '')));
begin
  if v_c !~ '^[0-9A-F]{6}$' then return false; end if;
  select token into v_token from public.sva_album_spielcodes where spiel_id = p_spiel;
  if v_token is null then return false; end if;
  select coalesce(checkin_rotation_minuten, 3) into v_min from public.sva_album_einstellungen where id = 1;
  v_idx := public.sva_album_rot_index(now(), v_min);
  -- aktuelles ± 1 Intervall (Taktabweichung in beide Richtungen)
  return v_c in (
    public.sva_album_rot_code(v_token, v_idx),
    public.sva_album_rot_code(v_token, v_idx - 1),
    public.sva_album_rot_code(v_token, v_idx + 1));
end;
$$;
revoke all on function public.sva_album_rot_index(timestamptz, integer) from public, anon, authenticated;
revoke all on function public.sva_album_rot_code(text, bigint) from public, anon, authenticated;
revoke all on function public.sva_album_rot_gueltig(uuid, text) from public, anon, authenticated;

-- ── 3. Admin/Team: aktueller Code + Vorschau der nächsten 2 h (Offline-Puffer) ─
create or replace function public.album_checkin_code(p_spiel uuid)
returns jsonb
language plpgsql stable security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_token text;
  v_min   integer;
  v_idx   bigint;
  v_jetzt timestamptz := now();
  v_rotation boolean;
  v_codes jsonb := '[]'::jsonb;
  i bigint;
  v_bis bigint;
begin
  if not public.is_sva_team() then raise exception 'album_kein_team' using errcode = '42501'; end if;
  select token into v_token from public.sva_album_spielcodes where spiel_id = p_spiel;
  if v_token is null then raise exception 'album_kein_spielcode' using errcode = 'P0001'; end if;
  select coalesce(checkin_rotation_minuten, 3), coalesce(checkin_rotation, true)
    into v_min, v_rotation from public.sva_album_einstellungen where id = 1;
  v_idx := public.sva_album_rot_index(v_jetzt, v_min);
  v_bis := v_idx + ceil(120.0 / v_min)::bigint;  -- ~2 h im Voraus
  for i in v_idx .. v_bis loop
    v_codes := v_codes || jsonb_build_array(jsonb_build_object(
      'code', public.sva_album_rot_code(v_token, i),
      'von',  to_timestamp(i * v_min * 60),
      'bis',  to_timestamp((i + 1) * v_min * 60)));
  end loop;
  return jsonb_build_object(
    'rotation', v_rotation,
    'intervallMin', v_min,
    'token', v_token,                 -- statischer Fallback-Code
    'jetzt', jsonb_build_object('code', public.sva_album_rot_code(v_token, v_idx),
                                'bis', to_timestamp((v_idx + 1) * v_min * 60)),
    'codes', v_codes);
end;
$$;
revoke all on function public.album_checkin_code(uuid) from public, anon;
grant execute on function public.album_checkin_code(uuid) to authenticated;

-- ── 4. Fan: Check-in per Rotationscode (ruft intern das bestehende album_checkin) ─
create or replace function public.album_checkin_rot(p_spiel uuid, p_code text)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_token text;
begin
  if not public.sva_album_rot_gueltig(p_spiel, p_code) then
    raise exception 'album_code_unbekannt' using errcode = 'P0001';
  end if;
  select token into v_token from public.sva_album_spielcodes where spiel_id = p_spiel;
  return public.album_checkin(v_token);  -- bestehende Logik (Fenster, Pack, Bonus)
end;
$$;
revoke all on function public.album_checkin_rot(uuid, text) from public, anon;
grant execute on function public.album_checkin_rot(uuid, text) to authenticated;

-- ── 5. Vormerken (Scan-Landing, anon) + Einlösen nach Login ─────────────────
create table if not exists public.sva_album_checkin_vormerk (
  email text not null,
  spiel_id uuid not null references public.sm_spiele(id) on delete cascade,
  scan_at timestamptz not null default now(),
  eingeloest_at timestamptz,
  primary key (email, spiel_id)
);
comment on table public.sva_album_checkin_vormerk is
  'v25-D: offener Check-in nach QR-Scan (E-Mail auf der Landing vorgemerkt, 30 min gültig). Nur über RPCs.';
alter table public.sva_album_checkin_vormerk enable row level security;
revoke all on public.sva_album_checkin_vormerk from anon, authenticated;

-- anon merkt vor: nur mit gültigem Rotationscode (verhindert Fremd-Vormerkung).
create or replace function public.album_checkin_vormerken(p_spiel uuid, p_email text, p_code text)
returns jsonb
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
  v_flut  integer;
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'album_email_ungueltig' using errcode = '22023';
  end if;
  if not public.sva_album_rot_gueltig(p_spiel, p_code) then
    raise exception 'album_code_unbekannt' using errcode = 'P0001';
  end if;
  -- einfacher Flutschutz (global, der Rotationscode ist der eigentliche Gate)
  select count(*) into v_flut from public.sva_album_checkin_vormerk where scan_at > now() - interval '1 minute';
  if v_flut > 300 then raise exception 'album_zu_viele' using errcode = 'P0001'; end if;
  insert into public.sva_album_checkin_vormerk (email, spiel_id, scan_at)
  values (v_email, p_spiel, now())
  on conflict (email, spiel_id) do update set scan_at = now(), eingeloest_at = null;
  return jsonb_build_object('ok', true);
end;
$$;
revoke all on function public.album_checkin_vormerken(uuid, text, text) from public;
grant execute on function public.album_checkin_vormerken(uuid, text, text) to anon, authenticated;

-- nach Login: offene Vormerkung (≤ 30 min) für die eigene E-Mail einlösen.
create or replace function public.album_checkin_offen_einloesen()
returns jsonb
language plpgsql volatile security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
  v_uid   uuid := public.sva_album_uid();
  v       record;
  v_res   jsonb;
begin
  if v_email = '' or v_uid is null then return jsonb_build_object('ok', false); end if;
  -- Profil nötig (album_checkin verlangt es) — sonst später erneut versuchen.
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    return jsonb_build_object('ok', false, 'grund', 'kein_profil');
  end if;
  for v in
    select vm.spiel_id, vm.scan_at
      from public.sva_album_checkin_vormerk vm
     where vm.email = v_email and vm.eingeloest_at is null
       and vm.scan_at > now() - interval '30 minutes'
     order by vm.scan_at desc
  loop
    begin
      select public.album_checkin((select token from public.sva_album_spielcodes where spiel_id = v.spiel_id)) into v_res;
      update public.sva_album_checkin_vormerk set eingeloest_at = now() where email = v_email and spiel_id = v.spiel_id;
      return v_res;  -- erste erfolgreiche Einlösung = das Pack, das wir zeigen
    exception when others then
      -- schon eingecheckt / Fenster zu → Vormerkung schließen, nächste prüfen
      update public.sva_album_checkin_vormerk set eingeloest_at = now() where email = v_email and spiel_id = v.spiel_id;
    end;
  end loop;
  return jsonb_build_object('ok', false);
end;
$$;
revoke all on function public.album_checkin_offen_einloesen() from public, anon;
grant execute on function public.album_checkin_offen_einloesen() to authenticated;
