-- Härtung (Security-Advisor): is_sm_admin ist SECURITY DEFINER und muss für
-- anonyme Aufrufer nicht erreichbar sein — sie wird nur in RLS-Policies und
-- von eingeloggten Admins (Drive-Bridge) genutzt.
revoke execute on function public.is_sm_admin() from anon;
