-- ─────────────────────────────────────────────────────────────────────────────
-- v25-B (Zeitplan): pg_cron ruft alle 10 min sva_tipp_auto_tick() — wertet jedes
-- beendete Pflichtspiel seit ≥ 30 min automatisch (vorläufig bis MOTM) und rechnet
-- bei MOTM-/Bericht-Änderung neu. Läuft komplett in SQL (kein HTTP, kein Secret) —
-- anders als der FuPa-Live-Cron braucht er weder pg_net noch Vault.
--
-- ⚠️ Reihenfolge: nach 20261018100000_sva_tipp_auto_wertung.sql.
--   pg_cron wird im Supabase-Dashboard (Database → Extensions) aktiviert.
-- OHNE diese Datei läuft alles andere normal weiter; nur die automatische Wertung
-- fehlt (der Admin kann weiter von Hand „Werten“). Abschalten pro Betrieb:
--   update public.sva_tipp_einstellungen set auto_wertung = false where id = 1;
-- Zeitplan entfernen:  select cron.unschedule('sva_tipp_auto_tick');
-- ─────────────────────────────────────────────────────────────────────────────

-- pg_cron wird im Dashboard aktiviert (globale Extension im geteilten Projekt).
-- Im PGlite-Test fehlt pg_cron → Fehler wird geschluckt, alles andere läuft weiter.
do $$
begin
  perform cron.schedule('sva_tipp_auto_tick', '*/10 * * * *', $q$select public.sva_tipp_auto_tick()$q$);
exception when others then
  raise notice 'pg_cron nicht verfügbar (ok im Test): %', sqlerrm;
end $$;

-- Zum Entfernen (falls nötig):
--   select cron.unschedule('sva_tipp_auto_tick');
