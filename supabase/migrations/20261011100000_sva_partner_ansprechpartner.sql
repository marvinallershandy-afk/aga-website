-- ─────────────────────────────────────────────────────────────
-- v19-S (Audit B §2.4): Ansprechpartner mit Gesicht über dem /partner-Formular.
-- „Firmeninhaber kaufen von Menschen."
--
-- Vier neue, optionale Spalten an sva_partner_info (genau 1 Zeile, id=1).
-- Leer = der Block erscheint nicht (NICHT mit Marvins Daten vorbefüllt).
--
-- Bewusst KEINE Änderung an web_snapshot(): Ein paralleler Strang fasst
-- web_snapshot() evtl. ebenfalls an. Stattdessen eine eigene, kleine
-- öffentliche RPC web_partner_kontakt(). Der Build (scripts/fetch-content.mjs)
-- ruft sie zusätzlich auf und legt den Block unter overlay.partner.ansprechpartner.
-- Foto-URL wird dabei wie Sponsor-Logos nach public/generated/ geladen
-- (die Website macht zur Laufzeit 0 externe Requests).
--
-- Idempotent. Test: supabase/tests/partner_ansprechpartner.test.mjs (PGlite).
-- ─────────────────────────────────────────────────────────────

alter table public.sva_partner_info
  add column if not exists ansprechpartner_name text,
  add column if not exists ansprechpartner_rolle text,
  add column if not exists ansprechpartner_foto_url text,
  add column if not exists ansprechpartner_telefon text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_partner_info_ap_name_laenge') then
    alter table public.sva_partner_info
      add constraint sva_partner_info_ap_name_laenge
      check (ansprechpartner_name is null or char_length(ansprechpartner_name) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sva_partner_info_ap_rolle_laenge') then
    alter table public.sva_partner_info
      add constraint sva_partner_info_ap_rolle_laenge
      check (ansprechpartner_rolle is null or char_length(ansprechpartner_rolle) <= 80);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sva_partner_info_ap_foto_laenge') then
    alter table public.sva_partner_info
      add constraint sva_partner_info_ap_foto_laenge
      check (ansprechpartner_foto_url is null or char_length(ansprechpartner_foto_url) <= 500);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sva_partner_info_ap_tel_laenge') then
    alter table public.sva_partner_info
      add constraint sva_partner_info_ap_tel_laenge
      check (ansprechpartner_telefon is null or char_length(ansprechpartner_telefon) <= 40);
  end if;
end$$;

comment on column public.sva_partner_info.ansprechpartner_name is
  'v19-S: Ansprechpartner auf /partner (über dem Formular). Leer = Block unsichtbar.';

-- Öffentliche RPC — nur der Ansprechpartner-Block, nie interne Felder.
-- Gibt null zurück, solange kein Name gepflegt ist.
create or replace function public.web_partner_kontakt()
returns jsonb
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select case
    when nullif(btrim(coalesce(pi.ansprechpartner_name, '')), '') is not null then
      jsonb_strip_nulls(jsonb_build_object(
        'name',    btrim(pi.ansprechpartner_name),
        'rolle',   nullif(btrim(coalesce(pi.ansprechpartner_rolle, '')), ''),
        'fotoUrl', nullif(btrim(coalesce(pi.ansprechpartner_foto_url, '')), ''),
        'telefon', nullif(btrim(coalesce(pi.ansprechpartner_telefon, '')), '')
      ))
    else null
  end
  from public.sva_partner_info pi
  where pi.id = 1;
$$;

comment on function public.web_partner_kontakt() is
  'v19-S: öffentlicher Ansprechpartner-Block für /partner (Build-Overlay). Keine internen Felder.';

revoke all on function public.web_partner_kontakt() from public;
grant execute on function public.web_partner_kontakt() to anon, authenticated;
