-- ─────────────────────────────────────────────────────────────────────────────
-- v20: Brücke Tipp-Liga → Sammelalbum für die MOTM-Karte.
-- Der Spielbericht der Tipp-Liga (Admin) ruft album_motm_karte_veroeffentlichen(spiel)
-- auf; das Kartensystem bietet album_admin_motm(roster, spiel, bild, tage).
-- Der Spieler des Spiels kommt aus sm_spiele.motm_roster_id (wird nach der
-- Instagram-Abstimmung im Admin eingetragen). Rechte prüft album_admin_motm
-- (sva_album_admin_pruefen). Nach 20261012110000_sva_karten.sql anwenden.
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.album_motm_karte_veroeffentlichen(p_spiel uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path to 'public', 'pg_temp'
as $$
declare
  v_roster uuid;
begin
  select s.motm_roster_id into v_roster from public.sm_spiele s where s.id = p_spiel;
  if v_roster is null then
    raise exception 'album_motm_fehlt' using errcode = 'P0001',
      hint = 'Erst den Spieler des Spiels im Spielbericht eintragen.';
  end if;
  return public.album_admin_motm(v_roster, p_spiel, null, null);
end;
$$;

comment on function public.album_motm_karte_veroeffentlichen(uuid) is
  'v20: MOTM-Spezialkarte aus dem Spielbericht der Tipp-Liga veröffentlichen (Brücke zu album_admin_motm).';

revoke all on function public.album_motm_karte_veroeffentlichen(uuid) from public, anon;
grant execute on function public.album_motm_karte_veroeffentlichen(uuid) to authenticated, service_role;
