-- ─────────────────────────────────────────────────────────────────────────────
-- v23-L (Zeitplan): pg_cron ruft alle 30 s den FuPa-Live-Bot — ABER NUR, wenn ein
-- Spielfenster läuft und fupa_live_modus = 'an'. Außerhalb des Fensters: null Aufrufe.
--
-- ⚠️ ERST ANWENDEN, wenn Marvin das geprüft/vorbereitet hat (docs/LIVE_BOT.md):
--   1. Extensions vorhanden?  select extname, extversion from pg_extension
--        where extname in ('pg_cron','pg_net');    -- pg_cron ≥ 1.5 für '30 seconds'
--      Fehlt eine: im Supabase-Dashboard (Database → Extensions) aktivieren.
--   2. Vault-Secrets anlegen (Dashboard → Project Settings → Vault):
--        sva_fupa_live_url    = https://<ref>.supabase.co/functions/v1/fupa-live
--        sva_fupa_live_secret = <FUPA_LIVE_CRON_SECRET>   (gleicher Wert wie das
--        Function-Secret FUPA_LIVE_CRON_SECRET)
--   3. Function deployen:  supabase functions deploy fupa-live --no-verify-jwt
-- OHNE diese Datei läuft alles andere (Pult, Admin, web_live) ganz normal weiter;
-- nur der automatische Abruf fehlt. „Jetzt abrufen" im Pult geht auch ohne Cron.
--
-- NICHT automatisch anwenden. Reihenfolge: nach 20261015100000_sva_live_v23.sql.
-- ─────────────────────────────────────────────────────────────────────────────

-- Body-Validierung aus: die Function referenziert net.* und vault.* — die gibt
-- es erst mit den Extensions. In Produktion vorhanden; im PGlite-Test nicht, dort
-- wird die Function nur angelegt (nie aufgerufen). Am Ende wieder an.
set check_function_bodies = off;

-- pg_net (HTTP aus der DB). In Produktion verfügbar; im PGlite-Test nicht → der
-- Fehler wird geschluckt, alles andere läuft weiter.
do $$
begin
  create extension if not exists pg_net;
exception when others then
  raise notice 'pg_net nicht verfügbar (ok im Test): %', sqlerrm;
end $$;
-- pg_cron wird im Dashboard aktiviert (globale Extension im geteilten Projekt).

-- Spielfenster prüfen und ggf. den Bot rufen. security definer, nur Cron/Service.
create or replace function public.sva_fupa_live_tick()
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp', 'vault', 'net'
as $$
declare
  v_modus   text;
  v_konf    boolean;
  v_url     text;
  v_secret  text;
  s         record;
  v_konf_heute boolean;
begin
  select fupa_live_modus, konferenz_an into v_modus, v_konf from public.sva_settings where id = 1;
  if coalesce(v_modus, 'aus') <> 'an' then return; end if;

  select decrypted_secret into v_url     from vault.decrypted_secrets where name = 'sva_fupa_live_url'    limit 1;
  select decrypted_secret into v_secret  from vault.decrypted_secrets where name = 'sva_fupa_live_secret' limit 1;
  if v_url is null or v_secret is null then return; end if;

  -- 1. Laufende SVA-Spiele im Fenster (Anstoß −30 min … +3 h), effektive Quelle fupa.
  for s in
    select sp.* from public.sm_spiele sp
     where sp.fupa_id is not null
       and coalesce(sp.demo, false) = false
       and sp.anstoss between now() - interval '3 hours' and now() + interval '30 minutes'
       and (sp.live_quelle = 'fupa' or sp.live_quelle = 'auto')
       and (sp.fupa_pause_bis is null or sp.fupa_pause_bis < now())
       -- Fensterende: 20 min nach dem ersten POST-Abruf nicht mehr pollen
       and not (sp.fupa_section = 'POST' and sp.fupa_post_at is not null and sp.fupa_post_at < now() - interval '20 minutes')
  loop
    perform net.http_post(
      url     := v_url,
      headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
      body    := jsonb_build_object('aufgabe', 'spiel', 'spiel_id', s.id),
      timeout_milliseconds := 8000);
  end loop;

  -- 2. Konferenz (nur an Tagen mit SVA-Ligaspiel, ~alle 60 s = nur in der ersten
  --    Sekundenhälfte jedes 30-s-Ticks), solange nicht alle Liga-Spiele beendet sind.
  if coalesce(v_konf, true) and extract(second from now()) < 30 then
    select exists (
      select 1 from public.sm_spiele sp
       where sp.demo is not true and sp.spieltag_nr is not null
         and sp.anstoss::date = current_date
    ) into v_konf_heute;
    if v_konf_heute then
      perform net.http_post(
        url     := v_url,
        headers := jsonb_build_object('content-type', 'application/json', 'x-cron-secret', v_secret),
        body    := jsonb_build_object('aufgabe', 'konferenz', 'datum', to_char(current_date, 'YYYY-MM-DD')),
        timeout_milliseconds := 8000);
    end if;
  end if;
end;
$$;
revoke all on function public.sva_fupa_live_tick() from public, anon, authenticated;

-- Zeitpläne (eindeutige Namen im geteilten Projekt). In Produktion vorhanden;
-- im PGlite-Test fehlt pg_cron → Fehler geschluckt.
do $$
begin
  perform cron.schedule('sva_fupa_live_tick', '30 seconds', $q$select public.sva_fupa_live_tick()$q$);
  perform cron.schedule('sva_reaktion_verdichten', '0 4 * * *', $q$select public.sva_reaktion_verdichten()$q$);
exception when others then
  raise notice 'pg_cron nicht verfügbar (ok im Test): %', sqlerrm;
end $$;

reset check_function_bodies;

-- Zum Entfernen (falls nötig):
--   select cron.unschedule('sva_fupa_live_tick');
--   select cron.unschedule('sva_reaktion_verdichten');
