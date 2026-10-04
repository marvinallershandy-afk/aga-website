-- ─────────────────────────────────────────────────────────────────────────────
-- v14-C: Security-Härtung (Audit v14 §5).
--
-- 20260711030000 hat is_sm_admin() nur „from anon" entzogen. Postgres vergibt
-- EXECUTE auf neue Funktionen aber standardmäßig an PUBLIC — und darüber
-- erreicht anon die Funktion weiterhin. Korrekt ist „from public, anon" plus
-- ein expliziter Grant an die Rollen, die sie wirklich brauchen
-- (authenticated für RLS-Policies, service_role für Wartung).
--
-- WICHTIG: Ohne den Grant an authenticated würden alle RLS-Policies, die
-- is_sm_admin() aufrufen, für eingeloggte Admins fehlschlagen.
-- ─────────────────────────────────────────────────────────────────────────────

revoke execute on function public.is_sm_admin() from public, anon;
grant  execute on function public.is_sm_admin() to authenticated, service_role;

-- Admin-RPCs (security invoker, RLS greift ohnehin) — trotzdem nicht für anon.
revoke execute on function public.sm_spieltagspaket(uuid) from public, anon;
grant  execute on function public.sm_spieltagspaket(uuid) to authenticated, service_role;

revoke execute on function public.sm_eingang_into_plan(uuid, date) from public, anon;
grant  execute on function public.sm_eingang_into_plan(uuid, date) to authenticated, service_role;

-- Hilfsfunktion der Aufstellungs-Prüfregel: nur intern gebraucht.
revoke execute on function public.sva_array_distinct(uuid[]) from public, anon;
grant  execute on function public.sva_array_distinct(uuid[]) to authenticated, service_role;

-- web_snapshot() bleibt bewusst für anon ausführbar (öffentliche Lese-Schicht,
-- siehe 20261004101000_sva_web_snapshot.sql).
