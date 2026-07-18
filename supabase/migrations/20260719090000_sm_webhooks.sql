-- P2 (Admin-Ausbau): Automationen produktiv machen.
-- Die Automationen-Seite hielt Webhook-URLs bisher NUR in localStorage
-- (pro Gerät, nicht team-weit sichtbar, nicht beobachtbar). Diese Migration
-- hebt sie in die Datenbank: eine Registry `sm_webhooks` (eine Zeile je
-- n8n-Andockpunkt/Event) plus ein Zustell-Log `sm_webhook_deliveries` als
-- Grundgerüst für die Beobachtbarkeit in der Admin-UI (letzter Versand/Status).
--
-- RLS 1:1 nach bestehendem sm_*-Muster (20260708000000_sm_baseline.sql /
-- 20260711020000_sm_insights.sql): nur is_sm_admin() darf lesen/schreiben.
--
-- NICHT auf prod anwenden ohne ausdrückliche Freigabe (Builder-Regel:
-- Migrationen entstehen als DATEIEN). Idempotent formuliert.

-- ── Webhook-Registry (eine Zeile je Event/Andockpunkt) ──────────────────────
create table if not exists public.sm_webhooks (
  id uuid primary key default gen_random_uuid(),
  event text not null unique,            -- z. B. 'beitrag.fertig', 'grafik.gerendert'
  url text,                               -- n8n-Webhook-Ziel (leer = noch nicht verbunden)
  aktiv boolean not null default true,
  letzter_versand timestamptz,            -- Zeitpunkt des letzten Versands (Test o. echt)
  letzter_status text,                    -- 'ok' | 'fehler' | HTTP-Code als Text
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.sm_webhooks is
  'Registry der n8n-Andockpunkte je Event. Ersetzt die frühere localStorage-Ablage.';
comment on column public.sm_webhooks.event is
  'Fachlicher Event-Schlüssel, deckt sich mit den Rezepten in Automationen.tsx (HOOKS).';
comment on column public.sm_webhooks.letzter_status is
  'Ergebnis des letzten Versands: no-cors → opake Antwort, daher "ok" = kein Netzwerkfehler.';
alter table public.sm_webhooks enable row level security;

-- ── Zustell-Log (Grundgerüst für die Beobachtbarkeit) ───────────────────────
create table if not exists public.sm_webhook_deliveries (
  id uuid primary key default gen_random_uuid(),
  webhook_id uuid references public.sm_webhooks(id) on delete cascade,
  event text not null,
  status text not null,                   -- 'ok' | 'fehler'
  http_code integer,                      -- bei no-cors null (opake Antwort)
  payload_excerpt text,                   -- gekürzter Payload zur Nachvollziehbarkeit
  gesendet_at timestamptz not null default now()
);
comment on table public.sm_webhook_deliveries is
  'Zustell-Log je Versand (Test + echt). Speist die "letzter Versand/Status"-Anzeige im Admin.';
create index if not exists sm_webhook_deliveries_webhook_id_idx
  on public.sm_webhook_deliveries (webhook_id, gesendet_at desc);
alter table public.sm_webhook_deliveries enable row level security;

-- ── Einheitliche Admin-RLS (nur is_sm_admin) ────────────────────────────────
do $$
declare t text;
begin
  foreach t in array array['sm_webhooks','sm_webhook_deliveries'] loop
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

-- ── Seed der bekannten Andockpunkte (idempotent, URL bleibt leer) ───────────
-- Deckt sich mit den Rezepten in src/admin/pages/Automationen.tsx (HOOKS).
-- 'spiel.angelegt' bewusst als Platzhalter: Trigger-Quelle sm_spiele ist
-- eingefroren (STAGE0 R1) → nach SME Stage 1 auf `matches` INSERT umziehen.
insert into public.sm_webhooks (event)
values
  ('beitrag.fertig'),
  ('spiel.angelegt'),
  ('insights.faellig'),
  ('grafik.gerendert')
on conflict (event) do nothing;
