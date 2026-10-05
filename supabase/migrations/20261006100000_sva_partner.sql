-- ─────────────────────────────────────────────────────────────────────────────
-- v16-S „Partner-Bereich": Sponsoren gewinnen statt nur „Deine Bande wartet".
--
-- Was diese Migration tut (alles ADDITIV, nur eigene sm_*/sva_*-Objekte —
-- das Supabase-Projekt wird mit einer fremden App geteilt):
--   1. sva_partner_pakete: verkaufbare Pakete (Bande, Trikot, Social Media,
--      „Spieltag präsentiert von", „Live-Ticker präsentiert von", Unterstützer)
--      mit Preis „ab …", Plätzen, Reihenfolge, sichtbar ja/nein. Vorschlags-
--      Seed nur, wenn die Tabelle leer ist (im Admin änderbar).
--   2. sm_sponsoren: + stufe (hauptpartner | partner | unterstuetzer) für die
--      Partner-Wand, + partner_paket_id (welches Paket gekauft wurde → „noch
--      2 frei" rechnet sich selbst).
--   3. sva_partner_info (genau 1 Zeile): Mediadaten (Instagram-Follower,
--      Ø Reichweite/Monat, Ø Zuschauer Heimspiel, Website-Besuche/Monat,
--      Heimspiele/Saison, Stand) + „Live-Ticker präsentiert von" (Sponsor).
--   4. sva_partner_anfragen: Eingang des Anfrage-Formulars auf /partner.
--      Lesen/Bearbeiten nur Admin. Schreiben NUR über die RPC (5).
--   5. partner_anfrage(...) — öffentliche RPC (anon), SECURITY DEFINER:
--      Validierung, Honeypot + Mindest-Ausfüllzeit (still verworfen),
--      Rate-Limit (5/h je E-Mail, 5/h je IP-Hash, 40/h gesamt), Aufräumen
--      (IP-Hash nach 7 Tagen weg, alte Anfragen gelöscht), optional Webhook
--      `partner.anfrage` über pg_net — nur wenn die Extension aktiv ist.
--   6. web_snapshot(): + sponsors[].stufe, + partner { pakete, mediadaten,
--      livePartner }  (nur öffentliche Felder).
--   7. web_live(): + partner { name, logoUrl, url } für „präsentiert von".
--
-- NICHT automatisch anwenden — Reihenfolge siehe docs/PARTNER.md.
-- Idempotent formuliert (mehrfaches Anwenden schadet nicht). Lokal gegen
-- PGlite mit Supabase-Stubs getestet: supabase/tests/partner.test.mjs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Pakete ────────────────────────────────────────────────────────────────
create table if not exists public.sva_partner_pakete (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  beschreibung text check (beschreibung is null or char_length(beschreibung) <= 400),
  -- Leistungen als Liste (eine Zeile = ein Häkchen auf /partner)
  leistungen text[] not null default '{}' check (cardinality(leistungen) <= 12),
  -- Preis „ab … €" (ganze Euro). null = „Preis auf Anfrage".
  preis_ab integer check (preis_ab is null or preis_ab between 0 and 1000000),
  preis_einheit text not null default 'Saison'
    check (preis_einheit in ('Saison', 'Spieltag', 'Monat', 'einmalig')),
  -- Gesamtzahl der Plätze. null = unbegrenzt (keine „noch x frei"-Anzeige).
  plaetze integer check (plaetze is null or plaetze between 0 and 999),
  hervorgehoben boolean not null default false,
  sichtbar boolean not null default true,
  sortierung integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sva_partner_pakete is
  'Partner-Pakete für /partner (Admin → Partner → Pakete). Öffentlich nur über web_snapshot().';
comment on column public.sva_partner_pakete.plaetze is
  'Gesamtplätze. Frei = plaetze − aktive Sponsoren mit diesem Paket (sm_sponsoren.partner_paket_id).';
create index if not exists sva_partner_pakete_sort_idx on public.sva_partner_pakete (sortierung, name);
alter table public.sva_partner_pakete enable row level security;

-- Vorschlags-Seed (nur in eine LEERE Tabelle). Preise sind Startwerte für die
-- Kreisliga und im Admin zu bestätigen/ändern.
insert into public.sva_partner_pakete
  (name, beschreibung, leistungen, preis_ab, preis_einheit, plaetze, hervorgehoben, sortierung)
select * from (values
  ('Bande am Spielfeld',
   'Dein Banner direkt am Waldsportplatz — bei jedem Heimspiel, auf jedem Spielfoto.',
   array['Bandenplatz am Waldsportplatz (ganze Saison)', 'Logo auf der 3D-Bande der Website', 'Logo auf der Partner-Wand', 'Dankes-Post auf Instagram'],
   250, 'Saison', 8, true, 10),
  ('Trikot / Ärmel',
   'Die sichtbarste Fläche im Verein: auf jedem Trikot, in jedem Spielfoto und Reel.',
   array['Logo auf Brust oder Ärmel der 1. Herren', 'In allen Spielfotos und Reels sichtbar', 'Hauptpartner auf der Partner-Wand', 'Vorstellung als Partner auf Instagram'],
   null, 'Saison', 2, false, 20),
  ('Social-Media-Paket',
   'Reichweite in der Region: Wir stellen dich in Stories und einem Reel vor.',
   array['2 Story-Features mit Markierung', '1 Reel mit deinem Unternehmen', 'Logo auf der Partner-Wand'],
   150, 'Saison', null, false, 30),
  ('„Spieltag präsentiert von"',
   'Ein Heimspiel gehört dir: Ankündigung, Durchsage und Spieltagsgrafik mit deinem Namen.',
   array['Nennung in Spieltags-Post und Story', 'Durchsage am Platz', 'Logo auf der Spieltagsgrafik'],
   75, 'Spieltag', 15, false, 40),
  ('„Live-Ticker präsentiert von"',
   'Dein Logo im Kopf des Live-Tickers und auf jeder Endstand-Grafik der Saison.',
   array['Logo im Kopf von aga-erste.de/live bei jedem Spiel', 'Logo auf jeder Endstand-Story-Grafik', 'Nennung im Ticker-Link in der Instagram-Story'],
   300, 'Saison', 1, false, 50),
  ('Unterstützer',
   'Kleiner Betrag, große Wirkung: Du hilfst dem Verein und stehst auf der Partner-Wand.',
   array['Name bzw. Logo auf der Partner-Wand', 'Dank im Saison-Abschluss-Post'],
   50, 'Saison', null, false, 60)
) as v(name, beschreibung, leistungen, preis_ab, preis_einheit, plaetze, hervorgehoben, sortierung)
where not exists (select 1 from public.sva_partner_pakete);

-- ── 2. Sponsoren: Stufe + gekauftes Paket ────────────────────────────────────
alter table public.sm_sponsoren add column if not exists stufe text not null default 'partner';
alter table public.sm_sponsoren add column if not exists partner_paket_id uuid
  references public.sva_partner_pakete(id) on delete set null;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sm_sponsoren_stufe_check') then
    alter table public.sm_sponsoren add constraint sm_sponsoren_stufe_check
      check (stufe in ('hauptpartner', 'partner', 'unterstuetzer'));
  end if;
end $$;
comment on column public.sm_sponsoren.stufe is 'Partner-Wand auf /partner: hauptpartner | partner | unterstuetzer.';
comment on column public.sm_sponsoren.partner_paket_id is 'Gekauftes Partner-Paket (zählt gegen sva_partner_pakete.plaetze).';
create index if not exists sm_sponsoren_partner_paket_idx on public.sm_sponsoren (partner_paket_id);

-- ── 3. Mediadaten + „präsentiert von" (genau eine Zeile) ─────────────────────
create table if not exists public.sva_partner_info (
  id smallint primary key default 1 check (id = 1),
  instagram_follower integer check (instagram_follower is null or instagram_follower between 0 and 100000000),
  reichweite_monat integer check (reichweite_monat is null or reichweite_monat between 0 and 1000000000),
  zuschauer_heim integer check (zuschauer_heim is null or zuschauer_heim between 0 and 100000),
  website_besuche_monat integer check (website_besuche_monat is null or website_besuche_monat between 0 and 100000000),
  heimspiele_saison integer check (heimspiele_saison is null or heimspiele_saison between 0 and 60),
  stand date,
  -- „Live-Ticker präsentiert von": erscheint auf /live (Kopf) + Endstand-Story.
  live_partner_id uuid references public.sm_sponsoren(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by text
);
comment on table public.sva_partner_info is 'Mediadaten für /partner + „Live-Ticker präsentiert von" (genau 1 Zeile, id = 1).';
alter table public.sva_partner_info enable row level security;
insert into public.sva_partner_info (id) values (1) on conflict (id) do nothing;

-- ── 4. Anfragen (Eingang) ────────────────────────────────────────────────────
create table if not exists public.sva_partner_anfragen (
  id uuid primary key default gen_random_uuid(),
  firma text not null check (char_length(firma) between 2 and 120),
  ansprechpartner text not null check (char_length(ansprechpartner) between 2 and 80),
  email text not null check (char_length(email) <= 200 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  telefon text check (telefon is null or char_length(telefon) <= 40),
  paket_id uuid references public.sva_partner_pakete(id) on delete set null,
  -- Name zum Zeitpunkt der Anfrage (Paket kann später umbenannt/gelöscht werden)
  paket_name text,
  nachricht text check (nachricht is null or char_length(nachricht) <= 2000),
  -- Herkunft, z. B. „instagram" (utm_source) — nur Kanal, keine Kennung
  quelle text check (quelle is null or quelle ~ '^[a-z0-9_.-]{1,40}$'),
  datenschutz_ok boolean not null check (datenschutz_ok),
  status text not null default 'neu' check (status in ('neu', 'in_kontakt', 'gewonnen', 'abgelehnt')),
  notiz text check (notiz is null or char_length(notiz) <= 4000),
  -- Tages-gesalzener SHA-256 der IP, nur für das Rate-Limit; nach 7 Tagen geleert.
  ip_hash text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sva_partner_anfragen is
  'Partner-Anfragen von /partner. Schreiben nur über RPC partner_anfrage(); Lesen/Bearbeiten nur Admin.';
create index if not exists sva_partner_anfragen_created_idx on public.sva_partner_anfragen (created_at desc);
create index if not exists sva_partner_anfragen_email_idx on public.sva_partner_anfragen (lower(email), created_at desc);
create index if not exists sva_partner_anfragen_ip_idx on public.sva_partner_anfragen (ip_hash, created_at desc) where ip_hash is not null;
alter table public.sva_partner_anfragen enable row level security;

-- ── RLS: alles nur Admin (Anfragen: KEIN Insert für Clients — nur die RPC) ───
do $$
declare t text;
begin
  foreach t in array array['sva_partner_pakete', 'sva_partner_info', 'sva_partner_anfragen'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_sm_admin()) with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_sm_admin())', t);
  end loop;
end $$;
-- Anfragen legt nur die RPC an (Admins pflegen Status/Notiz, löschen bei Bedarf).
drop policy if exists sva_partner_anfragen_insert on public.sva_partner_anfragen;
-- Mediadaten: genau eine Zeile, kein Löschen.
drop policy if exists sva_partner_info_delete on public.sva_partner_info;

-- Webhook-Andockpunkt registrieren (nur wenn die Automationen-Migration da ist)
do $$
begin
  if to_regclass('public.sm_webhooks') is not null then
    execute $q$ insert into public.sm_webhooks (event) values ('partner.anfrage') on conflict (event) do nothing $q$;
  end if;
end $$;

-- ── 5. Öffentliche RPC: Anfrage speichern ────────────────────────────────────
create or replace function public.partner_anfrage(
  p_firma        text,
  p_name         text,
  p_email        text,
  p_telefon      text default null,
  p_paket_id     uuid default null,
  p_nachricht    text default null,
  p_datenschutz  boolean default false,
  p_website      text default null,   -- Honeypot: Menschen sehen das Feld nicht
  p_dauer_ms     integer default null, -- Ausfüllzeit laut Browser
  p_quelle       text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_firma   text := btrim(regexp_replace(coalesce(p_firma, ''), '\s+', ' ', 'g'));
  v_name    text := btrim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  v_email   text := lower(btrim(coalesce(p_email, '')));
  v_tel     text := nullif(btrim(coalesce(p_telefon, '')), '');
  v_msg     text := nullif(btrim(coalesce(p_nachricht, '')), '');
  v_quelle  text := nullif(lower(btrim(coalesce(p_quelle, ''))), '');
  v_paket   public.sva_partner_pakete;
  v_headers jsonb;
  v_ip      text;
  v_ip_hash text;
  v_n       integer;
  v_id      uuid;
  v_hook    record;
begin
  -- Honeypot / zu schnell ausgefüllt → still „ok" (Bots lernen nichts dazu).
  if nullif(btrim(coalesce(p_website, '')), '') is not null
     or (p_dauer_ms is not null and p_dauer_ms < 1500) then
    return jsonb_build_object('ok', true);
  end if;

  -- Validierung (Meldungen mit Präfix → der Client zeigt sie verständlich an)
  if char_length(v_firma) < 2 or char_length(v_firma) > 120 then
    raise exception 'partner_anfrage_ungueltig:firma' using errcode = '22023';
  end if;
  if char_length(v_name) < 2 or char_length(v_name) > 80 then
    raise exception 'partner_anfrage_ungueltig:name' using errcode = '22023';
  end if;
  if char_length(v_email) > 200 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'partner_anfrage_ungueltig:email' using errcode = '22023';
  end if;
  if v_tel is not null and (char_length(v_tel) > 40 or v_tel !~ '^[0-9 +()/.-]{4,40}$') then
    raise exception 'partner_anfrage_ungueltig:telefon' using errcode = '22023';
  end if;
  if v_msg is not null and char_length(v_msg) > 2000 then
    raise exception 'partner_anfrage_ungueltig:nachricht' using errcode = '22023';
  end if;
  if coalesce(p_datenschutz, false) is not true then
    raise exception 'partner_anfrage_ungueltig:datenschutz' using errcode = '22023';
  end if;
  if v_quelle is not null and v_quelle !~ '^[a-z0-9_.-]{1,40}$' then
    v_quelle := null;
  end if;
  if p_paket_id is not null then
    select * into v_paket from public.sva_partner_pakete where id = p_paket_id and sichtbar;
    -- Unbekanntes/verstecktes Paket → Anfrage trotzdem annehmen, ohne Paket.
  end if;

  -- IP (PostgREST reicht die Request-Header als GUC durch) → Tages-Hash.
  begin
    v_headers := nullif(current_setting('request.headers', true), '')::jsonb;
  exception when others then
    v_headers := null;
  end;
  v_ip := coalesce(
    nullif(btrim(v_headers ->> 'cf-connecting-ip'), ''),
    nullif(btrim(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1)), ''),
    nullif(btrim(v_headers ->> 'x-real-ip'), '')
  );
  if v_ip is not null then
    v_ip_hash := encode(sha256(convert_to(v_ip || '|' || to_char(now() at time zone 'utc', 'YYYY-MM-DD') || '|sva-partner', 'UTF8')), 'hex');
  end if;

  -- Rate-Limit
  select count(*) into v_n from public.sva_partner_anfragen
   where lower(email) = v_email and created_at > now() - interval '1 hour';
  if v_n >= 5 then
    raise exception 'partner_anfrage_limit' using errcode = 'P0001';
  end if;
  if v_ip_hash is not null then
    select count(*) into v_n from public.sva_partner_anfragen
     where ip_hash = v_ip_hash and created_at > now() - interval '1 hour';
    if v_n >= 5 then
      raise exception 'partner_anfrage_limit' using errcode = 'P0001';
    end if;
  end if;
  select count(*) into v_n from public.sva_partner_anfragen where created_at > now() - interval '1 hour';
  if v_n >= 40 then
    raise exception 'partner_anfrage_limit' using errcode = 'P0001';
  end if;

  -- Aufräumen (Datenminimierung, siehe datenschutz.html Abschnitt 7a)
  update public.sva_partner_anfragen set ip_hash = null
   where ip_hash is not null and created_at < now() - interval '7 days';
  delete from public.sva_partner_anfragen
   where (status = 'abgelehnt' and updated_at < now() - interval '6 months')
      or (status in ('neu', 'in_kontakt') and updated_at < now() - interval '12 months');

  insert into public.sva_partner_anfragen
    (firma, ansprechpartner, email, telefon, paket_id, paket_name, nachricht, quelle, datenschutz_ok, ip_hash)
  values
    (v_firma, v_name, v_email, v_tel, v_paket.id, v_paket.name, v_msg, v_quelle, true, v_ip_hash)
  returning id into v_id;

  -- Optional: n8n-Webhook „partner.anfrage" (nur mit pg_net + hinterlegter URL).
  -- Bewusst OHNE E-Mail/Telefon/Nachricht — die stehen im Admin.
  begin
    if to_regclass('public.sm_webhooks') is not null
       and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null then
      execute $q$ select id, url from public.sm_webhooks
                  where event = 'partner.anfrage' and aktiv and coalesce(btrim(url), '') <> '' $q$
        into v_hook;
      if v_hook.url is not null and v_hook.url ~ '^https://' then
        execute 'select net.http_post(url := $1, body := $2)'
          using v_hook.url, jsonb_build_object(
            'event', 'partner.anfrage',
            'firma', v_firma,
            'ansprechpartner', v_name,
            'paket', v_paket.name,
            'quelle', v_quelle,
            'admin', '/admin/sponsoren?tab=anfragen',
            'at', now());
        execute $q$ update public.sm_webhooks set letzter_versand = now(), letzter_status = 'ok' where id = $1 $q$ using v_hook.id;
        if to_regclass('public.sm_webhook_deliveries') is not null then
          execute $q$ insert into public.sm_webhook_deliveries (webhook_id, event, status, payload_excerpt)
                      values ($1, 'partner.anfrage', 'ok', $2) $q$
            using v_hook.id, left('Anfrage: ' || v_firma, 200);
        end if;
      end if;
    end if;
  exception when others then
    -- Ein Webhook-Problem darf die Anfrage nie verlieren.
    null;
  end;

  return jsonb_build_object('ok', true);
end;
$$;

comment on function public.partner_anfrage(text, text, text, text, uuid, text, boolean, text, integer, text) is
  'Öffentliche RPC des Anfrage-Formulars auf /partner: validiert, bremst (Rate-Limit), speichert in sva_partner_anfragen.';

revoke all on function public.partner_anfrage(text, text, text, text, uuid, text, boolean, text, integer, text) from public;
grant execute on function public.partner_anfrage(text, text, text, text, uuid, text, boolean, text, integer, text)
  to anon, authenticated, service_role;

-- ── 6. web_snapshot(): + sponsors[].stufe, + partner ─────────────────────────
-- Unverändert gegenüber 20261005100000 bis auf den Sponsoren-Block und das
-- neue Feld „partner". ACHTUNG beim Mergen paralleler Stränge: wer
-- web_snapshot()/web_live() ebenfalls neu anlegt, muss diese Blöcke übernehmen.
create or replace function public.web_snapshot()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_players  jsonb;
  v_staff    jsonb;
  v_lineup   jsonb;
  v_next     jsonb;
  v_last     jsonb;
  v_form     jsonb;
  v_table    jsonb := '[]'::jsonb;
  v_sponsors jsonb;
  v_settings jsonb;
  v_sections jsonb := '[]'::jsonb;
  v_saison   text;
  v_partner  jsonb;
begin
  select coalesce(jsonb_agg(p.obj order by p.sortierung, p.nummer nulls last, p.name), '[]'::jsonb)
    into v_players
    from (
      select r.sortierung, r.nummer, r.name,
             jsonb_strip_nulls(jsonb_build_object(
               'id',           r.slug,
               'name',         r.name,
               'number',       r.nummer,
               'position',     case upper(coalesce(r.position, ''))
                                 when 'TW' then 'TW' when 'TORWART' then 'TW'
                                 when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
                                 when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
                                 else 'MIT' end,
               'photoUrl',     r.foto_url,
               'cutoutUrl',    r.freisteller_url,
               'isCaptain',    case when r.kapitaen then true end,
               'isNewSigning', case when r.neuzugang then true end,
               'since',        r.im_verein_seit
             )) || jsonb_build_object('number', r.nummer) as obj
        from public.sm_roster r
       where r.aktiv and r.rolle = 'spieler'
    ) p;

  select coalesce(jsonb_agg(s.obj order by s.sortierung, s.name), '[]'::jsonb)
    into v_staff
    from (
      select r.sortierung, r.name,
             jsonb_strip_nulls(jsonb_build_object(
               'id',             r.slug,
               'name',           r.name,
               'role',           r.rolle,
               'since',          r.im_verein_seit,
               'photoUrl',       r.foto_url,
               'cutoutUrl',      r.freisteller_url,
               'contactMessage', r.kontakt_text,
               'isNewSigning',   case when r.neuzugang then true end
             )) as obj
        from public.sm_roster r
       where r.aktiv and r.rolle <> 'spieler'
    ) s;

  select jsonb_build_object(
           'formation',  l.formation,
           'startelf',   coalesce((select jsonb_agg(r.slug order by e.i)
                                     from unnest(l.startelf) with ordinality as e(pid, i)
                                     join public.sm_roster r on r.id = e.pid and r.aktiv and r.rolle = 'spieler'), '[]'::jsonb),
           'bank',       coalesce((select jsonb_agg(r.slug order by e.i)
                                     from unnest(l.bank) with ordinality as e(pid, i)
                                     join public.sm_roster r on r.id = e.pid and r.aktiv and r.rolle = 'spieler'), '[]'::jsonb),
           'matchLabel', nullif(trim(coalesce(l.match_label, '')), ''),
           'updatedAt',  l.created_at
         )
    into v_lineup
    from public.sva_lineup l
   order by l.created_at desc
   limit 1;

  select jsonb_build_object(
           'opponent',    s.gegner,
           'home',        s.heim,
           'kickoff',     s.anstoss,
           'venue',       s.ort,
           'competition', s.wettbewerb,
           'matchday',    s.spieltag_nr
         )
    into v_next
    from public.sm_spiele s
   where s.anstoss >= now() - interval '3 hours'
     and (s.tore_sva is null or s.tore_gegner is null)
   order by s.anstoss asc
   limit 1;

  select jsonb_build_object(
           'opponent',     s.gegner,
           'home',         s.heim,
           'kickoff',      s.anstoss,
           'goalsFor',     s.tore_sva,
           'goalsAgainst', s.tore_gegner
         )
    into v_last
    from public.sm_spiele s
   where s.tore_sva is not null and s.tore_gegner is not null
   order by s.anstoss desc
   limit 1;

  select coalesce(jsonb_agg(f.res order by f.anstoss asc), '[]'::jsonb)
    into v_form
    from (
      select s.anstoss,
             case when s.tore_sva > s.tore_gegner then 'W'
                  when s.tore_sva = s.tore_gegner then 'U'
                  else 'N' end as res
        from public.sm_spiele s
       where s.tore_sva is not null and s.tore_gegner is not null
       order by s.anstoss desc
       limit 5
    ) f;

  -- v16-S: + stufe (Partner-Wand); Hauptpartner zuerst (auch auf der Bande)
  select coalesce(jsonb_agg(x.obj order by x.rang, x.sortierung, x.name), '[]'::jsonb)
    into v_sponsors
    from (
      select sp.sortierung, sp.name,
             case sp.stufe when 'hauptpartner' then 0 when 'partner' then 1 else 2 end as rang,
             jsonb_strip_nulls(jsonb_build_object(
               'name',    sp.name,
               'logoUrl', sp.logo_url,
               'url',     sp.website_url,
               'bande',   sp.bande,
               'stufe',   sp.stufe
             )) as obj
        from public.sm_sponsoren sp
       where sp.aktiv
    ) x;

  -- v16-S: Partner-Bereich (/partner) — Pakete (sichtbar), Mediadaten (nur
  -- gepflegte Felder), „Live-Ticker präsentiert von". Keine Anfragen, keine
  -- Kontakte, keine internen IDs außer der Paket-ID (Formular-Auswahl).
  select jsonb_build_object(
           'pakete', coalesce((
             select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
                      'id',            pk.id,
                      'name',          pk.name,
                      'beschreibung',  nullif(btrim(coalesce(pk.beschreibung, '')), ''),
                      'leistungen',    to_jsonb(pk.leistungen),
                      'preisAb',       pk.preis_ab,
                      'preisEinheit',  pk.preis_einheit,
                      'plaetze',       pk.plaetze,
                      'frei',          case when pk.plaetze is null then null
                                            else greatest(0, pk.plaetze - (
                                              select count(*)::int from public.sm_sponsoren s2
                                               where s2.aktiv and s2.partner_paket_id = pk.id)) end,
                      'hervorgehoben', case when pk.hervorgehoben then true end
                    )) order by pk.sortierung, pk.name)
               from public.sva_partner_pakete pk
              where pk.sichtbar), '[]'::jsonb),
           'mediadaten', (
             select jsonb_strip_nulls(jsonb_build_object(
                      'instagramFollower',   pi.instagram_follower,
                      'reichweiteMonat',     pi.reichweite_monat,
                      'zuschauerHeim',       pi.zuschauer_heim,
                      'websiteBesucheMonat', pi.website_besuche_monat,
                      'heimspieleSaison',    pi.heimspiele_saison,
                      'stand',               pi.stand
                    ))
               from public.sva_partner_info pi where pi.id = 1),
           'livePartner', (
             select jsonb_strip_nulls(jsonb_build_object(
                      'name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url))
               from public.sva_partner_info pi
               join public.sm_sponsoren sp on sp.id = pi.live_partner_id and sp.aktiv
              where pi.id = 1)
         )
    into v_partner;

  -- ── Verein & Links (v15-L: + trainingOrt, Widget-IDs) ──────────────────────
  select jsonb_strip_nulls(jsonb_build_object(
           'fussballDeTeamId',        st.fussball_de_team_id,
           'fussballDeWidgetTabelle', st.fussball_de_widget_tabelle,
           'fussballDeWidgetSpielplan', st.fussball_de_widget_spielplan,
           'fupaUrl',                 st.fupa_url,
           'instagram',               st.instagram,
           'whatsapp',                st.whatsapp,
           'email',                   st.email,
           'training',                st.training,
           'trainingOrt',             nullif(btrim(coalesce(st.training_ort, '')), ''),
           'address',                 st.adresse,
           'saison',                  st.saison,
           'updatedAt',               st.updated_at
         )), st.saison
    into v_settings, v_saison
    from public.sva_settings st
   where st.id = 1;

  if to_regclass('public.sm_tabelle') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object(
               'pos', t.platz, 'team', t.team, 'sp', t.spiele, 'pkt', t.punkte,
               'w', t.siege, 'd', t.unentschieden, 'l', t.niederlagen,
               'goals', t.tore, 'against', t.gegentore, 'self', t.self
             ) order by t.platz), '[]'::jsonb)
        from public.sm_tabelle t
       where $1 is null
          or not exists (select 1 from public.sm_tabelle x where x.saison = $1)
          or t.saison = $1
    $q$ into v_table using v_saison;
  end if;

  if to_regclass('public.sm_website_content') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', c.section_key, 'label', c.label, 'kicker', c.kicker,
               'title', c.titel, 'body', c.body
             )) order by c.sortierung), '[]'::jsonb)
        from public.sm_website_content c
       where c.aktiv
    $q$ into v_sections;
  end if;

  return jsonb_build_object(
    'version',     1,
    'generatedAt', now(),
    'players',     v_players,
    'staff',       v_staff,
    'lineup',      v_lineup,
    'nextMatch',   v_next,
    'lastMatch',   v_last,
    'form',        v_form,
    'table',       coalesce(v_table, '[]'::jsonb),
    'sponsors',    v_sponsors,
    'settings',    coalesce(v_settings, '{}'::jsonb),
    'sections',    coalesce(v_sections, '[]'::jsonb),
    'partner',     jsonb_strip_nulls(v_partner)
  );
end;
$$;
revoke all on function public.web_snapshot() from public;
grant execute on function public.web_snapshot() to anon, authenticated, service_role;

-- ── 7. web_live(): + partner („Live-Ticker präsentiert von") ─────────────────
-- Unverändert gegenüber 20261005100000 bis auf v_partner + Feld „partner".
create or replace function public.web_live()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s        public.sm_spiele;
  v_status   text;
  v_minute   integer;
  v_half     integer;
  v_lineup   public.sva_lineup;
  v_lfor     boolean := false;
  v_ids      uuid[] := '{}';
  v_events   jsonb := '[]'::jsonb;
  v_players  jsonb := '[]'::jsonb;
  v_staff    jsonb := '[]'::jsonb;
  v_settings jsonb := '{}'::jsonb;
  v_prev     jsonb;
  v_match    jsonb;
  v_lj       jsonb;
  v_partner  jsonb;
begin
  select * into v_s from public.sm_spiele s
   where s.status in ('live', 'halbzeit')
   order by s.anstoss desc limit 1;

  if v_s.id is null then
    select * into v_s from public.sm_spiele s
     where (s.status = 'beendet' or (s.tore_sva is not null and s.tore_gegner is not null))
       and s.anstoss between now() - interval '12 hours' and now() + interval '1 hour'
     order by s.anstoss desc limit 1;
  end if;

  if v_s.id is null then
    select * into v_s from public.sm_spiele s
     where s.anstoss >= now() - interval '3 hours'
       and s.status <> 'beendet'
       and (s.tore_sva is null or s.tore_gegner is null)
     order by s.anstoss asc limit 1;
  end if;

  if v_s.id is null then
    select * into v_s from public.sm_spiele s
     where s.status = 'beendet' or (s.tore_sva is not null and s.tore_gegner is not null)
     order by s.anstoss desc limit 1;
  end if;

  -- Verein & Links (immer, auch ohne Spiel)
  select jsonb_strip_nulls(jsonb_build_object(
           'address',          st.adresse,
           'fussballDeTeamId', st.fussball_de_team_id,
           'widgetTabelle',    st.fussball_de_widget_tabelle,
           'widgetSpielplan',  st.fussball_de_widget_spielplan,
           'fupaUrl',          st.fupa_url,
           'instagram',        st.instagram,
           'saison',           st.saison
         ))
    into v_settings
    from public.sva_settings st where st.id = 1;

  if v_s.id is not null then
    v_status := case
                  when v_s.status in ('live', 'halbzeit') then v_s.status
                  when v_s.status = 'beendet' or (v_s.tore_sva is not null and v_s.tore_gegner is not null) then 'beendet'
                  else 'geplant'
                end;

    if v_status = 'live' and v_s.wiederanpfiff_at is not null then
      v_half := 2;
      v_minute := 45 + greatest(1, floor(extract(epoch from (now() - v_s.wiederanpfiff_at)) / 60)::int + 1);
    elsif v_status = 'live' and v_s.anpfiff_at is not null then
      v_half := 1;
      v_minute := greatest(1, floor(extract(epoch from (now() - v_s.anpfiff_at)) / 60)::int + 1);
    elsif v_status = 'halbzeit' then
      v_half := 1;
      v_minute := 45;
    end if;

    -- Aufstellung zum Spiel, sonst die aktuelle
    select * into v_lineup from public.sva_lineup l
     where l.spiel_id = v_s.id order by l.created_at desc limit 1;
    if v_lineup.id is not null then
      v_lfor := true;
    else
      select * into v_lineup from public.sva_lineup l order by l.created_at desc limit 1;
    end if;

    -- Ticker: neueste zuerst, max. 200
    select coalesce(jsonb_agg(e.obj order by e.zeitpunkt desc, e.created_at desc), '[]'::jsonb)
      into v_events
      from (
        select t.zeitpunkt, t.created_at,
               jsonb_strip_nulls(jsonb_build_object(
                 'id',      t.id,
                 'type',    t.typ,
                 'minute',  t.minute,
                 'extra',   nullif(t.nachspielzeit, 0),
                 'player',  r1.slug,
                 'player2', r2.slug,
                 'text',    nullif(btrim(coalesce(t.text, '')), ''),
                 'at',      t.zeitpunkt
               )) as obj
          from public.sva_ticker t
          left join public.sm_roster r1 on r1.id = t.roster_id
          left join public.sm_roster r2 on r2.id = t.roster_id_2
         where t.spiel_id = v_s.id
         order by t.zeitpunkt desc, t.created_at desc
         limit 200
      ) e;

    -- Alle Spieler, die irgendwo vorkommen (Aufstellung, Ticker, MOTM)
    v_ids := coalesce(v_lineup.startelf, '{}') || coalesce(v_lineup.bank, '{}')
             || coalesce((select array_agg(x) from (
                  select t.roster_id as x from public.sva_ticker t where t.spiel_id = v_s.id and t.roster_id is not null
                  union
                  select t.roster_id_2 from public.sva_ticker t where t.spiel_id = v_s.id and t.roster_id_2 is not null
                ) q), '{}');
    if v_s.motm_roster_id is not null then
      v_ids := v_ids || v_s.motm_roster_id;
    end if;

    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id',        r.slug,
             'name',      r.name,
             'number',    r.nummer,
             'position',  case upper(coalesce(r.position, ''))
                            when 'TW' then 'TW' when 'TORWART' then 'TW'
                            when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
                            when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
                            else 'MIT' end,
             'photoUrl',  r.foto_url,
             'cutoutUrl', r.freisteller_url,
             'isCaptain', case when r.kapitaen then true end
           )) order by r.sortierung, r.name), '[]'::jsonb)
      into v_players
      from public.sm_roster r
     where r.id = any (v_ids);

    if v_lineup.id is not null then
      v_lj := jsonb_build_object(
        'formation',  v_lineup.formation,
        'startelf',   coalesce((select jsonb_agg(r.slug order by e.i)
                                  from unnest(v_lineup.startelf) with ordinality as e(pid, i)
                                  join public.sm_roster r on r.id = e.pid), '[]'::jsonb),
        'bank',       coalesce((select jsonb_agg(r.slug order by e.i)
                                  from unnest(v_lineup.bank) with ordinality as e(pid, i)
                                  join public.sm_roster r on r.id = e.pid), '[]'::jsonb),
        'forMatch',   v_lfor,
        'matchLabel', nullif(btrim(coalesce(v_lineup.match_label, '')), ''),
        'updatedAt',  v_lineup.created_at
      );
    end if;

    v_match := jsonb_strip_nulls(jsonb_build_object(
      'id',              v_s.id,
      'opponent',        v_s.gegner,
      'home',            v_s.heim,
      'kickoff',         v_s.anstoss,
      'venue',           v_s.ort,
      'competition',     v_s.wettbewerb,
      'matchday',        v_s.spieltag_nr,
      'status',          v_status,
      'half',            v_half,
      'minute',          v_minute,
      'anpfiffAt',       v_s.anpfiff_at,
      'wiederanpfiffAt', v_s.wiederanpfiff_at,
      'motm',            (select r.slug from public.sm_roster r where r.id = v_s.motm_roster_id),
      'updatedAt',       v_s.live_updated_at
    )) || jsonb_build_object(
      'goalsFor',     case when v_status = 'beendet' and v_s.tore_sva is not null then v_s.tore_sva else v_s.live_tore_sva end,
      'goalsAgainst', case when v_status = 'beendet' and v_s.tore_gegner is not null then v_s.tore_gegner else v_s.live_tore_gegner end
    );

    -- Trainerstab (für die Aufstellung)
    select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id', r.slug, 'name', r.name, 'role', r.rolle,
             'photoUrl', r.foto_url, 'cutoutUrl', r.freisteller_url
           )) order by r.sortierung, r.name), '[]'::jsonb)
      into v_staff
      from public.sm_roster r
     where r.aktiv and r.rolle <> 'spieler';
  end if;

  -- Letztes beendetes Spiel vor dem aktuellen (für „Zuletzt: 2:1 gegen …")
  select jsonb_build_object(
           'opponent',     s.gegner,
           'home',         s.heim,
           'kickoff',      s.anstoss,
           'goalsFor',     s.tore_sva,
           'goalsAgainst', s.tore_gegner
         )
    into v_prev
    from public.sm_spiele s
   where s.tore_sva is not null and s.tore_gegner is not null
     and (v_s.id is null or s.id <> v_s.id)
     and s.anstoss < coalesce(v_s.anstoss, now())
   order by s.anstoss desc
   limit 1;

  -- v16-S: „Live-Ticker präsentiert von" (nur aktiver Sponsor, nur öffentliche Felder)
  select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url))
    into v_partner
    from public.sva_partner_info pi
    join public.sm_sponsoren sp on sp.id = pi.live_partner_id and sp.aktiv
   where pi.id = 1;

  return jsonb_build_object(
    'version',   1,
    'serverNow', now(),
    'match',     v_match,
    'events',    v_events,
    'lineup',    v_lj,
    'players',   v_players,
    'staff',     v_staff,
    'previous',  v_prev,
    'settings',  coalesce(v_settings, '{}'::jsonb),
    'partner',   v_partner
  );
end;
$$;

comment on function public.web_live() is
  'Öffentliche Live-Lese-Schicht (/live, Spieltag-Leiste): aktuelles/nächstes Spiel, Spielstand, Minute, Ticker, Aufstellung. Nur veröffentlichbare Felder.';

revoke all on function public.web_live() from public;
grant execute on function public.web_live() to anon, authenticated, service_role;

