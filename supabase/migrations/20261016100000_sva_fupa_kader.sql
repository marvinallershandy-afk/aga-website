-- ─────────────────────────────────────────────────────────────────────────────
-- v23-U: FuPa-Kader-Schnappschuss + „fehlende" Spieler + „als Spieler anlegen".
--
-- Der fupa-sync-Bot füllt sva_fupa_kader per GET /v1/teams/<slug>/squad
-- (matches, goals, assists, jerseyNumber). DATENMINIMAL: keine Geburtsdaten,
-- Bilder oder Profil-URLs. Lesen/Schreiben nur über RPCs bzw. service_role.
--
-- Zweck: Spieler, die bei FuPa im Kader stehen, aber (noch) nicht auf der
-- Website, im Admin sichtbar machen und per Tipp als Platzhalter-Spieler
-- anlegen (ohne Foto). Die Zuordnung Bot↔Kader läuft dann über fupa_spieler_id.
--
-- Reihenfolge: nach 20261015100000_sva_live_v23.sql (nutzt sva_name_norm).
-- Idempotent (if not exists / create or replace).
-- ─────────────────────────────────────────────────────────────────────────────

create table if not exists public.sva_fupa_kader (
  fupa_spieler_id bigint primary key,
  vorname       text,
  nachname      text,
  nummer        integer,
  spiele        integer not null default 0,
  tore          integer not null default 0,
  vorlagen      integer not null default 0,
  abgerufen_at  timestamptz not null default now()
);
comment on table public.sva_fupa_kader is 'v23-U: FuPa-Teamkader (Schnappschuss, vom fupa-sync-Bot). Datenminimal, ohne Geburtsdaten/Bilder. Lesen über RPC.';

alter table public.sva_fupa_kader enable row level security;
-- Keine direkten anon/authenticated-Policies: Zugriff ausschließlich über die
-- RPCs unten (security definer) bzw. die service_role (Bot, umgeht RLS).

-- ── RPC: FuPa-Spieler, die (noch) nicht auf der Website stehen ───────────────
-- „Nicht auf der Website" = weder per fupa_spieler_id noch per normalisiertem
-- Namen einem aktiven Kader-Spieler zugeordnet.
create or replace function public.sva_admin_fupa_fehlende()
returns jsonb
language plpgsql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
declare v_res jsonb;
begin
  perform public.sva_tipp_team_pruefen();
  select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
           'fupaId',  k.fupa_spieler_id,
           'name',    btrim(concat_ws(' ', k.vorname, k.nachname)),
           'nummer',  k.nummer,
           'spiele',  k.spiele,
           'tore',    k.tore,
           'vorlagen',k.vorlagen
         )) order by k.nummer nulls last, k.nachname), '[]'::jsonb)
    into v_res
    from public.sva_fupa_kader k
   where btrim(concat_ws(' ', k.vorname, k.nachname)) <> ''
     and not exists (select 1 from public.sm_roster r where r.fupa_spieler_id = k.fupa_spieler_id)
     and not exists (
           select 1 from public.sm_roster r
            where r.aktiv and r.rolle = 'spieler'
              and public.sva_name_norm(r.name) = public.sva_name_norm(btrim(concat_ws(' ', k.vorname, k.nachname))));
  return v_res;
end;
$$;
revoke all on function public.sva_admin_fupa_fehlende() from public, anon;
grant  execute on function public.sva_admin_fupa_fehlende() to authenticated;
comment on function public.sva_admin_fupa_fehlende() is 'v23-U: FuPa-Kaderspieler ohne Website-Eintrag (Team/Admin).';

-- ── RPC: einen FuPa-Spieler als Platzhalter-Spieler anlegen (Admin) ──────────
create or replace function public.sva_admin_fupa_spieler_anlegen(p_fupa bigint)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_k    public.sva_fupa_kader;
  v_name text;
  v_base text;
  v_slug text;
  v_i    int := 2;
  v_id   uuid;
  v_sort int;
begin
  if not public.is_sm_admin() then
    raise exception 'nur_admin' using errcode = '42501';
  end if;
  select * into v_k from public.sva_fupa_kader where fupa_spieler_id = p_fupa;
  if v_k.fupa_spieler_id is null then
    raise exception 'fupa_spieler_unbekannt' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.sm_roster where fupa_spieler_id = p_fupa) then
    raise exception 'schon_angelegt' using errcode = 'P0001';
  end if;

  v_name := btrim(concat_ws(' ', v_k.vorname, v_k.nachname));
  if v_name = '' then raise exception 'kein_name' using errcode = 'P0001'; end if;

  -- Slug aus dem Nachnamen (Fallback: ganzer Name), eindeutig machen.
  v_base := 'p-' || btrim(regexp_replace(public.sva_name_norm(coalesce(nullif(v_k.nachname, ''), v_name)), '[^a-z0-9]+', '-', 'g'), '-');
  if v_base = 'p-' then v_base := 'p-fupa-' || p_fupa; end if;
  v_slug := v_base;
  while exists (select 1 from public.sm_roster where slug = v_slug) loop
    v_slug := v_base || '-' || v_i;
    v_i := v_i + 1;
  end loop;

  select coalesce(max(sortierung), 0) + 10 into v_sort from public.sm_roster;

  insert into public.sm_roster (slug, name, rolle, position, nummer, aktiv, sortierung, fupa_spieler_id)
  values (v_slug, v_name, 'spieler', 'MIT', v_k.nummer, true, v_sort, p_fupa)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'slug', v_slug, 'name', v_name);
end;
$$;
revoke all on function public.sva_admin_fupa_spieler_anlegen(bigint) from public, anon;
grant  execute on function public.sva_admin_fupa_spieler_anlegen(bigint) to authenticated;
comment on function public.sva_admin_fupa_spieler_anlegen(bigint) is 'v23-U: FuPa-Kaderspieler als Platzhalter-Spieler (ohne Foto) anlegen (nur Admin).';
