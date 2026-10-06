-- ═══════════════════════════════════════════════════════════════════════════
-- v22-T „Tipp-Liga: ein Fokus, Preise, Startelf-Vorschlag“ (06.10.2026)
-- — nach 20261013200000.
--
--   1. EIN Fokus pro Zeitpunkt (Feedback Marvin): Solange ein früheres
--      Tipp-Spiel angepfiffen, aber noch nicht gewertet ist, bleibt das
--      nächste Spiel zu. Es öffnet erst mit der Wertung — spätestens 24 h
--      nach dem Abpfiff (Abpfiff aus dem Ticker, sonst Anstoß + 2 h).
--      Serverseitig: Trigger sva_tipp_abgabe_waechter (Tipp UND Elf) wirft
--      'tipp_noch_nicht_offen'; tipp_lage() liefert das gesperrte nächste
--      Spiel nur noch als Vorschau „naechstes“ (mit oeffnetAb), nicht als
--      „offen“. Vorher (vor dem 1. Anpfiff) war ohnehin nur das früheste
--      offene Spiel sichtbar (unverändert; Vorab-Tipps für spätere Spiele
--      bleiben serverseitig möglich, die Seite bietet sie nicht an).
--   2. Preise (Admin pflegt): Saison Platz 1–5, Monatssieger (Platz 1–3),
--      optional „präsentiert von“ (Partner), Altersgrenze (16/18) mit
--      automatischer U18-Alternative. Leer = Bereich auf /tippen unsichtbar.
--      Kabine bleibt von Preisen ausgeschlossen (Teilnahmebedingungen).
--   3. Startelf-Vorschlag: tipp_lage() liefert „vorschlagElf“ aus der
--      aktuellen Aufstellung (sva_lineup, neueste Zeile) in der Formation
--      1 TW · 1 ABW · 2 MIT · 1 ANG — nur verfügbare Spieler, ohne Kapitän
--      (den wählt der Fan bewusst). Nie automatisch abgegeben.
--
-- Idempotent (mehrfach ausführbar). Getestet: supabase/tests/tippliga_v22.test.mjs
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Ein Fokus: wann darf das nächste Spiel getippt werden? ───────────────
-- Abpfiff-Zeitpunkt: Ticker-Ereignis „abpfiff“, sonst Anstoß + 2 h (Schätzung,
-- auch wenn der Ticker vergessen wurde).
create or replace function public.sva_tipp_abpfiff_zeit(p_spiel uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(
           (select max(t.zeitpunkt) from public.sva_ticker t where t.spiel_id = p_spiel and t.typ = 'abpfiff'),
           s.anstoss + interval '2 hours')
    from public.sm_spiele s where s.id = p_spiel;
$$;
comment on function public.sva_tipp_abpfiff_zeit(uuid) is 'v22-T: Abpfiff eines Spiels (Ticker), ersatzweise Anstoß + 2 h.';

-- Das frühere Tipp-Spiel, das p_spiel noch sperrt (null = frei): angepfiffen
-- bzw. Anstoß vorbei, noch NICHT gewertet und Abpfiff + 24 h noch nicht erreicht.
create or replace function public.sva_tipp_blocker(p_spiel uuid)
returns uuid
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select y.id
    from public.sm_spiele x
    join public.sm_spiele y on y.id <> x.id and y.anstoss < x.anstoss and not y.demo
    left join public.sva_tipp_spieltage t on t.spiel_id = y.id
   where x.id = p_spiel
     and public.sva_tipp_wertung(y.id) is not null
     and t.gewertet_at is null
     and not public.sva_tipp_offen(y.id)
     and now() < public.sva_tipp_abpfiff_zeit(y.id) + interval '24 hours'
   order by y.anstoss desc
   limit 1;
$$;
comment on function public.sva_tipp_blocker(uuid) is 'v22-T: früheres Tipp-Spiel, das noch läuft bzw. auf die Wertung wartet (≤ 24 h nach Abpfiff) — sperrt das nächste.';

-- Ab wann öffnet p_spiel spätestens? (null = schon offen bzw. kein Blocker)
create or replace function public.sva_tipp_oeffnet_ab(p_spiel uuid)
returns timestamptz
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.sva_tipp_abpfiff_zeit(b) + interval '24 hours'
    from (select public.sva_tipp_blocker(p_spiel) as b) z
   where z.b is not null;
$$;

-- Darf jetzt getippt werden? Offen (vor Anpfiff) UND nicht gesperrt.
create or replace function public.sva_tipp_freigegeben(p_spiel uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select public.sva_tipp_offen(p_spiel) and public.sva_tipp_blocker(p_spiel) is null;
$$;
comment on function public.sva_tipp_freigegeben(uuid) is 'v22-T: true, wenn für das Spiel JETZT getippt werden darf (vor Anpfiff und kein früheres Spiel wartet auf die Wertung).';

-- Wächter (Tipp + Elf): wie v20, zusätzlich „ein Fokus“
create or replace function public.sva_tipp_abgabe_waechter()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_s public.sm_spiele;
begin
  -- Fremdschlüssel-Aktionen (Spieler gelöscht → set null) laufen verschachtelt
  -- und dürfen nach Anpfiff weiter durch.
  if tg_op = 'UPDATE' and pg_trigger_depth() > 1 then
    return new;
  end if;
  select * into v_s from public.sm_spiele where id = new.spiel_id;
  if v_s.id is null then
    raise exception 'tipp_spiel_unbekannt' using errcode = 'P0001';
  end if;
  if public.sva_tipp_wertung(new.spiel_id) is null then
    raise exception 'tipp_nicht_tippbar' using errcode = 'P0001';
  end if;
  if not public.sva_tipp_offen(new.spiel_id) then
    raise exception 'tipp_geschlossen' using errcode = 'P0001';
  end if;
  -- v22-T: ein Fokus — das nächste Spiel öffnet erst nach der Wertung des
  -- laufenden/letzten (spätestens 24 h nach dessen Abpfiff)
  if public.sva_tipp_blocker(new.spiel_id) is not null then
    raise exception 'tipp_noch_nicht_offen' using errcode = 'P0001';
  end if;
  if tg_table_name = 'sva_tipp_tipps' then
    new.joker_monat := public.sva_tipp_monat_von(v_s.anstoss);
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ── 2. Preise ───────────────────────────────────────────────────────────────
create table if not exists public.sva_tipp_preise (
  id uuid primary key default gen_random_uuid(),
  -- 'saison' = Saisonwertung Platz 1–5 · 'monat' = Monatswertung Platz 1–3
  wertung text not null check (wertung in ('saison', 'monat')),
  platz smallint not null check (platz between 1 and 5),
  titel text not null check (char_length(btrim(titel)) between 2 and 60),
  beschreibung text check (beschreibung is null or char_length(beschreibung) <= 200),
  partner_id uuid references public.sm_sponsoren(id) on delete set null,
  -- Altersgrenze (z. B. 18 bei alkoholischen Preisen) → U18 bekommt die Alternative
  ab_alter smallint check (ab_alter is null or ab_alter in (16, 18)),
  alternative text check (alternative is null or char_length(alternative) between 2 and 80),
  aktiv boolean not null default true,
  updated_at timestamptz not null default now(),
  updated_by text default (auth.jwt() ->> 'email'),
  constraint sva_tipp_preise_monat_platz check (wertung = 'saison' or platz <= 3)
);
comment on table public.sva_tipp_preise is 'v22-T: Preise der Tipp-Liga (Saison Platz 1–5, Monat Platz 1–3), optional von Partnern; Altersgrenze mit U18-Alternative. Pflege nur Admin; öffentlich über tipp_lage(). Kabine ausgeschlossen.';
create unique index if not exists sva_tipp_preise_platz_idx on public.sva_tipp_preise (wertung, platz) where aktiv;
alter table public.sva_tipp_preise enable row level security;
revoke all on table public.sva_tipp_preise from anon;
revoke all on table public.sva_tipp_preise from authenticated;
grant select, insert, update, delete on table public.sva_tipp_preise to authenticated;
drop policy if exists sva_tipp_preise_select on public.sva_tipp_preise;
create policy sva_tipp_preise_select on public.sva_tipp_preise for select to authenticated using (public.is_sm_admin());
drop policy if exists sva_tipp_preise_insert on public.sva_tipp_preise;
create policy sva_tipp_preise_insert on public.sva_tipp_preise for insert to authenticated with check (public.is_sm_admin());
drop policy if exists sva_tipp_preise_update on public.sva_tipp_preise;
create policy sva_tipp_preise_update on public.sva_tipp_preise for update to authenticated using (public.is_sm_admin()) with check (public.is_sm_admin());
drop policy if exists sva_tipp_preise_delete on public.sva_tipp_preise;
create policy sva_tipp_preise_delete on public.sva_tipp_preise for delete to authenticated using (public.is_sm_admin());

-- Altersgrenze ohne Alternative → nüchterne Standard-Alternative
create or replace function public.sva_tipp_preise_vorher()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  new.titel := btrim(new.titel);
  new.beschreibung := nullif(btrim(coalesce(new.beschreibung, '')), '');
  new.alternative := nullif(btrim(coalesce(new.alternative, '')), '');
  if new.ab_alter is not null and new.alternative is null then
    new.alternative := 'Softdrink-Variante';
  end if;
  if new.ab_alter is null then
    new.alternative := null;
  end if;
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists sva_tipp_preise_vorher on public.sva_tipp_preise;
create trigger sva_tipp_preise_vorher before insert or update on public.sva_tipp_preise
  for each row execute function public.sva_tipp_preise_vorher();

create or replace function public.sva_tipp_preise_json()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'wertung', p.wertung, 'platz', p.platz, 'titel', p.titel, 'beschreibung', p.beschreibung,
           'abAlter', p.ab_alter, 'alternative', p.alternative,
           'partner', case when sp.id is not null then jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url)) end))
         order by case p.wertung when 'saison' then 0 else 1 end, p.platz), '[]'::jsonb)
    from public.sva_tipp_preise p
    left join public.sm_sponsoren sp on sp.id = p.partner_id and sp.aktiv
   where p.aktiv;
$$;

-- ── 3. Startelf-Vorschlag aus der aktuellen Aufstellung ─────────────────────
create or replace function public.sva_tipp_vorschlag_elf()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_l public.sva_lineup;
  v_plaetze text[] := array['TW', 'ABW', 'MIT', 'MIT', 'ANG'];
  v_elf text[] := array[null, null, null, null, null]::text[];
  v_gesetzt int := 0;
  r record;
  i int;
begin
  select * into v_l from public.sva_lineup order by created_at desc limit 1;
  if v_l.id is null then return null; end if;
  for r in
    select x.slug, public.sva_tipp_pos(x.position) as pos
      from unnest(v_l.startelf) with ordinality as u(id, n)
      join public.sm_roster x on x.id = u.id and x.aktiv and x.rolle = 'spieler'
      left join public.sva_tipp_spieler z on z.roster_id = x.id
     where not coalesce(z.nicht_verfuegbar, false)
     order by u.n
  loop
    for i in 1 .. 5 loop
      if v_elf[i] is null and v_plaetze[i] = r.pos then
        v_elf[i] := r.slug;
        v_gesetzt := v_gesetzt + 1;
        exit;
      end if;
    end loop;
  end loop;
  if v_gesetzt = 0 then return null; end if;
  return jsonb_build_object(
    'spieler', to_jsonb(v_elf),
    'kapitaen', '',
    'frei', false,
    'quelle', coalesce('Startelf ' || nullif(btrim(coalesce(v_l.match_label, '')), ''), 'Aktuelle Startelf'));
end;
$$;

-- ── 4. Lage: offen nur, wenn freigegeben; sonst Vorschau „naechstes“ ────────
create or replace function public.tipp_lage()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_e public.sva_tipp_einstellungen;
  v_kandidat uuid;
  v_offen uuid;
  v_naechstes jsonb;
  v_gesperrt uuid;
  v_gewertet uuid;
  v_fan public.sva_album_fans;
  v_t public.sva_tipp_teilnehmer;
  v_ich jsonb;
  v_partner jsonb;
  v_letzte jsonb;
  v_monat date;
  v_saison text := public.sva_tipp_saison_von(now());
begin
  select * into v_e from public.sva_tipp_einstellungen where id = 1;

  select s.id into v_kandidat from public.sm_spiele s
   where not s.demo and public.sva_tipp_wertung(s.id) is not null and public.sva_tipp_offen(s.id)
   order by s.anstoss asc limit 1;
  if v_kandidat is not null and public.sva_tipp_blocker(v_kandidat) is null then
    v_offen := v_kandidat;
  elsif v_kandidat is not null then
    select jsonb_strip_nulls(jsonb_build_object(
             'id', s.id, 'gegner', s.gegner, 'heim', s.heim, 'anstoss', s.anstoss,
             'wettbewerb', nullif(btrim(coalesce(s.wettbewerb, '')), ''), 'spieltag', s.spieltag_nr,
             'oeffnetAb', public.sva_tipp_oeffnet_ab(s.id)))
      into v_naechstes from public.sm_spiele s where s.id = v_kandidat;
  end if;
  select s.id into v_gesperrt from public.sm_spiele s
    left join public.sva_tipp_spieltage t on t.spiel_id = s.id
   where not s.demo and public.sva_tipp_wertung(s.id) is not null and not public.sva_tipp_offen(s.id)
     and t.gewertet_at is null and s.anstoss > now() - interval '7 days'
   order by s.anstoss desc limit 1;
  select s.id into v_gewertet from public.sm_spiele s
    join public.sva_tipp_spieltage t on t.spiel_id = s.id
   where not s.demo and t.gewertet_at is not null
   order by s.anstoss desc limit 1;

  if v_e.partner_id is not null then
    select jsonb_strip_nulls(jsonb_build_object('name', sp.name, 'logoUrl', sp.logo_url, 'url', sp.website_url))
      into v_partner from public.sm_sponsoren sp where sp.id = v_e.partner_id and sp.aktiv;
  end if;

  if v_uid is not null then
    select * into v_fan from public.sva_album_fans where user_id = v_uid;
    select * into v_t from public.sva_tipp_teilnehmer where user_id = v_uid;
    if v_offen is not null then
      v_monat := public.sva_tipp_monat_von((select s.anstoss from public.sm_spiele s where s.id = v_offen));
    end if;
    -- letzte eigene Elf (Vorbelegung → Tipp in 20 Sekunden)
    select jsonb_build_object(
             'spieler', (select jsonb_agg(public.sva_tipp_slug(x) order by i) from unnest(e.spieler) with ordinality as z(x, i)),
             'kapitaen', public.sva_tipp_slug(e.kapitaen), 'frei', e.frei)
      into v_letzte
      from public.sva_tipp_elf e join public.sm_spiele s on s.id = e.spiel_id
     where e.user_id = v_uid order by s.anstoss desc limit 1;

    v_ich := jsonb_strip_nulls(jsonb_build_object(
      'email', auth.jwt() ->> 'email',
      'profil', case when v_fan.user_id is not null then jsonb_build_object(
                  'vorname', v_fan.vorname, 'initial', v_fan.initial,
                  'anzeigename', v_fan.vorname || ' ' || v_fan.initial || '.') end,
      'teilnehmer', case when v_t.user_id is not null then jsonb_build_object(
                  'sichtbar', v_t.sichtbar, 'kabine', v_t.kabine, 'seit', v_t.created_at) end,
      'jokerFrei', case when v_monat is not null then not exists (
                  select 1 from public.sva_tipp_tipps x where x.user_id = v_uid and x.joker
                     and x.joker_monat = v_monat and x.spiel_id <> v_offen) end,
      'abzeichen', coalesce((select jsonb_agg(jsonb_build_object('key', a.abzeichen, 'at', a.erreicht_at) order by a.erreicht_at)
                     from public.sva_tipp_abzeichen a where a.user_id = v_uid), '[]'::jsonb),
      'statistik', (select jsonb_build_object(
                     'punkte', coalesce(sum(p.gesamt), 0), 'spieltage', count(*),
                     'exakt', count(*) filter (where p.exakt), 'beste', coalesce(max(p.gesamt), 0))
                     from public.sva_tipp_punkte p where p.user_id = v_uid and p.saison = v_saison and p.wertung = 'saison'),
      'tippsGesamt', (select count(*) from public.sva_tipp_tipps x where x.user_id = v_uid),
      'letzteElf', v_letzte,
      'ligen', (select count(*) from public.sva_tipp_liga_mitglieder m where m.user_id = v_uid)
    ));
  end if;

  return jsonb_strip_nulls(jsonb_build_object(
    'version', 2,
    'serverNow', now(),
    'saison', v_saison,
    'einstellungen', jsonb_strip_nulls(jsonb_build_object(
        'aktiv', coalesce(v_e.aktiv, true),
        'partner', v_partner,
        'preise', nullif(btrim(coalesce(v_e.preise, '')), ''),
        'elfFrei', coalesce(v_e.elf_frei, true),
        'winterpause', public.sva_tipp_winterpause(now()))),
    'offen', public.sva_tipp_spiel_json(v_offen, v_uid),
    'naechstes', v_naechstes,
    'gesperrt', public.sva_tipp_spiel_json(v_gesperrt, v_uid),
    'gewertet', public.sva_tipp_spiel_json(v_gewertet, v_uid),
    'kader', public.sva_tipp_kader_json(),
    'ich', v_ich,
    'preise', nullif(public.sva_tipp_preise_json(), '[]'::jsonb),
    'vorschlagElf', public.sva_tipp_vorschlag_elf()
  ));
end;
$$;
comment on function public.tipp_lage() is 'v22-T: Tipp-Liga-Lage für /tippen (anon + eingeloggt): offen = JETZT tippbar (ein Fokus), naechstes = Vorschau des gesperrten nächsten Spiels, gesperrt/gewertet, Kader, eigene Abgaben, Preise, Startelf-Vorschlag.';

-- ── 5. Rechte ───────────────────────────────────────────────────────────────
-- interne Helfer: niemand außer service_role (Aufrufe aus SECURITY-DEFINER-RPCs/Triggern)
revoke all on function public.sva_tipp_abpfiff_zeit(uuid), public.sva_tipp_blocker(uuid), public.sva_tipp_oeffnet_ab(uuid),
  public.sva_tipp_freigegeben(uuid), public.sva_tipp_preise_json(), public.sva_tipp_vorschlag_elf(),
  public.sva_tipp_preise_vorher(), public.sva_tipp_abgabe_waechter()
  from public, anon, authenticated;
grant execute on function public.sva_tipp_abpfiff_zeit(uuid), public.sva_tipp_blocker(uuid), public.sva_tipp_oeffnet_ab(uuid),
  public.sva_tipp_freigegeben(uuid), public.sva_tipp_preise_json(), public.sva_tipp_vorschlag_elf()
  to service_role;
revoke all on function public.tipp_lage() from public;
grant execute on function public.tipp_lage() to anon, authenticated, service_role;
