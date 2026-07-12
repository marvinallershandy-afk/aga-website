-- Spieltag-Kern: Spiele + Kader als Datenherz des Admin-Cockpits.

create table public.sm_spiele (
  id uuid primary key default gen_random_uuid(),
  gegner text not null,
  heim boolean not null default true,
  anstoss timestamptz not null,
  ort text,
  wettbewerb text,
  spieltag_nr integer,
  tore_sva integer,
  tore_gegner integer,
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sm_spiele enable row level security;

create table public.sm_roster (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nummer integer,
  position text,
  foto_url text,
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  steckbrief jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sm_roster enable row level security;

do $$
declare t text;
begin
  foreach t in array array['sm_spiele','sm_roster'] loop
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_sm_admin())', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_sm_admin())', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_sm_admin())', t);
  end loop;
end $$;

-- Beiträge können jetzt an ein Spiel gekoppelt sein (Spieltagspaket, Grafiken).
alter table public.sm_content
  add column spiel_id uuid references public.sm_spiele(id) on delete set null;

-- Ein Klick → komplettes Spieltagspaket (4 Beiträge). Idempotent: existieren
-- bereits Beiträge zu diesem Spiel, werden diese zurückgegeben statt Duplikate
-- anzulegen.
create or replace function public.sm_spieltagspaket(p_spiel_id uuid)
returns setof public.sm_content
language plpgsql security invoker
set search_path to 'public'
as $$
declare
  v_spiel public.sm_spiele;
  v_paarung text;
  v_datum date;
begin
  select * into v_spiel from public.sm_spiele where id = p_spiel_id;
  if not found then
    raise exception 'Spiel % nicht gefunden', p_spiel_id;
  end if;

  if exists (select 1 from public.sm_content where spiel_id = p_spiel_id) then
    return query select * from public.sm_content where spiel_id = p_spiel_id order by geplant_am;
    return;
  end if;

  v_paarung := case when v_spiel.heim
    then 'SVA vs. ' || v_spiel.gegner
    else v_spiel.gegner || ' vs. SVA' end;
  v_datum := (v_spiel.anstoss at time zone 'Europe/Berlin')::date;

  return query
  insert into public.sm_content (titel, beschreibung, kanal, status, format, kategorie, geplant_am, spiel_id)
  values
    ('Spieltag-Ankündigung: ' || v_paarung,
     'Gegner, Anstoßzeit, Ort — Vorfreude wecken.',
     array['instagram','facebook','whatsapp'], 'geplant', 'Grafik', 'Spieltag', v_datum - 2, p_spiel_id),
    ('Startaufstellung: ' || v_paarung,
     'Aufstellungs-Grafik ~1h vor Anpfiff.',
     array['instagram','facebook'], 'geplant', 'Grafik', 'Spieltag', v_datum, p_spiel_id),
    ('Endergebnis: ' || v_paarung,
     'Ergebnis-Kachel direkt nach Abpfiff.',
     array['instagram','facebook','whatsapp'], 'geplant', 'Grafik', 'Spieltag', v_datum, p_spiel_id),
    ('Spieler des Spiels: ' || v_paarung,
     'MOTM küren — Abend nach dem Spiel.',
     array['instagram'], 'geplant', 'Grafik', 'Spieltag', v_datum + 1, p_spiel_id)
  returning *;
end;
$$;
