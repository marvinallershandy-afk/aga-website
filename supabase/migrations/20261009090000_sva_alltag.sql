-- ─────────────────────────────────────────────────────────────────────────────
-- v18-A „Alltag“: Kalender-Abo + Probetraining-Kontakte je Mannschaft.
--
--   1. sm_spiele: kalender_seq / kalender_geaendert_at — ein Trigger zählt die
--      Version hoch, sobald sich etwas Kalender-Relevantes ändert (Gegner,
--      Heim/Auswärts, Anstoß, Ort, Wettbewerb, Spieltag, Endergebnis). Daraus
--      werden SEQUENCE/LAST-MODIFIED im ICS. Live-Zwischenstände (live_tore_*)
--      zählen bewusst NICHT — sonst „ändert“ sich der Termin bei jedem Tor.
--   2. web_kalender(p_alle) — öffentliche Lese-RPC (anon) für die Edge Function
--      `kalender`: nur Spielplan-Felder (keine Notizen, keine IDs von Personen),
--      Testspiele mit „(TEST)“ im Gegnernamen ausgeblendet, max. 400 Tage
--      zurück/voraus, max. 500 Termine.
--   3. sva_mannschaften — Mannschaften für den Probetraining-Assistenten mit
--      optionaler eigener WhatsApp-Nummer und Ansprechpartner (Fallback = Haupt-
--      WhatsApp aus „Verein & Links“). Startwerte = was die Website heute kennt:
--      1. Herren und Jugend (unter 18). Weitere (z. B. 2. Herren) legt der Admin an.
--   4. web_mitspielen() — öffentliche Lese-RPC (anon) für den Build
--      (scripts/fetch-content.mjs): nur sichtbare Mannschaften.
--
-- Bewusst KEIN Neuanlegen von web_snapshot(): andere Stränge erweitern es
-- parallel; eine eigene RPC vermeidet, dass sich Migrationen gegenseitig Felder
-- wegdefinieren. Idempotent (mehrfach anwendbar).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Kalender-Version am Spiel ────────────────────────────────────────────
alter table public.sm_spiele add column if not exists kalender_seq integer not null default 0;
alter table public.sm_spiele add column if not exists kalender_geaendert_at timestamptz;
comment on column public.sm_spiele.kalender_seq is
  'v18-A: Änderungszähler für das Kalender-Abo (ICS SEQUENCE). Trigger sva_spiele_kalender_seq.';

create or replace function public.sva_spiele_kalender_seq()
returns trigger
language plpgsql
set search_path to 'public', 'pg_temp'
as $$
begin
  if (new.gegner, new.heim, new.anstoss, new.ort, new.wettbewerb, new.spieltag_nr, new.tore_sva, new.tore_gegner)
     is distinct from
     (old.gegner, old.heim, old.anstoss, old.ort, old.wettbewerb, old.spieltag_nr, old.tore_sva, old.tore_gegner) then
    new.kalender_seq := coalesce(old.kalender_seq, 0) + 1;
    new.kalender_geaendert_at := now();
  else
    -- Version nur über den Trigger — kein Zurückdrehen von außen
    new.kalender_seq := old.kalender_seq;
    new.kalender_geaendert_at := old.kalender_geaendert_at;
  end if;
  return new;
end;
$$;
revoke all on function public.sva_spiele_kalender_seq() from public, anon, authenticated;

drop trigger if exists sva_spiele_kalender_seq on public.sm_spiele;
create trigger sva_spiele_kalender_seq
  before update on public.sm_spiele
  for each row execute function public.sva_spiele_kalender_seq();

-- ── 2. web_kalender(): öffentlicher Spielplan für das ICS-Abo ───────────────
create or replace function public.web_kalender(p_alle boolean default false)
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select jsonb_build_object(
    'version', 1,
    'erzeugt', now(),
    'verein', coalesce((
      select jsonb_strip_nulls(jsonb_build_object(
               'adresse', nullif(btrim(coalesce(st.adresse, '')), '')))
        from public.sva_settings st where st.id = 1), '{}'::jsonb),
    'spiele', coalesce((
      select jsonb_agg(x.obj order by x.anstoss)
        from (
          select s.anstoss,
                 jsonb_strip_nulls(jsonb_build_object(
                   'id',         s.id,
                   'gegner',     btrim(s.gegner),
                   'heim',       s.heim,
                   'anstoss',    s.anstoss,
                   'ort',        nullif(btrim(coalesce(s.ort, '')), ''),
                   'wettbewerb', nullif(btrim(coalesce(s.wettbewerb, '')), ''),
                   'spieltag',   s.spieltag_nr,
                   'toreSva',    case when s.tore_sva is not null and s.tore_gegner is not null then s.tore_sva end,
                   'toreGegner', case when s.tore_sva is not null and s.tore_gegner is not null then s.tore_gegner end,
                   'seq',        s.kalender_seq,
                   'geaendert',  coalesce(s.kalender_geaendert_at, s.created_at)
                 )) as obj
            from public.sm_spiele s
           where (coalesce(p_alle, false) or s.heim)
             and position('(test)' in lower(s.gegner)) = 0
             and s.anstoss between now() - interval '400 days' and now() + interval '400 days'
           order by s.anstoss
           limit 500
        ) x), '[]'::jsonb)
  );
$$;
revoke all on function public.web_kalender(boolean) from public;
grant execute on function public.web_kalender(boolean) to anon, authenticated, service_role;
comment on function public.web_kalender(boolean) is
  'v18-A: Öffentlicher Spielplan für das Kalender-Abo (Edge Function kalender). Ohne Notizen, ohne Testspiele.';

-- ── 3. Mannschaften für den Probetraining-Assistenten ───────────────────────
create table if not exists public.sva_mannschaften (
  id uuid primary key default gen_random_uuid(),
  schluessel text not null unique check (schluessel ~ '^[a-z0-9][a-z0-9-]{0,39}$'),
  name text not null check (char_length(btrim(name)) between 2 and 40),
  -- kurze Zeile unter dem Namen, z. B. „ab 18 Jahren“
  hinweis text check (hinweis is null or char_length(hinweis) <= 120),
  -- leer = Trainingszeiten/-ort aus „Verein & Links“
  training text check (training is null or char_length(training) <= 160),
  -- Vorname für die Anrede in der Nachricht („Hallo Jan!“)
  ansprechpartner text check (ansprechpartner is null or char_length(btrim(ansprechpartner)) between 1 and 40),
  -- internationales Format ohne + und ohne führende 0 (wie sva_settings.whatsapp)
  whatsapp text check (whatsapp is null or whatsapp ~ '^[1-9][0-9]{7,14}$'),
  sichtbar boolean not null default true,
  sortierung integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sva_mannschaften is
  'v18-A: Mannschaften im Probetraining-Assistenten (Website). WhatsApp leer = Haupt-WhatsApp aus Verein & Links.';
alter table public.sva_mannschaften enable row level security;

do $$
begin
  execute 'drop policy if exists sva_mannschaften_select on public.sva_mannschaften';
  execute 'create policy sva_mannschaften_select on public.sva_mannschaften for select to authenticated using (public.is_sm_admin())';
  execute 'drop policy if exists sva_mannschaften_insert on public.sva_mannschaften';
  execute 'create policy sva_mannschaften_insert on public.sva_mannschaften for insert to authenticated with check (public.is_sm_admin())';
  execute 'drop policy if exists sva_mannschaften_update on public.sva_mannschaften';
  execute 'create policy sva_mannschaften_update on public.sva_mannschaften for update to authenticated using (public.is_sm_admin()) with check (public.is_sm_admin())';
  execute 'drop policy if exists sva_mannschaften_delete on public.sva_mannschaften';
  execute 'create policy sva_mannschaften_delete on public.sva_mannschaften for delete to authenticated using (public.is_sm_admin())';
end $$;
revoke all on public.sva_mannschaften from anon;
grant select, insert, update, delete on public.sva_mannschaften to authenticated;

-- Startwerte: nur, was die Website heute schon kennt (Panel „Mitspielen“:
-- 1. Herren + „Unter 18? … wir verbinden dich mit der Jugend“).
insert into public.sva_mannschaften (schluessel, name, hinweis, training, sortierung)
values
  ('herren-1', '1. Herren', 'ab 18 Jahren · Kreisliga', null, 10),
  ('jugend', 'Jugend (unter 18)', 'eigene Teams und Trainer', 'Zeiten je nach Altersklasse — wir verbinden dich mit der Jugend.', 20)
on conflict (schluessel) do nothing;

-- ── 4. web_mitspielen(): öffentliche Liste für den Build ────────────────────
create or replace function public.web_mitspielen()
returns jsonb
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'id',       m.schluessel,
           'name',     btrim(m.name),
           'hinweis',  nullif(btrim(coalesce(m.hinweis, '')), ''),
           'training', nullif(btrim(coalesce(m.training, '')), ''),
           'kontakt',  nullif(btrim(coalesce(m.ansprechpartner, '')), ''),
           'whatsapp', m.whatsapp
         )) order by m.sortierung, m.name), '[]'::jsonb)
    from public.sva_mannschaften m
   where m.sichtbar;
$$;
revoke all on function public.web_mitspielen() from public;
grant execute on function public.web_mitspielen() to anon, authenticated, service_role;
comment on function public.web_mitspielen() is
  'v18-A: Sichtbare Mannschaften für den Probetraining-Assistenten (Build-Fetch, anon).';
