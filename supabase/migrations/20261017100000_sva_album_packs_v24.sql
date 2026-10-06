-- ─────────────────────────────────────────────────────────────────────────────
-- v24-P „Pack-Typen“: Packs mit mehr als einer Karte, große und kleine,
-- hochwertige und einfache. Konzept + Ökonomie: docs/KARTEN.md („v24: Pack-Typen“),
-- Simulation: node scripts/karten-simulation.mjs (muss hierzu passen).
--
--   Typ        Quelle                               Karten  Garantie        Wochen-Slot  Optik / Reveal
--   tipp       Tipp-Liga (erster Tipp je Spieltag)  2       –                8 %         klein · 1 (ruhig)
--   spieltag   Check-in am Platz                    4       mind. 1 Silber  30 %         groß  · 2
--   sieg       Heimsieg (getippt ODER eingecheckt)  2       mind. 1 Gold    30 %         gold  · 3 (groß)
--   starter    Anmeldung                            5       mind. 1 Silber   0 %         starter · 2
--   ziel       Ziele/Meilensteine/Kapitel           je Ziel (Kapitel: 1)     0 %         ziel  · 2
--   event      Event-Codes (Derby-/MOTM-Woche …),   3       –               60 %         event · 3
--              Check-in beim Derby (Größe/Garantie wie Spieltag)
--
-- Alle Werte stehen in sva_album_pack_typen und sind im Admin (Album →
-- Einstellungen → Pack-Typen) einstellbar; Karten = 0 schaltet den Typ ab.
-- Smart-Pack bleibt: die erste Karte jedes Zufalls-Packs ist eine fehlende
-- Album-Karte (wenn möglich). Mindest-Seltenheit ersetzt wie bisher die letzte
-- Karte. Limitierte Wochenkarten sind aus der normalen Ziehung genommen.
-- WOCHEN-SLOT: jedes Pack würfelt beim Erzeugen EINMAL (nicht je Karte)
-- mit limitiert_chance % seines Typs; bei Treffer ersetzt eine gerade ziehbare
-- limitierte Wochenkarte (Spieler des Spiels im Ziehfenster Mo–So, Derby-Karte
-- des Spiels) die letzte Karte — nur eine, die der Fan noch nicht hat. Event-
-- Codes können ihre Event-Karte vorgeben (karte_id). Garantie bleibt erhalten.
--
-- Ökonomie (mehr Karten je Pack → kalibriert per Simulation, docs/KARTEN.md):
--   Smart-Pack nur noch in Packs ab smart_ab_karten = 2 Karten (Story-/Advent-/
--   Freund-Einzelkarte = reine Zufallskarte), doppelte_bremse 25 → 5 %,
--   wunsch_kosten 3 → 5. Wochen-Slot 8/30/30/60 % (Ziel: ~50 % der wöchentlich
--   aktiven Fans bekommen die MOTM-Karte, reine Tipper ~15 %). Bestehende Zeile
--   wird nur angepasst, wenn sie noch auf den alten Standardwerten steht.
--
-- Was diese Migration tut (ADDITIV, idempotent; Besitz/Packs der Fans bleiben
-- unverändert — alte ungeöffnete Packs bekommen ihren Typ nur in der Anzeige):
--   1. Tabelle sva_album_pack_typen (+ RLS Admin), Spalte sva_album_packs.typ,
--      Pack-Art 'event', Code-Art 'event'.
--   2. Ziehung sva_album_pack_ziehen_v24 (Typ, Event-Karte); v20 und die alte
--      Signatur rufen sie mit dem Typ der Art auf.
--   3. Tipp-Pack (album_karte_gutschreiben), Kapitel-Bonus, Event-Codes
--      (album_admin_story_code, sva_album_code_einloesen_v21).
--   4. album_katalog() + regeln.packTypen, album_mein().packs[].typ,
--      album_pack_oeffnen() + typ — als Hüllen um die v22-Fassungen.
--   5. Tipp-Liga: tipp_abgeben() liefert packId + pack {id, typ, titel, karten},
--      tipp_lage() liefert tippPack {titel, karten}.
-- Nach 20261016100000_sva_fupa_kader.sql anwenden. Test: supabase/tests/packs_v24.test.mjs.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Pack-Typen ───────────────────────────────────────────────────────────
create table if not exists public.sva_album_pack_typen (
  typ text primary key check (typ in ('tipp', 'spieltag', 'sieg', 'starter', 'ziel', 'event')),
  titel text not null check (char_length(btrim(titel)) between 2 and 40),
  -- Karten je Pack (0 = Typ aus, es gibt dann kein Pack); beim Ziel-Pack nur
  -- der Kapitel-Bonus — Ziele haben ihre eigene Kartenzahl
  karten integer not null check (karten between 0 and 10),
  min_seltenheit text check (min_seltenheit is null or min_seltenheit in ('silber', 'gold', 'spezial')),
  -- Tütchen-Optik im Album (Frontend) und Reveal-Intensität 1 ruhig · 2 normal · 3 groß
  optik text not null check (optik in ('klein', 'gross', 'gold', 'starter', 'ziel', 'event')),
  reveal integer not null default 2 check (reveal between 1 and 3),
  -- Wochen-Slot: Chance (%) je Pack auf die limitierte Wochenkarte (MOTM/Derby), 0 = aus
  limitiert_chance integer not null default 0 check (limitiert_chance between 0 and 100),
  -- Smart-Pack (erste Karte = fehlende Album-Karte) für diesen Typ
  smart boolean not null default true,
  beschreibung text check (beschreibung is null or char_length(beschreibung) <= 160),
  sortierung integer not null default 0,
  updated_at timestamptz not null default now()
);
comment on table public.sva_album_pack_typen is 'v24-P: Pack-Typen (Tipp, Spieltag, Sieg, Starter, Ziel, Event) — Karten, Garantie, Optik, Reveal, Event-Chance. Fester Satz; Admin ändert Werte.';
alter table public.sva_album_pack_typen enable row level security;
do $$
begin
  drop policy if exists sva_album_pack_typen_select on public.sva_album_pack_typen;
  create policy sva_album_pack_typen_select on public.sva_album_pack_typen for select to authenticated using (public.is_sm_admin());
  drop policy if exists sva_album_pack_typen_update on public.sva_album_pack_typen;
  create policy sva_album_pack_typen_update on public.sva_album_pack_typen for update to authenticated using (public.is_sm_admin()) with check (public.is_sm_admin());
end $$;
revoke all on public.sva_album_pack_typen from anon, public;
revoke insert, delete, truncate on public.sva_album_pack_typen from authenticated;
grant select, update on public.sva_album_pack_typen to authenticated;
grant select, insert, update, delete on public.sva_album_pack_typen to service_role;

-- Packs: Typ (Anzeige + Ziehung), neue Art 'event'
alter table public.sva_album_packs add column if not exists typ text
  check (typ is null or typ in ('tipp', 'spieltag', 'sieg', 'starter', 'ziel', 'event'));
alter table public.sva_album_packs drop constraint if exists sva_album_packs_art_check;
alter table public.sva_album_packs add constraint sva_album_packs_art_check check (art in (
  'checkin', 'heimsieg', 'geschenk', 'starter', 'tipp', 'story', 'partner', 'advent',
  'freund', 'kapitel', 'wunsch', 'ziel', 'geheim', 'event'));
-- Codes: neue Art 'event' (Event-Pack, Karte = Event-Karte mit Chance statt fest)
alter table public.sva_album_codes drop constraint if exists sva_album_codes_art_check;
alter table public.sva_album_codes add constraint sva_album_codes_art_check check (art in ('story', 'partner', 'advent', 'event'));

-- Ökonomie v24 (Simulation): mehr Karten je Pack → weniger Bremse, Wunschkarte teurer.
alter table public.sva_album_einstellungen alter column doppelte_bremse set default 5;
alter table public.sva_album_einstellungen alter column wunsch_kosten set default 5;
alter table public.sva_album_einstellungen
  add column if not exists smart_ab_karten integer not null default 2 check (smart_ab_karten between 1 and 10);

-- Startwerte — NUR beim ersten Lauf (danach gelten die Admin-Werte). Starter
-- übernimmt die bisherige Einstellung (karten_starter, starter_min_silber), der
-- Kapitel-Bonus (Ziel-Pack) karten_kapitel. Bremse/Wunsch-Kosten werden nur
-- angepasst, wenn die Zeile noch auf den alten Standards (25 % / 3) steht.
do $$
declare
  v_erst boolean := not exists (select 1 from public.sva_album_pack_typen);
  v_e public.sva_album_einstellungen;
begin
  insert into public.sva_album_pack_typen (typ, titel, karten, min_seltenheit, optik, reveal, limitiert_chance, beschreibung, sortierung)
  select v.typ, v.titel, v.karten, v.min_s, v.optik, v.reveal, v.chance, v.beschreibung, v.sortierung
    from (values
      ('tipp',     'Tipp-Pack',      2, null::text, 'klein',   1, 8,  'Für den ersten Tipp eines Spieltags in der Tipp-Liga.', 10),
      ('spieltag', 'Spieltags-Pack', 4, 'silber',   'gross',   2, 30,  'Check-in am Platz (QR-Code am Eingang).', 20),
      ('sieg',     'Sieg-Pack',      2, 'gold',     'gold',    3, 30,  'Heimsieg: für alle, die eingecheckt oder getippt haben.', 30),
      ('starter',  'Starter-Pack',   5, 'silber',   'starter', 2, 0,  'Einmal zur Anmeldung.', 40),
      ('ziel',     'Ziel-Pack',      1, null,       'ziel',    2, 0,  'Sammelziel, Meilenstein oder Kapitel komplett (Kartenzahl je Ziel).', 50),
      ('event',    'Event-Pack',     3, null,       'event',   3, 60, 'Derby, MOTM-Woche, Aktionen: mit Chance auf die limitierte Karte.', 60)
    ) as v(typ, titel, karten, min_s, optik, reveal, chance, beschreibung, sortierung)
  on conflict (typ) do nothing;
  if not v_erst then
    return;
  end if;
  select * into v_e from public.sva_album_einstellungen where id = 1;
  if v_e.id is null then
    return;
  end if;
  update public.sva_album_pack_typen
     set karten = coalesce(v_e.karten_starter, 5),
         min_seltenheit = case when coalesce(v_e.starter_min_silber, true) then 'silber' end
   where typ = 'starter';
  update public.sva_album_pack_typen set karten = coalesce(v_e.karten_kapitel, 1) where typ = 'ziel';
  update public.sva_album_einstellungen
     set doppelte_bremse = case when doppelte_bremse = 25 then 5 else doppelte_bremse end,
         wunsch_kosten = case when wunsch_kosten = 3 then 5 else wunsch_kosten end,
         updated_at = now()
   where id = 1 and (doppelte_bremse = 25 or wunsch_kosten = 3);
end $$;

-- ── 2. Hilfen ───────────────────────────────────────────────────────────────
-- Pack-Typ einer Pack-Art (Altbestand ohne typ-Spalte: nur Anzeige)
create or replace function public.sva_album_typ_von_art(p_art text)
returns text
language sql
immutable
set search_path to 'public', 'pg_temp'
as $$
  select case p_art when 'tipp' then 'tipp' when 'checkin' then 'spieltag' when 'heimsieg' then 'sieg'
                    when 'starter' then 'starter' when 'ziel' then 'ziel' when 'kapitel' then 'ziel'
                    when 'event' then 'event' end;
$$;

create or replace function public.sva_album_pack_typen_json()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'typ', t.typ, 'titel', t.titel, 'karten', t.karten, 'minSeltenheit', t.min_seltenheit,
           'optik', t.optik, 'reveal', t.reveal,
           'limitiertChance', case when t.limitiert_chance > 0 then t.limitiert_chance end,
           'smart', t.smart,
           'beschreibung', t.beschreibung)) order by t.sortierung, t.typ), '[]'::jsonb)
    from public.sva_album_pack_typen t;
$$;

-- ── 3. Ziehung v24 ──────────────────────────────────────────────────────────
-- Wie sva_album_pack_ziehen_v20 (Smart-Pack, Bremse, Mindest-Seltenheit, feste
-- Karte, Idempotenz) — dazu:
--   p_typ:         Pack-Typ → Kartenzahl/Garantie, wenn nicht übergeben; wird gespeichert
--   p_event_karte: Event-Karte (Code) — statt der Zufallsauswahl unter den ziehbaren
--                  limitierten Karten (nur bei Typ mit limitiert_chance > 0)
create or replace function public.sva_album_pack_ziehen_v24(
  p_fan uuid,
  p_art text,
  p_typ text default null,
  p_spiel uuid default null,
  p_anzahl integer default null,
  p_quelle text default null,
  p_titel text default null,
  p_min_seltenheit text default null,
  p_fest uuid default null,
  p_belohnung boolean default false,
  p_event_karte uuid default null)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_set    public.sva_album_einstellungen;
  v_t      public.sva_album_pack_typen;
  v_saison text := public.sva_album_saison();
  v_n      integer;
  v_min    text;
  v_ids    uuid[];
  v_selt   text[];
  v_album  boolean[];
  v_lim    boolean[];
  v_limk   uuid[];
  v_platz  uuid[];
  v_hat_k  uuid[];
  v_hat_p  uuid[];
  v_karten uuid[] := '{}';
  v_seltn  text[] := '{}';
  v_pp     uuid[] := '{}';
  v_smart  boolean;
  v_fest   public.sva_album_karten;
  v_ev     public.sva_album_karten;
  v_k      uuid;
  v_s      text;
  v_i      integer;
  v_j      integer;
  v_id     uuid;
  v_erlaubt text[];
  v_ok     boolean;
begin
  select * into v_set from public.sva_album_einstellungen where id = 1;
  if p_typ is not null then
    select * into v_t from public.sva_album_pack_typen t where t.typ = p_typ;
  end if;
  v_n := greatest(0, least(10, coalesce(p_anzahl, v_t.karten, v_set.karten_pro_pack, 3)));
  v_min := coalesce(p_min_seltenheit, v_t.min_seltenheit);
  if v_n = 0 then
    return null;
  end if;
  if p_quelle is not null and exists (select 1 from public.sva_album_packs p
                                       where p.fan_user_id = p_fan and p.art = p_art and p.quelle = p_quelle) then
    return null;
  end if;
  if p_spiel is not null and exists (select 1 from public.sva_album_packs p
                                      where p.fan_user_id = p_fan and p.art = p_art and p.spiel_id = p_spiel) then
    return null;
  end if;

  select coalesce(array_agg(k.id), '{}'), coalesce(array_agg(k.seltenheit), '{}'),
         coalesce(array_agg(not k.variante and not k.limitiert), '{}'),
         coalesce(array_agg(k.limitiert), '{}'),
         coalesce(array_agg(public.sva_album_platz(k.typ, k.roster_id, k.id)), '{}')
    into v_ids, v_selt, v_album, v_lim, v_platz
    from public.sva_album_karten k
   where k.aktiv and (k.saison is null or k.saison = v_saison)
     and (k.ziehbar_von is null or k.ziehbar_von <= now())
     and (k.ziehbar_bis is null or k.ziehbar_bis > now())
     and (k.nur_spiel_id is null or k.nur_spiel_id = p_spiel)
     and (not k.limitiert or k.ziehbar_von is not null or k.ziehbar_bis is not null or k.nur_spiel_id is not null)
     and not coalesce(k.geheim, false);
  -- v24: limitierte Wochenkarten (MOTM, Derby) kommen NUR über den Wochen-Slot
  -- (je Fan höchstens einmal) — nicht mehr über die normale Spezial-Ziehung
  v_limk := array(select t.id from unnest(v_ids, v_lim) as t(id, l) where t.l);
  select coalesce(array_agg(t.id), '{}'), coalesce(array_agg(t.s), '{}'), coalesce(array_agg(t.a), '{}'), coalesce(array_agg(t.p), '{}')
    into v_ids, v_selt, v_album, v_platz
    from unnest(v_ids, v_selt, v_album, v_platz, v_lim) as t(id, s, a, p, l)
   where not t.l;

  if p_fest is not null then
    select * into v_fest from public.sva_album_karten k where k.id = p_fest;
  end if;
  if cardinality(v_ids) = 0 and v_fest.id is null and cardinality(v_limk) = 0 then
    return null;
  end if;

  select coalesce(array_agg(distinct x.k), '{}') into v_hat_k
    from (select b.karte_id as k from public.sva_album_besitz b where b.fan_user_id = p_fan
          union
          select unnest(p.karten) from public.sva_album_packs p where p.fan_user_id = p_fan and p.geoeffnet_at is null) x;
  select coalesce(array_agg(distinct public.sva_album_platz(k.typ, k.roster_id, k.id)), '{}') into v_hat_p
    from public.sva_album_karten k
   where k.id = any (v_hat_k) and not k.variante and not k.limitiert;

  v_smart := coalesce(v_set.smart_pack, true) and v_fest.id is null
             and (not coalesce(p_belohnung, false) or coalesce(v_set.smart_pack_belohnung, false))
             and coalesce(v_t.smart, true) and v_n >= coalesce(v_set.smart_ab_karten, 1);

  for v_i in 1 .. v_n loop
    if v_i = 1 and v_fest.id is not null then
      v_k := v_fest.id;
      v_s := v_fest.seltenheit;
      if not v_fest.variante and not v_fest.limitiert then
        v_pp := v_pp || public.sva_album_platz(v_fest.typ, v_fest.roster_id, v_fest.id);
      end if;
    else
      v_k := public.sva_album_karte_waehlen(v_set, v_ids, v_selt, v_album, v_platz,
               array['bronze', 'silber', 'gold', 'spezial'], v_smart and v_i = 1,
               v_hat_k, v_hat_p, v_karten, v_pp);
      exit when v_k is null;
      select t.s into v_s from unnest(v_ids, v_selt) as t(id, s) where t.id = v_k limit 1;
      v_pp := v_pp || array(select t.p from unnest(v_ids, v_album, v_platz) as t(id, a, p) where t.id = v_k and t.a limit 1);
    end if;
    v_karten := v_karten || v_k;
    v_seltn := v_seltn || v_s;
  end loop;

  -- Mindest-Seltenheit: letzte Karte ersetzen (die feste Karte bleibt immer)
  if v_min in ('silber', 'gold', 'spezial') and cardinality(v_karten) > 0
     and not exists (select 1 from unnest(v_seltn) s where public.sva_album_rang(s) >= public.sva_album_rang(v_min))
     and not (cardinality(v_karten) = 1 and v_fest.id is not null) then
    v_erlaubt := array(select s from unnest(array['silber', 'gold', 'spezial']) s
                        where public.sva_album_rang(s) >= public.sva_album_rang(v_min));
    v_karten := v_karten[1:cardinality(v_karten) - 1];
    v_seltn := v_seltn[1:cardinality(v_seltn) - 1];
    v_pp := array(select t.p from unnest(v_ids, v_album, v_platz) as t(id, a, p) where t.a and t.id = any (v_karten));
    v_k := public.sva_album_karte_waehlen(v_set, v_ids, v_selt, v_album, v_platz, v_erlaubt,
             v_smart and cardinality(v_karten) = 0, v_hat_k, v_hat_p, v_karten, v_pp);
    if v_k is not null then
      v_karten := v_karten || v_k;
      v_seltn := v_seltn || (select t.s from unnest(v_ids, v_selt) as t(id, s) where t.id = v_k limit 1);
    end if;
  end if;
  if cardinality(v_karten) = 0 then
    return null;
  end if;

  -- Event: mit limitiert_chance % die limitierte Karte ins Pack (bevorzugt eine,
  -- die der Fan noch nicht hat — sonst bleibt alles, wie es gezogen wurde)
  if coalesce(v_t.limitiert_chance, 0) > 0 and v_fest.id is null and random() * 100 < v_t.limitiert_chance then
    if p_event_karte is not null then
      select * into v_ev from public.sva_album_karten k
       where k.id = p_event_karte and k.aktiv and not coalesce(k.geheim, false)
         and not (k.id = any (v_hat_k)) and not (k.id = any (v_karten));
    else
      select k.* into v_ev from public.sva_album_karten k
       where k.id = any (v_limk)
         and not (k.id = any (v_hat_k)) and not (k.id = any (v_karten))
       order by random() limit 1;
    end if;
    if v_ev.id is not null then
      if cardinality(v_karten) = 1 then
        v_karten := v_karten || v_ev.id;
        v_seltn := v_seltn || v_ev.seltenheit;
      else
        -- von hinten die erste Karte ersetzen, ohne die Garantie (Mindest-Seltenheit)
        -- zu verlieren; Karte 1 (Smart-Pack) bleibt
        for v_j in reverse cardinality(v_karten) .. 2 loop
          v_ok := v_min is null
                  or public.sva_album_rang(v_ev.seltenheit) >= public.sva_album_rang(v_min)
                  or exists (select 1 from unnest(v_seltn) with ordinality as x(s, i)
                              where x.i <> v_j and public.sva_album_rang(x.s) >= public.sva_album_rang(v_min));
          if v_ok then
            v_karten[v_j] := v_ev.id;
            v_seltn[v_j] := v_ev.seltenheit;
            exit;
          end if;
        end loop;
      end if;
    end if;
  end if;

  insert into public.sva_album_packs (fan_user_id, spiel_id, art, karten, seltenheiten, saison, quelle, titel, typ)
  values (p_fan, p_spiel, p_art, v_karten, v_seltn, v_saison, p_quelle, left(p_titel, 80), p_typ)
  on conflict do nothing
  returning id into v_id;
  return v_id;
end;
$$;

-- v20-Signatur bleibt (Ziele, Codes, Wunsch, Geheim …) — jetzt mit Pack-Typ der Art
create or replace function public.sva_album_pack_ziehen_v20(
  p_fan uuid,
  p_art text,
  p_spiel uuid default null,
  p_anzahl integer default null,
  p_quelle text default null,
  p_titel text default null,
  p_min_seltenheit text default null,
  p_fest uuid default null,
  p_belohnung boolean default false)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  return public.sva_album_pack_ziehen_v24(p_fan, p_art, public.sva_album_typ_von_art(p_art), p_spiel, p_anzahl,
                                          p_quelle, p_titel, p_min_seltenheit, p_fest, p_belohnung, null);
end;
$$;

-- Alte Signatur (Check-in, Heimsieg-Trigger, Freund, Starter, Geschenk).
-- Typisierte Arten nehmen Größe/Garantie aus sva_album_pack_typen; Check-in beim
-- Derby (es gibt eine aktive Derby-Karte für dieses Spiel) wird zum Event-Pack
-- mit der Größe/Garantie des Spieltags-Packs (mindestens Event-Größe).
create or replace function public.sva_album_pack_ziehen(p_fan uuid, p_spiel uuid, p_art text)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_set public.sva_album_einstellungen;
  v_typ text := public.sva_album_typ_von_art(p_art);
  v_t   public.sva_album_pack_typen;
  v_ev  public.sva_album_pack_typen;
  v_n   integer;
  v_min text;
  v_titel text;
begin
  select * into v_set from public.sva_album_einstellungen where id = 1;
  if v_typ is not null then
    select * into v_t from public.sva_album_pack_typen t where t.typ = v_typ;
  end if;
  if v_t.typ is not null then
    v_n := v_t.karten;
    v_min := v_t.min_seltenheit;
    v_titel := v_t.titel;
  else
    v_n := case p_art when 'heimsieg' then v_set.karten_heimsieg
                      when 'freund' then v_set.karten_freund
                      when 'starter' then v_set.karten_starter
                      when 'tipp' then v_set.karten_tipp
                      when 'story' then v_set.karten_story
                      when 'kapitel' then v_set.karten_kapitel
                      else v_set.karten_pro_pack end;
    v_min := case when p_art = 'starter' and v_set.starter_min_silber then 'silber' end;
    v_titel := case p_art when 'heimsieg' then 'Heimsieg-Bonus' when 'starter' then 'Starter-Pack' end;
  end if;
  if p_art = 'freund' then
    v_titel := 'Freundes-Bonus';
  end if;
  -- Derby-Check-in → Event-Pack
  if p_art = 'checkin' and p_spiel is not null and coalesce(v_n, 0) > 0
     and exists (select 1 from public.sva_album_karten k
                  where k.aktiv and k.limitiert and k.nur_spiel_id = p_spiel and not coalesce(k.geheim, false)) then
    select * into v_ev from public.sva_album_pack_typen t where t.typ = 'event';
    if v_ev.typ is not null and v_ev.karten > 0 then
      v_typ := 'event';
      v_n := greatest(v_n, v_ev.karten);
      v_min := coalesce(v_min, v_ev.min_seltenheit);
      v_titel := 'Derby-Pack';
    end if;
  end if;
  return public.sva_album_pack_ziehen_v24(
    p_fan, p_art, v_typ, p_spiel, coalesce(v_n, 0),
    case when p_art in ('freund', 'starter') then coalesce(p_spiel::text, p_art) end,
    v_titel, v_min, null, p_art = 'kapitel', null);
end;
$$;

-- ── 4. Quellen: Tipp, Kapitel, Event-Codes ──────────────────────────────────
create or replace function public.album_karte_gutschreiben(p_quelle text, p_bezug uuid)
returns uuid
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := auth.uid();
  v_pack uuid;
begin
  if p_quelle is distinct from 'tipp' then
    raise exception 'album_quelle_unbekannt' using errcode = 'P0001';
  end if;
  if v_uid is null or p_bezug is null or not exists (select 1 from public.sva_album_fans f where f.user_id = v_uid) then
    return null;
  end if;
  v_pack := public.sva_album_pack_ziehen_v24(v_uid, 'tipp', 'tipp', null, null, 'tipp:' || p_bezug::text,
              coalesce((select t.titel from public.sva_album_pack_typen t where t.typ = 'tipp'), 'Tipp-Pack'));
  if v_pack is not null then
    perform public.sva_album_ziele_pruefen(v_uid, array['serie_tipp']);
  end if;
  return v_pack;
end;
$$;

-- Kapitel komplett → Abzeichen + Ziel-Pack (Kartenzahl = Pack-Typ „ziel“)
create or replace function public.sva_album_kapitel_pruefen(p_fan uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_saison text := public.sva_album_saison();
  v_kap text;
  v_ok text;
  v_pack uuid;
  v_out jsonb := '[]'::jsonb;
begin
  for v_kap in
    select p.kapitel from public.sva_album_plaetze(p_fan) p
     group by p.kapitel having count(*) > 0 and bool_and(p.belegt)
  loop
    v_ok := null;
    insert into public.sva_album_abzeichen (fan_user_id, saison, kapitel) values (p_fan, v_saison, v_kap)
    on conflict do nothing returning kapitel into v_ok;
    if v_ok is not null then
      v_pack := null;
      if not exists (select 1 from public.sva_album_ziele z
                      where z.aktiv and z.typ = 'kapitel' and z.kapitel = v_kap
                        and (z.saison is null or z.saison = v_saison)) then
        v_pack := public.sva_album_pack_ziehen_v24(p_fan, 'kapitel', 'ziel', null,
                    coalesce((select t.karten from public.sva_album_pack_typen t where t.typ = 'ziel'),
                             (select e.karten_kapitel from public.sva_album_einstellungen e where e.id = 1)),
                    'kapitel:' || v_saison || ':' || v_kap, 'Kapitel komplett', null, null, true, null);
      end if;
      v_out := v_out || jsonb_build_object('kapitel', v_kap, 'packId', v_pack);
    end if;
  end loop;
  return v_out;
end;
$$;

-- Aktions-Codes: + Art 'event' (Kartenzahl = Pack-Typ „event“, Karte = Event-Karte)
create or replace function public.album_admin_story_code(
  p_art text, p_titel text, p_karte uuid default null, p_karten integer default null,
  p_stunden integer default 24, p_code text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_code text := nullif(upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g')), '');
  v_c public.sva_album_codes;
begin
  perform public.sva_album_admin_pruefen();
  if p_art not in ('story', 'partner', 'advent', 'event') then
    raise exception 'album_ungueltig:art' using errcode = '22023';
  end if;
  if p_titel is null or char_length(btrim(p_titel)) not between 2 and 60 then
    raise exception 'album_ungueltig:titel' using errcode = '22023';
  end if;
  if coalesce(p_stunden, 24) not between 1 and 8760 then
    raise exception 'album_ungueltig:stunden' using errcode = '22023';
  end if;
  if p_karte is not null and not exists (select 1 from public.sva_album_karten k where k.id = p_karte) then
    raise exception 'album_ungueltig:karte' using errcode = '22023';
  end if;
  if v_code is null then
    v_code := public.sva_album_aktionscode_neu(case p_art when 'story' then 'STORY' when 'partner' then 'PARTNER'
                                                          when 'event' then 'EVENT' else 'ADVENT' end);
  elsif v_code !~ '^[A-Z0-9-]{4,24}$' then
    raise exception 'album_ungueltig:code' using errcode = '22023';
  elsif exists (select 1 from public.sva_album_codes c where c.code = v_code) then
    raise exception 'album_code_vergeben' using errcode = 'P0001';
  end if;
  insert into public.sva_album_codes (code, art, titel, karte_id, karten, gueltig_von, gueltig_bis, erzeugt_von)
  values (v_code, p_art, btrim(p_titel), p_karte,
          greatest(1, least(5, coalesce(p_karten, case p_art
                                                    when 'story' then (select e.karten_story from public.sva_album_einstellungen e where e.id = 1)
                                                    when 'event' then (select nullif(t.karten, 0) from public.sva_album_pack_typen t where t.typ = 'event')
                                                    else 1 end, 1))),
          now(), now() + make_interval(hours => coalesce(p_stunden, 24)), auth.jwt() ->> 'email')
  returning * into v_c;
  return jsonb_build_object('id', v_c.id, 'code', v_c.code, 'gueltigBis', v_c.gueltig_bis);
end;
$$;

-- Code einlösen (Story / Partner / Advent / Event) — v22-Hülle album_code_einloesen ruft das
create or replace function public.sva_album_code_einloesen_v21(p_code text)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid  uuid := public.sva_album_uid();
  v_e    public.sva_album_einstellungen;
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '\s+', '', 'g'));
  v_c    public.sva_album_codes;
  v_n    integer;
  v_ok   uuid;
  v_pack uuid;
begin
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

  if v_code ~ '^[A-Z0-9-]{4,24}$' then
    select * into v_c from public.sva_album_codes c where c.code = v_code and c.aktiv for update;
  end if;
  if v_c.id is null then
    insert into public.sva_album_code_fehler (fan_user_id) values (v_uid);
    return jsonb_build_object('ok', false, 'grund', 'ungueltig', 'versuche', greatest(0, v_e.code_fehler_limit - v_n - 1));
  end if;
  if now() < v_c.gueltig_von then
    return jsonb_build_object('ok', false, 'grund', 'noch_nicht', 'gueltigVon', v_c.gueltig_von);
  end if;
  if now() >= v_c.gueltig_bis then
    return jsonb_build_object('ok', false, 'grund', 'abgelaufen');
  end if;
  if exists (select 1 from public.sva_album_code_einloesungen ce where ce.code_id = v_c.id and ce.fan_user_id = v_uid) then
    return jsonb_build_object('ok', false, 'grund', 'schon');
  end if;
  if v_c.max_einloesungen is not null
     and (select count(*) from public.sva_album_code_einloesungen ce where ce.code_id = v_c.id) >= v_c.max_einloesungen then
    return jsonb_build_object('ok', false, 'grund', 'abgelaufen');
  end if;

  insert into public.sva_album_code_einloesungen (code_id, fan_user_id) values (v_c.id, v_uid)
  on conflict do nothing returning code_id into v_ok;
  if v_ok is null then
    return jsonb_build_object('ok', false, 'grund', 'schon');
  end if;
  if v_c.art = 'event' then
    v_pack := public.sva_album_pack_ziehen_v24(v_uid, 'event', 'event', null, v_c.karten, v_c.id::text, v_c.titel,
                null, null, false, (select k.id from public.sva_album_karten k where k.id = v_c.karte_id and k.aktiv));
  else
    v_pack := public.sva_album_pack_ziehen_v20(v_uid, v_c.art, null, v_c.karten, v_c.id::text, v_c.titel, null,
                (select k.id from public.sva_album_karten k where k.id = v_c.karte_id and k.aktiv));
  end if;
  return jsonb_strip_nulls(jsonb_build_object('ok', true, 'packId', v_pack, 'art', v_c.art, 'titel', v_c.titel,
                                              'typ', case when v_c.art = 'event' then 'event' end));
end;
$$;

-- ── 5. Fan-RPCs: Hüllen um die v22-Fassungen ────────────────────────────────
do $$
begin
  if to_regprocedure('public.sva_album_katalog_v22()') is null then
    alter function public.album_katalog() rename to sva_album_katalog_v22;
  end if;
  if to_regprocedure('public.sva_album_mein_v22()') is null then
    alter function public.album_mein() rename to sva_album_mein_v22;
  end if;
  if to_regprocedure('public.sva_album_pack_oeffnen_v22(uuid)') is null then
    alter function public.album_pack_oeffnen(uuid) rename to sva_album_pack_oeffnen_v22;
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
  v jsonb := public.sva_album_katalog_v22();
begin
  return jsonb_set(v, '{regeln,packTypen}', public.sva_album_pack_typen_json());
end;
$$;
comment on function public.album_katalog() is 'Öffentlich: Album-Katalog der Saison + Regeln. v24: + regeln.packTypen[{typ,titel,karten,minSeltenheit,optik,reveal,limitiertChance,beschreibung}].';

create or replace function public.album_mein()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v jsonb := public.sva_album_mein_v22();
begin
  return jsonb_set(v, '{packs}', coalesce((
    select jsonb_agg(jsonb_strip_nulls(jsonb_build_object('id', p.id, 'art', p.art, 'anzahl', cardinality(p.karten),
             'titel', coalesce(p.titel, t.titel), 'gegner', s.gegner, 'at', p.created_at,
             'typ', coalesce(p.typ, public.sva_album_typ_von_art(p.art)))) order by p.created_at)
      from public.sva_album_packs p
      left join public.sm_spiele s on s.id = p.spiel_id
      left join public.sva_album_pack_typen t on t.typ = coalesce(p.typ, public.sva_album_typ_von_art(p.art))
     where p.fan_user_id = v_uid and p.geoeffnet_at is null), '[]'::jsonb));
end;
$$;

create or replace function public.album_pack_oeffnen(p_pack uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_album_uid();
  v jsonb := public.sva_album_pack_oeffnen_v22(p_pack);
  v_typ text;
  v_titel text;
begin
  select coalesce(p.typ, public.sva_album_typ_von_art(p.art)), coalesce(p.titel, t.titel) into v_typ, v_titel
    from public.sva_album_packs p
    left join public.sva_album_pack_typen t on t.typ = coalesce(p.typ, public.sva_album_typ_von_art(p.art))
   where p.id = p_pack and p.fan_user_id = v_uid;
  return v || jsonb_strip_nulls(jsonb_build_object('typ', v_typ, 'titel', v_titel));
end;
$$;

-- ── 6. Tipp-Liga: Pack-Infos in Abgabe und Lage ─────────────────────────────
create or replace function public.tipp_abgeben(
  p_spiel uuid, p_tore_sva integer, p_tore_gegner integer,
  p_erster text default null, p_motm text default null,
  p_joker boolean default false, p_bonus jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_uid uuid := public.sva_tipp_uid();
  v_e public.sva_tipp_einstellungen;
  v_s public.sm_spiele;
  v_fragen text[];
  v_bonus jsonb := '{}'::jsonb;
  k text;
  v text;
  v_neu boolean;
  v_karte boolean := false;
  v_res text;
  v_pack uuid;
  v_pack_j jsonb;
  v_abz text[];
begin
  select * into v_e from public.sva_tipp_einstellungen where id = 1;
  if not coalesce(v_e.aktiv, true) then
    raise exception 'tipp_pausiert' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.sva_tipp_teilnehmer t where t.user_id = v_uid) then
    raise exception 'tipp_kein_teilnehmer' using errcode = 'P0001';
  end if;
  select * into v_s from public.sm_spiele where id = p_spiel;
  if v_s.id is null then raise exception 'tipp_spiel_unbekannt' using errcode = 'P0001'; end if;
  if public.sva_tipp_wertung(p_spiel) is null then raise exception 'tipp_nicht_tippbar' using errcode = 'P0001'; end if;
  if not public.sva_tipp_offen(p_spiel) then raise exception 'tipp_geschlossen' using errcode = 'P0001'; end if;
  if p_tore_sva is null or p_tore_gegner is null or p_tore_sva not between 0 and 20 or p_tore_gegner not between 0 and 20 then
    raise exception 'tipp_ungueltig:ergebnis' using errcode = '22023';
  end if;

  v_fragen := public.sva_tipp_fragen(p_spiel);
  if p_bonus is not null and jsonb_typeof(p_bonus) = 'object' then
    for k, v in select key, value from jsonb_each_text(p_bonus) loop
      if not (k = any (v_fragen)) or not public.sva_tipp_bonus_ok(k, v) then
        raise exception 'tipp_ungueltig:bonus' using errcode = '22023';
      end if;
      v_bonus := v_bonus || jsonb_build_object(k, v);
    end loop;
  end if;

  perform pg_advisory_xact_lock(hashtext('sva_tipp_joker:' || v_uid::text));
  if coalesce(p_joker, false) and exists (
       select 1 from public.sva_tipp_tipps x
        where x.user_id = v_uid and x.joker and x.spiel_id <> p_spiel
          and x.joker_monat = public.sva_tipp_monat_von(v_s.anstoss)) then
    raise exception 'tipp_joker_verbraucht' using errcode = 'P0001';
  end if;

  v_neu := not exists (select 1 from public.sva_tipp_tipps x where x.user_id = v_uid and x.spiel_id = p_spiel);
  insert into public.sva_tipp_tipps (user_id, spiel_id, tore_sva, tore_gegner, erster_torschuetze, motm, joker, bonus)
  values (v_uid, p_spiel, p_tore_sva, p_tore_gegner, public.sva_tipp_roster(p_erster), public.sva_tipp_roster(p_motm),
          coalesce(p_joker, false), v_bonus)
  on conflict (user_id, spiel_id) do update
     set tore_sva = excluded.tore_sva, tore_gegner = excluded.tore_gegner,
         erster_torschuetze = excluded.erster_torschuetze, motm = excluded.motm,
         joker = excluded.joker, bonus = excluded.bonus;

  -- Erster Tipp dieses Spieltags → Tipp-Pack (v24: Pack-Typ „tipp“, z. B. 2 Karten)
  if v_neu and to_regprocedure('public.album_karte_gutschreiben(text,uuid)') is not null then
    begin
      execute 'select public.album_karte_gutschreiben($1, $2)::text' into v_res using 'tipp', p_spiel;
      v_karte := coalesce(v_res, '') not in ('', 'false', 'null') and v_res !~ '"ok"\s*:\s*false';
      if v_res ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
        v_pack := v_res::uuid;
        select jsonb_build_object('id', p.id, 'typ', coalesce(p.typ, 'tipp'), 'titel', coalesce(p.titel, 'Tipp-Pack'),
                                  'karten', cardinality(p.karten))
          into v_pack_j
          from public.sva_album_packs p where p.id = v_pack;
      end if;
    exception when others then
      v_karte := false; -- das Pack darf den Tipp nie verhindern
      v_pack := null;
      v_pack_j := null;
    end;
  end if;

  v_abz := public.sva_tipp_abzeichen_pruefen(v_uid);
  return jsonb_strip_nulls(jsonb_build_object('ok', true, 'neu', v_neu, 'karte', v_karte, 'abzeichen', to_jsonb(v_abz),
                            'anzahlTipps', (select count(*) from public.sva_tipp_tipps x where x.spiel_id = p_spiel),
                            'packId', v_pack, 'pack', v_pack_j));
end;
$$;

do $$
begin
  if to_regprocedure('public.sva_tipp_lage_v22()') is null then
    alter function public.tipp_lage() rename to sva_tipp_lage_v22;
  end if;
end $$;
create or replace function public.tipp_lage()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb := public.sva_tipp_lage_v22();
  v_t public.sva_album_pack_typen;
begin
  select * into v_t from public.sva_album_pack_typen t where t.typ = 'tipp';
  if v_t.typ is null or v_t.karten <= 0 then
    return v;
  end if;
  return v || jsonb_build_object('tippPack', jsonb_build_object('titel', v_t.titel, 'karten', v_t.karten));
end;
$$;
comment on function public.tipp_lage() is 'v24-P: wie v22 (sva_tipp_lage_v22) + tippPack {titel, karten} (Pack-Typ „tipp“ des Albums).';

-- ── 7. Sieg-Pack: alle, die getippt ODER eingecheckt haben ──────────────────
-- Beim Eintragen des Heimsieg-Ergebnisses (Trigger auf sm_spiele, wie bisher)
-- bekommt jeder Fan mit Album-Profil, der für dieses Spiel getippt oder
-- eingecheckt hat, genau EIN Sieg-Pack (Unique-Index Fan+Spiel+Art). Das Pack
-- liegt bereit, bis der Fan wiederkommt — Packs verfallen nicht. Vorführ-Spiele
-- (demo) zählen nur für Check-ins (wie bisher).
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
  for v_c in
    select c.fan_user_id as fan from public.sva_album_checkins c
     where c.spiel_id = p_spiel and c.fan_user_id is not null
    union
    select x.user_id from public.sva_tipp_tipps x
      join public.sva_album_fans f on f.user_id = x.user_id
     where x.spiel_id = p_spiel and not coalesce(v_s.demo, false)
  loop
    if public.sva_album_pack_ziehen(v_c.fan, p_spiel, 'heimsieg') is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  update public.sva_album_spielcodes set bonus_at = coalesce(bonus_at, now()) where spiel_id = p_spiel;
  return v_n;
end;
$$;

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
     and (exists (select 1 from public.sva_album_checkins c where c.spiel_id = new.id)
          or exists (select 1 from public.sva_tipp_tipps x where x.spiel_id = new.id)) then
    begin
      perform public.sva_album_heimsieg_bonus(new.id);
    exception when others then
      null; -- Album-Bonus darf Ergebnis/Ticker/Wertung nie blockieren
    end;
  end if;
  return null;
end;
$$;

-- Wertung der Tipp-Liga (tipp_admin_werten setzt gewertet_at) → Sieg-Packs
-- noch einmal sicherstellen (idempotent; wichtig, falls das Ergebnis vor dem
-- ersten Tipp/Check-in eingetragen war oder der Ergebnis-Trigger übersprungen wurde).
create or replace function public.sva_album_wertung_trigger()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  if new.gewertet_at is not null and old.gewertet_at is distinct from new.gewertet_at then
    begin
      perform public.sva_album_heimsieg_bonus(new.spiel_id);
    exception when others then
      null; -- die Wertung darf nie am Album scheitern
    end;
  end if;
  return null;
end;
$$;
drop trigger if exists sva_album_sieg_bei_wertung on public.sva_tipp_spieltage;
create trigger sva_album_sieg_bei_wertung
  after update on public.sva_tipp_spieltage
  for each row execute function public.sva_album_wertung_trigger();

-- ── 8. Pack-Kontrolle (Admin): Soll vs. Ist je Anlass, Nachliefern ──────────
-- Anlass-Schlüssel: 'spiel:<id>:tipp' · 'spiel:<id>:checkin' · 'spiel:<id>:sieg' ·
-- 'starter' · 'ziel:<ziel-id>'. Soll = wem ein Pack zusteht, Ist = vorhandene
-- Packs (geöffnet oder nicht) dieses Fans für diesen Anlass. Saison = laufende.
create or replace function public.sva_album_pack_soll()
returns table (anlass text, art text, titel text, spiel_id uuid, fan uuid, ziel_id uuid, bezug text, ist integer)
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  with e as (select * from public.sva_album_einstellungen where id = 1),
  tk as (select t.typ, t.karten from public.sva_album_pack_typen t),
  sz as (select public.sva_album_saison() as s),
  von as (select make_timestamptz(left(sz.s, 4)::int, 7, 1, 0, 0, 0, 'Europe/Berlin') as v from sz where sz.s ~ '^[0-9]{4}'),
  spiele as (
    select s.* from public.sm_spiele s, von
     where s.anstoss >= von.v and s.anstoss < von.v + interval '1 year'),
  soll as (
    select 'spiel:' || s.id || ':tipp' as anlass, 'tipp'::text as art, 'Tipp-Pack · ' || s.gegner as titel,
           s.id as spiel_id, x.user_id as fan, null::uuid as ziel_id, null::text as bezug
      from spiele s
      join public.sva_tipp_tipps x on x.spiel_id = s.id
      join public.sva_album_fans f on f.user_id = x.user_id
     where not coalesce(s.demo, false) and coalesce((select tk.karten from tk where tk.typ = 'tipp'), 0) > 0
    union all
    select 'spiel:' || s.id || ':checkin', 'checkin', 'Spieltags-Pack · ' || s.gegner, s.id, c.fan_user_id, null, null
      from spiele s join public.sva_album_checkins c on c.spiel_id = s.id
     where c.fan_user_id is not null and coalesce((select tk.karten from tk where tk.typ = 'spieltag'), 0) > 0
    union all
    select 'spiel:' || s.id || ':sieg', 'heimsieg', 'Sieg-Pack · ' || s.gegner, s.id, u.fan, null, null
      from spiele s
     cross join lateral (
       select c.fan_user_id as fan from public.sva_album_checkins c where c.spiel_id = s.id and c.fan_user_id is not null
       union
       select x.user_id from public.sva_tipp_tipps x join public.sva_album_fans f on f.user_id = x.user_id
        where x.spiel_id = s.id and not coalesce(s.demo, false)) u
     where s.heim and s.tore_sva is not null and s.tore_gegner is not null and s.tore_sva > s.tore_gegner
       and coalesce((select e.bonus_heimsieg from e), true)
       and coalesce((select tk.karten from tk where tk.typ = 'sieg'), 0) > 0
    union all
    select 'starter', 'starter', 'Starter-Pack', null, f.user_id, null, null
      from public.sva_album_fans f
     where f.created_at < now() - interval '10 minutes'
       and coalesce((select tk.karten from tk where tk.typ = 'starter'), 0) > 0
    union all
    select 'ziel:' || z.id, 'ziel', z.titel, null, r.fan_user_id, z.id, r.bezug
      from public.sva_album_ziel_erreicht r
      join public.sva_album_ziele z on z.id = r.ziel_id
     where r.saison = (select sz.s from sz) and z.belohnung_karten > 0
  )
  select soll.anlass, soll.art, soll.titel, soll.spiel_id, soll.fan, soll.ziel_id, soll.bezug,
         (select count(*)::int from public.sva_album_packs p
           where p.fan_user_id = soll.fan and p.art = soll.art
             and case soll.art
                   when 'tipp' then p.quelle = 'tipp:' || soll.spiel_id::text
                   when 'ziel' then p.quelle = soll.ziel_id::text || ':' || coalesce(soll.bezug, '')
                   when 'starter' then true
                   else p.spiel_id = soll.spiel_id end) as ist
    from soll;
$$;

create or replace function public.sva_admin_pack_kontrolle()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v jsonb;
begin
  perform public.sva_album_admin_pruefen();
  with x as (select * from public.sva_album_pack_soll()),
  a as (
    select x.anlass, min(x.art) as art, min(x.titel) as titel, min(x.spiel_id::text) as spiel,
           count(*)::int as soll,
           count(*) filter (where x.ist > 0)::int as ist,
           count(*) filter (where x.ist = 0)::int as fehlend,
           coalesce(sum(greatest(x.ist - 1, 0)), 0)::int as doppelt,
           coalesce(jsonb_agg(coalesce(public.sva_album_name(x.fan), 'Fan ohne Profil') order by x.fan) filter (where x.ist = 0), '[]'::jsonb) as fans
      from x group by x.anlass)
  select jsonb_build_object(
           'saison', public.sva_album_saison(),
           'ok', coalesce(bool_and(a.fehlend = 0 and a.doppelt = 0), true),
           'soll', coalesce(sum(a.soll), 0),
           'ist', coalesce(sum(a.ist), 0),
           'fehlend', coalesce(sum(a.fehlend), 0),
           'doppelt', coalesce(sum(a.doppelt), 0),
           'anlaesse', coalesce(jsonb_agg(jsonb_build_object(
               'anlass', a.anlass, 'art', a.art, 'titel', a.titel, 'soll', a.soll, 'ist', a.ist,
               'fehlend', a.fehlend, 'doppelt', a.doppelt, 'fans', a.fans)
             order by (a.fehlend + a.doppelt) desc, a.anlass), '[]'::jsonb))
    into v
    from a;
  return v;
end;
$$;
comment on function public.sva_admin_pack_kontrolle() is 'v24-P Admin: Pack-Kontrolle der Saison — je Anlass (Spiel: Tipp/Check-in/Sieg, Starter, Ziel) Soll vs. Ist, fehlende Fans, Doppelte.';

create or replace function public.album_admin_pack_nachliefern(p_anlass text default 'alle')
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  r record;
  z public.sva_album_ziele;
  v_pack uuid;
  v_n integer := 0;
  v_offen integer;
begin
  perform public.sva_album_admin_pruefen();
  if p_anlass is null or (p_anlass <> 'alle' and p_anlass !~ '^(spiel:[0-9a-f-]{36}:(tipp|checkin|sieg)|starter|ziel:[0-9a-f-]{36})$') then
    raise exception 'album_ungueltig:anlass' using errcode = '22023';
  end if;
  for r in select * from public.sva_album_pack_soll() s where s.ist = 0 and (p_anlass = 'alle' or s.anlass = p_anlass) loop
    v_pack := null;
    if r.art = 'tipp' then
      v_pack := public.sva_album_pack_ziehen_v24(r.fan, 'tipp', 'tipp', null, null, 'tipp:' || r.spiel_id::text,
                  coalesce((select t.titel from public.sva_album_pack_typen t where t.typ = 'tipp'), 'Tipp-Pack'));
    elsif r.art in ('checkin', 'heimsieg') then
      v_pack := public.sva_album_pack_ziehen(r.fan, r.spiel_id, r.art);
    elsif r.art = 'starter' then
      v_pack := public.sva_album_pack_ziehen(r.fan, null, 'starter');
    elsif r.art = 'ziel' then
      select * into z from public.sva_album_ziele where id = r.ziel_id;
      v_pack := public.sva_album_pack_ziehen_v20(r.fan, 'ziel', null, z.belohnung_karten, z.id::text || ':' || coalesce(r.bezug, ''),
                  z.titel, z.belohnung_min_seltenheit, null, true);
      if v_pack is not null then
        update public.sva_album_ziel_erreicht set pack_id = v_pack
         where ziel_id = z.id and fan_user_id = r.fan and bezug = coalesce(r.bezug, '');
      end if;
    end if;
    if v_pack is not null then
      v_n := v_n + 1;
    end if;
  end loop;
  select count(*)::int into v_offen from public.sva_album_pack_soll() s where s.ist = 0 and (p_anlass = 'alle' or s.anlass = p_anlass);
  return jsonb_build_object('nachgeliefert', v_n, 'offen', v_offen);
end;
$$;
comment on function public.album_admin_pack_nachliefern(text) is 'v24-P Admin: fehlende Packs eines Anlasses (oder alle) nachliefern — idempotent (Unique-Key je Fan+Anlass).';

-- ── 9. Rechte ───────────────────────────────────────────────────────────────
do $$
declare f text;
begin
  foreach f in array array['public.sva_admin_pack_kontrolle()', 'public.album_admin_pack_nachliefern(text)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  foreach f in array array[
    'public.sva_album_pack_soll()',
    'public.sva_album_heimsieg_bonus(uuid)',
    'public.sva_album_spiel_trigger()',
    'public.sva_album_wertung_trigger()',
    'public.sva_album_pack_ziehen_v24(uuid, text, text, uuid, integer, text, text, text, uuid, boolean, uuid)',
    'public.sva_album_pack_typen_json()',
    'public.sva_album_katalog_v22()',
    'public.sva_album_mein_v22()',
    'public.sva_album_pack_oeffnen_v22(uuid)',
    'public.sva_tipp_lage_v22()'
  ] loop
    execute format('revoke all on function %s from public, anon, authenticated', f);
    execute format('grant execute on function %s to service_role', f);
  end loop;
  -- reine Zuordnung, harmlos
  execute 'revoke all on function public.sva_album_typ_von_art(text) from public, anon, authenticated';
  execute 'grant execute on function public.sva_album_typ_von_art(text) to service_role';
  foreach f in array array['public.album_mein()', 'public.album_pack_oeffnen(uuid)'] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated, service_role', f);
  end loop;
  execute 'revoke all on function public.album_katalog() from public';
  execute 'grant execute on function public.album_katalog() to anon, authenticated, service_role';
  execute 'revoke all on function public.tipp_lage() from public';
  execute 'grant execute on function public.tipp_lage() to anon, authenticated, service_role';
end $$;
