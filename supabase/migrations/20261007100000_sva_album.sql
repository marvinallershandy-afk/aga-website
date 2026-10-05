-- ─────────────────────────────────────────────────────────────────────────────
-- v17-A „SVA Sammelalbum“ mit QR-Check-in (Treue-Pass + Sticker-Album).
-- Spezifikation: SVA_KONZEPT_FANERLEBNIS.md, Abschnitt 1 + Update A.
--
-- Was diese Migration tut (alles ADDITIV, nur eigene sva_*-Objekte — das
-- Supabase-Projekt wird mit einer fremden App geteilt):
--   1. sva_album_einstellungen (genau 1 Zeile): Seltenheits-Gewichte
--      (70/22/7/1), Karten pro Pack, Doppelten-Bremse, Check-in-Fenster,
--      Heimsieg-Bonus, Belohnungs-Schwellen (5/10 + Album komplett) mit
--      „präsentiert von“-Partnern, Stand-PIN (nur als gesalzener Hash).
--   2. sva_album_karten: Karten-Katalog (spieler | moment | partner | fan),
--      Seltenheit bronze | silber | gold | spezial, Saison, aktiv.
--   3. sva_album_spielcodes: pro Heimspiel ein geheimer Check-in-Token
--      (+ „Check-in präsentiert von“-Partner), im Admin neu erzeugbar.
--   4. Fan-Daten: sva_album_fans (Profil + Einwilligungen), _checkins
--      (1 pro Fan und Spiel), _packs (serverseitig gezogen), _besitz,
--      _gutscheine (offen | eingeloest), _pin_fehler (Sperre gegen Raten).
--      Fans haben KEINEN direkten Tabellenzugriff — nur die RPCs unten.
--      Admins (is_sm_admin(), Allowlist, unverändert) lesen alles.
--   5. RPCs für Fans (nur eingeloggt, SECURITY DEFINER): album_checkin,
--      album_pack_oeffnen, album_mein, album_profil_speichern,
--      album_gutschein_einloesen (Stand-PIN), album_konto_loeschen.
--      Öffentlich (auch anon): album_katalog, album_rangliste,
--      album_checkins_pro_spiel (Zuschauer-Check-ins als Aggregat).
--      Admin: album_admin_spielerkarten, album_admin_code, album_admin_pin,
--      album_admin_statistik.
--   6. Heimsieg-Bonus: Trigger auf sm_spiele — bei feststehendem Heimsieg
--      bekommt jeder eingecheckte Fan ein Bonus-Pack (idempotent).
--   7. web_snapshot(): partner.mediadaten + checkinsSchnitt/checkinsSpiele
--      (Ø gezählte Zuschauer-Check-ins pro Heimspiel der Saison).
--
-- Die Ziehung passiert IMMER hier in der Datenbank, nie im Browser.
-- NICHT automatisch anwenden — Reihenfolge siehe docs/ALBUM.md.
-- Idempotent formuliert (mehrfaches Anwenden schadet nicht). Lokal gegen
-- PGlite mit Supabase-Stubs getestet: supabase/tests/album.test.mjs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 0. Saison (aus Verein & Links) ──────────────────────────────────────────
create or replace function public.sva_album_saison()
returns text
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce((select nullif(btrim(st.saison), '') from public.sva_settings st where st.id = 1), '2026/27');
$$;
comment on function public.sva_album_saison() is 'Aktuelle Album-Saison = sva_settings.saison (z. B. 2026/27).';

-- ── 1. Einstellungen (genau eine Zeile) ─────────────────────────────────────
create table if not exists public.sva_album_einstellungen (
  id smallint primary key default 1 check (id = 1),
  -- false = Album pausiert (Check-ins werden freundlich abgelehnt)
  aktiv boolean not null default true,
  -- Seltenheits-Gewichte (relativ; 70/22/7/1 = Prozent). Seltenheiten ohne
  -- aktive Karte fallen aus der Ziehung, der Rest wird neu verteilt.
  gewicht_bronze  integer not null default 70 check (gewicht_bronze between 0 and 1000),
  gewicht_silber  integer not null default 22 check (gewicht_silber between 0 and 1000),
  gewicht_gold    integer not null default 7  check (gewicht_gold between 0 and 1000),
  gewicht_spezial integer not null default 1  check (gewicht_spezial between 0 and 1000),
  karten_pro_pack integer not null default 3 check (karten_pro_pack between 1 and 5),
  -- Doppelten-Bremse: mit dieser Wahrscheinlichkeit (%) wird innerhalb der
  -- gezogenen Seltenheit eine Karte gewählt, die der Fan noch NICHT hat.
  doppelte_bremse integer not null default 50 check (doppelte_bremse between 0 and 100),
  -- Check-in-Fenster relativ zum Anstoß. 135 min ≈ Abpfiff + 30 min.
  -- Endet der Ticker später (Abpfiff-Ereignis), gilt Abpfiff + 30 min.
  fenster_vor_min  integer not null default 60  check (fenster_vor_min between 0 and 240),
  fenster_nach_min integer not null default 135 check (fenster_nach_min between 15 and 360),
  bonus_heimsieg boolean not null default true,
  schwelle_1 integer not null default 5 check (schwelle_1 between 1 and 60),
  belohnung_1 text not null default 'Freibier oder Bratwurst' check (char_length(btrim(belohnung_1)) between 2 and 80),
  partner_1_id uuid references public.sm_sponsoren(id) on delete set null,
  schwelle_2 integer not null default 10 check (schwelle_2 between 2 and 60),
  belohnung_2 text not null default 'SVA-Fanartikel' check (char_length(btrim(belohnung_2)) between 2 and 80),
  partner_2_id uuid references public.sm_sponsoren(id) on delete set null,
  belohnung_komplett text not null default 'Los für die Saison-Verlosung' check (char_length(btrim(belohnung_komplett)) between 2 and 80),
  partner_komplett_id uuid references public.sm_sponsoren(id) on delete set null,
  -- Stand-PIN (4 Ziffern) NUR als gesalzener SHA-256 (album_admin_pin).
  stand_pin_hash text,
  stand_pin_salt text,
  stand_pin_gesetzt_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by text,
  constraint sva_album_einstellungen_schwellen check (schwelle_2 > schwelle_1),
  constraint sva_album_einstellungen_gewichte check (gewicht_bronze + gewicht_silber + gewicht_gold + gewicht_spezial > 0)
);
comment on table public.sva_album_einstellungen is 'Sammelalbum: Gewichte, Pack-Größe, Check-in-Fenster, Belohnungen, Stand-PIN-Hash (genau 1 Zeile, nur Admin).';
alter table public.sva_album_einstellungen enable row level security;
insert into public.sva_album_einstellungen (id) values (1) on conflict (id) do nothing;

-- ── 2. Karten-Katalog ───────────────────────────────────────────────────────
create table if not exists public.sva_album_karten (
  id uuid primary key default gen_random_uuid(),
  typ text not null check (typ in ('spieler', 'moment', 'partner', 'fan')),
  -- Spielerkarte → Kader-Eintrag (mehrere Versionen je Spieler möglich:
  -- Bronze-Basis + Silber/Gold/Spezial). Partnerkarte → Sponsor.
  roster_id uuid references public.sm_roster(id) on delete set null,
  sponsor_id uuid references public.sm_sponsoren(id) on delete set null,
  titel text not null check (char_length(btrim(titel)) between 2 and 60),
  untertitel text check (untertitel is null or char_length(untertitel) <= 80),
  bild_url text check (bild_url is null or (char_length(bild_url) <= 500 and bild_url ~ '^(https://|/)')),
  walkout_url text check (walkout_url is null or (char_length(walkout_url) <= 500 and walkout_url ~ '^(https://|/)')),
  seltenheit text not null default 'bronze' check (seltenheit in ('bronze', 'silber', 'gold', 'spezial')),
  aktiv boolean not null default true,
  -- null = gilt in jeder Saison
  saison text check (saison is null or saison ~ '^[0-9]{4}(/[0-9]{2})?$'),
  sortierung integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sva_album_karten is 'Sammelalbum-Katalog. Öffentlich nur über album_katalog(); Pflege im Admin → Album.';
create index if not exists sva_album_karten_saison_idx on public.sva_album_karten (aktiv, saison, seltenheit);
create unique index if not exists sva_album_karten_spieler_uniq
  on public.sva_album_karten (roster_id, seltenheit, coalesce(saison, ''))
  where typ = 'spieler' and roster_id is not null;
alter table public.sva_album_karten enable row level security;

-- ── 3. Check-in-Codes je Heimspiel ──────────────────────────────────────────
create table if not exists public.sva_album_spielcodes (
  spiel_id uuid primary key references public.sm_spiele(id) on delete cascade,
  token text not null unique check (token ~ '^[a-z0-9]{16,64}$'),
  -- „Check-in präsentiert von …“ (Logo auf dem QR-Plakat und im Pack)
  partner_id uuid references public.sm_sponsoren(id) on delete set null,
  erzeugt_at timestamptz not null default now(),
  erzeugt_von text,
  -- Heimsieg-Bonus an alle Eingecheckten verteilt
  bonus_at timestamptz
);
comment on table public.sva_album_spielcodes is 'Geheimer Check-in-Token pro Heimspiel (QR-Code am Eingang). Nur Admin.';
alter table public.sva_album_spielcodes enable row level security;

-- ── 4. Fan-Daten ────────────────────────────────────────────────────────────
-- user_id = auth.users.id. Ein Fan-Konto ist ein ganz normaler Login OHNE
-- Eintrag in sm_admins → is_sm_admin() bleibt false, kein Admin-Recht.
create table if not exists public.sva_album_fans (
  user_id uuid primary key references auth.users(id) on delete cascade,
  vorname text not null check (char_length(vorname) between 2 and 24),
  initial text not null check (char_length(initial) = 1),
  -- freiwillig: erscheint als „Vorname I.“ in der Rangliste „Treueste Fans“
  rangliste boolean not null default false,
  -- freiwillig: E-Mail-Erinnerung vor Heimspielen
  erinnerung boolean not null default false,
  einwilligung_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sva_album_fans is 'Sammelalbum-Fanprofil (Vorname + Initial, Einwilligungen). Schreiben nur über RPC.';
alter table public.sva_album_fans enable row level security;

create table if not exists public.sva_album_checkins (
  id uuid primary key default gen_random_uuid(),
  -- null = Konto gelöscht (Zählung bleibt anonym erhalten)
  fan_user_id uuid references auth.users(id) on delete set null,
  spiel_id uuid not null references public.sm_spiele(id) on delete cascade,
  saison text not null,
  created_at timestamptz not null default now(),
  constraint sva_album_checkins_einmal unique (fan_user_id, spiel_id)
);
comment on table public.sva_album_checkins is 'Zuschauer-Check-ins (1 pro Konto und Spiel). Aggregat öffentlich über album_checkins_pro_spiel().';
create index if not exists sva_album_checkins_spiel_idx on public.sva_album_checkins (spiel_id);
create index if not exists sva_album_checkins_saison_idx on public.sva_album_checkins (saison, fan_user_id);
alter table public.sva_album_checkins enable row level security;

create table if not exists public.sva_album_packs (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  spiel_id uuid references public.sm_spiele(id) on delete set null,
  art text not null check (art in ('checkin', 'heimsieg', 'geschenk')),
  karten uuid[] not null,
  seltenheiten text[] not null,
  -- beim Öffnen gesetzt: war die jeweilige Karte neu für den Fan?
  neu boolean[],
  saison text not null,
  created_at timestamptz not null default now(),
  geoeffnet_at timestamptz
);
comment on table public.sva_album_packs is 'Serverseitig gezogene Packs. Gutschrift in sva_album_besitz beim Öffnen.';
create unique index if not exists sva_album_packs_einmal on public.sva_album_packs (fan_user_id, spiel_id, art) where spiel_id is not null;
create index if not exists sva_album_packs_fan_idx on public.sva_album_packs (fan_user_id, geoeffnet_at);
alter table public.sva_album_packs enable row level security;

create table if not exists public.sva_album_besitz (
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  karte_id uuid not null references public.sva_album_karten(id) on delete cascade,
  anzahl integer not null default 1 check (anzahl >= 1),
  erstmals_at timestamptz not null default now(),
  zuletzt_at timestamptz not null default now(),
  primary key (fan_user_id, karte_id)
);
comment on table public.sva_album_besitz is 'Welche Karten ein Fan hat (anzahl > 1 = Doppelte).';
alter table public.sva_album_besitz enable row level security;

create table if not exists public.sva_album_gutscheine (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  saison text not null,
  stufe text not null check (stufe in ('schwelle_1', 'schwelle_2', 'komplett')),
  titel text not null,
  partner_id uuid references public.sm_sponsoren(id) on delete set null,
  code text not null unique check (code ~ '^SVA-[A-Z0-9]{5}$'),
  status text not null default 'offen' check (status in ('offen', 'eingeloest')),
  eingeloest_at timestamptz,
  eingeloest_durch text check (eingeloest_durch is null or eingeloest_durch in ('stand', 'admin')),
  created_at timestamptz not null default now(),
  constraint sva_album_gutscheine_einmal unique (fan_user_id, saison, stufe)
);
comment on table public.sva_album_gutscheine is 'Belohnungen (5./10. Check-in, Album komplett = Verlosungs-Los). Einlösen am Stand per PIN.';
create index if not exists sva_album_gutscheine_status_idx on public.sva_album_gutscheine (saison, status);
alter table public.sva_album_gutscheine enable row level security;

create table if not exists public.sva_album_pin_fehler (
  id uuid primary key default gen_random_uuid(),
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
comment on table public.sva_album_pin_fehler is 'Falsche Stand-PIN-Eingaben (Sperre nach 5 Fehlern in 15 min). Nach 1 Tag gelöscht.';
create index if not exists sva_album_pin_fehler_idx on public.sva_album_pin_fehler (fan_user_id, created_at desc);
alter table public.sva_album_pin_fehler enable row level security;

-- ── RLS: Katalog/Einstellungen/Codes = Admin; Fan-Daten = Admin liest ───────
-- Fans haben bewusst KEINE Policy: alles läuft über die RPCs (5).
do $$
declare t text;
begin
  foreach t in array array['sva_album_einstellungen', 'sva_album_karten', 'sva_album_spielcodes'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_sm_admin()) with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_sm_admin())', t);
  end loop;
  foreach t in array array['sva_album_fans', 'sva_album_checkins', 'sva_album_packs', 'sva_album_besitz', 'sva_album_gutscheine', 'sva_album_pin_fehler'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
  end loop;
end $$;
drop policy if exists sva_album_einstellungen_delete on public.sva_album_einstellungen;
-- Admin darf einen Gutschein von Hand als eingelöst markieren (Notfall ohne Handy-Akku).
drop policy if exists sva_album_gutscheine_update on public.sva_album_gutscheine;
create policy sva_album_gutscheine_update on public.sva_album_gutscheine
  for update to authenticated using (public.is_sm_admin()) with check (public.is_sm_admin());

-- Verteidigung in der Tiefe: anon braucht keine dieser Tabellen direkt.
revoke all on public.sva_album_einstellungen, public.sva_album_karten, public.sva_album_spielcodes,
              public.sva_album_fans, public.sva_album_checkins, public.sva_album_packs,
              public.sva_album_besitz, public.sva_album_gutscheine, public.sva_album_pin_fehler
  from anon;

-- ── Interne Helfer ──────────────────────────────────────────────────────────
create or replace function public.sva_album_uid()
returns uuid
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v uuid := auth.uid();
begin
  if v is null then
    raise exception 'album_nicht_angemeldet' using errcode = '28000';
  end if;
  return v;
end;
$$;

create or replace function public.sva_album_admin_pruefen()
returns void
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if not public.is_sm_admin() then
    raise exception 'album_kein_admin' using errcode = '42501';
  end if;
end;
$$;

-- Lesbarer Gutschein-Code (ohne 0/O/1/I): SVA-7K3PQ
create or replace function public.sva_album_code()
returns text
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  a text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v text;
  i int;
begin
  for i in 1 .. 8 loop
    v := 'SVA-' || (select string_agg(substr(a, 1 + floor(random() * 32)::int, 1), '') from generate_series(1, 5));
    exit when not exists (select 1 from public.sva_album_gutscheine g where g.code = v);
  end loop;
  return v;
end;
$$;

-- Zieht ein Pack für einen Fan (serverseitig, Seltenheits-Gewichte +
-- Doppelten-Bremse). Idempotent je (Fan, Spiel, Art). Gibt die Pack-ID
-- zurück, null wenn es schon eines gibt oder der Katalog leer ist.
create or replace function public.sva_album_pack_ziehen(p_fan uuid, p_spiel uuid, p_art text)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_set    public.sva_album_einstellungen;
  v_saison text := public.sva_album_saison();
  v_karten uuid[] := '{}';
  v_selt   text[] := '{}';
  v_total  numeric;
  v_r      numeric;
  v_s      text;
  v_k      uuid;
  v_id     uuid;
  v_i      int;
begin
  select * into v_set from public.sva_album_einstellungen where id = 1;
  if not exists (select 1 from public.sva_album_karten k
                  where k.aktiv and (k.saison is null or k.saison = v_saison)) then
    return null;
  end if;

  for v_i in 1 .. greatest(1, least(5, coalesce(v_set.karten_pro_pack, 3))) loop
    -- 1) Seltenheit nach Gewicht — nur Stufen, die es im Katalog gibt
    with stufen as (
      select distinct k.seltenheit as s from public.sva_album_karten k
       where k.aktiv and (k.saison is null or k.saison = v_saison)
    ), gew as (
      select s,
             case s when 'bronze' then 1 when 'silber' then 2 when 'gold' then 3 else 4 end as o,
             case s when 'bronze' then coalesce(v_set.gewicht_bronze, 70)
                    when 'silber' then coalesce(v_set.gewicht_silber, 22)
                    when 'gold'   then coalesce(v_set.gewicht_gold, 7)
                    else coalesce(v_set.gewicht_spezial, 1) end::numeric as w
        from stufen
    )
    select coalesce(sum(w), 0) into v_total from gew;

    v_s := null;
    if v_total > 0 then
      v_r := random() * v_total;
      with stufen as (
        select distinct k.seltenheit as s from public.sva_album_karten k
         where k.aktiv and (k.saison is null or k.saison = v_saison)
      ), gew as (
        select s,
               case s when 'bronze' then 1 when 'silber' then 2 when 'gold' then 3 else 4 end as o,
               case s when 'bronze' then coalesce(v_set.gewicht_bronze, 70)
                      when 'silber' then coalesce(v_set.gewicht_silber, 22)
                      when 'gold'   then coalesce(v_set.gewicht_gold, 7)
                      else coalesce(v_set.gewicht_spezial, 1) end::numeric as w
          from stufen
      ), kum as (
        select s, sum(w) over (order by o) as bis from gew where w > 0
      )
      select s into v_s from kum where bis > v_r order by bis limit 1;
    end if;

    -- 2) Karte innerhalb der Stufe; Doppelten-Bremse bevorzugt Neue
    v_k := null;
    if random() * 100 < coalesce(v_set.doppelte_bremse, 0) then
      select k.id into v_k
        from public.sva_album_karten k
       where k.aktiv and (k.saison is null or k.saison = v_saison)
         and (v_s is null or k.seltenheit = v_s)
         and not (k.id = any (v_karten))
         and not exists (select 1 from public.sva_album_besitz b where b.fan_user_id = p_fan and b.karte_id = k.id)
         and not exists (select 1 from public.sva_album_packs p
                          where p.fan_user_id = p_fan and p.geoeffnet_at is null and k.id = any (p.karten))
       order by random() limit 1;
    end if;
    if v_k is null then
      select k.id into v_k
        from public.sva_album_karten k
       where k.aktiv and (k.saison is null or k.saison = v_saison)
         and (v_s is null or k.seltenheit = v_s)
       order by random() limit 1;
    end if;

    v_karten := v_karten || v_k;
    v_selt := v_selt || (select k.seltenheit from public.sva_album_karten k where k.id = v_k);
  end loop;

  insert into public.sva_album_packs (fan_user_id, spiel_id, art, karten, seltenheiten, saison)
  values (p_fan, p_spiel, p_art, v_karten, v_selt, v_saison)
  on conflict (fan_user_id, spiel_id, art) where spiel_id is not null do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- Album komplett? = jeder Spieler-Platz der Saison ist belegt (egal welche
-- Version/Seltenheit). Spielerkarten ohne Kader-Bezug zählen einzeln.
create or replace function public.sva_album_komplett(p_fan uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with plaetze as (
    select distinct coalesce(k.roster_id, k.id) as platz
      from public.sva_album_karten k
     where k.typ = 'spieler' and k.aktiv
       and (k.saison is null or k.saison = public.sva_album_saison())
  ), belegt as (
    select distinct coalesce(k.roster_id, k.id) as platz
      from public.sva_album_besitz b
      join public.sva_album_karten k on k.id = b.karte_id
     where b.fan_user_id = p_fan and k.typ = 'spieler' and k.aktiv
       and (k.saison is null or k.saison = public.sva_album_saison())
  )
  select (select count(*) from plaetze) > 0
     and not exists (select 1 from plaetze p where p.platz not in (select platz from belegt));
$$;

-- Prüft Schwellen + Album komplett, legt fehlende Gutscheine an.
-- Gibt die NEU angelegten Gutscheine zurück.
create or replace function public.sva_album_belohnungen(p_fan uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_set    public.sva_album_einstellungen;
  v_saison text := public.sva_album_saison();
  v_n      integer;
  v_neu    jsonb := '[]'::jsonb;
  v_row    public.sva_album_gutscheine;
  v_stufe  text;
  v_titel  text;
  v_partner uuid;
begin
  select * into v_set from public.sva_album_einstellungen where id = 1;
  select count(*) into v_n from public.sva_album_checkins c where c.fan_user_id = p_fan and c.saison = v_saison;

  foreach v_stufe in array array['schwelle_1', 'schwelle_2', 'komplett'] loop
    if (v_stufe = 'schwelle_1' and v_n >= v_set.schwelle_1)
       or (v_stufe = 'schwelle_2' and v_n >= v_set.schwelle_2)
       or (v_stufe = 'komplett' and public.sva_album_komplett(p_fan)) then
      v_titel := case v_stufe when 'schwelle_1' then v_set.belohnung_1 when 'schwelle_2' then v_set.belohnung_2 else v_set.belohnung_komplett end;
      v_partner := case v_stufe when 'schwelle_1' then v_set.partner_1_id when 'schwelle_2' then v_set.partner_2_id else v_set.partner_komplett_id end;
      v_row := null;
      insert into public.sva_album_gutscheine (fan_user_id, saison, stufe, titel, partner_id, code)
      values (p_fan, v_saison, v_stufe, v_titel, v_partner, public.sva_album_code())
      on conflict (fan_user_id, saison, stufe) do nothing
      returning * into v_row;
      if v_row.id is not null then
        v_neu := v_neu || jsonb_build_object('id', v_row.id, 'stufe', v_row.stufe, 'titel', v_row.titel, 'code', v_row.code);
      end if;
    end if;
  end loop;
  return v_neu;
end;
$$;

-- Heimsieg-Bonus an alle Eingecheckten (idempotent über sva_album_packs_einmal)
create or replace function public.sva_album_heimsieg_bonus(p_spiel uuid)
returns integer
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s  public.sm_spiele;
  v_n  integer := 0;
  v_c  record;
begin
  if not coalesce((select e.bonus_heimsieg from public.sva_album_einstellungen e where e.id = 1), true) then
    return 0;
  end if;
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null or not v_s.heim or v_s.tore_sva is null or v_s.tore_gegner is null
     or v_s.tore_sva <= v_s.tore_gegner then
    return 0;
  end if;
  for v_c in select c.fan_user_id from public.sva_album_checkins c
              where c.spiel_id = p_spiel and c.fan_user_id is not null loop
    if public.sva_album_pack_ziehen(v_c.fan_user_id, p_spiel, 'heimsieg') is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  update public.sva_album_spielcodes set bonus_at = coalesce(bonus_at, now()) where spiel_id = p_spiel;
  return v_n;
end;
$$;

-- Ende des Check-in-Fensters (Anstoß + fenster_nach, mindestens Abpfiff + 30 min)
create or replace function public.sva_album_fenster(p_spiel uuid, out p_start timestamptz, out p_ende timestamptz)
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_e public.sva_album_einstellungen;
  v_abpfiff timestamptz;
begin
  select * into v_s from public.sm_spiele where id = p_spiel;
  select * into v_e from public.sva_album_einstellungen where id = 1;
  p_start := v_s.anstoss - make_interval(mins => coalesce(v_e.fenster_vor_min, 60));
  p_ende  := v_s.anstoss + make_interval(mins => coalesce(v_e.fenster_nach_min, 135));
  if to_regclass('public.sva_ticker') is not null then
    execute $q$ select max(t.zeitpunkt) from public.sva_ticker t where t.spiel_id = $1 and t.typ = 'abpfiff' $q$
      into v_abpfiff using p_spiel;
    if v_abpfiff is not null then
      p_ende := greatest(p_ende, v_abpfiff + interval '30 minutes');
    end if;
  end if;
end;
$$;

-- ── 5a. Öffentlich: Katalog + Regeln ────────────────────────────────────────
create or replace function public.album_katalog()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_e public.sva_album_einstellungen;
  v_summe numeric;
  v_partner jsonb;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  v_summe := greatest(1, v_e.gewicht_bronze + v_e.gewicht_silber + v_e.gewicht_gold + v_e.gewicht_spezial);
  return jsonb_build_object(
    'saison', v_saison,
    'aktiv', coalesce(v_e.aktiv, true),
    'regeln', jsonb_build_object(
      'chancen', jsonb_build_object(
        'bronze',  round(100 * v_e.gewicht_bronze / v_summe, 1),
        'silber',  round(100 * v_e.gewicht_silber / v_summe, 1),
        'gold',    round(100 * v_e.gewicht_gold / v_summe, 1),
        'spezial', round(100 * v_e.gewicht_spezial / v_summe, 1)),
      'kartenProPack', v_e.karten_pro_pack,
      'fensterVorMin', v_e.fenster_vor_min,
      'fensterNachMin', v_e.fenster_nach_min,
      'bonusHeimsieg', v_e.bonus_heimsieg,
      'belohnungen', jsonb_build_array(
        jsonb_strip_nulls(jsonb_build_object('stufe', 'schwelle_1', 'checkins', v_e.schwelle_1, 'titel', v_e.belohnung_1,
          'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                        from public.sm_sponsoren sp where sp.id = v_e.partner_1_id and sp.aktiv))),
        jsonb_strip_nulls(jsonb_build_object('stufe', 'schwelle_2', 'checkins', v_e.schwelle_2, 'titel', v_e.belohnung_2,
          'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                        from public.sm_sponsoren sp where sp.id = v_e.partner_2_id and sp.aktiv))),
        jsonb_strip_nulls(jsonb_build_object('stufe', 'komplett', 'titel', v_e.belohnung_komplett,
          'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                        from public.sm_sponsoren sp where sp.id = v_e.partner_komplett_id and sp.aktiv)))
      )
    ),
    'karten', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id',          k.id,
               'typ',         k.typ,
               'titel',       k.titel,
               'untertitel',  nullif(btrim(coalesce(k.untertitel, '')), ''),
               'bildUrl',     k.bild_url,
               'walkoutUrl',  k.walkout_url,
               'seltenheit',  k.seltenheit,
               'sortierung',  k.sortierung,
               'spieler', case when r.id is not null then jsonb_strip_nulls(jsonb_build_object(
                            'slug',      r.slug,
                            'name',      r.name,
                            'nummer',    r.nummer,
                            'position',  case upper(coalesce(r.position, ''))
                                           when 'TW' then 'TW' when 'TORWART' then 'TW'
                                           when 'ABW' then 'ABW' when 'ABWEHR' then 'ABW'
                                           when 'ANG' then 'ANG' when 'STURM' then 'ANG' when 'ANGRIFF' then 'ANG'
                                           else 'MIT' end,
                            'fotoUrl',   r.foto_url,
                            'cutoutUrl', r.freisteller_url,
                            'kapitaen',  case when r.kapitaen then true end)) end,
               'partner', case when sp.id is not null then jsonb_strip_nulls(jsonb_build_object(
                            'name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url)) end
             )) order by case k.typ when 'spieler' then 0 when 'moment' then 1 when 'partner' then 2 else 3 end,
                         k.sortierung, r.sortierung nulls last, k.titel,
                         case k.seltenheit when 'bronze' then 1 when 'silber' then 2 when 'gold' then 3 else 4 end)
        from public.sva_album_karten k
        left join public.sm_roster r on r.id = k.roster_id
        left join public.sm_sponsoren sp on sp.id = k.sponsor_id and sp.aktiv
       where k.aktiv and (k.saison is null or k.saison = v_saison)
    ), '[]'::jsonb)
  );
end;
$$;
comment on function public.album_katalog() is 'Öffentlich: Album-Katalog der Saison + Regeln (Chancen, Pack-Größe, Belohnungen). Keine Fan-Daten.';

-- ── 5b. Fan: eigenes Album ──────────────────────────────────────────────────
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
  v_f public.sva_album_fans;
begin
  select * into v_f from public.sva_album_fans where user_id = v_uid;
  return jsonb_build_object(
    'email', auth.jwt() ->> 'email',
    'saison', v_saison,
    'profil', case when v_f.user_id is null then null else jsonb_build_object(
                'vorname', v_f.vorname, 'initial', v_f.initial,
                'anzeigename', v_f.vorname || ' ' || v_f.initial || '.',
                'rangliste', v_f.rangliste, 'erinnerung', v_f.erinnerung) end,
    'checkins', (select count(*) from public.sva_album_checkins c where c.fan_user_id = v_uid and c.saison = v_saison),
    'checkinsGesamt', (select count(*) from public.sva_album_checkins c where c.fan_user_id = v_uid),
    'spiele', coalesce((
      select jsonb_agg(jsonb_build_object('gegner', s.gegner, 'anstoss', s.anstoss, 'at', c.created_at) order by c.created_at desc)
        from (select * from public.sva_album_checkins c0 where c0.fan_user_id = v_uid order by c0.created_at desc limit 30) c
        join public.sm_spiele s on s.id = c.spiel_id), '[]'::jsonb),
    'besitz', coalesce((
      select jsonb_agg(jsonb_build_object('karteId', b.karte_id, 'anzahl', b.anzahl) order by b.erstmals_at)
        from public.sva_album_besitz b where b.fan_user_id = v_uid), '[]'::jsonb),
    'packs', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', p.id, 'art', p.art, 'anzahl', cardinality(p.karten),
               'gegner', s.gegner, 'at', p.created_at)) order by p.created_at)
        from public.sva_album_packs p
        left join public.sm_spiele s on s.id = p.spiel_id
       where p.fan_user_id = v_uid and p.geoeffnet_at is null), '[]'::jsonb),
    'gutscheine', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'id', g.id, 'stufe', g.stufe, 'titel', g.titel, 'code', g.code, 'status', g.status,
               'saison', g.saison, 'eingeloestAt', g.eingeloest_at, 'at', g.created_at,
               'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                             from public.sm_sponsoren sp where sp.id = g.partner_id)))
             order by g.created_at desc)
        from public.sva_album_gutscheine g where g.fan_user_id = v_uid), '[]'::jsonb)
  );
end;
$$;

create or replace function public.album_profil_speichern(
  p_vorname text,
  p_initial text,
  p_rangliste boolean default false,
  p_erinnerung boolean default false,
  p_einwilligung boolean default false
)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_vorname text := btrim(regexp_replace(coalesce(p_vorname, ''), '\s+', ' ', 'g'));
  v_initial text := upper(left(btrim(coalesce(p_initial, '')), 1));
  v_da boolean;
begin
  select exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) into v_da;
  if not v_da and coalesce(p_einwilligung, false) is not true then
    raise exception 'album_einwilligung_fehlt' using errcode = '22023';
  end if;
  if char_length(v_vorname) < 2 or char_length(v_vorname) > 24
     or v_vorname !~ '^[A-Za-zÀ-ÖØ-öø-ÿĀ-ž][A-Za-zÀ-ÖØ-öø-ÿĀ-ž .''-]*$' then
    raise exception 'album_ungueltig:vorname' using errcode = '22023';
  end if;
  if v_initial !~ '^[A-ZÀ-ÖØ-ÞĀ-Ž]$' then
    raise exception 'album_ungueltig:initial' using errcode = '22023';
  end if;
  insert into public.sva_album_fans (user_id, vorname, initial, rangliste, erinnerung, einwilligung_at)
  values (v_uid, v_vorname, v_initial, coalesce(p_rangliste, false), coalesce(p_erinnerung, false), now())
  on conflict (user_id) do update
     set vorname = excluded.vorname, initial = excluded.initial,
         rangliste = excluded.rangliste, erinnerung = excluded.erinnerung, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 5c. Fan: Check-in (QR-Code am Eingang) ──────────────────────────────────
create or replace function public.album_checkin(p_token text)
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
  -- Wer erst nach einem feststehenden Heimsieg eincheckt, bekommt den Bonus sofort.
  if coalesce(v_e.bonus_heimsieg, true) and v_s.tore_sva is not null and v_s.tore_gegner is not null
     and v_s.tore_sva > v_s.tore_gegner then
    v_bonus := public.sva_album_pack_ziehen(v_uid, v_s.id, 'heimsieg');
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'ok', true,
    'packId', v_pack,
    'bonusPackId', v_bonus,
    'spiel', jsonb_build_object('gegner', v_s.gegner, 'anstoss', v_s.anstoss),
    'partner', (select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url))
                  from public.sm_sponsoren sp where sp.id = v_code.partner_id and sp.aktiv),
    'checkins', (select count(*) from public.sva_album_checkins c where c.fan_user_id = v_uid and c.saison = v_saison),
    'gutscheine', public.sva_album_belohnungen(v_uid)
  ));
end;
$$;

-- ── 5d. Fan: Pack öffnen (Gutschrift ins Album) ─────────────────────────────
create or replace function public.album_pack_oeffnen(p_pack uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := public.sva_album_uid();
  v_p    public.sva_album_packs;
  v_neu  boolean[] := '{}';
  v_k    uuid;
  v_war  boolean;
  v_gut  jsonb := '[]'::jsonb;
begin
  select * into v_p from public.sva_album_packs p where p.id = p_pack and p.fan_user_id = v_uid for update;
  if v_p.id is null then
    raise exception 'album_pack_unbekannt' using errcode = 'P0001';
  end if;

  if v_p.geoeffnet_at is null then
    foreach v_k in array v_p.karten loop
      if not exists (select 1 from public.sva_album_karten k where k.id = v_k) then
        v_neu := v_neu || false;
        continue;
      end if;
      select exists (select 1 from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = v_k) into v_war;
      insert into public.sva_album_besitz (fan_user_id, karte_id, anzahl)
      values (v_uid, v_k, 1)
      on conflict (fan_user_id, karte_id) do update
         set anzahl = public.sva_album_besitz.anzahl + 1, zuletzt_at = now();
      v_neu := v_neu || (not v_war);
    end loop;
    update public.sva_album_packs set geoeffnet_at = now(), neu = v_neu where id = v_p.id;
    v_p.neu := v_neu;
    v_gut := public.sva_album_belohnungen(v_uid);
  end if;

  return jsonb_build_object(
    'id', v_p.id,
    'art', v_p.art,
    'gegner', (select s.gegner from public.sm_spiele s where s.id = v_p.spiel_id),
    'karten', coalesce((
      select jsonb_agg(jsonb_build_object(
               'karteId', x.k,
               'seltenheit', coalesce(v_p.seltenheiten[x.i], 'bronze'),
               'neu', coalesce(v_p.neu[x.i], false),
               'anzahl', coalesce((select b.anzahl from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = x.k), 0)
             ) order by x.i)
        from unnest(v_p.karten) with ordinality as x(k, i)
       where exists (select 1 from public.sva_album_karten k where k.id = x.k)), '[]'::jsonb),
    'gutscheine', v_gut
  );
end;
$$;

-- ── 5e. Fan: Gutschein am Stand einlösen (Helfer tippt die Stand-PIN) ───────
-- Falsche PIN = KEIN Fehler (sonst würde der Fehlversuch zurückgerollt),
-- sondern { ok: false, grund } — so greift die Sperre wirklich.
create or replace function public.album_gutschein_einloesen(p_gutschein uuid, p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v_g   public.sva_album_gutscheine;
  v_e   public.sva_album_einstellungen;
  v_n   integer;
  v_pin text := btrim(coalesce(p_pin, ''));
begin
  delete from public.sva_album_pin_fehler where created_at < now() - interval '1 day';

  select * into v_g from public.sva_album_gutscheine g where g.id = p_gutschein and g.fan_user_id = v_uid for update;
  if v_g.id is null then
    raise exception 'album_gutschein_unbekannt' using errcode = 'P0001';
  end if;
  if v_g.stufe = 'komplett' then
    return jsonb_build_object('ok', false, 'grund', 'verlosung');
  end if;
  if v_g.status = 'eingeloest' then
    return jsonb_build_object('ok', false, 'grund', 'schon_eingeloest', 'eingeloestAt', v_g.eingeloest_at);
  end if;

  select count(*) into v_n from public.sva_album_pin_fehler f
   where f.fan_user_id = v_uid and f.created_at > now() - interval '15 minutes';
  if v_n >= 5 then
    return jsonb_build_object('ok', false, 'grund', 'gesperrt');
  end if;

  select * into v_e from public.sva_album_einstellungen where id = 1;
  if v_e.stand_pin_hash is null then
    return jsonb_build_object('ok', false, 'grund', 'keine_pin');
  end if;
  if v_pin !~ '^[0-9]{4}$'
     or encode(sha256(convert_to(v_e.stand_pin_salt || ':' || v_pin, 'UTF8')), 'hex') <> v_e.stand_pin_hash then
    insert into public.sva_album_pin_fehler (fan_user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'grund', 'pin_falsch', 'versuche', greatest(0, 4 - v_n));
  end if;

  update public.sva_album_gutscheine
     set status = 'eingeloest', eingeloest_at = now(), eingeloest_durch = 'stand'
   where id = v_g.id;
  delete from public.sva_album_pin_fehler where fan_user_id = v_uid;
  return jsonb_build_object('ok', true, 'eingeloestAt', now());
end;
$$;

-- ── 5f. Öffentlich: Rangliste „Treueste Fans“ (nur mit Einwilligung) ────────
create or replace function public.album_rangliste()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with werte as (
    select f.user_id, f.vorname || ' ' || f.initial || '.' as name,
           (select count(*) from public.sva_album_checkins c where c.fan_user_id = f.user_id and c.saison = public.sva_album_saison()) as checkins,
           (select count(*) from public.sva_album_besitz b where b.fan_user_id = f.user_id) as karten,
           f.created_at
      from public.sva_album_fans f
     where f.rangliste
  ), rang as (
    select w.*, rank() over (order by w.checkins desc, w.karten desc) as platz
      from werte w where w.checkins > 0
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'platz', r.platz, 'name', r.name, 'checkins', r.checkins, 'karten', r.karten,
           'ich', case when r.user_id = auth.uid() then true end))
         order by r.platz, r.created_at), '[]'::jsonb)
    from (select * from rang order by platz, created_at limit 20) r;
$$;

-- ── 5g. Öffentlich: Zuschauer-Check-ins pro Heimspiel (nur Zahlen) ──────────
create or replace function public.album_checkins_pro_spiel()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_build_object(
           'spielId', x.id, 'gegner', x.gegner, 'anstoss', x.anstoss, 'checkins', x.n) order by x.anstoss), '[]'::jsonb)
    from (
      select s.id, s.gegner, s.anstoss, count(c.id)::int as n
        from public.sm_spiele s
        join public.sva_album_checkins c on c.spiel_id = s.id
       where s.heim and c.saison = public.sva_album_saison()
       group by s.id
    ) x;
$$;
comment on function public.album_checkins_pro_spiel() is 'Öffentlich: Anzahl Album-Check-ins je Heimspiel der Saison (Mediadaten, später Tipp-Bonusfrage „Zuschauerzahl“).';

-- ── 5h. Fan: Konto löschen ──────────────────────────────────────────────────
-- Löscht alle Album-Daten. Check-ins bleiben ANONYM (ohne Konto-Bezug) für
-- die Zuschauerzahl. Das Login selbst (auth.users) wird nur gelöscht, wenn
-- das Album es angelegt hat (user_metadata.app = 'sva-album') und es kein
-- Admin-/Team-Zugang ist — das Auth-Schema teilt sich das Projekt mit einer
-- fremden App, deren Konten wir nie anfassen.
create or replace function public.album_konto_loeschen()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := public.sva_album_uid();
  v_app  text;
  v_mail text;
  v_auth boolean := false;
begin
  update public.sva_album_checkins set fan_user_id = null where fan_user_id = v_uid;
  delete from public.sva_album_packs where fan_user_id = v_uid;
  delete from public.sva_album_besitz where fan_user_id = v_uid;
  delete from public.sva_album_gutscheine where fan_user_id = v_uid;
  delete from public.sva_album_pin_fehler where fan_user_id = v_uid;
  delete from public.sva_album_fans where user_id = v_uid;

  begin
    execute $q$ select u.raw_user_meta_data ->> 'app', u.email from auth.users u where u.id = $1 $q$
      into v_app, v_mail using v_uid;
    if v_app = 'sva-album'
       and not exists (select 1 from public.sm_admins a where lower(a.email) = lower(coalesce(v_mail, ''))) then
      execute $q$ delete from auth.users where id = $1 $q$ using v_uid;
      v_auth := true;
    end if;
  exception when others then
    v_auth := false; -- Album-Daten sind trotzdem gelöscht
  end;
  return jsonb_build_object('ok', true, 'loginGeloescht', v_auth);
end;
$$;

-- ── 5i. Admin ───────────────────────────────────────────────────────────────
-- Spielerkarten aus dem Kader: Bronze-Basis für jeden aktiven Spieler,
-- Gold-Version „Kapitän“ für den Kapitän. Bestehende bleiben unberührt.
create or replace function public.album_admin_spielerkarten()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_n integer := 0;
  v_m integer := 0;
begin
  perform public.sva_album_admin_pruefen();
  insert into public.sva_album_karten (typ, roster_id, titel, untertitel, bild_url, seltenheit, saison, sortierung)
  select 'spieler', r.id, r.name,
         case upper(coalesce(r.position, '')) when 'TW' then 'Torwart' when 'TORWART' then 'Torwart'
              when 'ABW' then 'Abwehr' when 'ABWEHR' then 'Abwehr'
              when 'ANG' then 'Angriff' when 'STURM' then 'Angriff' when 'ANGRIFF' then 'Angriff'
              else 'Mittelfeld' end,
         coalesce(r.freisteller_url, r.foto_url), 'bronze', v_saison, r.sortierung
    from public.sm_roster r
   where r.aktiv and r.rolle = 'spieler'
     and not exists (select 1 from public.sva_album_karten k
                      where k.typ = 'spieler' and k.roster_id = r.id and k.seltenheit = 'bronze'
                        and coalesce(k.saison, '') = v_saison);
  get diagnostics v_n = row_count;
  insert into public.sva_album_karten (typ, roster_id, titel, untertitel, bild_url, seltenheit, saison, sortierung)
  select 'spieler', r.id, r.name, 'Kapitän', coalesce(r.freisteller_url, r.foto_url), 'gold', v_saison, r.sortierung
    from public.sm_roster r
   where r.aktiv and r.rolle = 'spieler' and r.kapitaen
     and not exists (select 1 from public.sva_album_karten k
                      where k.typ = 'spieler' and k.roster_id = r.id and k.seltenheit = 'gold'
                        and coalesce(k.saison, '') = v_saison);
  get diagnostics v_m = row_count;
  return jsonb_build_object('bronze', v_n, 'gold', v_m, 'saison', v_saison);
end;
$$;

-- QR-Code für ein Heimspiel anlegen / Partner ändern / Token neu erzeugen.
create or replace function public.album_admin_code(p_spiel uuid, p_partner uuid default null, p_neu boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
  v_token text;
  v_c public.sva_album_spielcodes;
begin
  perform public.sva_album_admin_pruefen();
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null then
    raise exception 'album_spiel_unbekannt' using errcode = 'P0001';
  end if;
  if not v_s.heim then
    raise exception 'album_nur_heimspiel' using errcode = 'P0001';
  end if;
  v_token := substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 24);
  insert into public.sva_album_spielcodes (spiel_id, token, partner_id, erzeugt_von)
  values (p_spiel, v_token, p_partner, auth.jwt() ->> 'email')
  on conflict (spiel_id) do update
     set partner_id = excluded.partner_id,
         token = case when p_neu then excluded.token else public.sva_album_spielcodes.token end,
         erzeugt_at = case when p_neu then now() else public.sva_album_spielcodes.erzeugt_at end,
         erzeugt_von = case when p_neu then excluded.erzeugt_von else public.sva_album_spielcodes.erzeugt_von end
  returning * into v_c;
  return jsonb_build_object('spielId', v_c.spiel_id, 'token', v_c.token, 'partnerId', v_c.partner_id, 'erzeugtAt', v_c.erzeugt_at);
end;
$$;

-- Stand-PIN setzen (4 Ziffern). Gespeichert wird nur Salz + SHA-256.
create or replace function public.album_admin_pin(p_pin text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_pin text := btrim(coalesce(p_pin, ''));
  v_salt text := replace(gen_random_uuid()::text, '-', '');
begin
  perform public.sva_album_admin_pruefen();
  if v_pin !~ '^[0-9]{4}$' then
    raise exception 'album_ungueltig:pin' using errcode = '22023';
  end if;
  update public.sva_album_einstellungen
     set stand_pin_salt = v_salt,
         stand_pin_hash = encode(sha256(convert_to(v_salt || ':' || v_pin, 'UTF8')), 'hex'),
         stand_pin_gesetzt_at = now(),
         updated_at = now(),
         updated_by = auth.jwt() ->> 'email'
   where id = 1;
  return jsonb_build_object('ok', true, 'gesetztAt', now());
end;
$$;

-- Kennzahlen + Live-Zähler für den Admin.
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
    'spiele', coalesce((
      select jsonb_agg(jsonb_build_object('spielId', s.id, 'checkins',
               (select count(*) from public.sva_album_checkins c where c.spiel_id = s.id)) order by s.anstoss)
        from public.sm_spiele s
       where s.heim and s.anstoss > now() - interval '400 days'), '[]'::jsonb),
    -- E-Mail NUR von Fans, die einer Erinnerung zugestimmt haben
    'kontakte', coalesce((
      select jsonb_agg(jsonb_build_object('name', f.vorname || ' ' || f.initial || '.', 'email', u.email) order by f.created_at)
        from public.sva_album_fans f
        join auth.users u on u.id = f.user_id
       where f.erinnerung), '[]'::jsonb)
  );
end;
$$;

-- ── 6. Heimsieg-Bonus bei Abpfiff/Ergebnis ──────────────────────────────────
create or replace function public.sva_album_spiel_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.heim and new.tore_sva is not null and new.tore_gegner is not null and new.tore_sva > new.tore_gegner
     and (old.tore_sva is distinct from new.tore_sva or old.tore_gegner is distinct from new.tore_gegner
          or old.status is distinct from new.status)
     and exists (select 1 from public.sva_album_checkins c where c.spiel_id = new.id) then
    begin
      perform public.sva_album_heimsieg_bonus(new.id);
    exception when others then
      null; -- Album-Bonus darf Ergebnis/Ticker nie blockieren
    end;
  end if;
  return null;
end;
$$;
drop trigger if exists sva_album_heimsieg on public.sm_spiele;
create trigger sva_album_heimsieg
  after update on public.sm_spiele
  for each row execute function public.sva_album_spiel_trigger();

-- ── Funktionsrechte ─────────────────────────────────────────────────────────
-- Supabase vergibt EXECUTE per Default-Privileg an anon/authenticated →
-- explizit entziehen und gezielt neu vergeben.
revoke all on function public.sva_album_saison() from public, anon, authenticated;
revoke all on function public.sva_album_uid() from public, anon, authenticated;
revoke all on function public.sva_album_admin_pruefen() from public, anon, authenticated;
revoke all on function public.sva_album_code() from public, anon, authenticated;
revoke all on function public.sva_album_pack_ziehen(uuid, uuid, text) from public, anon, authenticated;
revoke all on function public.sva_album_komplett(uuid) from public, anon, authenticated;
revoke all on function public.sva_album_belohnungen(uuid) from public, anon, authenticated;
revoke all on function public.sva_album_heimsieg_bonus(uuid) from public, anon, authenticated;
revoke all on function public.sva_album_fenster(uuid) from public, anon, authenticated;
revoke all on function public.sva_album_spiel_trigger() from public, anon, authenticated;
grant execute on function public.sva_album_saison(), public.sva_album_uid(), public.sva_album_admin_pruefen(),
  public.sva_album_code(), public.sva_album_pack_ziehen(uuid, uuid, text), public.sva_album_komplett(uuid),
  public.sva_album_belohnungen(uuid), public.sva_album_heimsieg_bonus(uuid), public.sva_album_fenster(uuid)
  to service_role;

-- öffentlich (anon + eingeloggt)
revoke all on function public.album_katalog() from public;
revoke all on function public.album_rangliste() from public;
revoke all on function public.album_checkins_pro_spiel() from public;
grant execute on function public.album_katalog(), public.album_rangliste(), public.album_checkins_pro_spiel()
  to anon, authenticated, service_role;

-- nur eingeloggt (prüfen zusätzlich auth.uid() bzw. is_sm_admin())
revoke all on function public.album_mein() from public, anon;
revoke all on function public.album_profil_speichern(text, text, boolean, boolean, boolean) from public, anon;
revoke all on function public.album_checkin(text) from public, anon;
revoke all on function public.album_pack_oeffnen(uuid) from public, anon;
revoke all on function public.album_gutschein_einloesen(uuid, text) from public, anon;
revoke all on function public.album_konto_loeschen() from public, anon;
revoke all on function public.album_admin_spielerkarten() from public, anon;
revoke all on function public.album_admin_code(uuid, uuid, boolean) from public, anon;
revoke all on function public.album_admin_pin(text) from public, anon;
revoke all on function public.album_admin_statistik() from public, anon;
grant execute on function public.album_mein(), public.album_profil_speichern(text, text, boolean, boolean, boolean),
  public.album_checkin(text), public.album_pack_oeffnen(uuid), public.album_gutschein_einloesen(uuid, text),
  public.album_konto_loeschen(), public.album_admin_spielerkarten(), public.album_admin_code(uuid, uuid, boolean),
  public.album_admin_pin(text), public.album_admin_statistik()
  to authenticated, service_role;

-- ── 7. web_snapshot(): + partner.mediadaten.checkinsSchnitt/checkinsSpiele ───
-- Unverändert gegenüber 20261006100000_sva_partner.sql bis auf die
-- Check-in-Zahlen in den Mediadaten. ACHTUNG beim Mergen paralleler Stränge:
-- wer web_snapshot() ebenfalls neu anlegt, muss diesen Block übernehmen.
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
  v_ci_spiele  integer;
  v_ci_schnitt integer;
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

  -- v17-A: gezählte Zuschauer (Album-Check-ins) je Heimspiel der Saison
  select count(*)::int, round(avg(x.n))::int
    into v_ci_spiele, v_ci_schnitt
    from (
      select c.spiel_id, count(*) as n
        from public.sva_album_checkins c
        join public.sm_spiele s on s.id = c.spiel_id and s.heim
       where c.saison = public.sva_album_saison()
       group by c.spiel_id
    ) x;
  if coalesce(v_ci_spiele, 0) = 0 then
    v_ci_spiele := null;
    v_ci_schnitt := null;
  end if;

  -- v16-S: Partner-Bereich (/partner) — Pakete (sichtbar), Mediadaten (nur
  -- gepflegte Felder), „Live-Ticker präsentiert von“. Keine Anfragen, keine
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
                      'stand',               pi.stand,
                      'checkinsSchnitt',     v_ci_schnitt,
                      'checkinsSpiele',      v_ci_spiele
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
