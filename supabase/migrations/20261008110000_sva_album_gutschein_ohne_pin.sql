-- ─────────────────────────────────────────────────────────────────────────────
-- v17-D: Album-Gutschein ohne Stand-PIN.
-- Einlösen = Knopf „Einlösen“ → Bestätigung „Wirklich einlösen? Danach ist der
-- Gutschein verbraucht.“ → Ja → Status eingelöst (Zeitstempel). Der Helfer am
-- Stand sieht den großen Haken + Uhrzeit; ein zweites Einlösen ist unmöglich.
--
-- Was diese Migration tut:
--   1. album_gutschein_einloesen(p_gutschein uuid) — NEUE Signatur ohne PIN:
--      nur der eigene Gutschein (sonst album_gutschein_unbekannt), Verlosungs-
--      Los nicht am Stand, schon eingelöst → { ok:false, grund:'schon_eingeloest' }.
--      Zeilen-Sperre (for update) → doppeltes Antippen löst nur EINMAL ein.
--   2. Alte PIN-Funktionen entfernt: album_gutschein_einloesen(uuid, text),
--      album_admin_pin(text). Spalten stand_pin_* und Tabelle
--      sva_album_pin_fehler bleiben (unbenutzt, von album_konto_loeschen noch
--      referenziert) — keine Daten gehen verloren.
-- Nach 20261007100000_sva_album.sql anwenden. Idempotent.
-- PGlite-Test: supabase/tests/album.test.mjs (Abschnitt „Gutschein einlösen“).
-- ─────────────────────────────────────────────────────────────────────────────

drop function if exists public.album_gutschein_einloesen(uuid, text);
drop function if exists public.album_admin_pin(text);

create or replace function public.album_gutschein_einloesen(p_gutschein uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_g   public.sva_album_gutscheine;
begin
  select * into v_g from public.sva_album_gutscheine g
   where g.id = p_gutschein and g.fan_user_id = v_uid
   for update;
  if v_g.id is null then
    raise exception 'album_gutschein_unbekannt' using errcode = 'P0001';
  end if;
  if v_g.stufe = 'komplett' then
    return jsonb_build_object('ok', false, 'grund', 'verlosung');
  end if;
  if v_g.status = 'eingeloest' then
    return jsonb_build_object('ok', false, 'grund', 'schon_eingeloest', 'eingeloestAt', v_g.eingeloest_at);
  end if;

  update public.sva_album_gutscheine
     set status = 'eingeloest', eingeloest_at = now(), eingeloest_durch = 'stand'
   where id = v_g.id;
  return jsonb_build_object('ok', true, 'eingeloestAt', now());
end;
$$;
comment on function public.album_gutschein_einloesen(uuid) is
  'v17-D: Fan löst den eigenen Gutschein am Stand ein (Bestätigung im Client, kein PIN). Einmalig.';

revoke all on function public.album_gutschein_einloesen(uuid) from public, anon;
grant execute on function public.album_gutschein_einloesen(uuid) to authenticated, service_role;

comment on column public.sva_album_einstellungen.stand_pin_hash is 'Unbenutzt seit v17-D (Gutschein ohne PIN).';
comment on table public.sva_album_pin_fehler is 'Unbenutzt seit v17-D (Gutschein ohne PIN). Bleibt für album_konto_loeschen bestehen.';
