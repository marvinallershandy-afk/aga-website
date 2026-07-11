-- BASELINE (dokumentierend): Stand der sm_-Objekte, wie sie bereits remote im
-- Supabase-Projekt fwiivwmoyagcdrjvhaou existieren (angelegt via MCP, vor der
-- Versionierung im Repo). Diese Migration NICHT erneut auf das bestehende
-- Projekt anwenden — sie dient Reproduzierbarkeit (frisches Projekt/Branch)
-- und Review. Alle Statements sind idempotent formuliert.

-- ── Admin-Whitelist ────────────────────────────────────────────────────────
create table if not exists public.sm_admins (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  created_at timestamptz not null default now()
);
alter table public.sm_admins enable row level security;

create or replace function public.is_sm_admin()
returns boolean
language sql stable security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.sm_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists sm_admins_self_select on public.sm_admins;
create policy sm_admins_self_select on public.sm_admins
  for select to authenticated
  using (lower(email) = lower(coalesce(auth.jwt() ->> 'email', '')));

-- ── Format-Bibliothek (wiederkehrende Ideen) ───────────────────────────────
create table if not exists public.sm_ideen_pool (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  beschreibung text,
  kanal text[] not null default '{}',
  kategorie text,
  rhythmus text,
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sm_ideen_pool enable row level security;

-- ── Redaktionsplan-Beiträge ────────────────────────────────────────────────
create table if not exists public.sm_content (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  beschreibung text,
  kanal text[] not null default '{}',
  status text not null default 'idee'
    check (status = any (array['idee','geplant','in_arbeit','fertig','veroeffentlicht'])),
  format text,
  kategorie text,
  geplant_am date,
  verantwortlich text,
  idee_id uuid references public.sm_ideen_pool(id),
  notizen text,
  hook text,
  caption text,
  cta text,
  sound text,
  drive_rohmaterial_url text,
  drive_asset_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on column public.sm_content.hook is 'Opener/Hook der ersten Sekunden';
comment on column public.sm_content.caption is 'Post-Caption (veröffentlichter Text)';
comment on column public.sm_content.cta is 'Call-to-Action';
comment on column public.sm_content.sound is 'Audio/Sound-Referenz';
comment on column public.sm_content.drive_rohmaterial_url is 'Deep-Link zum Drive-Rohmaterial-Ordner';
comment on column public.sm_content.drive_asset_url is 'Deep-Link zum fertigen Asset in Drive';
alter table public.sm_content enable row level security;

-- ── Ideen-Eingang (Team-Ideen, Triage) ─────────────────────────────────────
create table if not exists public.sm_ideen_eingang (
  id uuid primary key default gen_random_uuid(),
  titel text not null,
  beschreibung text,
  von text,
  kanal text[] not null default '{}',
  status text not null default 'offen'
    check (status = any (array['offen','geprueft','uebernommen','verworfen'])),
  content_id uuid references public.sm_content(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sm_ideen_eingang enable row level security;

-- ── Sponsoren (CRM) ────────────────────────────────────────────────────────
create table if not exists public.sm_sponsoren (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  paket text,
  laufzeit_von date,
  laufzeit_bis date,
  leistungen text,
  ansprechpartner text,
  kontakt text,
  logo_url text,
  aktiv boolean not null default true,
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sm_sponsoren enable row level security;

-- ── Einheitliche Admin-RLS für alle sm_-Datentabellen ─────────────────────
do $$
declare t text;
begin
  foreach t in array array['sm_content','sm_ideen_pool','sm_ideen_eingang','sm_sponsoren'] loop
    execute format('drop policy if exists %1$s_select on public.%1$s', t);
    execute format('create policy %1$s_select on public.%1$s for select to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_insert on public.%1$s', t);
    execute format('create policy %1$s_insert on public.%1$s for insert to authenticated with check (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_update on public.%1$s', t);
    execute format('create policy %1$s_update on public.%1$s for update to authenticated using (public.is_sm_admin())', t);
    execute format('drop policy if exists %1$s_delete on public.%1$s', t);
    execute format('create policy %1$s_delete on public.%1$s for delete to authenticated using (public.is_sm_admin())', t);
  end loop;
end $$;
