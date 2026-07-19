-- P1 (Admin-Ausbau, Copy-Teil): Sektionstexte der öffentlichen Website.
--
-- Unabhängig vom SME-Backfill (Kader/Spiele/Sponsoren) sind die Sektions-Texte
-- (Kicker/Titel/Body je Abschnitt) sofort im Cockpit pflegbar. Diese Tabelle
-- ist die Copy-Quelle; der Build-Fetch (scripts/fetch-content.mjs) liest sie und
-- der Website-Resolver (src/data/content.ts) überschreibt damit — pro Abschnitt
-- und NUR die Textfelder — die statischen Seeds aus src/data/club.ts (SECTIONS).
-- Reihenfolge und Abschnitts-IDs (Kamera-Stationen) bleiben aus dem statischen
-- Seed, damit unvollständige Pflege die 3D-Fahrt nicht bricht.
--
-- RLS 1:1 nach sm_*-Muster (nur is_sm_admin). NICHT auf prod anwenden
-- (Builder-Regel: Migrationen als DATEIEN). Idempotent formuliert.

create table if not exists public.sm_website_content (
  id uuid primary key default gen_random_uuid(),
  -- deckt sich mit Section.id in src/data/club.ts:
  -- 'verein' | 'mannschaft' | 'fanblock' | 'musik' | 'tabelle' | 'sponsoren' | 'kontakt'
  section_key text not null unique,
  label text,
  kicker text,
  titel text,
  body text,
  aktiv boolean not null default true,
  sortierung integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sm_website_content is
  'Sektionstexte der öffentlichen Website (Copy). Überschreibt beim Build die statischen SECTIONS-Seeds pro Abschnitt.';
alter table public.sm_website_content enable row level security;

create policy sm_website_content_select on public.sm_website_content for select to authenticated using (public.is_sm_admin());
create policy sm_website_content_insert on public.sm_website_content for insert to authenticated with check (public.is_sm_admin());
create policy sm_website_content_update on public.sm_website_content for update to authenticated using (public.is_sm_admin());
create policy sm_website_content_delete on public.sm_website_content for delete to authenticated using (public.is_sm_admin());
