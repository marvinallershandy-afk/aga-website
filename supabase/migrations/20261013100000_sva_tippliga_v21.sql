-- ═══════════════════════════════════════════════════════════════════════════
-- v21-T „Tipp-Liga nach dem ersten Test“ (06.10.2026) — nach 20261012120000.
--
--   1. „Deine Elf“ neu: 1 TW · 1 ABW · 2 MIT · 1 ANG (Plätze in dieser
--      Reihenfolge). Jeder Platz nimmt Spieler mit passender Haupt- ODER
--      Zweitposition. Zweitposition + „nicht verfügbar“ (verletzt/abwesend,
--      mit kurzem Hinweis) pflegt das Team im Admin (sva_tipp_spieler).
--      Punkteberechnung unverändert (Zu-null weiter nach HAUPTposition).
--      Bestehende Elfen: gewertete bleiben wie sie sind; Elfen für noch
--      offene Spiele werden in die neue Platz-Reihenfolge sortiert — passt
--      das nicht, werden sie als „frei“ markiert (waren zum Zeitpunkt der
--      Abgabe gültig, zählen unverändert).
--   2. Kabinen-Liga: feste System-Liga, alle Kabine-Konten automatisch drin
--      (Trigger), kein Beitritt per Code, kein Verlassen. Tabelle öffentlich
--      lesbar (Nicht-Mitglieder sehen nur „öffentlich zeigen“-Konten).
--      Admin „Kabine“ markieren schaltet zugleich „öffentlich zeigen“ an
--      (Spieler-Konten stehen sichtbar mit „Kabine“-Abzeichen in den
--      Ranglisten; der Spieler kann es im Profil wieder ausschalten).
--   3. Admin/Team: tipp_admin_kader(), tipp_admin_spieler_speichern(...).
--
-- Idempotent (mehrfach ausführbar). Getestet: supabase/tests/tippliga_v21.test.mjs
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Spieler-Zusatz für die Tipp-Liga ─────────────────────────────────────
create table if not exists public.sva_tipp_spieler (
  roster_id uuid primary key references public.sm_roster(id) on delete cascade,
  zweitposition text check (zweitposition in ('TW', 'ABW', 'MIT', 'ANG')),
  nicht_verfuegbar boolean not null default false,
  hinweis text check (hinweis is null or char_length(hinweis) between 1 and 60),
  updated_at timestamptz not null default now()
);
comment on table public.sva_tipp_spieler is 'v21-T: Tipp-Liga-Zusatz je Spieler — Zweitposition für „Deine Elf“, „nicht verfügbar“ (verletzt/abwesend) mit Hinweis.';
alter table public.sva_tipp_spieler enable row level security;
revoke all on table public.sva_tipp_spieler from anon, authenticated;
grant select on table public.sva_tipp_spieler to authenticated;
drop policy if exists sva_tipp_spieler_select on public.sva_tipp_spieler;
create policy sva_tipp_spieler_select on public.sva_tipp_spieler for select to authenticated using (public.is_sva_team());

-- Startwerte: offensive Mittelfeldspieler dürfen auch in den Angriff
insert into public.sva_tipp_spieler (roster_id, zweitposition)
select r.id, 'ANG' from public.sm_roster r
 where r.slug in ('p-pejas-n', 'p-pejas-e', 'p-bruenjes') and public.sva_tipp_pos(r.position) <> 'ANG'
on conflict (roster_id) do nothing;

-- Plätze von „Deine Elf“ (1-basiert wie Postgres-Arrays)
create or replace function public.sva_tipp_platz_pos(p_platz integer)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select (array['TW', 'ABW', 'MIT', 'MIT', 'ANG'])[p_platz];
$$;

-- Spieler (roster) passt auf Platz? Haupt- ODER Zweitposition.
create or replace function public.sva_tipp_passt(p_roster uuid, p_platz integer)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.sm_roster r
      left join public.sva_tipp_spieler s on s.roster_id = r.id
     where r.id = p_roster
       and (public.sva_tipp_pos(r.position) = public.sva_tipp_platz_pos(p_platz)
            or s.zweitposition = public.sva_tipp_platz_pos(p_platz)));
$$;

-- Fünf Spieler in die Platz-Reihenfolge bringen (null = passt nicht).
create or replace function public.sva_tipp_elf_ordnen(p_ids uuid[])
returns uuid[]
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with recursive perm(n, arr) as (
    select 0, array[]::uuid[]
    union all
    select perm.n + 1, perm.arr || x.id
      from perm
      cross join unnest(p_ids) as x(id)
     where perm.n < 5
       and not (x.id = any (perm.arr))
       and public.sva_tipp_passt(x.id, perm.n + 1)
  )
  select arr from perm where n = 5 and cardinality(p_ids) = 5 limit 1;
$$;

-- Kader für /tippen: + Zweitposition, nicht verfügbar, Hinweis
create or replace function public.sva_tipp_kader_json()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with st as (
    select b.roster_id,
           count(*) filter (where b.eingesetzt)::int as spiele,
           coalesce(sum(b.tore), 0)::int as tore
      from public.sva_tipp_bericht b
      join public.sm_spiele s on s.id = b.spiel_id
      join public.sva_tipp_spieltage t on t.spiel_id = s.id and t.gewertet_at is not null
     where public.sva_tipp_saison_von(s.anstoss) = public.sva_tipp_saison_von(now())
       and not s.demo
     group by b.roster_id
  )
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id', r.slug, 'name', r.name, 'nummer', r.nummer, 'position', public.sva_tipp_pos(r.position),
           'zweitposition', case when x.zweitposition is distinct from public.sva_tipp_pos(r.position) then x.zweitposition end,
           'nichtVerfuegbar', case when x.nicht_verfuegbar then true end,
           'hinweis', case when x.nicht_verfuegbar then x.hinweis end,
           'fotoUrl', r.foto_url, 'cutoutUrl', r.freisteller_url,
           'kapitaen', case when r.kapitaen then true end,
           'spiele', coalesce(st.spiele, 0), 'tore', coalesce(st.tore, 0)))
         order by r.sortierung, r.nummer nulls last, r.name), '[]'::jsonb)
    from public.sm_roster r
    left join st on st.roster_id = r.id
    left join public.sva_tipp_spieler x on x.roster_id = r.id
   where r.aktiv and r.rolle = 'spieler';
$$;

-- Elf speichern: neue Formation + nicht verfügbar
create or replace function public.tipp_elf_speichern(p_spiel uuid, p_spieler text[], p_kapitaen text, p_frei boolean default false)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_e public.sva_tipp_einstellungen;
  v_ids uuid[] := '{}';
  v_k uuid;
  s text;
  v_id uuid;
  i integer;
begin
  select * into v_e from public.sva_tipp_einstellungen where id = 1;
  if not coalesce(v_e.aktiv, true) then raise exception 'tipp_pausiert' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.sva_tipp_teilnehmer t where t.user_id = v_uid) then
    raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001';
  end if;
  if public.sva_tipp_wertung(p_spiel) is null then raise exception 'tipp_nicht_tippbar' using errcode = 'P0001'; end if;
  if not public.sva_tipp_offen(p_spiel) then raise exception 'tipp_geschlossen' using errcode = 'P0001'; end if;
  if coalesce(cardinality(p_spieler), 0) <> 5 then raise exception 'tipp_ungueltig:elf' using errcode = '22023'; end if;
  foreach s in array p_spieler loop
    v_id := public.sva_tipp_roster(s);
    if v_id is null or v_id = any (v_ids) then raise exception 'tipp_ungueltig:elf' using errcode = '22023'; end if;
    v_ids := v_ids || v_id;
  end loop;
  v_k := public.sva_tipp_roster(p_kapitaen);
  if v_k is null or not (v_k = any (v_ids)) then raise exception 'tipp_ungueltig:kapitaen' using errcode = '22023'; end if;
  if exists (select 1 from public.sva_tipp_spieler x where x.roster_id = any (v_ids) and x.nicht_verfuegbar) then
    raise exception 'tipp_ungueltig:nicht_verfuegbar' using errcode = '22023';
  end if;
  if coalesce(p_frei, false) then
    if not coalesce(v_e.elf_frei, true) then raise exception 'tipp_ungueltig:frei' using errcode = '22023'; end if;
  else
    -- v21: 1 TW · 1 ABW · 2 MIT · 1 ANG — Haupt- oder Zweitposition
    for i in 1 .. 5 loop
      if not public.sva_tipp_passt(v_ids[i], i) then
        raise exception 'tipp_ungueltig:positionen' using errcode = '22023';
      end if;
    end loop;
  end if;
  insert into public.sva_tipp_elf (user_id, spiel_id, spieler, kapitaen, frei)
  values (v_uid, p_spiel, v_ids, v_k, coalesce(p_frei, false))
  on conflict (user_id, spiel_id) do update
     set spieler = excluded.spieler, kapitaen = excluded.kapitaen, frei = excluded.frei;
  return jsonb_build_object('ok', true);
end;
$$;

comment on column public.sva_tipp_elf.spieler is 'v21-T: Plätze [TW, ABW, MIT, MIT, ANG] (Haupt- oder Zweitposition) bzw. frei. Vor v21 gewertete Elfen: [TW/ABW, MIT, MIT, ANG, ANG].';

-- Bestehende Elfen für noch offene Spiele in die neue Reihenfolge bringen
do $$
declare
  r record;
  v_neu uuid[];
begin
  for r in select e.user_id, e.spiel_id, e.spieler from public.sva_tipp_elf e
            where not e.frei and public.sva_tipp_offen(e.spiel_id) and public.sva_tipp_wertung(e.spiel_id) is not null loop
    v_neu := public.sva_tipp_elf_ordnen(r.spieler);
    if v_neu is not null then
      if v_neu is distinct from r.spieler then
        update public.sva_tipp_elf set spieler = v_neu where user_id = r.user_id and spiel_id = r.spiel_id;
      end if;
    else
      update public.sva_tipp_elf set frei = true where user_id = r.user_id and spiel_id = r.spiel_id;
    end if;
  end loop;
end;
$$;

-- ── 2. Kabinen-Liga ─────────────────────────────────────────────────────────
alter table public.sva_tipp_ligen add column if not exists system text;
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'sva_tipp_ligen_system_check') then
    alter table public.sva_tipp_ligen add constraint sva_tipp_ligen_system_check check (system in ('kabine'));
  end if;
end;
$$;
create unique index if not exists sva_tipp_ligen_system_idx on public.sva_tipp_ligen (system) where system is not null;
comment on column public.sva_tipp_ligen.system is 'v21-T: feste System-Liga (''kabine'' = alle Spieler-Konten). Kein Beitritt per Code, kein Verlassen.';

insert into public.sva_tipp_ligen (name, code, system)
select 'Kabinen-Liga', public.sva_tipp_liga_code(), 'kabine'
 where not exists (select 1 from public.sva_tipp_ligen l where l.system = 'kabine');

create or replace function public.sva_tipp_kabinen_liga()
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select l.id from public.sva_tipp_ligen l where l.system = 'kabine';
$$;

create or replace function public.sva_tipp_kabine_sync()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_liga uuid := public.sva_tipp_kabinen_liga();
begin
  if v_liga is null then return new; end if;
  if new.kabine then
    insert into public.sva_tipp_liga_mitglieder (liga_id, user_id) values (v_liga, new.user_id) on conflict do nothing;
  else
    delete from public.sva_tipp_liga_mitglieder where liga_id = v_liga and user_id = new.user_id;
  end if;
  return new;
end;
$$;
drop trigger if exists sva_tipp_kabine_sync on public.sva_tipp_teilnehmer;
create trigger sva_tipp_kabine_sync
  after insert or update of kabine on public.sva_tipp_teilnehmer
  for each row execute function public.sva_tipp_kabine_sync();

-- vorhandene Kabine-Konten nachziehen (Liga + einmalig „öffentlich zeigen“,
-- wie künftig beim Markieren; im Profil wieder abschaltbar)
insert into public.sva_tipp_liga_mitglieder (liga_id, user_id)
select public.sva_tipp_kabinen_liga(), t.user_id from public.sva_tipp_teilnehmer t where t.kabine
on conflict do nothing;
do $$
begin
  if not exists (select 1 from public.sva_tipp_ligen l where l.system = 'kabine' and l.created_at < now() - interval '1 minute') then
    update public.sva_tipp_teilnehmer set sichtbar = true, updated_at = now() where kabine and not sichtbar;
  end if;
end;
$$;

-- Ranglisten-Kreis: Liga-Mitglieder; wer selbst nicht drin ist (nur Kabinen-
-- Liga ist öffentlich lesbar), sieht nur „öffentlich zeigen“-Konten.
create or replace function public.sva_tipp_scope(p_art text, p_spiel uuid, p_monat date, p_saison text, p_liga uuid, p_ich uuid)
returns table (user_id uuid, spiel_id uuid, gesamt integer, exakt boolean, anstoss timestamptz)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select p.user_id, p.spiel_id, p.gesamt, p.exakt, s.anstoss
    from public.sva_tipp_punkte p
    join public.sm_spiele s on s.id = p.spiel_id
   where case p_art
           when 'spieltag' then p.spiel_id = p_spiel
           when 'monat'    then p.monat = p_monat
           when 'saison'   then p.saison = p_saison and p.wertung = 'saison'
           when 'winter'   then p.saison = p_saison and p.wertung = 'winter'
           else false end
     and exists (
       select 1 from public.sva_tipp_teilnehmer t
        where t.user_id = p.user_id
          and case when p_liga is not null
                   then exists (select 1 from public.sva_tipp_liga_mitglieder m where m.liga_id = p_liga and m.user_id = t.user_id)
                        and (t.sichtbar or t.user_id = p_ich
                             or exists (select 1 from public.sva_tipp_liga_mitglieder m2 where m2.liga_id = p_liga and m2.user_id = p_ich))
                   else (t.sichtbar or t.user_id = p_ich) end);
$$;

create or replace function public.tipp_rangliste(p_art text default 'saison', p_bezug text default null, p_liga uuid default null)
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_spiel uuid;
  v_monat date;
  v_saison text := public.sva_tipp_saison_von(now());
  v_res jsonb;
begin
  if p_art not in ('spieltag', 'monat', 'saison', 'winter') then
    raise exception 'tipp_ungueltig:art' using errcode = '22023';
  end if;
  -- private Ligen nur für Mitglieder; die Kabinen-Liga ist öffentlich lesbar
  if p_liga is not null and p_liga is distinct from public.sva_tipp_kabinen_liga() and (v_uid is null or not exists (
       select 1 from public.sva_tipp_liga_mitglieder m where m.liga_id = p_liga and m.user_id = v_uid)) then
    raise exception 'tipp_liga_kein_mitglied' using errcode = '42501';
  end if;
  if p_art = 'spieltag' then
    if p_bezug ~ '^[0-9a-f-]{36}$' then
      v_spiel := p_bezug::uuid;
    else
      select t.spiel_id into v_spiel from public.sva_tipp_spieltage t join public.sm_spiele s on s.id = t.spiel_id
       where t.gewertet_at is not null and not s.demo order by s.anstoss desc limit 1;
    end if;
    if v_spiel is not null and not exists (select 1 from public.sva_tipp_spieltage t where t.spiel_id = v_spiel and t.gewertet_at is not null) then
      v_spiel := null;
    end if;
  elsif p_art = 'monat' then
    if p_bezug ~ '^\d{4}-\d{2}$' then
      v_monat := to_date(p_bezug || '-01', 'YYYY-MM-DD');
    else
      v_monat := public.sva_tipp_monat_von(now());
      if not exists (select 1 from public.sva_tipp_punkte p where p.monat = v_monat) then
        select p.monat into v_monat from public.sva_tipp_punkte p order by p.anstoss desc limit 1;
        v_monat := coalesce(v_monat, public.sva_tipp_monat_von(now()));
      end if;
    end if;
  else
    if p_bezug ~ '^\d{4}/\d{2}$' then v_saison := p_bezug; end if;
  end if;
  v_res := public.sva_tipp_rang(p_art, v_spiel, v_monat, v_saison, p_liga, v_uid, 50);
  if p_art = 'spieltag' and v_spiel is not null then
    v_res := v_res || jsonb_build_object('spiel', (select jsonb_build_object('gegner', s.gegner, 'heim', s.heim, 'anstoss', s.anstoss,
                         'toreSva', s.tore_sva, 'toreGegner', s.tore_gegner) from public.sm_spiele s where s.id = v_spiel));
  end if;
  return v_res;
end;
$$;

create or replace function public.tipp_liga_beitreten(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_l public.sva_tipp_ligen;
  v_abz text[];
begin
  if not exists (select 1 from public.sva_tipp_teilnehmer t where t.user_id = v_uid) then
    raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001';
  end if;
  -- System-Ligen (Kabine) nie per Code
  select * into v_l from public.sva_tipp_ligen l where l.code = upper(btrim(coalesce(p_code, ''))) and l.system is null;
  if v_l.id is null then raise exception 'tipp_liga_unbekannt' using errcode = 'P0001'; end if;
  if (select count(*) from public.sva_tipp_liga_mitglieder m where m.liga_id = v_l.id) >= 300 then
    raise exception 'tipp_liga_voll' using errcode = 'P0001';
  end if;
  insert into public.sva_tipp_liga_mitglieder (liga_id, user_id) values (v_l.id, v_uid) on conflict do nothing;
  perform public.sva_tipp_abzeichen_pruefen(m.user_id) from public.sva_tipp_liga_mitglieder m where m.liga_id = v_l.id;
  v_abz := array(select a.abzeichen from public.sva_tipp_abzeichen a where a.user_id = v_uid and a.erreicht_at > now() - interval '5 seconds');
  return jsonb_build_object('id', v_l.id, 'name', v_l.name, 'code', v_l.code, 'abzeichen', to_jsonb(v_abz));
end;
$$;

create or replace function public.tipp_liga_verlassen(p_liga uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
begin
  if exists (select 1 from public.sva_tipp_ligen l where l.id = p_liga and l.system is not null) then
    raise exception 'tipp_liga_system' using errcode = 'P0001';
  end if;
  delete from public.sva_tipp_liga_mitglieder where liga_id = p_liga and user_id = v_uid;
  delete from public.sva_tipp_ligen l where l.id = p_liga and l.system is null
     and not exists (select 1 from public.sva_tipp_liga_mitglieder m where m.liga_id = l.id);
  return jsonb_build_object('ok', true);
end;
$$;

create or replace function public.tipp_liga_vorschau(p_code text)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object('name', l.name, 'code', l.code,
                            'mitglieder', (select count(*) from public.sva_tipp_liga_mitglieder m where m.liga_id = l.id))
    from public.sva_tipp_ligen l where l.code = upper(btrim(coalesce(p_code, ''))) and l.system is null;
$$;

create or replace function public.tipp_meine_ligen()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_saison text := public.sva_tipp_saison_von(now());
begin
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id', l.id, 'name', l.name, 'code', case when l.system is null then l.code end,
             'gruender', l.gruender = v_uid,
             'system', l.system,
             'mitglieder', (select count(*) from public.sva_tipp_liga_mitglieder m2 where m2.liga_id = l.id),
             'meinPlatz', (public.sva_tipp_rang('saison', null, null, v_saison, l.id, v_uid, 1) -> 'ich' ->> 'platz')::int,
             'fuehrender', (public.sva_tipp_rang('saison', null, null, v_saison, l.id, v_uid, 1) -> 'eintraege' -> 0 ->> 'name')))
           order by (l.system is null), m.beigetreten_at)
      from public.sva_tipp_liga_mitglieder m
      join public.sva_tipp_ligen l on l.id = m.liga_id
     where m.user_id = v_uid), '[]'::jsonb);
end;
$$;

-- Kabinen-Liga als Kennzahl für alle (Name + Größe, ohne Mitglieder)
create or replace function public.tipp_kabinen_liga()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object('id', l.id, 'name', l.name, 'system', l.system,
                            'mitglieder', (select count(*) from public.sva_tipp_liga_mitglieder m where m.liga_id = l.id))
    from public.sva_tipp_ligen l where l.system = 'kabine';
$$;

-- Admin: Kabine markieren schaltet „öffentlich zeigen“ mit an
create or replace function public.tipp_admin_kabine(p_user uuid, p_kabine boolean)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_tipp_admin_pruefen();
  update public.sva_tipp_teilnehmer
     set kabine = coalesce(p_kabine, false),
         sichtbar = case when coalesce(p_kabine, false) then true else sichtbar end,
         updated_at = now()
   where user_id = p_user;
  if not found then raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001'; end if;
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 3. Admin/Team: Kader-Pflege für die Tipp-Liga ───────────────────────────
create or replace function public.tipp_admin_kader()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  perform public.sva_tipp_team_pruefen();
  return coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
             'id', r.slug, 'name', r.name, 'nummer', r.nummer, 'position', public.sva_tipp_pos(r.position),
             'fotoUrl', r.foto_url, 'cutoutUrl', r.freisteller_url,
             'zweitposition', x.zweitposition,
             'nichtVerfuegbar', coalesce(x.nicht_verfuegbar, false),
             'hinweis', x.hinweis))
           order by r.sortierung, r.nummer nulls last, r.name)
      from public.sm_roster r
      left join public.sva_tipp_spieler x on x.roster_id = r.id
     where r.aktiv and r.rolle = 'spieler'), '[]'::jsonb);
end;
$$;

create or replace function public.tipp_admin_spieler_speichern(p_spieler text, p_zweitposition text, p_nicht_verfuegbar boolean, p_hinweis text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_id uuid;
  v_pos text;
  v_zweit text := nullif(upper(btrim(coalesce(p_zweitposition, ''))), '');
  v_hinweis text := nullif(btrim(coalesce(p_hinweis, '')), '');
begin
  perform public.sva_tipp_team_pruefen();
  v_id := public.sva_tipp_roster(p_spieler);
  if v_id is null then raise exception 'tipp_spieler_unbekannt' using errcode = '22023'; end if;
  if v_zweit is not null and v_zweit not in ('TW', 'ABW', 'MIT', 'ANG') then
    raise exception 'tipp_ungueltig:position' using errcode = '22023';
  end if;
  if v_hinweis is not null and char_length(v_hinweis) > 60 then
    raise exception 'tipp_ungueltig:hinweis' using errcode = '22023';
  end if;
  select public.sva_tipp_pos(r.position) into v_pos from public.sm_roster r where r.id = v_id;
  if v_zweit = v_pos then v_zweit := null; end if;
  insert into public.sva_tipp_spieler (roster_id, zweitposition, nicht_verfuegbar, hinweis)
  values (v_id, v_zweit, coalesce(p_nicht_verfuegbar, false), case when coalesce(p_nicht_verfuegbar, false) then v_hinweis end)
  on conflict (roster_id) do update
     set zweitposition = excluded.zweitposition, nicht_verfuegbar = excluded.nicht_verfuegbar,
         hinweis = excluded.hinweis, updated_at = now();
  return jsonb_build_object('ok', true);
end;
$$;

-- ── 4. Rechte ───────────────────────────────────────────────────────────────
revoke all on function public.sva_tipp_platz_pos(integer), public.sva_tipp_passt(uuid, integer),
  public.sva_tipp_elf_ordnen(uuid[]), public.sva_tipp_kabinen_liga(), public.sva_tipp_kabine_sync()
  from public, anon, authenticated;
grant execute on function public.sva_tipp_platz_pos(integer), public.sva_tipp_passt(uuid, integer),
  public.sva_tipp_elf_ordnen(uuid[]), public.sva_tipp_kabinen_liga() to service_role;

revoke all on function public.tipp_kabinen_liga() from public;
grant execute on function public.tipp_kabinen_liga() to anon, authenticated, service_role;

revoke all on function public.tipp_admin_kader(), public.tipp_admin_spieler_speichern(text, text, boolean, text) from public, anon;
grant execute on function public.tipp_admin_kader(), public.tipp_admin_spieler_speichern(text, text, boolean, text) to authenticated, service_role;

-- neu definierte Funktionen behalten ihre Rechte (create or replace) —
-- zur Sicherheit noch einmal ausdrücklich:
revoke all on function public.tipp_elf_speichern(uuid, text[], text, boolean), public.tipp_liga_beitreten(text),
  public.tipp_liga_verlassen(uuid), public.tipp_meine_ligen(), public.tipp_admin_kabine(uuid, boolean) from public, anon;
grant execute on function public.tipp_elf_speichern(uuid, text[], text, boolean), public.tipp_liga_beitreten(text),
  public.tipp_liga_verlassen(uuid), public.tipp_meine_ligen(), public.tipp_admin_kabine(uuid, boolean) to authenticated, service_role;
revoke all on function public.tipp_rangliste(text, text, uuid), public.tipp_liga_vorschau(text) from public;
grant execute on function public.tipp_rangliste(text, text, uuid), public.tipp_liga_vorschau(text) to anon, authenticated, service_role;
revoke all on function public.sva_tipp_scope(text, uuid, date, text, uuid, uuid), public.sva_tipp_kader_json() from public, anon, authenticated;
grant execute on function public.sva_tipp_scope(text, uuid, date, text, uuid, uuid), public.sva_tipp_kader_json() to service_role;
