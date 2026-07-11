-- Insights-Grundgerüst: wöchentlich manuell erfasste Kanal-KPIs
-- (bewusst ohne Meta/TikTok-API — die kann später dieselbe Tabelle füllen).
create table public.sm_insights (
  id uuid primary key default gen_random_uuid(),
  datum date not null,
  kanal text not null,
  follower integer,
  reichweite integer,
  top_beitrag text,
  notizen text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (datum, kanal)
);
alter table public.sm_insights enable row level security;

create policy sm_insights_select on public.sm_insights for select to authenticated using (public.is_sm_admin());
create policy sm_insights_insert on public.sm_insights for insert to authenticated with check (public.is_sm_admin());
create policy sm_insights_update on public.sm_insights for update to authenticated using (public.is_sm_admin());
create policy sm_insights_delete on public.sm_insights for delete to authenticated using (public.is_sm_admin());
