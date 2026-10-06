-- ─────────────────────────────────────────────────────────────────────────────
-- v22-A: Sammelalbum — Shiny-Karten, Geheimkarten (Easter Eggs), Vereins-
-- Geburtstag. Konzept + Wahrscheinlichkeiten: docs/KARTEN.md („v22: Shiny &
-- Geheimkarten“). Simulation: node scripts/karten-simulation.mjs.
--
-- 1. SHINY (reines Sammler-Glück, ohne spielerischen Mehrwert):
--    · Jede gezogene Spieler-/Trainer-Karte (Basis oder Glanz, nicht limitiert)
--      ist mit 1 : shiny_chance (Standard 250, 0 = aus) zusätzlich „Shiny“.
--      Entschieden wird SERVERSEITIG beim Anlegen des Packs (Trigger auf
--      sva_album_packs → Spalte shiny boolean[]), also bei jeder Ziehung, egal
--      aus welcher Quelle. Der Browser kann nichts beeinflussen.
--    · Die gezogene Karte zählt ganz normal (Basis füllt ihren Platz, Glanz
--      bleibt Glanz). Shiny kommt OBEN DRAUF: ein Eintrag je Person und Saison
--      in sva_album_shiny (Shiny-Vitrine, zählt NICHT fürs Album, nicht für
--      Kapitel, Sets, Meilensteine, Tausch oder Wunschkarte).
--    · Erstfund: wer eine Person als Erste(r) der Saison shiny öffnet, steht
--      in sva_album_shiny_erstfund („Shiny · Erstfund von Lena B. am 12.10.“).
--      Gutgeschrieben wird beim ÖFFNEN des Packs (wie der Besitz).
-- 2. GEHEIMKARTEN (Entdecken): Karten mit geheim = true (immer limitiert, nie
--    ziehbar, nicht im öffentlichen Katalog). Ein Easter Egg im Browser liefert
--    nur ein Token („G-“ + 32 Hex), eingelöst über die vorhandene Code-RPC
--    album_code_einloesen (Rate-Limit wie bei Story-Codes). Die DB kennt nur
--    SHA-256(Token) — weder Bundle noch DB enthalten eine prüfbare Klartext-
--    Liste. Je Fan und Geheimkarte genau einmal (Pack-Art 'geheim').
--    Eier (je Admin an/aus, sva_album_geheim.aktiv):
--      wappen     7× aufs Wappen der Startseite      → „Der Platzwart“
--      ball       versteckter Ball im Rundgang        → „Der verlorene Ball“
--      geburtstag nur am Vereins-Geburtstag (Datum im Admin, Europe/Berlin)
--                                                     → „Seit 1949“
--      geste      Wisch-Geste im Album                → „Die Geheimtaktik“
-- 3. Neue Fan-Felder: album_mein() + shiny, shinyErstfunde, geheim;
--    album_katalog() ohne Geheimkarten, + regeln.shinyChance / vereinsGeburtstag;
--    album_pack_oeffnen() je Karte + shiny, erstfund.
-- 4. Admin: album_admin_shiny(), album_admin_geheim(), album_admin_geheim_standard().
--
-- ADDITIV und idempotent. Bestehende Sammlungen bleiben unverändert (neue
-- Spalten mit Default, neue Tabellen). Die bisherigen Funktionen album_mein,
-- album_katalog, album_code_einloesen, album_konto_loeschen werden umbenannt
-- (…_v21, nur noch intern) und von gleichnamigen Hüllen aufgerufen.
-- Nach 20261013200000_sva_album_v21.sql anwenden. Test: supabase/tests/album_v22.test.mjs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Einstellungen ────────────────────────────────────────────────────────
alter table public.sva_album_einstellungen
  -- 1 : N je gezogener Spieler-/Trainer-Karte; 0 = keine Shinys
  add column if not exists shiny_chance integer not null default 250
    check (shiny_chance = 0 or shiny_chance between 2 and 100000),
  -- Gründungstag des Vereins (1949; Tag/Monat sind entscheidend). null = Geburtstags-Ei schläft
  add column if not exists vereins_geburtstag date;

-- ── 2. Karten: Geheimkarten ─────────────────────────────────────────────────
alter table public.sva_album_karten add column if not exists geheim boolean not null default false;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_album_karten_geheim') then
    -- geheim ⇒ limitiert (zählt nie fürs Album) und nie zufällig ziehbar
    alter table public.sva_album_karten add constraint sva_album_karten_geheim
      check (not geheim or (limitiert and ziehbar_von is null and ziehbar_bis is null and nur_spiel_id is null));
  end if;
end $$;

-- ── 3. Packs: Shiny-Flags + Pack-Art „geheim“ ──────────────────────────────
alter table public.sva_album_packs add column if not exists shiny boolean[];
alter table public.sva_album_packs drop constraint if exists sva_album_packs_art_check;
alter table public.sva_album_packs add constraint sva_album_packs_art_check check (art in (
  'checkin', 'heimsieg', 'geschenk', 'starter', 'tipp', 'story', 'partner', 'advent',
  'freund', 'kapitel', 'wunsch', 'ziel', 'geheim'));

-- ── 4. Neue Tabellen ────────────────────────────────────────────────────────
create table if not exists public.sva_album_shiny (
  fan_user_id uuid not null references auth.users(id) on delete cascade,
  roster_id uuid not null references public.sm_roster(id) on delete cascade,
  saison text not null,
  -- die gezogene Karte (Basis oder Glanz-Variante)
  karte_id uuid references public.sva_album_karten(id) on delete set null,
  anzahl integer not null default 1 check (anzahl >= 1),
  pack_id uuid references public.sva_album_packs(id) on delete set null,
  erstmals_at timestamptz not null default now(),
  zuletzt_at timestamptz not null default now(),
  primary key (fan_user_id, roster_id, saison)
);
comment on table public.sva_album_shiny is 'v22: Shiny-Funde je Fan, Person und Saison (Shiny-Vitrine; zählt nicht fürs Album). Nur über RPCs.';
create index if not exists sva_album_shiny_saison on public.sva_album_shiny (saison, erstmals_at desc);
alter table public.sva_album_shiny enable row level security;

create table if not exists public.sva_album_shiny_erstfund (
  roster_id uuid not null references public.sm_roster(id) on delete cascade,
  saison text not null,
  fan_user_id uuid references auth.users(id) on delete set null,
  -- „Vorname I.“ zum Zeitpunkt des Funds (bei Konto-Löschung: „Ein SVA-Fan“)
  name text not null check (char_length(name) between 2 and 40),
  karte_id uuid references public.sva_album_karten(id) on delete set null,
  at timestamptz not null default now(),
  primary key (roster_id, saison)
);
comment on table public.sva_album_shiny_erstfund is 'v22: Wer eine Person als Erste(r) der Saison shiny gezogen hat (wird auf der Karte verewigt).';
alter table public.sva_album_shiny_erstfund enable row level security;

create table if not exists public.sva_album_geheim (
  schluessel text primary key check (schluessel ~ '^[a-z0-9_]{2,30}$'),
  karte_id uuid references public.sva_album_karten(id) on delete set null,
  -- SHA-256 (hex) des Tokens, das der Browser beim Entdecken schickt
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  raetsel text not null check (char_length(btrim(raetsel)) between 4 and 160),
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  created_at timestamptz not null default now()
);
comment on table public.sva_album_geheim is 'v22: Easter Eggs → Geheimkarte. Token nur als Hash. Admin schaltet an/aus und pflegt den Rätseltext.';
alter table public.sva_album_geheim enable row level security;

do $$
begin
  -- Geheim-Eier: Admin liest/ändert (an/aus, Rätsel); Fans nur über RPCs
  drop policy if exists sva_album_geheim_select on public.sva_album_geheim;
  create policy sva_album_geheim_select on public.sva_album_geheim for select to authenticated using (public.is_sm_admin());
  drop policy if exists sva_album_geheim_update on public.sva_album_geheim;
  create policy sva_album_geheim_update on public.sva_album_geheim for update to authenticated using (public.is_sm_admin()) with check (public.is_sm_admin());
  drop policy if exists sva_album_shiny_select on public.sva_album_shiny;
  create policy sva_album_shiny_select on public.sva_album_shiny for select to authenticated using (public.is_sm_admin());
  drop policy if exists sva_album_shiny_erstfund_select on public.sva_album_shiny_erstfund;
  create policy sva_album_shiny_erstfund_select on public.sva_album_shiny_erstfund for select to authenticated using (public.is_sm_admin());
end $$;
revoke all on public.sva_album_shiny, public.sva_album_shiny_erstfund, public.sva_album_geheim from anon;
-- Zugriff nur für eingeloggte Admins (RLS oben); Fans sehen 0 Zeilen.
grant select on public.sva_album_shiny, public.sva_album_shiny_erstfund to authenticated, service_role;
grant select, update on public.sva_album_geheim to authenticated, service_role;
revoke insert, delete on public.sva_album_geheim from authenticated;

-- ── 5. Shiny-Ziehung (Trigger: jede Pack-Anlage, jede Quelle) ──────────────
create or replace function public.sva_album_pack_shiny()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_chance integer;
begin
  if new.shiny is not null then
    return new;
  end if;
  if new.art = 'geheim' then
    new.shiny := array(select false from unnest(new.karten));
    return new;
  end if;
  select coalesce(e.shiny_chance, 0) into v_chance from public.sva_album_einstellungen e where e.id = 1;
  -- je Karte unabhängig: P(shiny) = 1 / shiny_chance (nur Spieler/Trainer, nicht limitiert)
  new.shiny := array(
    select coalesce(v_chance > 0 and k.typ in ('spieler', 'trainer') and k.roster_id is not null
                    and not k.limitiert and random() * v_chance < 1, false)
      from unnest(new.karten) with ordinality as x(id, i)
      left join public.sva_album_karten k on k.id = x.id
     order by x.i);
  return new;
end;
$$;
drop trigger if exists sva_album_pack_shiny on public.sva_album_packs;
create trigger sva_album_pack_shiny before insert on public.sva_album_packs
  for each row execute function public.sva_album_pack_shiny();

-- ── 6. Hilfen ───────────────────────────────────────────────────────────────
-- Token der Easter Eggs: „G-“ + die ersten 32 Hex-Zeichen von SHA-256('sva-geheim|' || teil).
-- Gespeichert wird nur SHA-256(Token). (Der Browser rechnet dasselbe zur Laufzeit.)
create or replace function public.sva_album_geheim_hash(p_teil text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select encode(sha256(convert_to(
           'G-' || upper(substr(encode(sha256(convert_to('sva-geheim|' || p_teil, 'UTF8')), 'hex'), 1, 32)),
           'UTF8')), 'hex');
$$;

-- Basis-Karte einer Person in der Saison (Anzeige in der Shiny-Vitrine)
create or replace function public.sva_album_basis_karte(p_roster uuid, p_saison text)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select k.id from public.sva_album_karten k
   where k.roster_id = p_roster and k.typ in ('spieler', 'trainer') and not k.variante and not k.limitiert
     and coalesce(k.saison, p_saison) = p_saison
   order by k.aktiv desc, k.created_at limit 1;
$$;

-- Karte als Katalog-JSON (Geheimkarten: nur für Fans, die sie gefunden haben)
create or replace function public.sva_album_karte_json(p_id uuid)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_strip_nulls(jsonb_build_object(
           'id', k.id, 'typ', k.typ, 'titel', k.titel,
           'untertitel', nullif(btrim(coalesce(k.untertitel, '')), ''),
           'bildUrl', k.bild_url, 'seltenheit', k.seltenheit, 'sortierung', k.sortierung,
           'variante', k.variante, 'limitiert', k.limitiert, 'geheim', k.geheim, 'kapitel', 'geheim',
           'serie', k.serie, 'credit', k.credit, 'bildFokus', k.bild_fokus,
           'rueckseite', nullif(btrim(coalesce(k.rueckseite, '')), '')))
    from public.sva_album_karten k where k.id = p_id;
$$;

-- ── 7. Standard-Geheimkarten + Eier (idempotent) ────────────────────────────
create or replace function public.sva_album_v22_nachziehen()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_karten integer := 0;
  v_eier integer := 0;
  v_n integer;
  r record;
  v_id uuid;
begin
  for r in
    select * from (values
      ('wappen', 'moment', 'Der Platzwart', 'Hüter des Waldsportplatzes', '/album/karten/geheim-platzwart.webp', '50% 46%',
       'Wenn das Flutlicht ausgeht, dreht er noch eine Runde: Netze, Fahnen, Kreidelinien. Ohne ihn gibt es keinen Anstoß.',
       'Sieben Mal klopft, wer den Platzwart sprechen will.', 'wappen|7', 10),
      ('ball', 'fan', 'Der verlorene Ball', 'Irgendwo am Waldsportplatz', null, null,
       'Über den Zaun, in den Wald, nie wieder gesehen. Bis du ihn gefunden hast. Jeder Verein hat so einen — das hier ist unserer.',
       'Einer ging nie ins Tor. Er wartet darauf, dass ihn jemand findet.', 'ball|rundgang', 20),
      ('geburtstag', 'fan', 'Seit 1949', 'Der Geburtstag des SVA', null, null,
       'Gegründet 1949 — seitdem rollt der Ball in Agathenburg und Dollern. Diese Karte gibt es nur an einem einzigen Tag im Jahr.',
       'Nur an einem Tag im Jahr brennen die Kerzen.', 'geburtstag|kerzen', 30),
      ('geste', 'fan', 'Die Geheimtaktik', 'Nur für Eingeweihte', null, null,
       'Kein Trainer verrät sie, keine Taktiktafel zeigt sie. Wer sie kennt, gehört dazu.',
       'Hoch, hoch, runter, runter … wer die Alten kennt, kennt den Rest.', 'geste|OOUULRLR', 40)
    ) as t(schluessel, typ, titel, untertitel, bild, fokus, rueck, raetsel, teil, sort)
  loop
    select g.karte_id into v_id from public.sva_album_geheim g where g.schluessel = r.schluessel;
    if v_id is null or not exists (select 1 from public.sva_album_karten k where k.id = v_id) then
      select k.id into v_id from public.sva_album_karten k
       where k.geheim and k.titel = r.titel and coalesce(k.saison, v_saison) = v_saison limit 1;
      if v_id is null then
        insert into public.sva_album_karten (typ, titel, untertitel, bild_url, bild_fokus, seltenheit, limitiert, geheim,
                                             serie, rueckseite, saison, sortierung)
        values (r.typ, r.titel, r.untertitel, r.bild, r.fokus, 'spezial', true, true, 'Geheimkarte', r.rueck, null, 900 + r.sort)
        returning id into v_id;
        v_karten := v_karten + 1;
      end if;
    end if;
    insert into public.sva_album_geheim (schluessel, karte_id, token_hash, raetsel, sortierung)
    values (r.schluessel, v_id, public.sva_album_geheim_hash(r.teil), r.raetsel, r.sort)
    on conflict (schluessel) do update
       set karte_id = coalesce((select k.id from public.sva_album_karten k where k.id = public.sva_album_geheim.karte_id), excluded.karte_id);
    get diagnostics v_n = row_count;
    v_eier := v_eier + v_n;
  end loop;
  return jsonb_build_object('saison', v_saison, 'karten', v_karten, 'eier', v_eier);
end;
$$;

-- ── 8. Öffentlich: Katalog ohne Geheimkarten ───────────────────────────────
do $$
begin
  if to_regprocedure('public.sva_album_katalog_v21()') is null then
    alter function public.album_katalog() rename to sva_album_katalog_v21;
  end if;
  if to_regprocedure('public.sva_album_mein_v21()') is null then
    alter function public.album_mein() rename to sva_album_mein_v21;
  end if;
  if to_regprocedure('public.sva_album_code_einloesen_v21(text)') is null then
    alter function public.album_code_einloesen(text) rename to sva_album_code_einloesen_v21;
  end if;
  if to_regprocedure('public.sva_album_konto_loeschen_v21()') is null then
    alter function public.album_konto_loeschen() rename to sva_album_konto_loeschen_v21;
  end if;
end $$;

create or replace function public.album_katalog()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb := public.sva_album_katalog_v21();
  v_e public.sva_album_einstellungen;
begin
  select * into v_e from public.sva_album_einstellungen where id = 1;
  v := jsonb_set(v, '{karten}', coalesce((
         select jsonb_agg(x.e order by x.i)
           from jsonb_array_elements(v -> 'karten') with ordinality as x(e, i)
          where not exists (select 1 from public.sva_album_karten k where k.id = (x.e ->> 'id')::uuid and k.geheim)), '[]'::jsonb));
  v := jsonb_set(v, '{regeln,shinyChance}', to_jsonb(coalesce(v_e.shiny_chance, 0)));
  if v_e.vereins_geburtstag is not null then
    -- nur Tag + Monat (fürs Kerzen-Detail am Geburtstag)
    v := jsonb_set(v, '{regeln,vereinsGeburtstag}', to_jsonb(to_char(v_e.vereins_geburtstag, 'MM-DD')));
  end if;
  v := jsonb_set(v, '{regeln,geheimAnzahl}', to_jsonb((
         select count(*)::int from public.sva_album_geheim g join public.sva_album_karten k on k.id = g.karte_id
          where g.aktiv and k.aktiv)));
  return v;
end;
$$;
comment on function public.album_katalog() is 'Öffentlich: Album-Katalog der Saison + Regeln. v22: ohne Geheimkarten; + shinyChance, vereinsGeburtstag (MM-DD), geheimAnzahl.';

-- ── 9. Fan: eigenes Album + Shiny + Geheimseite ────────────────────────────
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
  v jsonb := public.sva_album_mein_v21();
begin
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    return v || jsonb_build_object('shiny', '[]'::jsonb, 'shinyErstfunde', '[]'::jsonb, 'geheim', '[]'::jsonb);
  end if;
  return v || jsonb_build_object(
    'shiny', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'karteId', coalesce(public.sva_album_basis_karte(s.roster_id, s.saison), s.karte_id),
               'gezogen', s.karte_id, 'anzahl', s.anzahl, 'at', s.erstmals_at,
               'erstfund', (select jsonb_build_object('name', e.name, 'at', e.at, 'ich', e.fan_user_id is not distinct from v_uid)
                              from public.sva_album_shiny_erstfund e where e.roster_id = s.roster_id and e.saison = s.saison)))
             order by s.erstmals_at)
        from public.sva_album_shiny s where s.fan_user_id = v_uid and s.saison = v_saison), '[]'::jsonb),
    'shinyErstfunde', coalesce((
      select jsonb_agg(jsonb_build_object('karteId', public.sva_album_basis_karte(e.roster_id, e.saison),
                                          'name', e.name, 'at', e.at, 'ich', e.fan_user_id is not distinct from v_uid) order by e.at)
        from public.sva_album_shiny_erstfund e where e.saison = v_saison), '[]'::jsonb),
    -- Geheimseite: Rätsel + Silhouette, Karte erst nach dem Fund (Schlüssel/Ort bleiben verborgen)
    'geheim', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'nr', x.nr, 'raetsel', x.raetsel, 'gefunden', x.gefunden,
               'karte', case when x.gefunden then public.sva_album_karte_json(x.karte_id) end)) order by x.nr)
        from (
          select row_number() over (order by g.sortierung, g.schluessel) as nr, g.raetsel, g.karte_id,
                 exists (select 1 from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = g.karte_id) as gefunden,
                 g.aktiv and k.aktiv as aktiv
            from public.sva_album_geheim g join public.sva_album_karten k on k.id = g.karte_id
        ) x
       where x.aktiv or x.gefunden), '[]'::jsonb));
end;
$$;

-- ── 10. Fan: Pack öffnen (+ Shiny gutschreiben, Erstfund) ───────────────────
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
  v_i    integer;
  v_kk   public.sva_album_karten;
  v_nach jsonb := jsonb_build_object('gutscheine', '[]'::jsonb, 'kapitel', '[]'::jsonb, 'ziele', '[]'::jsonb);
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
    -- v22: Shiny obendrauf (Vitrine + Erstfund); der Besitz oben bleibt unverändert
    for v_i in 1 .. coalesce(cardinality(v_p.karten), 0) loop
      continue when not coalesce(v_p.shiny[v_i], false);
      select * into v_kk from public.sva_album_karten k where k.id = v_p.karten[v_i];
      continue when v_kk.id is null or v_kk.roster_id is null;
      insert into public.sva_album_shiny (fan_user_id, roster_id, saison, karte_id, anzahl, pack_id)
      values (v_uid, v_kk.roster_id, v_p.saison, v_kk.id, 1, v_p.id)
      on conflict (fan_user_id, roster_id, saison) do update
         set anzahl = public.sva_album_shiny.anzahl + 1, zuletzt_at = now();
      insert into public.sva_album_shiny_erstfund (roster_id, saison, fan_user_id, name, karte_id)
      values (v_kk.roster_id, v_p.saison, v_uid, coalesce(public.sva_album_name(v_uid), 'Ein SVA-Fan'), v_kk.id)
      on conflict (roster_id, saison) do nothing;
    end loop;
    update public.sva_album_packs set geoeffnet_at = now(), neu = v_neu where id = v_p.id;
    v_p.neu := v_neu;
    v_nach := public.sva_album_nach_besitz(v_uid);
  end if;

  return jsonb_build_object(
    'id', v_p.id,
    'art', v_p.art,
    'titel', v_p.titel,
    'gegner', (select s.gegner from public.sm_spiele s where s.id = v_p.spiel_id),
    'karten', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'karteId', x.k,
               'seltenheit', coalesce(v_p.seltenheiten[x.i], 'bronze'),
               'neu', coalesce(v_p.neu[x.i], false),
               'anzahl', coalesce((select b.anzahl from public.sva_album_besitz b where b.fan_user_id = v_uid and b.karte_id = x.k), 0),
               'variante', kk.variante,
               'limitiert', kk.limitiert,
               'geheim', case when kk.geheim then true end,
               'shiny', coalesce(v_p.shiny[x.i], false),
               'erstfund', case when coalesce(v_p.shiny[x.i], false) then (
                             select jsonb_build_object('name', e.name, 'at', e.at, 'ich', e.fan_user_id is not distinct from v_uid)
                               from public.sva_album_shiny_erstfund e where e.roster_id = kk.roster_id and e.saison = v_p.saison) end,
               -- Geheimkarten stehen nicht im öffentlichen Katalog → Daten direkt mitliefern
               'karte', case when kk.geheim then public.sva_album_karte_json(kk.id) end
             )) order by x.i)
        from unnest(v_p.karten) with ordinality as x(k, i)
        join public.sva_album_karten kk on kk.id = x.k), '[]'::jsonb),
    'gutscheine', v_nach -> 'gutscheine',
    'kapitel', v_nach -> 'kapitel',
    'ziele', v_nach -> 'ziele'
  );
end;
$$;

-- ── 11. Fan: Code einlösen (+ Geheim-Token) ─────────────────────────────────
create or replace function public.album_code_einloesen(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := public.sva_album_uid();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  v_e    public.sva_album_einstellungen;
  v_g    public.sva_album_geheim;
  v_n    integer;
  v_pack uuid;
  v_heute text;
begin
  if v_code !~ '^G-[0-9A-F]{32}$' then
    return public.sva_album_code_einloesen_v21(p_code);
  end if;
  select * into v_e from public.sva_album_einstellungen where id = 1;
  delete from public.sva_album_code_fehler where at < now() - interval '1 day';
  if not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    return jsonb_build_object('ok', false, 'grund', 'kein_profil');
  end if;
  select count(*) into v_n from public.sva_album_code_fehler f
   where f.fan_user_id = v_uid and f.at > now() - interval '1 hour';
  if v_n >= v_e.code_fehler_limit then
    return jsonb_build_object('ok', false, 'grund', 'gesperrt');
  end if;

  select g.* into v_g from public.sva_album_geheim g
    join public.sva_album_karten k on k.id = g.karte_id
   where g.token_hash = encode(sha256(convert_to(v_code, 'UTF8')), 'hex')
     and g.aktiv and k.aktiv and k.geheim;
  if v_g.schluessel is null then
    -- Fehlversuch zählt (kein raise, sonst würde er zurückgerollt)
    insert into public.sva_album_code_fehler (fan_user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'grund', 'ungueltig', 'versuche', greatest(0, v_e.code_fehler_limit - v_n - 1));
  end if;
  if v_g.schluessel = 'geburtstag' then
    v_heute := to_char(now() at time zone 'Europe/Berlin', 'MM-DD');
    if v_e.vereins_geburtstag is null or to_char(v_e.vereins_geburtstag, 'MM-DD') <> v_heute then
      return jsonb_build_object('ok', false, 'grund', 'nicht_heute');
    end if;
  end if;
  if exists (select 1 from public.sva_album_packs p
              where p.fan_user_id = v_uid and p.art = 'geheim' and p.quelle = 'geheim:' || v_g.schluessel) then
    return jsonb_build_object('ok', false, 'grund', 'schon', 'geheim', true);
  end if;
  v_pack := public.sva_album_pack_ziehen_v20(v_uid, 'geheim', null, 1, 'geheim:' || v_g.schluessel,
                                             'Geheimkarte entdeckt', null, v_g.karte_id);
  if v_pack is null then
    return jsonb_build_object('ok', false, 'grund', 'schon', 'geheim', true);
  end if;
  return jsonb_build_object('ok', true, 'packId', v_pack, 'art', 'geheim', 'titel', 'Geheimkarte entdeckt', 'geheim', true);
end;
$$;

-- ── 12. Fan: Konto löschen (+ Shiny; Erstfund wird anonym) ──────────────────
create or replace function public.album_konto_loeschen()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
begin
  delete from public.sva_album_shiny where fan_user_id = v_uid;
  update public.sva_album_shiny_erstfund set fan_user_id = null, name = 'Ein SVA-Fan' where fan_user_id = v_uid;
  return public.sva_album_konto_loeschen_v21();
end;
$$;

-- ── 13. Admin ───────────────────────────────────────────────────────────────
create or replace function public.album_admin_shiny()
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
    'chance', (select e.shiny_chance from public.sva_album_einstellungen e where e.id = 1),
    'gesamt', (select coalesce(sum(s.anzahl), 0)::int from public.sva_album_shiny s where s.saison = v_saison),
    'personen', (select count(distinct s.roster_id)::int from public.sva_album_shiny s where s.saison = v_saison),
    'fans', (select count(distinct s.fan_user_id)::int from public.sva_album_shiny s where s.saison = v_saison),
    'funde', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'karteId', coalesce(public.sva_album_basis_karte(s.roster_id, s.saison), s.karte_id),
               'gezogen', s.karte_id,
               'person', r.name, 'fan', public.sva_album_name(s.fan_user_id),
               'at', s.erstmals_at, 'anzahl', s.anzahl,
               'erstfund', exists (select 1 from public.sva_album_shiny_erstfund e
                                    where e.roster_id = s.roster_id and e.saison = s.saison and e.fan_user_id = s.fan_user_id)))
             order by s.erstmals_at desc)
        from (select * from public.sva_album_shiny s0 where s0.saison = v_saison order by s0.erstmals_at desc limit 200) s
        join public.sm_roster r on r.id = s.roster_id), '[]'::jsonb),
    'erstfunde', coalesce((
      select jsonb_agg(jsonb_build_object('person', r.name, 'name', e.name, 'at', e.at,
                                          'karteId', public.sva_album_basis_karte(e.roster_id, e.saison)) order by e.at desc)
        from public.sva_album_shiny_erstfund e join public.sm_roster r on r.id = e.roster_id
       where e.saison = v_saison), '[]'::jsonb));
end;
$$;

create or replace function public.album_admin_geheim()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_album_admin_pruefen();
  return jsonb_build_object(
    'vereinsGeburtstag', (select e.vereins_geburtstag from public.sva_album_einstellungen e where e.id = 1),
    'eier', coalesce((
      select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
               'schluessel', g.schluessel, 'aktiv', g.aktiv, 'raetsel', g.raetsel, 'sortierung', g.sortierung,
               'karte', public.sva_album_karte_json(g.karte_id),
               'kartenAktiv', k.aktiv,
               'gefunden', (select count(*)::int from public.sva_album_besitz b where b.karte_id = g.karte_id)))
             order by g.sortierung, g.schluessel)
        from public.sva_album_geheim g left join public.sva_album_karten k on k.id = g.karte_id), '[]'::jsonb));
end;
$$;

create or replace function public.album_admin_geheim_standard()
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_album_admin_pruefen();
  return public.sva_album_v22_nachziehen();
end;
$$;

-- ── 14. Rechte ──────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  -- intern (nur aus SECURITY-DEFINER-RPCs bzw. service_role)
  foreach f in array array[
    'public.sva_album_pack_shiny()',
    'public.sva_album_basis_karte(uuid, text)',
    'public.sva_album_karte_json(uuid)',
    'public.sva_album_v22_nachziehen()',
    'public.sva_album_katalog_v21()',
    'public.sva_album_mein_v21()',
    'public.sva_album_code_einloesen_v21(text)',
    'public.sva_album_konto_loeschen_v21()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- Hash-Hilfe: harmlos, aber nicht öffentlich nötig
  execute 'revoke all on function public.sva_album_geheim_hash(text) from public, anon, authenticated';
  execute 'grant execute on function public.sva_album_geheim_hash(text) to service_role';
  foreach f in array array[
    'public.album_mein()',
    'public.album_pack_oeffnen(uuid)',
    'public.album_code_einloesen(text)',
    'public.album_konto_loeschen()',
    'public.album_admin_shiny()',
    'public.album_admin_geheim()',
    'public.album_admin_geheim_standard()'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  execute 'revoke all on function public.album_katalog() from public';
  execute 'grant execute on function public.album_katalog() to anon, authenticated, service_role';
end $$;

-- ── 15. Geheimkarten der echten DB anlegen (idempotent, ändert keinen Besitz) ─
-- Nur wenn es schon einen Katalog gibt (echte DB). Eine leere DB bekommt sie
-- später per Admin → Album → Shiny & Geheim → „Geheimkarten anlegen“
-- (album_admin_geheim_standard()).
select public.sva_album_v22_nachziehen()
 where exists (select 1 from public.sva_album_karten k where not k.geheim);
