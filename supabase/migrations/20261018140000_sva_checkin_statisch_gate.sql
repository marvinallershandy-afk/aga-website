-- ─────────────────────────────────────────────────────────────────────────────
-- v25-D (Nachtrag): Fern-Check-in wirklich schließen.
-- Solange der statische Spiel-Token direkt per album_checkin einlösbar ist, hilft
-- die Rotation nicht — ein abfotografierter alter QR funktioniert weiter.
-- Neu: Die bisherige Logik heißt album_checkin_kern (nur intern). album_checkin
-- (statischer Token, für Fans) prüft vorher: Ist die Rotation AN, wird der
-- statische Token abgelehnt (album_code_veraltet) — er gilt nur im Notfall-Modus
-- (Rotation im Admin aus). album_checkin_rot und album_checkin_offen_einloesen
-- rufen direkt den Kern. Dazu: Vormerkungen (E-Mail-Adressen) nach 1 Tag löschen.
-- Nach 20261018130000 anwenden. Wer album_checkin später neu definiert, muss den
-- Kern album_checkin_kern ändern, nicht diesen Wrapper.
-- ─────────────────────────────────────────────────────────────────────────────

do $$
begin
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
                  where n.nspname = 'public' and p.proname = 'album_checkin_kern') then
    alter function public.album_checkin(text) rename to album_checkin_kern;
  end if;
end $$;
revoke all on function public.album_checkin_kern(text) from public, anon, authenticated;
grant execute on function public.album_checkin_kern(text) to service_role;

create or replace function public.album_checkin(p_token text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if coalesce((select checkin_rotation from public.sva_album_einstellungen where id = 1), true) then
    raise exception 'album_code_veraltet' using errcode = 'P0001',
      hint = 'Rotation ist an: bitte den QR-Code an der Check-in-Anzeige scannen.';
  end if;
  return public.album_checkin_kern(p_token);
end;
$$;
comment on function public.album_checkin(text) is
  'v25-D: statischer Check-in — nur bei ausgeschalteter Rotation (Notfall). Logik: album_checkin_kern.';
revoke all on function public.album_checkin(text) from public, anon;
grant execute on function public.album_checkin(text) to authenticated, service_role;

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
  return public.album_checkin_kern(v_token);
end;
$$;
revoke all on function public.album_checkin_rot(uuid, text) from public, anon;
grant execute on function public.album_checkin_rot(uuid, text) to authenticated;

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
      select public.album_checkin_kern((select token from public.sva_album_spielcodes where spiel_id = v.spiel_id)) into v_res;
      update public.sva_album_checkin_vormerk set eingeloest_at = now() where email = v_email and spiel_id = v.spiel_id;
      return v_res;
    exception when others then
      update public.sva_album_checkin_vormerk set eingeloest_at = now() where email = v_email and spiel_id = v.spiel_id;
    end;
  end loop;
  return jsonb_build_object('ok', false);
end;
$$;
revoke all on function public.album_checkin_offen_einloesen() from public, anon;
grant execute on function public.album_checkin_offen_einloesen() to authenticated;

-- Datensparsamkeit: Vormerkungen nach 1 Tag löschen (stündlich, wenn pg_cron da ist).
create or replace function public.sva_album_vormerk_aufraeumen()
returns integer
language sql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
  with weg as (
    delete from public.sva_album_checkin_vormerk where scan_at < now() - interval '1 day' returning 1
  )
  select count(*)::integer from weg;
$$;
revoke all on function public.sva_album_vormerk_aufraeumen() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'sva_album_vormerk_aufraeumen';
    perform cron.schedule('sva_album_vormerk_aufraeumen', '17 * * * *', 'select public.sva_album_vormerk_aufraeumen()');
  end if;
end $$;
