-- ─────────────────────────────────────────────────────────────────────────────
-- v15-L „Spieltag-Modus": eigener Liveticker, Rollen, öffentliche Lese-RPC.
--
-- Was diese Migration tut (alles ADDITIV, nur eigene sm_*/sva_*-Objekte —
-- das Supabase-Projekt wird mit der Kochsafe-App geteilt):
--   1. Rollen: sm_admins.rolle ('admin' | 'team'). is_sm_admin() gilt ab jetzt
--      NUR für rolle = 'admin'; neu is_sva_team() = admin ODER team.
--      Admins dürfen sm_admins verwalten (Seite „Team & Zugänge"), aber nie
--      die eigene Zeile ändern/löschen (kein Selbst-Aussperren).
--   2. Live-Status am Spiel (sm_spiele): status, anpfiff_at, wiederanpfiff_at,
--      live_tore_sva/live_tore_gegner, motm_roster_id.
--   3. Tabelle sva_ticker (Ereignisse). Spielstand, Status und Anpfiffzeiten
--      werden SERVERSEITIG aus den Ereignissen abgeleitet (Trigger) → eine
--      Quelle der Wahrheit, „Rückgängig" = Ereignis löschen, Offline-
--      Warteschlange im Admin kann Ereignisse gefahrlos erneut senden (die
--      ID kommt vom Gerät, doppeltes Senden scheitert am Primärschlüssel).
--   4. Team-Rechte: Team darf sva_lineup, sva_ticker und die Live-/Ergebnis-
--      felder an sm_spiele schreiben (Spalten-Wächter per Trigger). Alles
--      andere bleibt is_sm_admin().
--   5. sva_settings: training_ort (Trainingsort ≠ Spielort) + fussball.de-
--      Widget-IDs (Tabelle, Spielplan). Steht die Adresse heute auf dem
--      Trainingsplatz (B73/Paschberg), wird sie einmalig nach training_ort
--      verschoben und adresse auf den Waldsportplatz (Spielort) gesetzt.
--   6. web_snapshot() liefert zusätzlich trainingOrt + Widget-IDs.
--   7. Öffentliche Lese-RPC web_live() (SECURITY DEFINER, anon): aktuelles
--      bzw. nächstes Spiel, Status, Spielstand, laufende Minute, Ticker,
--      Aufstellung, Spieler (nur Name/Nummer/Foto).
--
-- NICHT automatisch anwenden — Reihenfolge siehe docs/SPIELTAG.md.
-- Idempotent formuliert (mehrfaches Anwenden schadet nicht). Lokal gegen
-- PGlite mit Supabase-Stubs getestet (alle Migrationen der Reihe nach, 2×).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Rollen ────────────────────────────────────────────────────────────────
alter table public.sm_admins add column if not exists rolle text not null default 'admin';
alter table public.sm_admins add column if not exists name text;
alter table public.sm_admins add column if not exists angelegt_von text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sm_admins_rolle_check') then
    alter table public.sm_admins add constraint sm_admins_rolle_check check (rolle in ('admin', 'team'));
  end if;
  -- Neue Einträge: E-Mail klein und ohne Leerzeichen (Altbestand bleibt
  -- unangetastet → NOT VALID; Vergleiche laufen ohnehin über lower()).
  if not exists (select 1 from pg_constraint where conname = 'sm_admins_email_format') then
    alter table public.sm_admins add constraint sm_admins_email_format
      check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$') not valid;
  end if;
end $$;

comment on column public.sm_admins.rolle is 'admin = alles; team = Übersicht, Aufstellung, Spiele/Ergebnis, Live-Ticker.';

-- is_sm_admin(): ab jetzt NUR Vollzugriff. Bestehende Zeilen haben durch den
-- Default rolle = 'admin' → für heutige Admins ändert sich nichts.
create or replace function public.is_sm_admin()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.sm_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
      and rolle = 'admin'
  );
$$;

create or replace function public.is_sva_team()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.sm_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
comment on function public.is_sva_team() is 'Eingeloggt und in sm_admins (Rolle admin ODER team).';

-- Für den Admin-Client: welche Rolle habe ich? (null = kein Zugang)
create or replace function public.sva_meine_rolle()
returns text
language sql stable security definer
set search_path to 'public'
as $$
  select a.rolle from public.sm_admins a
   where lower(a.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
   order by (a.rolle = 'admin') desc
   limit 1;
$$;

revoke execute on function public.is_sm_admin() from public, anon;
grant  execute on function public.is_sm_admin() to authenticated, service_role;
revoke execute on function public.is_sva_team() from public, anon;
grant  execute on function public.is_sva_team() to authenticated, service_role;
revoke execute on function public.sva_meine_rolle() from public, anon;
grant  execute on function public.sva_meine_rolle() to authenticated, service_role;

-- sm_admins: Selbst-Lesen bleibt (sm_admins_self_select). Admins verwalten
-- alle Zeilen, aber nicht die eigene (kein Aussperren, kein Selbst-Herabstufen).
drop policy if exists sm_admins_admin_select on public.sm_admins;
create policy sm_admins_admin_select on public.sm_admins
  for select to authenticated using (public.is_sm_admin());
drop policy if exists sm_admins_admin_insert on public.sm_admins;
create policy sm_admins_admin_insert on public.sm_admins
  for insert to authenticated with check (public.is_sm_admin());
drop policy if exists sm_admins_admin_update on public.sm_admins;
create policy sm_admins_admin_update on public.sm_admins
  for update to authenticated
  using (public.is_sm_admin() and lower(email) <> lower(coalesce(auth.jwt() ->> 'email', '')))
  with check (public.is_sm_admin() and lower(email) <> lower(coalesce(auth.jwt() ->> 'email', '')));
drop policy if exists sm_admins_admin_delete on public.sm_admins;
create policy sm_admins_admin_delete on public.sm_admins
  for delete to authenticated
  using (public.is_sm_admin() and lower(email) <> lower(coalesce(auth.jwt() ->> 'email', '')));

-- ── 2. Live-Status am Spiel ──────────────────────────────────────────────────
alter table public.sm_spiele add column if not exists status text not null default 'geplant';
alter table public.sm_spiele add column if not exists anpfiff_at timestamptz;
alter table public.sm_spiele add column if not exists wiederanpfiff_at timestamptz;
alter table public.sm_spiele add column if not exists live_tore_sva integer not null default 0;
alter table public.sm_spiele add column if not exists live_tore_gegner integer not null default 0;
alter table public.sm_spiele add column if not exists motm_roster_id uuid references public.sm_roster(id) on delete set null;
alter table public.sm_spiele add column if not exists live_updated_at timestamptz;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sm_spiele_status_check') then
    alter table public.sm_spiele add constraint sm_spiele_status_check
      check (status in ('geplant', 'live', 'halbzeit', 'beendet'));
  end if;
end $$;

comment on column public.sm_spiele.status is 'geplant | live | halbzeit | beendet — wird aus sva_ticker abgeleitet (Trigger).';
comment on column public.sm_spiele.anpfiff_at is 'Tatsächlicher Anpfiff 1. Halbzeit (aus Ticker-Ereignis „anpfiff"). Basis der laufenden Minute.';
comment on column public.sm_spiele.wiederanpfiff_at is 'Tatsächlicher Anpfiff 2. Halbzeit (aus Ticker-Ereignis „wiederanpfiff").';
comment on column public.sm_spiele.live_tore_sva is 'Live-Spielstand (Zahl der Ticker-Ereignisse „tor"). Endergebnis steht nach Abpfiff in tore_sva.';
comment on column public.sm_spiele.motm_roster_id is 'Spieler des Spiels (nach Abpfiff im Admin gewählt).';

-- Altbestand: Spiele mit Ergebnis gelten als beendet.
update public.sm_spiele set status = 'beendet'
 where status = 'geplant' and tore_sva is not null and tore_gegner is not null;

-- ── 3. Ticker ────────────────────────────────────────────────────────────────
create table if not exists public.sva_ticker (
  -- Die ID erzeugt das Gerät (Offline-Warteschlange) — doppeltes Senden
  -- scheitert am Primärschlüssel und wird im Admin als „schon da" gewertet.
  id uuid primary key default gen_random_uuid(),
  spiel_id uuid not null references public.sm_spiele(id) on delete cascade,
  minute integer check (minute is null or minute between 0 and 130),
  nachspielzeit integer check (nachspielzeit is null or nachspielzeit between 0 and 30),
  typ text not null check (typ in (
    'anpfiff', 'tor', 'gegentor', 'gelb', 'gelbrot', 'rot', 'wechsel',
    'halbzeit', 'wiederanpfiff', 'abpfiff', 'elfmeter', 'kommentar')),
  -- tor: Torschütze · wechsel: kommt rein · Karten: Spieler
  roster_id uuid references public.sm_roster(id) on delete set null,
  -- tor: Vorlage · wechsel: geht raus
  roster_id_2 uuid references public.sm_roster(id) on delete set null,
  text text check (text is null or char_length(text) <= 500),
  -- Zeitpunkt auf dem Gerät (nicht beim späten Nachsenden) → Anpfiffzeit stimmt auch offline.
  zeitpunkt timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by text default (auth.jwt() ->> 'email')
);
comment on table public.sva_ticker is 'Liveticker-Ereignisse je Spiel. Spielstand/Status in sm_spiele werden daraus per Trigger abgeleitet.';
create index if not exists sva_ticker_spiel_idx on public.sva_ticker (spiel_id, zeitpunkt desc);
alter table public.sva_ticker enable row level security;

-- Ableitung: Spielstand, Status, Anpfiffzeiten, Endergebnis.
create or replace function public.sva_spiel_live_sync(p_spiel uuid)
returns void
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_sva     integer;
  v_geg     integer;
  v_last    text;
  v_anpfiff timestamptz;
  v_wieder  timestamptz;
  v_status  text;
begin
  if p_spiel is null then return; end if;

  select count(*) filter (where t.typ = 'tor'),
         count(*) filter (where t.typ = 'gegentor'),
         min(t.zeitpunkt) filter (where t.typ = 'anpfiff'),
         max(t.zeitpunkt) filter (where t.typ = 'wiederanpfiff')
    into v_sva, v_geg, v_anpfiff, v_wieder
    from public.sva_ticker t
   where t.spiel_id = p_spiel;

  select t.typ into v_last
    from public.sva_ticker t
   where t.spiel_id = p_spiel
     and t.typ in ('anpfiff', 'halbzeit', 'wiederanpfiff', 'abpfiff')
   order by t.zeitpunkt desc, t.created_at desc
   limit 1;

  v_status := case v_last
                when 'anpfiff' then 'live'
                when 'wiederanpfiff' then 'live'
                when 'halbzeit' then 'halbzeit'
                when 'abpfiff' then 'beendet'
                else 'geplant'
              end;

  update public.sm_spiele s
     set live_tore_sva    = v_sva,
         live_tore_gegner = v_geg,
         status           = case when v_last is null and s.tore_sva is not null and s.tore_gegner is not null
                                 then 'beendet' else v_status end,
         anpfiff_at       = v_anpfiff,
         wiederanpfiff_at = v_wieder,
         -- Ticker-geführtes Spiel: Ergebnis erst mit Abpfiff, „Rückgängig" nimmt es wieder weg.
         -- Ohne Status-Ereignisse bleibt ein von Hand eingetragenes Ergebnis stehen.
         tore_sva         = case when v_status = 'beendet' then v_sva
                                 when v_last is not null then null
                                 else s.tore_sva end,
         tore_gegner      = case when v_status = 'beendet' then v_geg
                                 when v_last is not null then null
                                 else s.tore_gegner end,
         live_updated_at  = now(),
         updated_at       = now()
   where s.id = p_spiel;
end;
$$;
revoke execute on function public.sva_spiel_live_sync(uuid) from public, anon, authenticated;
grant  execute on function public.sva_spiel_live_sync(uuid) to service_role;

create or replace function public.sva_ticker_after_change()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if tg_op = 'INSERT' then
    perform public.sva_spiel_live_sync(new.spiel_id);
  elsif tg_op = 'DELETE' then
    perform public.sva_spiel_live_sync(old.spiel_id);
  else
    perform public.sva_spiel_live_sync(old.spiel_id);
    if new.spiel_id is distinct from old.spiel_id then
      perform public.sva_spiel_live_sync(new.spiel_id);
    end if;
  end if;
  return null;
end;
$$;
revoke execute on function public.sva_ticker_after_change() from public, anon, authenticated;

drop trigger if exists sva_ticker_sync on public.sva_ticker;
create trigger sva_ticker_sync
  after insert or update or delete on public.sva_ticker
  for each row execute function public.sva_ticker_after_change();

-- ── 4. Team-Rechte ───────────────────────────────────────────────────────────
-- Ticker: Team + Admin, alle Operationen (Rückgängig = Löschen, Uhr stellen = Update).
drop policy if exists sva_ticker_select on public.sva_ticker;
create policy sva_ticker_select on public.sva_ticker for select to authenticated using (public.is_sva_team());
drop policy if exists sva_ticker_insert on public.sva_ticker;
create policy sva_ticker_insert on public.sva_ticker for insert to authenticated with check (public.is_sva_team());
drop policy if exists sva_ticker_update on public.sva_ticker;
create policy sva_ticker_update on public.sva_ticker for update to authenticated using (public.is_sva_team()) with check (public.is_sva_team());
drop policy if exists sva_ticker_delete on public.sva_ticker;
create policy sva_ticker_delete on public.sva_ticker for delete to authenticated using (public.is_sva_team());

-- Aufstellung: Team darf lesen und speichern (append-only; Löschen bleibt Admin).
drop policy if exists sva_lineup_select on public.sva_lineup;
create policy sva_lineup_select on public.sva_lineup for select to authenticated using (public.is_sva_team());
drop policy if exists sva_lineup_insert on public.sva_lineup;
create policy sva_lineup_insert on public.sva_lineup for insert to authenticated with check (public.is_sva_team());

-- Kader: Team liest (Aufstellung, Spieler-Chips im Ticker). Schreiben bleibt Admin.
drop policy if exists sm_roster_select on public.sm_roster;
create policy sm_roster_select on public.sm_roster for select to authenticated using (public.is_sva_team());

-- Spiele: Team liest und aktualisiert — aber nur Live-/Ergebnisfelder (Wächter
-- unten). Anlegen/Löschen bleibt Admin.
drop policy if exists sm_spiele_select on public.sm_spiele;
create policy sm_spiele_select on public.sm_spiele for select to authenticated using (public.is_sva_team());
drop policy if exists sm_spiele_update on public.sm_spiele;
create policy sm_spiele_update on public.sm_spiele for update to authenticated using (public.is_sva_team()) with check (public.is_sva_team());

create or replace function public.sva_spiele_team_waechter()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  -- Nur direkte Änderungen eingeloggter Nicht-Admins prüfen. Die Ableitung aus
  -- dem Ticker (SECURITY DEFINER) und Wartung (service_role) laufen nicht als
  -- „authenticated" und sind deshalb nicht betroffen.
  if current_user = 'authenticated' and not public.is_sm_admin() then
    if (new.id, new.gegner, new.heim, new.anstoss, new.ort, new.wettbewerb, new.spieltag_nr, new.notizen, new.created_at)
       is distinct from
       (old.id, old.gegner, old.heim, old.anstoss, old.ort, old.wettbewerb, old.spieltag_nr, old.notizen, old.created_at) then
      raise exception 'sva_team_nur_live_felder: Team-Zugang darf nur Ergebnis, Live-Stand und Spieler des Spiels ändern.'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists sva_spiele_team_waechter on public.sm_spiele;
create trigger sva_spiele_team_waechter
  before update on public.sm_spiele
  for each row execute function public.sva_spiele_team_waechter();

-- ── 5. Verein & Links: Trainingsort + fussball.de-Widgets ────────────────────
alter table public.sva_settings add column if not exists training_ort text;
alter table public.sva_settings add column if not exists fussball_de_widget_tabelle text;
alter table public.sva_settings add column if not exists fussball_de_widget_spielplan text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_settings_widget_tabelle_check') then
    alter table public.sva_settings add constraint sva_settings_widget_tabelle_check
      check (fussball_de_widget_tabelle is null or fussball_de_widget_tabelle ~ '^[A-Z0-9]{32}$');
  end if;
  if not exists (select 1 from pg_constraint where conname = 'sva_settings_widget_spielplan_check') then
    alter table public.sva_settings add constraint sva_settings_widget_spielplan_check
      check (fussball_de_widget_spielplan is null or fussball_de_widget_spielplan ~ '^[A-Z0-9]{32}$');
  end if;
end $$;

comment on column public.sva_settings.adresse is 'SPIELORT (Heimspiele): Waldsportplatz — Anfahrt, Karte, Live-Seite, Schema.';
comment on column public.sva_settings.training_ort is 'TRAININGSORT (≠ Spielort), z. B. Sportplatz an der B73. Erscheint bei den Trainingszeiten.';
comment on column public.sva_settings.fussball_de_widget_tabelle is 'fussball.de-Widget-ID (32 Zeichen) für die Tabelle — Live-Seite lädt das Widget erst nach Klick.';
comment on column public.sva_settings.fussball_de_widget_spielplan is 'fussball.de-Widget-ID (32 Zeichen) für den Spielplan.';

-- Spielort ≠ Trainingsort: steht die Trainingsplatz-Adresse (B73/Paschberg)
-- heute im Spielort-Feld, einmalig umziehen. Nur wenn training_ort noch leer
-- ist → idempotent, überschreibt nie eine Pflege im Admin.
update public.sva_settings
   set training_ort = adresse,
       adresse      = 'Waldsportplatz Agathenburg, Zur Mehrzweckhalle, 21684 Agathenburg',
       updated_at   = now(),
       updated_by   = 'migration v15-L'
 where id = 1
   and coalesce(btrim(training_ort), '') = ''
   and adresse ~* '(b ?73|paschberg)';

-- ── 6. web_snapshot(): + trainingOrt, Widget-IDs ─────────────────────────────
-- Unverändert bis auf den Block „Verein & Links" (siehe 20261004101000).
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

  select coalesce(jsonb_agg(x.obj order by x.sortierung, x.name), '[]'::jsonb)
    into v_sponsors
    from (
      select sp.sortierung, sp.name,
             jsonb_strip_nulls(jsonb_build_object(
               'name',    sp.name,
               'logoUrl', sp.logo_url,
               'url',     sp.website_url,
               'bande',   sp.bande
             )) as obj
        from public.sm_sponsoren sp
       where sp.aktiv
    ) x;

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
    'sections',    coalesce(v_sections, '[]'::jsonb)
  );
end;
$$;
revoke all on function public.web_snapshot() from public;
grant execute on function public.web_snapshot() to anon, authenticated, service_role;

-- ── 7. web_live(): öffentliche Live-Lese-Schicht ─────────────────────────────
-- Wird von /live (alle 15 s während des Spiels, sonst 5 min) und von der
-- Spieltag-Leiste des Onepagers (nur im Spieltagsfenster) per fetch mit dem
-- anon-Key gelesen. Liefert NUR Veröffentlichbares: keine E-Mails (created_by),
-- keine Notizen, keine internen IDs des Kaders (Spieler = öffentliche slug).
--
-- Welches Spiel?
--   1. ein laufendes (live/halbzeit)
--   2. sonst ein in den letzten 12 h beendetes (Endstand-Ansicht)
--   3. sonst das nächste (Anstoß höchstens 3 h her, ohne Ergebnis)
--   4. sonst das zuletzt beendete
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

  return jsonb_build_object(
    'version',   1,
    'serverNow', now(),
    'match',     v_match,
    'events',    v_events,
    'lineup',    v_lj,
    'players',   v_players,
    'staff',     v_staff,
    'previous',  v_prev,
    'settings',  coalesce(v_settings, '{}'::jsonb)
  );
end;
$$;

comment on function public.web_live() is
  'Öffentliche Live-Lese-Schicht (/live, Spieltag-Leiste): aktuelles/nächstes Spiel, Spielstand, Minute, Ticker, Aufstellung. Nur veröffentlichbare Felder.';

revoke all on function public.web_live() from public;
grant execute on function public.web_live() to anon, authenticated, service_role;
